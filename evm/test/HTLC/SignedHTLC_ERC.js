const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto")
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");


describe("Signed ERC HTLC", () => {

    async function deployTokenFixture() {
        const contract = await ethers.deployContract("DummyToken", [ethers.parseEther('1000')])
        return { instance: contract, address: await contract.getAddress() }
    }

    it("should withdraw funds once the secret is valid for the hash and the hash is signed by the Archethic pool", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenFixture)
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
            amount,
            `0x${hash.toString('hex')}`,
            lockTime,
            archPoolSigner.address
        ])

        await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

        const signature = ethers.Signature.from(await archPoolSigner.signMessage(secret))

        await expect(
            HTLCInstance.withdraw(`0x${secret.toString('hex')}`, signature.r, signature.s, signature.v)
        )
        .to.changeTokenBalance(
            tokenInstance, 
            accounts[2].address, 
            amount
        )
    })

    it("should return an error if the signature is invalid", async () => {
        const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenFixture)
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
})
