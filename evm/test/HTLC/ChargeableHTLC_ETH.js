const hre = require("hardhat");
const { createHash, randomBytes } = require("crypto")
const { expect } = require("chai");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Chargeable ETH HTLC", () => {

  it("should create contract and associated recipient and fee", async () => {
    const accounts = await ethers.getSigners()
    const satefyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address

    const amount = ethers.parseEther("0.995")
    const fee = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60
 
    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ETH", [
      amount,
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      lockTime,
      reserveAddress,
      satefyModuleAddress,
      fee,
      accounts[5].address
    ], { value: ethers.parseEther("1.0") })

    expect(await HTLCInstance.amount()).to.equal(amount)
    expect(await HTLCInstance.fee()).to.equal(fee)
    expect(await HTLCInstance.hash()).to.equal("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    expect(await HTLCInstance.recipient()).to.equal(reserveAddress)
    expect(await HTLCInstance.status()).to.equal(0)
    expect(await HTLCInstance.lockTime()).to.equal(lockTime)

    await expect(await ethers.provider.getBalance(await HTLCInstance.getAddress()))
      .to.equal(ethers.parseEther("1.0"))
  })

  it("should raise if the funds sending to the contract doesn't match the fee + amount", async () => {
    const accounts = await ethers.getSigners()
    const satefyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address

    const amount = ethers.parseEther("0.995")
    const fee = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const contract = await ethers.getContractFactory("ChargeableHTLC_ETH")
 
    await expect(ethers.deployContract("ChargeableHTLC_ETH", [
        amount,
        "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        lockTime,
        reserveAddress,
        satefyModuleAddress,
        fee,
        accounts[5].address
      ], { value: ethers.parseEther("0.995") })
    )
    .to.be.revertedWithCustomError(contract, "ContractNotProvisioned")
  })

  it("withdraw should send tokens to the reserve address, fee to the safety module and to the refill address", async() => {
    const accounts = await ethers.getSigners()

    const archPoolSigner = ethers.Wallet.createRandom()

    const pool = await ethers.deployContract("ETHPool")
    await pool.initialize(
        accounts[4].address,
        accounts[3].address,
        5,
        archPoolSigner.address,
        ethers.parseEther("0.95"),
        60
    )
    const poolAddress = await pool.getAddress()

    const safetyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = ethers.parseEther("0.995")
    const fee = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 60

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ETH", [
      amount,
      `0x${secretHash}`,
      lockTime,
      reserveAddress,
      safetyModuleAddress,
      fee,
      poolAddress
    ], { value: ethers.parseEther("1.0") })

    await expect(HTLCInstance
      .connect(accounts[2])
      .withdraw(`0x${secret.toString('hex')}`)
    )
    .to.changeEtherBalances(
      [safetyModuleAddress, reserveAddress, poolAddress, await HTLCInstance.getAddress()], 
      [ethers.parseEther("0.005"), ethers.parseEther("0.045"), ethers.parseEther("0.95"), -ethers.parseEther("1.0")]
    )

    expect(await HTLCInstance.withdrawAmount()).to.equal(ethers.parseEther("0.045"))
    expect(await HTLCInstance.refillAmount()).to.equal(ethers.parseEther("0.95"))
  })

  it("refund should send back tokens to the owner", async() => {
    const accounts = await ethers.getSigners()
    const safetyModuleAddress = accounts[3].address
    const reserveAddress = accounts[4].address
    
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = ethers.parseEther("0.995")
    const fee = ethers.parseEther("0.005")

    const blockTimestamp = await time.latest()
    const lockTime = blockTimestamp + 1

    const HTLCInstance = await ethers.deployContract("ChargeableHTLC_ETH", [
      amount,
      `0x${secretHash}`,
      lockTime,
      reserveAddress,
      safetyModuleAddress,
      fee,
      accounts[5].address
    ], { value: ethers.parseEther("1.0") })

    await time.increaseTo(lockTime + 5);
    expect(await HTLCInstance.refund())
      .to
      .changeEtherBalance(accounts[0].address, ethers.parseEther('1.0'))
  })
})