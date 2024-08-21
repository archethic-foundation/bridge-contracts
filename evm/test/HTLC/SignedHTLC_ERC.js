const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto")
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { uintArrayToHex, hexToUintArray, concatUint8Arrays } = require("../utils")


describe("Signed ERC HTLC", () => {
    async function deployToken() {
        return doDeployToken("DummyToken")
    }

    async function deployTokenMintable() {
        return doDeployToken("DummyTokenMintable")
    }

    async function doDeployToken(implementation) {
        const contract = await ethers.deployContract(implementation, [
            ethers.parseEther("1000"),
        ]);
        return { instance: contract, address: await contract.getAddress() };
    }

    it("should withdraw funds once the secret is valid for the hash and the hash is signed by the Archethic pool with non mintable token", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployToken)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            false,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(secret))

        await expect(
            HTLCInstance.withdraw(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)
        ).to.changeTokenBalance(
            tokenInstance,
            accounts[2].address,
            amount
        )
    })

    it("should return an error if the signature is invalid", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployToken)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            false,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        await tokenInstance.transfer(HTLCInstance.getAddress(), amount)
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(randomBytes(32)))

        await expect(
            HTLCInstance.withdraw(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)
        )
            .to.be.revertedWithCustomError(HTLCInstance, "InvalidSignature")
    })

    it("should return an error if the signature is invalid for a refund", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployToken)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            false,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(randomBytes(32)))

        await expect(
            HTLCInstance.refund(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)
        )
            .to.be.revertedWithCustomError(HTLCInstance, "InvalidSignature")
    })

    it("should refund after the signature is checked with non mintable token", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployToken)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 1

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            false,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        const HTLCAddress = await HTLCInstance.getAddress()
        await tokenInstance.transfer(HTLCAddress, amount)

        const sigPayload = concatUint8Arrays([
            secret,
            new TextEncoder().encode("refund")
        ])
        const sigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(sigPayload2))

        await time.increaseTo(lockTime + 5)

        const tx = HTLCInstance.refund(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)

        await expect(tx).to.emit(HTLCInstance, "Refunded")
        await expect(tx).to.changeTokenBalances(tokenInstance, [HTLCAddress, accounts[0].address], [-amount, amount])
    })

    it("should withdraw funds once the secret is valid for the hash and the hash is signed by the Archethic pool with mintable token", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenMintable)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            true,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(secret))

        await expect(
            HTLCInstance.withdraw(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)
        ).to.changeTokenBalance(
            tokenInstance,
            accounts[2].address,
            amount
        )
    })

    it("should burn tokens after the signature is checked with mintable token", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenMintable)
        const archPoolSigner = ethers.Wallet.createRandom()
        const accounts = await ethers.getSigners()

        const secret = randomBytes(32)

        const hash = createHash("sha256").update(secret).digest()

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 1

        const amount = ethers.parseEther("1.0")

        const HTLCInstance = await ethers.deployContract("SignedHTLC_ERC", [
            accounts[2].address,
            tokenAddress,
            true,
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        const HTLCAddress = await HTLCInstance.getAddress()
        await tokenInstance.transfer(HTLCAddress, amount)

        const sigPayload = concatUint8Arrays([secret, new TextEncoder().encode("refund")])
        const sigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(sigPayload2))

        await time.increaseTo(lockTime + 5)

        const tx = HTLCInstance.refund(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)

        await expect(tx).to.emit(HTLCInstance, "Refunded")
        await expect(tx).to.changeTokenBalances(tokenInstance, [HTLCAddress, accounts[0].address], [-amount, 0])
        await expect(tx).to.emit(tokenInstance, "Transfer").withArgs(HTLCAddress, ethers.ZeroAddress, amount)
    })
})
