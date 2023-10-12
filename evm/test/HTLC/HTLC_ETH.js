const hre = require("hardhat");

const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { createHash, randomBytes } = require("crypto")
const { expect } = require("chai")

describe("ETH HTLC", () => {

  it("should create contract", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2].address

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      ethers.parseEther("1.0"),
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      lockTime,
      false,
    ], { value: ethers.parseEther("1.0") })

    expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
    expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    expect(await HTLCInstance.recipient()).to.equal(recipientEthereum)
    expect(await HTLCInstance.finished()).to.be.false
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)

    expect(await ethers.provider.getBalance(await HTLCInstance.getAddress()))
      .to.equal(ethers.parseEther("1.0"))
  })

  it("should withdraw the funds with the hash preimage reveal", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })

    const tx = HTLCInstance
      .connect(accounts[3])
      .withdraw(`0x${secret.toString('hex')}`)

      await expect(tx).to.changeEtherBalance(
        recipientEthereum, 
        amount
      )
      await expect(tx).to.emit(HTLCInstance, "Withdrawn")

      expect(await HTLCInstance.finished()).to.be.true
  })

  it("should refuse the contract creation if the contract doesn't get the right funds", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const contract = await ethers.getContractFactory("HTLC_ETH")

    await expect(ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ]))
    .to.be.revertedWithCustomError(contract, "ContractNotProvisioned")
  })

  it("should refuse the withdraw is the swap is already done", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })

    HTLCInstance.withdraw(`0x${secret.toString('hex')}`)

    await expect(
      HTLCInstance.withdraw(`0x${secret.toString('hex')}`)
    )
    .to.be.revertedWithCustomError(HTLCInstance, "AlreadyFinished")
  })

  it("should refuse the withdraw is secret is invalid", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })

    await expect(
      HTLCInstance.withdraw(`0x${randomBytes(32).toString('hex')}`)
    )
    .to.be.revertedWithCustomError(HTLCInstance, "InvalidSecret")
  })

  it("should refuse the withdraw if the locktime passed", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 1

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })
   
    time.increaseTo(lockTime + 5)

    await expect(HTLCInstance.withdraw(`0x${secret.toString('hex')}`))
      .to.be.revertedWithCustomError(HTLCInstance, "TooLate")
  })

  it("should refund the owner after the lock time", async () => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 1

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })
    
    expect(await HTLCInstance.canRefund(lockTime + 5)).to.be.true

    time.increaseTo(lockTime + 5)
    const tx = HTLCInstance.refund()

    await expect(tx).to.changeEtherBalance(
      accounts[0], 
      amount
    )
    await expect(tx).to.emit(HTLCInstance, "Refunded")

    expect(await HTLCInstance.finished()).to.be.true
  })

  it ("should return an error if the swap is already finished", async() => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 1

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      lockTime,
      false,
    ], { value: amount })

    time.increaseTo(lockTime + 5)
    await HTLCInstance.refund()

    await expect(HTLCInstance.refund())
      .to.be.revertedWithCustomError(HTLCInstance, "AlreadyFinished")
  })

  it ("should return an error if the lock time is not reached", async() => {
    const accounts = await ethers.getSigners()
    const recipientEthereum = accounts[2]

    const amount = ethers.parseEther('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const previousBlockTimestamp = await time.latest()

    const HTLCInstance = await ethers.deployContract("HTLC_ETH", [
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      previousBlockTimestamp + 10,
      false,
    ], { value: amount })

    const now = new Date()
    const secondUNIX = Math.floor(now.getTime() / 1000)

    expect(await HTLCInstance.canRefund(secondUNIX)).to.be.false

    await expect(HTLCInstance.refund())
      .to.be.revertedWithCustomError(HTLCInstance, "TooEarly")
  })
})