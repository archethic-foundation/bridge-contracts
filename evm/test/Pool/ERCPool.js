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
            archPoolSigner.address,
            60,
            await token.getAddress(),
            accounts[0].address
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
        const { pool, archPoolSigner, tokenAddress } = await loadFixture(deployPool)

        expect(await pool.archethicPoolSigner()).to.equal(archPoolSigner.address)
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

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()
        const amount = ethers.parseEther('1');

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address", "uint"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress, amount])

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

        await expect(tx)
            .to.changeTokenBalance(tokenInstance, htlcAddress, ethers.parseEther("1"))

        const HTLCInstance = await ethers.getContractAt("SignedHTLC_ERC", htlcAddress)
        expect(await HTLCInstance.poolSigner()).to.equal(archPoolSigner.address)
        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(accounts[0].address);
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
        expect(await HTLCInstance.lockTime()).to.equal(lockTime)
        expect(await HTLCInstance.token()).to.equal(await tokenInstance.getAddress())
        expect(await HTLCInstance.from()).to.equal(await pool.getAddress())
    })

    it("should return an error when the pool doesn't have enough funds to provide HTLC contract", async () => {
        const { pool, archPoolSigner, accounts } = await loadFixture(deployPool)

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()
        const amount = ethers.parseEther("1.0")

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address", "uint"], [
          archethicHtlcAddressHash,
          "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
          networkConfig.chainId,
          senderAddress,
          amount
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await expect(pool.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            amount,
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
        const { pool, tokenAddress, tokenInstance, accounts } = await loadFixture(deployPool)

        const amount = ethers.parseEther('3')
        await tokenInstance.approve(await pool.getAddress(), amount)

        const tx = pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount)
        await tx

        await expect(tx)
            .to.emit(pool, "ContractMinted")

        const htlcAddress = await pool.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ERC", htlcAddress)

        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress());
        expect(await HTLCInstance.amount()).to.equal(amount)
        expect(await HTLCInstance.token()).to.equal(tokenAddress)
        expect(await HTLCInstance.from()).to.equal(accounts[0].address)
        expect(await tokenInstance.balanceOf(await HTLCInstance.getAddress())).to.equal(amount)

        const lockTime = await HTLCInstance.lockTime()
        const nowTimestamp = Math.floor(date.getTime() / 1000)
        const roundedTimestamp = nowTimestamp - (nowTimestamp % 60)

        expect(ethers.toBigInt(lockTime) - ethers.toBigInt(roundedTimestamp) >= 60).to.be.true
    })

    it("should mint and send funds to the HTLC contract with fee handling low decimals", async () => {
        const { pool, tokenInstance } = await loadFixture(deployPool)

        let amount = ethers.parseEther('0.000001')
        await tokenInstance.approve(await pool.getAddress(), amount)
        let tx = await pool.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount)

        await expect(tx).to.emit(pool, "ContractMinted")

        let htlcAddress = await pool.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        let HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ERC", htlcAddress)

        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.000001'))
        expect(await HTLCInstance.recipient()).to.equal(await pool.getAddress())
        expect(await tokenInstance.balanceOf(await HTLCInstance.getAddress())).to.equal(amount)
    })
})
