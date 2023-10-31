const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto")
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("Chargeable ERC HTLC",() => {

  async function deployTokenFixture() {
    const contract = await ethers.deployContract("DummyToken", [ethers.parseEther('1000')])
    return { instance: contract, address: await contract.getAddress() }
  }

  it("should create contract and associated recipient and fee", async () => {
    const { address: tokenAddress } = await loadFixture(deployTokenFixture);

    const accounts = await ethers.getSigners()
    const satefyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address

    const amount = ethers.parseEther("0.990")
    const fee = ethers.parseEther("0.005")
    const refillAmount = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      amount,
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      lockTime,
      reserveAddress,
      satefyModuleAddress,
      fee,
      refillAmount
    ])

    expect(await HTLCInstance.amount()).to.equal(amount + refillAmount)
    expect(await HTLCInstance.withdrawAmount()).to.equal(amount)
    expect(await HTLCInstance.fee()).to.equal(fee)
    expect(await HTLCInstance.refillAmount()).to.equal(refillAmount)
    expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    expect(await HTLCInstance.token()).to.equal(await tokenAddress)
    expect(await HTLCInstance.recipient()).to.equal(reserveAddress)
    expect(await HTLCInstance.status()).to.equal(0)
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)
  })

  it("withdraw should send tokens to the reserve address and fee to the safety module", async() => {
    const { instance: tokenInstance, address: tokenAddress } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const satefyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address
    
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = ethers.parseEther("0.990")
    const fee = ethers.parseEther("0.005")
    const refillAmount = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime,
      reserveAddress,
      satefyModuleAddress,
      fee,
      refillAmount
    ])

    await tokenInstance.transfer(HTLCInstance.getAddress(), ethers.parseEther("1.0"))

    await expect(HTLCInstance
      .connect(accounts[2])
      .withdraw(`0x${secret.toString('hex')}`)
    )
    .to.changeTokenBalances(tokenInstance, 
      [satefyModuleAddress, reserveAddress, accounts[0], await HTLCInstance.getAddress()], 
      [ethers.parseEther('0.005'), ethers.parseEther('0.990'), ethers.parseEther('0.005'), -ethers.parseEther("1.0")]
    )
  })

  it("refund should send back tokens to the owner", async() => {
    const { instance: tokenInstance, address: tokenAddress } = await loadFixture(deployTokenFixture);
    const accounts = await ethers.getSigners()

    const satefyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = ethers.parseEther("0.990")
    const fee = ethers.parseEther("0.005")
    const refillAmount = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 1

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ERC", [
      tokenAddress,
      amount,
      `0x${secretHash}`,
      lockTime,
      reserveAddress,
      satefyModuleAddress,
      fee,
      refillAmount
    ])

    await tokenInstance.transfer(HTLCInstance.getAddress(), ethers.parseEther("1.0"))
    await time.increaseTo(lockTime + 5);

    expect(await HTLCInstance.refund())
      .to
      .changeTokenBalance(tokenInstance, accounts[0].address, ethers.parseEther('1.0'))
  })
})