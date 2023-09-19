const HTLC = artifacts.require("SignedHTLC_ETH")
const LiquidityPool = artifacts.require("ETHPool")

const { generateECDSAKey, createEthSign } = require("../utils")
const { randomBytes, createHash } = require("crypto")
const { ethers } = require("ethers")

contract("Signed ETH HTLC", (accounts) => {

    let archPoolSigner = {}

    before(() => {
        const { privateKey } = generateECDSAKey()
        const { address } = web3.eth.accounts.privateKeyToAccount(`0x${privateKey.toString('hex')}`);
        archPoolSigner = {
            address: address,
            privateKey: privateKey
        }
    })

    it("should withdraw send funds once the secret is valid for the hash and the hash is signed by the Archethic pool", async () => {
        const poolInstance = await LiquidityPool.new()
        await poolInstance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'))

        await poolInstance.unlock()
        await web3.eth.sendTransaction({ from: accounts[1], to: poolInstance.address, value: web3.utils.toWei('2') });

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const { r, s, v } = createEthSign(hash, archPoolSigner.privateKey)

        await poolInstance.provisionHTLC(`0x${hash.toString('hex')}`, web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)
        const HTLCAddress = await poolInstance.provisionedSwaps(`0x${hash.toString('hex')}`)
        const HTLCInstance = await HTLC.at(HTLCAddress)

        const { r: rSecret, s: sSecret, v: vSecret } = createEthSign(secret, archPoolSigner.privateKey)

        const balanceRecipientBefore = await web3.eth.getBalance(accounts[0])
        await HTLCInstance.signedWithdraw(`0x${secret.toString('hex')}`, `0x${rSecret}`, `0x${sSecret}`, vSecret, { from: accounts[4] })

        assert.ok(await HTLCInstance.finished())

        const balanceRecipientAfter = await web3.eth.getBalance(accounts[0])

        assert.ok(balanceRecipientAfter - balanceRecipientBefore == web3.utils.toWei('1'))
        assert.equal(await HTLCInstance.secret(), `0x${secret.toString('hex')}`)
    })

    it("should return an error if the signature is invalid", async () => {
        const poolInstance = await LiquidityPool.new()
        await poolInstance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'))

        await poolInstance.unlock()
        await web3.eth.sendTransaction({ from: accounts[1], to: poolInstance.address, value: web3.utils.toWei('2') });

        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const { r, s, v } = createEthSign(hash, archPoolSigner.privateKey)

        await poolInstance.provisionHTLC(`0x${hash.toString('hex')}`, web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)
        const HTLCAddress = await poolInstance.provisionedSwaps(`0x${hash.toString('hex')}`)
        const HTLCInstance = await HTLC.at(HTLCAddress)

        const { r: rSecret, s: sSecret, v: vSecret } = createEthSign(randomBytes(32), archPoolSigner.privateKey)

        try {
            await HTLCInstance.signedWithdraw(`0x${secret.toString('hex')}`, `0x${rSecret}`, `0x${sSecret}`, vSecret, { from: accounts[3] })
        }
        catch (e) {
            const interface = new ethers.Interface(HTLCInstance.abi);
            assert.equal(interface.parseError(e.data.result).name, "InvalidSignature")
        }
    })

})
