const HTLC = artifacts.require("ChargeableHTLC_ETH")

const { increaseTime } = require("../utils")
const { createHash, randomBytes } = require("crypto")

contract("Chargeable ETH HTLC", (accounts) => {

  it("should create contract and associated recipient and fee", async () => {
    const safetyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]

    const amount = web3.utils.toWei("0.995")
    const fee = web3.utils.toWei("0.005")
    
    const HTLCInstance = await HTLC.new(
      amount,
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      1,
      reserveAddress,
      safetyModuleAddress,
      fee,
      { value: web3.utils.toWei("1") }
    )

    assert.equal(await HTLCInstance.amount(), amount)
    assert.equal(await HTLCInstance.fee(), fee)
    assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    assert.equal(await HTLCInstance.recipient(), reserveAddress)
    assert.equal(await HTLCInstance.finished(), false)
    assert.equal(await HTLCInstance.lockTime(), 1)

    assert.equal(await web3.eth.getBalance(HTLCInstance.address), web3.utils.toWei("1.0"))
  })

  it("withdraw should send tokens to the reserve address and fee to the safety module", async() => {
    const safetyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = web3.utils.toWei("0.995")
    const fee = web3.utils.toWei("0.005")

    const HTLCInstance = await HTLC.new(
      amount,
      `0x${secretHash}`,
      60,
      reserveAddress,
      safetyModuleAddress,
      fee,
      { value: web3.utils.toWei("1") }
    )

    const balanceSafetyModuleBefore = await web3.eth.getBalance(safetyModuleAddress)
    const balanceReserveBefore = await web3.eth.getBalance(reserveAddress)

    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[2] })

    const balanceSafetyModuleAfter = await web3.eth.getBalance(safetyModuleAddress)
    const balanceReserveAfter = await web3.eth.getBalance(reserveAddress)

    assert.equal(web3.utils.toBN(balanceSafetyModuleAfter).sub(web3.utils.toBN(balanceSafetyModuleBefore)).toString(), web3.utils.toWei('0.005'))
    assert.equal(web3.utils.toBN(balanceReserveAfter).sub(web3.utils.toBN(balanceReserveBefore)).toString(), web3.utils.toWei('0.995'))
  })

  it("refund should send back tokens to the owner", async() => {
    const safetyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]
    
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = web3.utils.toWei("0.995")
    const fee = web3.utils.toWei("0.005")

    const HTLCInstance = await HTLC.new(
      amount,
      `0x${secretHash}`,
      1,
      reserveAddress,
      safetyModuleAddress,
      fee,
      { from: accounts[2], value: web3.utils.toWei('1') }
    )

    const balanceBefore = await web3.eth.getBalance(accounts[2])

    await increaseTime(2)
    await HTLCInstance.refund()

    const balanceAfter = await web3.eth.getBalance(accounts[2])
    assert.equal(web3.utils.toBN(balanceAfter).sub(web3.utils.toBN(balanceBefore)), web3.utils.toWei('1'))
  })
})