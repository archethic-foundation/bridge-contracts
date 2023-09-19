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
      1
    )

    assert.equal(await HTLCInstance.amount(), web3.utils.toWei("1"))
    assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
    assert.equal(await HTLCInstance.recipient(), recipientEthereum)
    assert.equal(await HTLCInstance.finished(), false)
    assert.equal(await HTLCInstance.lockTime(), 1)
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
      60
    )
    
    const balance1 = await web3.eth.getBalance(recipientEthereum)

    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    const balance = await web3.eth.getBalance(HTLCInstance.address)
    assert.equal(balance, await HTLCInstance.amount())

    assert.ok(await HTLCInstance.canWithdraw())

    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })

    const balance2 = await web3.eth.getBalance(recipientEthereum)
    assert.equal(1, web3.utils.fromWei(balance2) - web3.utils.fromWei(balance1))
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
      60
    )

    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })
    try {
      assert.equal(false, await HTLCInstance.canWithdraw())
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
      60
    )

    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    try {
      await HTLCInstance.withdraw(`0x${randomBytes(32).toString('hex')}`, { from: accounts[3] })
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "InvalidSecret")
    }
  })

  it("should refuse the withdraw if the contract doesn't get funds", async () => {
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
      60
    )

    assert.equal(false, await HTLCInstance.canWithdraw())

    try {
      await HTLCInstance.withdraw(`0x${secret.toString('hex')}`, { from: accounts[3] })
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "InsufficientFunds")
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
      1
    )
    
    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    await increaseTime(2)

    assert.equal(false, await HTLCInstance.canWithdraw())
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
      1
    )
    
    const balance1 = await web3.eth.getBalance(recipientEthereum)

    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });
    await increaseTime(2)

    assert.ok(await HTLCInstance.canRefund())

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
      1
    )
    
    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });

    await increaseTime(2)
    await HTLCInstance.refund()
    assert.equal(false, await HTLCInstance.canRefund())
    
    try {
      await HTLCInstance.refund()
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "AlreadyFinished")
    }
  })

  it ("should return an error if contract doesn't get funds", async() => {
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
      1
    )
    
    assert.equal(false, await HTLCInstance.canRefund())
    
    try {
      await HTLCInstance.refund()
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "InsufficientFunds")
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
      1
    )
    
    await web3.eth.sendTransaction({ from: accounts[1], to: HTLCInstance.address, value: amount });

    assert.equal(false, await HTLCInstance.canRefund())
    
    try {
      await HTLCInstance.refund()
    }
    catch(e) {
      const interface = new ethers.Interface(HTLCInstance.abi);
      assert.equal(interface.parseError(e.data.result).name, "TooEarly")
    }
  })
})