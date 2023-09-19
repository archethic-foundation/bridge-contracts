const LiquidityPool = artifacts.require("ETHPool")
const LiquidityPoolV2 = artifacts.require("ETHPoolV2")
const ChargeableHTLC = artifacts.require("ChargeableHTLC_ETH")
const SignedHTLC = artifacts.require("SignedHTLC_ETH")

const { deployProxy, upgradeProxy, admin } = require('@openzeppelin/truffle-upgrades');

const { generateECDSAKey, createEthSign, hexToUintArray } = require('./utils')
const { ethers } = require('ethers')

contract("LP Proxy", (accounts) => {

    let archPoolSigner = {}

    before(() => {
        const { privateKey } = generateECDSAKey()
        const { address } = web3.eth.accounts.privateKeyToAccount(`0x${privateKey.toString('hex')}`);
        archPoolSigner = {
            address: address,
            privateKey: privateKey
        }
    })

    it("initialize pool", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const proxiedPoolInstance = await deployProxy(LiquidityPool, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('200')]);
        assert.equal(await proxiedPoolInstance.reserveAddress(), reserveAddress)
        assert.equal(await proxiedPoolInstance.poolCap(), web3.utils.toWei('200'))
    })

    it("delegate mint call", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const proxiedPoolInstance = await deployProxy(LiquidityPool, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('200')]);

        await proxiedPoolInstance.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60)
        const htlcAddress = await proxiedPoolInstance.mintedSwaps("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        const HTLCInstance = await ChargeableHTLC.at(htlcAddress)

        assert.equal(await HTLCInstance.pool(), proxiedPoolInstance.address)
        assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        assert.equal(await HTLCInstance.recipient(), reserveAddress);
        assert.equal(await HTLCInstance.amount(), web3.utils.toWei('0.95'))
        assert.equal(await HTLCInstance.fee(), web3.utils.toWei('0.05'))
        assert.equal(await HTLCInstance.lockTime(), 60)
    })


    it("delegate provision call", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const proxiedPoolInstance = await deployProxy(LiquidityPool, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('200')]);

        await proxiedPoolInstance.unlock()
        await web3.eth.sendTransaction({ from: accounts[1], to: proxiedPoolInstance.address, value: web3.utils.toWei('2') });

        const sigHash = hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")

        const { r, s, v } = createEthSign(sigHash, archPoolSigner.privateKey)

        await proxiedPoolInstance.provisionHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)
        const htlcAddress = await proxiedPoolInstance.provisionedSwaps("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        const balanceHTLC = await web3.eth.getBalance(htlcAddress)
        assert.equal(web3.utils.toWei('1'), balanceHTLC)

        const HTLCInstance = await SignedHTLC.at(htlcAddress)
        assert.equal(await HTLCInstance.pool(), proxiedPoolInstance.address)
        assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        assert.equal(await HTLCInstance.recipient(), accounts[0]);
        assert.equal(await HTLCInstance.amount(), web3.utils.toWei('1'))
        assert.equal(await HTLCInstance.lockTime(), 60)
    })

    it("change implementation", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const proxiedPoolInstance = await deployProxy(LiquidityPool, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('200')]);
        assert.equal(await proxiedPoolInstance.safetyModuleFeeRate(), 500)

        await upgradeProxy(proxiedPoolInstance.address, LiquidityPoolV2, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('200')]);
        await proxiedPoolInstance.setSafetyModuleFeeRate(500)
        assert.equal(await proxiedPoolInstance.safetyModuleFeeRate(), 1000)
    })
})

