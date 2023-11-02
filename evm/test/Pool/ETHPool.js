const { network: { config: networkConfig } } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { randomBytes } = require("crypto")
const { hexToUintArray, concatUint8Arrays, uintArrayToHex } = require("../utils")

const { expect } = require("chai")

describe("ETH LiquidityPool", () => {

    async function deployPool() {
        const accounts = await ethers.getSigners()
        const archPoolSigner = ethers.Wallet.createRandom()

        const pool = await ethers.deployContract("ETHPool")
        await pool.initialize(
            accounts[4].address,
            accounts[3].address,
            5,
            archPoolSigner.address,
            ethers.parseEther("2.0"),
            60
        )

        return { pool, archPoolSigner, accounts }
    }

    it("should create contract", async () => {
        const { pool, accounts, archPoolSigner } = await loadFixture(deployPool)

        expect(await pool.reserveAddress()).to.equal(accounts[4].address)
        expect(await pool.safetyModuleAddress()).to.equal(accounts[3].address)
        expect(await pool.safetyModuleFeeRate()).to.equal(500)
        expect(await pool.archethicPoolSigner()).to.equal(archPoolSigner.address)
        expect(await pool.poolCap()).to.equal(ethers.parseEther('2.0'))
        expect(await pool.locked()).to.be.false
        expect(await pool.lockTimePeriod()).to.equal(60)
    })

    it("should update the reserve address", async () => {
        const { pool, accounts } = await loadFixture(deployPool)

        const tx = pool.setReserveAddress(accounts[8].address)

        await expect(tx).to.emit(pool, "ReserveAddressChanged").withArgs(accounts[8].address)
        expect(await pool.reserveAddress()).to.equal(accounts[8].address)
    })

    it("should update the safety module address", async () => {
        const { pool, accounts } = await loadFixture(deployPool)

        const tx = pool.setSafetyModuleAddress(accounts[8].address)

        await expect(tx).to.emit(pool, "SafetyModuleAddressChanged").withArgs(accounts[8].address)
        expect(await pool.safetyModuleAddress()).to.equal(accounts[8].address)
    })

    it("should update the safety module fee", async () => {
        const { pool } = await loadFixture(deployPool)

        const tx = pool.setSafetyModuleFeeRate(10)

        await expect(tx).to.emit(pool, "SafetyModuleFeeRateChanged").withArgs(10)
        expect(await pool.safetyModuleFeeRate()).to.equal(1000)
    })

    it("should update the archethic pool signer address", async () => {
        const { pool } = await loadFixture(deployPool)

        const signer = ethers.Wallet.createRandom()
        const tx = pool.setArchethicPoolSigner(signer.address)

        await expect(tx).to.emit(pool, "ArchethicPoolSignerChanged").withArgs(signer.address)
        expect(await pool.archethicPoolSigner()).to.equal(signer.address)
    })

    it("should update the pool cap", async () => {
        const { pool } = await loadFixture(deployPool)

        const tx = pool.setPoolCap(50000)

        await expect(tx).to.emit(pool, "PoolCapChanged").withArgs(50000)
        expect(await pool.poolCap()).to.equal(50000)
    })

    it("should lock pool", async () => {
        const { pool } = await loadFixture(deployPool)

        const tx = pool.lock()

        await expect(tx).to.emit(pool, "Lock")
        expect(await pool.locked()).to.be.true
    })

    it("should lock pool", async () => {
        const { pool } = await loadFixture(deployPool)

        await pool.lock()
        const tx = pool.unlock()

        await expect(tx).to.emit(pool, "Unlock")
        expect(await pool.locked()).to.be.false
    })

    it("should update owner", async () => {
        const { pool, accounts } = await loadFixture(deployPool)

        await pool.transferOwnership(accounts[3].address)
        await pool
            .connect(accounts[3])
            .acceptOwnership()

        expect(await pool.owner()).to.equal(accounts[3].address)
    })

    it("should update locktime period", async () => {
        const { pool } = await loadFixture(deployPool)

        const tx = pool.setLockTimePeriod(1000)
        await expect(tx).to.emit(pool, "LockTimePeriodChanged").withArgs(1000)
        expect(await pool.lockTimePeriod()).to.equal(1000)
    })

    it("should deploy and provision HTLC contract after verifying the signature", async () => {
        const { pool, accounts, archPoolSigner } = await loadFixture(deployPool)

        await accounts[1].sendTransaction({
            to: pool.getAddress(),
            value: ethers.parseEther("2.0"),
        });

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const tx = pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        )

        await expect(tx).to.emit(pool, "ContractProvisioned")

        const htlcAddress = await pool.provisionedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")

        await expect(tx)
            .to.changeEtherBalance(htlcAddress, ethers.parseEther("1"))

        const HTLCInstance = await ethers.getContractAt("SignedHTLC_ETH", htlcAddress)
        expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)
        expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        expect(await HTLCInstance.recipient()).to.equal(accounts[0].address);
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
        expect(await HTLCInstance.lockTime()).to.equal(lockTime)
        expect(await HTLCInstance.from()).to.equal(await pool.getAddress())
    })

    it("should return an error if a swap's provision is requested with the pool is locked", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        await pool.lock()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWith("Locked")
    })

    it("should return an error if a swap's provision is requested with an invalid hash", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidHash")
    })

    it("should return an error if a swap's provision is requested with an invalid amount", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('0'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidAmount")
    })

    it("should return an error if a swap's provision is requested with an invalid locktime", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            0,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidLockTime")

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            await time.latest() - 10, // Before the latest block
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidLockTime")

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            await time.latest() + 90000, // More than 1 day from the latest block
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidLockTime")
    })

    it("should return an error an already provisioned hash contract is requested", async () => {
        const { pool, accounts, archPoolSigner } = await loadFixture(deployPool)

        await accounts[1].sendTransaction({
            to: pool.getAddress(),
            value: ethers.parseEther("2.0"),
        });

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        )

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "AlreadyProvisioned")
    })

    it("should return an error when the signature is invalid", async () => {
        const { pool, accounts, archPoolSigner } = await loadFixture(deployPool)

        await accounts[1].sendTransaction({
            to: pool.getAddress(),
            value: ethers.parseEther("2.0"),
        });

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(randomBytes(32)))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidSignature")
    })

    it("should return an error when the pool doesn't have enough funds to provide HTLC contract", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await expect(pool.provisionHTLC(
            "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
            ethers.parseEther('1'),
            lockTime,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InsufficientFunds")
    })

    it("should mint and send funds to the HTLC contract with fee integration", async () => {
        const date = new Date()
        const { pool, accounts } = await loadFixture(deployPool)

        const amount = ethers.parseEther('3')
        const tx = pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount, { value: amount })
        await tx

        await expect(tx)
            .to.emit(pool, "ContractMinted")

        const htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.safetyModuleAddress()).to.equal(await pool.safetyModuleAddress())
        expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        expect(await HTLCInstance.recipient()).to.equal(await pool.reserveAddress());
        expect(await HTLCInstance.withdrawAmount()).to.equal(ethers.parseEther('0.985'))
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('2.985'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0.015'))
        expect(await HTLCInstance.from()).to.equal(accounts[0].address)
        expect(await HTLCInstance.refillAmount()).to.equal(ethers.parseEther('2.0'))
        expect(await HTLCInstance.refillAddress()).to.equal(await pool.getAddress())

        const lockTime = await HTLCInstance.lockTime()
        const nowTimestamp = Math.floor(date.getTime() / 1000)
        const roundedTimestamp = nowTimestamp - (nowTimestamp % 60)

        expect(ethers.toBigInt(lockTime) - ethers.toBigInt(roundedTimestamp) >= 60).to.be.true
    })

    it("should mint and send funds to the HTLC contract with fee handling low decimals", async () => {
        const { pool } = await loadFixture(deployPool)

        let amount = ethers.parseEther('0.000001')
        let tx = await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount, { value: amount })

        await expect(tx).to.emit(pool, "ContractMinted")

        let htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        let HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.000001'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0'))
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
        expect(await HTLCInstance.refillAmount()).to.equal(0)

        amount = ethers.parseEther('0.00001')
        tx = await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09", amount, { value: amount })

        await expect(tx).to.emit(pool, "ContractMinted")

        htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09")
        HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.00000995'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0.00000005'))
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
        expect(await HTLCInstance.refillAmount()).to.equal(0)
    })

    it("should return an error if the sender does not provision the contract", async () => {
        const { pool } = await loadFixture(deployPool)

        await expect(
            pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", ethers.parseEther('100000'))
        )
            .to.be.revertedWithCustomError(pool, "ContractNotProvisioned")
    })

    it("should return an error if a swap with this hash is already existing", async () => {
        const { pool } = await loadFixture(deployPool)

        const amount = ethers.parseEther('1')
        await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount, { value: amount })

        await expect(
            pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount, { value: amount })
        )
            .to.be.revertedWithCustomError(pool, "AlreadyMinted")
    })

    it("should return an error if a swap is requested with an invalid hash", async () => {
        const { pool } = await loadFixture(deployPool)

        const amount = ethers.parseEther('1')
        await expect(pool.mintHTLC("0x0000000000000000000000000000000000000000000000000000000000000000", amount, { value: amount }))
            .to.be.revertedWithCustomError(pool, "InvalidHash")
    })

    it("should return an error if a swap is requested with an invalid amount", async () => {
        const { pool } = await loadFixture(deployPool)

        const amount = ethers.parseEther('0')
        await expect(pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount, { value: amount }))
            .to.be.revertedWithCustomError(pool, "InvalidAmount")
    })
})

