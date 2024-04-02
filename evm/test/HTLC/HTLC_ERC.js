const hre = require("hardhat");

const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { createHash, randomBytes } = require("crypto")
const { expect } = require("chai")

describe("ERC HTLC", (accounts) => {

  async function deployTokenFixture() {
    const contract = await ethers.deployContract("DummyToken", [ethers.parseEther('1000')])
    return { instance: contract, address: await contract.getAddress() }
  }

  it("should create contract", async () => {
    const { address: tokenAddress } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("HTLC_ERC", [
      recipientEthereum,
      tokenAddress,
      ethers.parseEther("1.0"),
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      lockTime
    ])

    expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
    expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    expect(await HTLCInstance.recipient()).to.equal(recipientEthereum)
    expect(await HTLCInstance.status()).to.equal(0)
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)
    expect(await HTLCInstance.token()).to.equal(tokenAddress)
  })

  it("should withdraw the funds with the hash preimage reveal", async () => {
    const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const amount = ethers.parseEther("1.0")

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await ethers.deployContract("HTLC_ERC", [
      recipientEthereum,
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime
    ])

    await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

    const tx = HTLCInstance.withdraw(`0x${secret.toString('hex')}`)

    await expect(tx).to.changeTokenBalance(
      tokenInstance,
      recipientEthereum, 
      amount
    )

    await expect(tx).to.emit(HTLCInstance, "Withdrawn")
  })

  it("should refuse the withdraw if the contract doesn't get funds", async () => {
    const { address: tokenAddress } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const amount = ethers.parseEther("1.0")

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await ethers.deployContract("HTLC_ERC", [
      recipientEthereum,
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime
    ])

    await expect(
      HTLCInstance.withdraw(`0x${secret.toString('hex')}`)
    )
    .to.be.revertedWithCustomError(HTLCInstance, "InsufficientFunds")
  })

  it("should refund the owner after the lock time", async () => {
    const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const amount = ethers.parseEther("1.0")

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await ethers.deployContract("HTLC_ERC", [
      recipientEthereum,
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime
    ])

    await tokenInstance.transfer(HTLCInstance.getAddress(), amount)

    expect(await HTLCInstance.canRefund(lockTime + 5)).to.be.true

    time.increaseTo(lockTime + 5)
    const tx = HTLCInstance.refund()

    await expect(tx).to.changeTokenBalance(
      tokenInstance,
      accounts[0], 
      amount
    )
    await expect(tx).to.emit(HTLCInstance, "Refunded")

    expect(await HTLCInstance.status()).to.equal(2)
  })

  it ("should return an error if contract doesn't get funds", async() => {
    const { address: tokenAddress, instance: tokenInstance } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const amount = ethers.parseEther("1.0")

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await ethers.deployContract("HTLC_ERC", [
      recipientEthereum,
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime
    ])


    time.increaseTo(lockTime + 5)

    await expect(
      HTLCInstance.refund()
    )
    .to.be.revertedWithCustomError(HTLCInstance, "InsufficientFunds")
  })
})