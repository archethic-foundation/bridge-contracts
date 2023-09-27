const HTLC = artifacts.require("HTLC_ETH")

const { increaseTime} = require('../utils')
const { createHash, randomBytes } = require("crypto")
const { ethers } = require("ethers");

contract("ETH HTLC", (accounts) => {

  it("should create contract", async () => {
    const recipientEthereum = accounts[2]

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      web3.utils.toWei("1"),
      "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      1,
      false,
      { value: web3.utils.toWei("1") }
    )

    assert.equal(await HTLCInstance.amount(), web3.utils.toWei("1"))
    assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    assert.equal(await HTLCInstance.recipient(), recipientEthereum)
    assert.equal(await HTLCInstance.finished(), false)
    assert.equal(await HTLCInstance.lockTime(), 1)

    assert.equal(await web3.eth.getBalance(HTLCInstance.address), web3.utils.toWei('1'))
  })

  it("should withdraw the funds with the hash preimage reveal", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      60,
      false,
      { value: amount }
    )
    
    const balance1 = await web3.eth.getBalance(recipientEthereum)

    const balance = await web3.eth.getBalance(HTLCInstance.address)
    assert.equal(balance, await HTLCInstance.amount())

    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })

    const balance2 = await web3.eth.getBalance(recipientEthereum)
    assert.equal(1, web3.utils.fromWei(balance2) - web3.utils.fromWei(balance1))
  })

  it("should refuse the contract creation if the contract doesn't get the right funds", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    try {
      await HTLC.new(
        recipientEthereum,
        amount,
        `0x${secretHash}`,
        60,
        false
      )
    }
    catch(e) {
      const interface = new ethers.Interface(HTLC.abi);
      assert.equal(interface.parseError(e.data.result).name, "ContractNotProvisioned")
    }

    try {
      await HTLC.new(
        recipientEthereum,
        amount,
        `0x${secretHash}`,
        60,
        false,
        { value: amount * 3}
      )
    }
    catch(e) {
      const interface = new ethers.Interface(HTLC.abi);
      assert.equal(interface.parseError(e.data.result).name, "ContractNotProvisioned")
    }
  })

  it("should refuse the withdraw is the swap is already done", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      60,
      false,
      { value: amount }
    )

    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })
    try {
      await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[2] })
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "AlreadyFinished")
    }
  })

  it("should refuse the withdraw is secret is invalid", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      60,
      false,
      { value: amount }
    )

    try {
      await HTLCInstance.withdraw(`0x${randomBytes(32).toString('hex')}`, { from: accounts[3] })
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "InvalidSecret")
    }
  })

  it("should refuse the withdraw if the locktime passed", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      1,
      false,
      { value: amount }
    )
   
    await increaseTime(2)

    try {
      await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "TooLate")
    }
  })

  it("should refund the owner after the lock time", async () => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      1,
      false,
      { value: amount }
    )
    
    const balance1 = await web3.eth.getBalance(recipientEthereum)

    const startTime = await HTLCInstance.startTime()
    const lockTime = await HTLCInstance.lockTime()

    const date = new Date(startTime * 1000)
    date.setSeconds(date.getSeconds() + lockTime + 1)
    const secondUNIX = Math.floor(date.getTime() / 1000)

    assert.equal(true, await HTLCInstance.canRefund(secondUNIX))

    await increaseTime(2)
    await HTLCInstance.refund()

    const balance2 = await web3.eth.getBalance(recipientEthereum)
    assert.equal(web3.utils.fromWei(balance2), web3.utils.fromWei(balance1))
    assert.equal(await HTLCInstance.finished(), true)
  })

  it ("should return an error if the swap is already finished", async() => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      1,
      false,
      { value: amount }
    )
    
    await increaseTime(2)
    await HTLCInstance.refund()
    
    try {
      await HTLCInstance.refund()
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "AlreadyFinished")
    }
  })

  it ("should return an error if the lock time is not reached", async() => {
    const recipientEthereum = accounts[2]

    const amount = web3.utils.toWei('1')
    const secret = randomBytes(32)
    const secretHash = createHash("sha256")
      .update(secret)
      .digest("hex")

    const HTLCInstance = await HTLC.new(
      recipientEthereum,
      amount,
      `0x${secretHash}`,
      1,
      false,
      { value: amount }
    )

    const date = new Date()
    const secondUNIX = Math.floor(date.getTime() / 1000)

    assert.equal(false, await HTLCInstance.canRefund(secondUNIX))
    
    try {
      await HTLCInstance.refund()
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "TooEarly")
    }
  })
})