const HTLC = artifacts.require("ChargeableHTLC_ETH")
const LiquidityPool = artifacts.require("ETHPool")

const { generateECDSAKey, increaseTime } = require("../utils")
const { createHash, randomBytes } = require("crypto")

contract("Chargeable ETH HTLC", (accounts) => {

  let archPoolSigner = {}

  before(() => {
      const { privateKey } = generateECDSAKey()
      const { address } = web3.eth.accounts.privateKeyToAccount(`0x${privateKey.toString('hex')}`);
      archPoolSigner = {
          address: address,
          privateKey: privateKey
      }
  })

  it("should create contract and associated recipient and fee", async () => {
    const satefyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]
    
    const poolInstance = await LiquidityPool.new()
    await poolInstance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'))

    const HTLCInstance = await HTLC.new(
      web3.utils.toWei("1"),
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      1,
      poolInstance.address
    )

    assert.equal(await HTLCInstance.amount(), web3.utils.toWei("0.95"))
    assert.equal(await HTLCInstance.fee(), web3.utils.toWei('0.05'))
    assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    assert.equal(await HTLCInstance.recipient(), reserveAddress)
    assert.equal(await HTLCInstance.finished(), false)
    assert.equal(await HTLCInstance.lockTime(), 1)
  })

  it("withdraw should send tokens to the reserve address and fee to the safety module", async() => {
    const satefyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]

    const poolInstance = await LiquidityPool.new()
    await poolInstance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'))

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = web3.utils.toWei("1")

    const HTLCInstance = await HTLC.new(
      amount,
      `0x${secretHash}`,
      60,
      poolInstance.address
    )

    const balanceSafetyModuleBefore = await web3.eth.getBalance(satefyModuleAddress)
    const balanceReserveBefore = await web3.eth.getBalance(reserveAddress)

    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[2] })

    const balanceSafetyModuleAfter = await web3.eth.getBalance(satefyModuleAddress)
    const balanceReserveAfter = await web3.eth.getBalance(reserveAddress)

    assert.equal(balanceSafetyModuleAfter - balanceSafetyModuleBefore, web3.utils.toWei('0.05'))
    assert.equal(balanceReserveAfter - balanceReserveBefore, web3.utils.toWei('0.95'))
  })

  it("refund should send back tokens to the owner", async() => {
    const satefyModuleAddress = accounts[3]
    const reserveAddress = accounts[4]
    
    const poolInstance = await LiquidityPool.new()
    await poolInstance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'))

    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")
      
    const amount = web3.utils.toWei("1")

    const HTLCInstance = await HTLC.new(
      amount,
      `0x${secretHash}`,
      1,
      poolInstance.address,
      { from: accounts[2] }
    )

    const balanceBefore = await web3.eth.getBalance(accounts[2])
    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });

    await increaseTime(2)
    await HTLCInstance.refund()

    const balanceAfter = await web3.eth.getBalance(accounts[2])
    assert.equal(balanceAfter - balanceBefore, web3.utils.toWei('1'))
  })
})