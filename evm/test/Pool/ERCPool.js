const DummyToken = artifacts.require("DummyToken")
const LiquidityPool = artifacts.require("ERCPool")
const SignedHTLC = artifacts.require("SignedHTLC_ERC")
const ChargeableHTLC = artifacts.require("ChargeableHTLC_ERC")

const { randomBytes, createHash } = require("crypto")
const { generateECDSAKey, hexToUintArray, createEthSign, concatUint8Arrays, uintArrayToHex } = require("../utils")
const { ethers } = require("ethers")

contract("ERC LiquidityPool", (accounts) => {

    let archPoolSigner = {}
    let DummyTokenInstance

    before(async () => {
        const { privateKey } = generateECDSAKey()
        const { address } = web3.eth.accounts.privateKeyToAccount(`0x${privateKey.toString('hex')}`);
        archPoolSigner = {
            address: address,
            privateKey: privateKey
        }

        DummyTokenInstance = await DummyToken.new(web3.utils.toWei('1000'))
    })

    it("should create contract", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        assert.equal(await instance.reserveAddress(), accounts[4])
        assert.equal(await instance.safetyModuleAddress(), accounts[3])
        assert.equal(await instance.safetyModuleFeeRate(), 500)
        assert.equal(await instance.archethicPoolSigner(), archPoolSigner.address)
        assert.equal(await instance.poolCap(), web3.utils.toWei('2'))
        assert.equal(await instance.locked(), true)
        assert.equal(await instance.token(), DummyTokenInstance.address)
    })

    it("should update the reserve address", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.setReserveAddress(accounts[8])
        assert.equal(await instance.reserveAddress(), accounts[8])
    })

    it("should update the safety module address", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.setSafetyModuleAddress(accounts[8])
        assert.equal(await instance.safetyModuleAddress(), accounts[8])
    })

    it("should update the safety module fee", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.setSafetyModuleFeeRate(10)
        assert.equal(await instance.safetyModuleFeeRate(), 1000)
    })

    it("should update the archethic pool signer address", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        const { privateKey } = generateECDSAKey()
        const { address } = web3.eth.accounts.privateKeyToAccount(`0x${privateKey.toString('hex')}`);

        await instance.setArchethicPoolSigner(address)
        assert.equal(await instance.archethicPoolSigner(), address)
    })

    it("should update the pool cap", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.setPoolCap(web3.utils.toWei('5'))
        assert.equal(await instance.poolCap(), web3.utils.toWei('5'))
    })

    it("should unlock pool", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()
        assert.equal(false, await instance.locked())
    })

    it("should lock pool after unlocked", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)
        await instance.unlock()

        assert.equal(false, await instance.locked())
        await instance.lock()
        assert.equal(true, await instance.locked())
    })

    it("should update owner", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.transferOwnership(accounts[3])
        assert.equal(accounts[3], await instance.owner())
    })

    it("should update token", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        const AnotherDummyTokenInstance = await DummyToken.new(2000000)

        await instance.setToken(AnotherDummyTokenInstance.address)
        assert.equal(AnotherDummyTokenInstance.address, await instance.token())
    })

    it("should create HTLC and provision ERC20 to the HTLC contract after verifying the signature", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()

        await DummyTokenInstance.transfer(instance.address, web3.utils.toWei('2'))

        const networkID = await web3.eth.getChainId()

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkID, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(web3.utils.sha3(`0x${uintArrayToHex(sigPayload)}`).slice(2))

        const { r, s, v } = createEthSign(hashedSigPayload2, archPoolSigner.privateKey)

        await instance.provisionHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)
        const htlcAddress = await instance.provisionedSwap("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        const balanceHTLC = await DummyTokenInstance.balanceOf(htlcAddress)
        assert.equal(web3.utils.toWei('1'), balanceHTLC)

        const HTLCInstance = await SignedHTLC.at(htlcAddress)

        assert.equal(await HTLCInstance.poolSigner(), archPoolSigner.address)
        assert.equal(await HTLCInstance.hash(), "0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08")
        assert.equal(await HTLCInstance.recipient(), accounts[0]);
        assert.equal(await HTLCInstance.amount(), web3.utils.toWei('1'))
        assert.equal(await HTLCInstance.lockTime(), 60)
        assert.equal(await HTLCInstance.token(), DummyTokenInstance.address)
    })

    it("should return an error when the signature is invalid", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()
        await DummyTokenInstance.transfer(instance.address, web3.utils.toWei('2'))

        const sigHash = randomBytes(32)

        const { r, s, v } = createEthSign(sigHash, archPoolSigner.privateKey)

        try {
            await instance.provisionHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)

        }
        catch (e) {
            const interface = new ethers.Interface(instance.abi);
            assert.equal(interface.parseError(e.data.result).name, "InvalidSignature")
        }
    })

    it("should return an error when the pool doesn't have enough funds to provide HTLC contract", async () => {
        const instance = await LiquidityPool.new()
        await instance.initialize(accounts[4], accounts[3], 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()

        const networkID = await web3.eth.getChainId()

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkID, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const sigPayload = concatUint8Arrays([
            hexToUintArray("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"),
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(web3.utils.sha3(`0x${uintArrayToHex(sigPayload)}`).slice(2))

        const { r, s, v } = createEthSign(hashedSigPayload2, archPoolSigner.privateKey)

        try {
            await instance.provisionHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60, `0x${r}`, `0x${s}`, v)
        }
        catch (e) {
            const interface = new ethers.Interface(instance.abi);
            assert.equal(interface.parseError(e.data.result).name, "InsufficientFunds")
        }
    })

    it("should mint and send funds to the HTLC contract with fee integration", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const instance = await LiquidityPool.new()
        await instance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)
        await instance.unlock()


        const secret = randomBytes(32)
        const secretHash = createHash("sha256")
            .update(secret)
            .digest("hex")

        await instance.mintHTLC(`0x${secretHash}`, web3.utils.toWei('1'), 60)
        const htlcAddress = await instance.mintedSwap(`0x${secretHash}`)
        const HTLCInstance = await ChargeableHTLC.at(htlcAddress)
        assert.equal(await HTLCInstance.safetyModuleAddress(), satefyModuleAddress)
        assert.equal(await HTLCInstance.hash(), `0x${secretHash}`)
        assert.equal(await HTLCInstance.recipient(), reserveAddress);

        assert.equal(await HTLCInstance.amount(), web3.utils.toWei('0.995'))
        assert.equal(await HTLCInstance.fee(), web3.utils.toWei('0.005'))
        assert.equal(await HTLCInstance.lockTime(), 60)

        await DummyTokenInstance.transfer(htlcAddress, web3.utils.toWei('1'))
        await HTLCInstance.withdraw(`0x${secret.toString('hex')}`)

        assert.equal(await DummyTokenInstance.balanceOf(reserveAddress), web3.utils.toWei('0.995'))
        assert.equal(await DummyTokenInstance.balanceOf(await instance.safetyModuleAddress()), web3.utils.toWei('0.005'))
    })

    it("should return an error if the sender does not have funds", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const instance = await LiquidityPool.new()
        await instance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()

        try {
            await instance.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('100000'), 60)
        }
        catch (e) {
            const interface = new ethers.Interface(instance.abi);
            assert.equal(interface.parseError(e.data.result).name, "InsufficientFunds")
        }
    })

    it("should return an error if a swap with this hash is already existing", async () => {
        const satefyModuleAddress = accounts[3]
        const reserveAddress = accounts[4]

        const instance = await LiquidityPool.new()
        await instance.initialize(reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, web3.utils.toWei('2'), DummyTokenInstance.address)

        await instance.unlock()

        await DummyTokenInstance.approve(instance.address, web3.utils.toWei('1'))
        await instance.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60)

        try {
            await instance.mintHTLC("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", web3.utils.toWei('1'), 60)
        }
        catch (e) {
            const interface = new ethers.Interface(instance.abi);
            assert.equal(interface.parseError(e.data.result).name, "AlreadyMinted")
        }
    })
})

