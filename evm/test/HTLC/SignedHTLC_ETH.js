const HTLC = artifacts.require("SignedHTLC_ETH")

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
        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const HTLCInstance = await HTLC.new(accounts[2], web3.utils.toWei('1'), `0x${hash.toString('hex')}`, 60, archPoolSigner.address, { value: web3.utils.toWei('1')})

        const { r: rSecret, s: sSecret, v: vSecret } = createEthSign(secret, archPoolSigner.privateKey)

        const balance1 = await web3.eth.getBalance(accounts[2])
        await HTLCInstance.signedWithdraw(`0x${secret.toString('hex')}`, `0x${rSecret}`, `0x${sSecret}`, vSecret, { from: accounts[1] })

        assert.ok(await HTLCInstance.finished())

        const balance2 = await web3.eth.getBalance(accounts[2])

        assert.ok(balance2 - balance1 == web3.utils.toWei('1'))
        assert.equal(await HTLCInstance.secret(), `0x${secret.toString('hex')}`)
    })

    it("should return an error if the signature is invalid", async () => {
        const secret = randomBytes(32)

        const hash = createHash("sha256")
            .update(secret)
            .digest()

        const HTLCInstance = await HTLC.new(accounts[2], web3.utils.toWei('1'), `0x${hash.toString('hex')}`, 60, archPoolSigner.address, { value: web3.utils.toWei('1')})

        const { r: rSecret, s: sSecret, v: vSecret } = createEthSign(secret, archPoolSigner.privateKey)

        try {
            await HTLCInstance.signedWithdraw(`0x${secret.toString('hex')}`, `0x${rSecret}`, `0x${sSecret}`, vSecret, { from: accounts[1] })
        }
        catch (e) {
            const interface = new ethers.Interface(HTLCInstance.abi);
            assert.equal(interface.parseError(e.data.result).name, "InvalidSignature")
        }
    })

})
