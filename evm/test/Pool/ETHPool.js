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
            archPoolSigner.address,
            60,
            accounts[0].address
        )

        return { pool, archPoolSigner, accounts }
    }

    it("should create contract", async () => {
        const { pool, archPoolSigner } = await loadFixture(deployPool)

        expect(await pool.archethicPoolSigner()).to.equal(archPoolSigner.address)
        expect(await pool.locked()).to.be.false
        expect(await pool.lockTimePeriod()).to.equal(60)
    })

    it("should update the archethic pool signer address", async () => {
        const { pool } = await loadFixture(deployPool)

        const signer = ethers.Wallet.createRandom()
        const tx = pool.setArchethicPoolSigner(signer.address)

        await expect(tx).to.emit(pool, "ArchethicPoolSignerChanged").withArgs(signer.address)
        expect(await pool.archethicPoolSigner()).to.equal(signer.address)
    })

    it("should lock pool", async () => {
        const { pool } = await loadFixture(deployPool)

        const tx = pool.lock()

        await expect(tx).to.emit(pool, "Lock")
        expect(await pool.locked()).to.be.true
    })

    it("should unlock pool", async () => {
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

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const tx = pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        )

        await expect(tx).to.emit(pool, "ContractProvisioned")

        const htlcAddress = await pool.provisionedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        const provisionedSwaps = await pool.getSwapsByOwner(accounts[0].address)
        expect(provisionedSwaps[0][0]).to.equal(htlcAddress)
        expect(provisionedSwaps[0][1]).to.equal(`0x${archethicHtlcAddress}`)
        expect(provisionedSwaps[0][2]).to.equal(1)

        await expect(tx)
            .to.changeEtherBalance(htlcAddress, ethers.parseEther("1"))

        const HTLCInstance = await ethers.getContractAt("SignedHTLC_ETH", htlcAddress)
        expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)
        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
        expect(await HTLCInstance.lockTime()).to.equal(lockTime)
        expect(await HTLCInstance.from()).to.equal(await pool.getAddress())
    })

    it("should return an error if a swap's provision is requested with the pool is locked", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        await pool.lock()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWith("Locked")
    })

    it("should return an error if a swap's provision is requested with an invalid hash", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidHash")
    })

    it("should return an error if a swap's provision is requested with an invalid amount", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('0'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidAmount")
    })

    it("should return an error if a swap's provision is requested with an invalid locktime", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            0,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidLockTime")

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            await time.latest() - 10, // Before the latest block
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidLockTime")

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            await time.latest() + 90000, // More than 1 day from the latest block
            `0x${archethicHtlcAddress}`,
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

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        )

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
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

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(randomBytes(32)))
        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InvalidSignature")
    })

    it("should return an error when the pool doesn't have enough funds to provide HTLC contract", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther('1'),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v
        ))
            .to.be.revertedWithCustomError(pool, "InsufficientFunds")
    })

    it("should mint and send funds to the HTLC contract", async () => {
        const date = new Date()
        const { pool, accounts } = await loadFixture(deployPool)

        const amount = ethers.parseEther('3')
        const tx = pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount })
        await tx

        await expect(tx)
            .to.emit(pool, "ContractMinted")

        const htlcAddress = await pool.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress());
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('3.0'))
        expect(await HTLCInstance.from()).to.equal(accounts[0].address)

        const lockTime = await HTLCInstance.lockTime()
        const nowTimestamp = Math.floor(date.getTime() / 1000)
        const roundedTimestamp = nowTimestamp - (nowTimestamp % 60)

        expect(ethers.toBigInt(lockTime) - ethers.toBigInt(roundedTimestamp) >= 60).to.be.true

        const swaps = await pool.getSwapsByOwner(accounts[0].address)
        expect(swaps[0][0]).to.equal(htlcAddress)
        expect(swaps[0][1]).to.equal("0x")
        expect(swaps[0][2]).to.equal(0)
    })

    it("should mint and send funds to the HTLC contract handling low decimals", async () => {
        const { pool } = await loadFixture(deployPool)

        let amount = ethers.parseEther('0.000001')
        let tx = await pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount })

        await expect(tx).to.emit(pool, "ContractMinted")

        let htlcAddress = await pool.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        let HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.000001'))
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())

        amount = ethers.parseEther('0.00001')
        tx = await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09", amount, { value: amount })

        await expect(tx).to.emit(pool, "ContractMinted")

        htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09")
        HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(amount)
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
    })

    it("should return an error if the sender does not provision the contract", async () => {
        const { pool } = await loadFixture(deployPool)

        await expect(
            pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", ethers.parseEther('100000'))
        )
            .to.be.revertedWithCustomError(pool, "ContractNotProvisioned")
    })

    it("should return an error if a swap with this hash is already existing", async () => {
        const { pool } = await loadFixture(deployPool)

        const amount = ethers.parseEther('1')
        await pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount })

        await expect(
            pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount })
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
        await expect(pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount }))
            .to.be.revertedWithCustomError(pool, "InvalidAmount")
    })
})
