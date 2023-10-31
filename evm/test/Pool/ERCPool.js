const { network: { config: networkConfig } } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai")

const { hexToUintArray, concatUint8Arrays, uintArrayToHex } = require("../utils")

describe("ERC LiquidityPool", () => {

    async function deployPool() {
        const token = await ethers.deployContract("DummyToken", [ethers.parseEther('1000')])
        const accounts = await ethers.getSigners()
        const archPoolSigner = ethers.Wallet.createRandom()

        const pool = await ethers.deployContract("ERCPool")
        await pool.initialize(
            accounts[4].address,
            accounts[3].address,
            5,
            archPoolSigner.address,
            ethers.parseEther("2.0"),
            60,
            await token.getAddress()
        )

        return {
            pool,
            archPoolSigner,
            accounts,
            tokenInstance: token,
            tokenAddress: await token.getAddress()
        }
    }
    it("should create contract", async () => {
        const { pool, accounts, archPoolSigner, tokenAddress } = await loadFixture(deployPool)

        expect(await pool.reserveAddress()).to.equal(accounts[4].address)
        expect(await pool.safetyModuleAddress()).to.equal(accounts[3].address)
        expect(await pool.safetyModuleFeeRate()).to.equal(500)
        expect(await pool.archethicPoolSigner()).to.equal(archPoolSigner.address)
        expect(await pool.poolCap()).to.equal(ethers.parseEther('2'))
        expect(await pool.locked()).to.be.false
        expect(await pool.token()).to.equal(tokenAddress)
        expect(await pool.lockTimePeriod()).to.equal(60)
    })

    it("should update token", async () => {
        const { pool } = await loadFixture(deployPool)

        const anotherToken = await ethers.deployContract("DummyToken", [ethers.parseEther('2000000')])
        const anotherTokenAddress = await anotherToken.getAddress()

        expect(await pool.setToken(anotherTokenAddress))
            .to.emit(pool, "TokenChanged").withArgs(anotherTokenAddress)

        expect(await pool.token()).to.equal(anotherTokenAddress)
    })

    it("should create HTLC and provision ERC20 to the HTLC contract after verifying the signature", async () => {
        const { pool, tokenInstance, archPoolSigner, accounts } = await loadFixture(deployPool)

        await tokenInstance.transfer(await pool.getAddress(), ethers.parseEther("2"))

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
            .to.changeTokenBalance(tokenInstance, htlcAddress, ethers.parseEther("1"))

        const HTLCInstance = await ethers.getContractAt("SignedHTLC_ERC", htlcAddress)
        expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)
        expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        expect(await HTLCInstance.recipient()).to.equal(accounts[0].address);
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
        expect(await HTLCInstance.lockTime()).to.equal(lockTime)
        expect(await HTLCInstance.token()).to.equal(await tokenInstance.getAddress())
        expect(await HTLCInstance.from()).to.equal(await pool.getAddress())
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
        const { pool, tokenAddress, accounts } = await loadFixture(deployPool)

        const amount = ethers.parseEther('3')
        const tx = pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount)
        await tx

        await expect(tx)
            .to.emit(pool, "ContractMinted")

        const htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ERC", htlcAddress)

        expect(await HTLCInstance.safetyModuleAddress()).to.equal(await pool.safetyModuleAddress())
        expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        expect(await HTLCInstance.recipient()).to.equal(await pool.reserveAddress());
        expect(await HTLCInstance.withdrawAmount()).to.equal(ethers.parseEther('0.985'))
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('2.985'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0.015'))
        expect(await HTLCInstance.refillAmount()).to.equal(ethers.parseEther('2.0'))
        expect(await HTLCInstance.token()).to.equal(tokenAddress)
        expect(await HTLCInstance.from()).to.equal(accounts[0].address)

        const lockTime = await HTLCInstance.lockTime()
        const nowTimestamp = Math.floor(date.getTime() / 1000)
        const roundedTimestamp = nowTimestamp - (nowTimestamp % 60)

        expect(ethers.toBigInt(lockTime) - ethers.toBigInt(roundedTimestamp) >= 60).to.be.true
    })

    it("should mint and send funds to the HTLC contract with fee handling low decimals", async () => {
        const { pool } = await loadFixture(deployPool)

        let amount = ethers.parseEther('0.000001')
        let tx = await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", amount)

        await expect(tx).to.emit(pool, "ContractMinted")

        let htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        let HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ERC", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.000001'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0'))
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
        expect(await HTLCInstance.refillAmount()).to.equal(0)

    //     amount = ethers.parseEther('0.00001')
    //     tx = await pool.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09", amount)

    //     await expect(tx).to.emit(pool, "ContractMinted")

    //     htlcAddress = await pool.mintedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a09")
    //     HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ERC", htlcAddress)

    //     expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.00000995'))
    //     expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0.00000005'))
    //     expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
    //     expect(await HTLCInstance.refillAmount()).to.equal(0)
    })
})

