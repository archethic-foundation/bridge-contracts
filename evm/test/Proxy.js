const { upgrades, network: { config: networkConfig } } = require("hardhat");
const { deployProxy, upgradeProxy } = upgrades
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai")

const { hexToUintArray, concatUint8Arrays, uintArrayToHex } = require('./utils')

describe("LP Proxy", () => {

    async function deployPool() {
        const accounts = await ethers.getSigners()
        const archPoolSigner = ethers.Wallet.createRandom()

        const pool = await ethers.getContractFactory("ETHPool");
        const proxiedPoolInstance = await deployProxy(pool, [archPoolSigner.address, 60, accounts[0].address]);

        return { proxy: proxiedPoolInstance, archPoolSigner, accounts }
    }

    it("initialize pool", async () => {
        const { proxy } = await loadFixture(deployPool)
        expect(await proxy.lockTimePeriod()).to.equal(60)
    })

    it("delegate mint call", async () => {
        const { proxy, accounts } = await loadFixture(deployPool)
        const amount = ethers.parseEther("1")
        await proxy.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", amount, { value: amount })
        const htlcAddress = await proxy.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.from()).to.equal(accounts[0].address)
        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(await proxy.getAddress());
        expect(await HTLCInstance.amount()).to.equal(amount)
    })

    it("delegate provision call", async () => {
        const { proxy, accounts, archPoolSigner } = await loadFixture(deployPool)

        await accounts[1].sendTransaction({
            to: proxy.getAddress(),
            value: ethers.parseEther("2.0"),
        });

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const senderAddress = await accounts[0].getAddress()

        const abiEncoder = new ethers.AbiCoder()
        const sigPayload = abiEncoder.encode(["bytes32", "bytes32", "uint", "address"], [archethicHtlcAddressHash, "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", networkConfig.chainId, senderAddress])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(sigPayload).slice(2))
        const signature = ethers.Signature.from(await archPoolSigner.signMessage(hashedSigPayload2))

        const blockTimestamp = await time.latest()
        const lockTime = blockTimestamp + 60

        await proxy.provisionHTLC(
            "0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a",
            ethers.parseEther("1.0"),
            lockTime,
            `0x${archethicHtlcAddress}`,
            signature.r,
            signature.s,
            signature.v)

        const htlcAddress = await proxy.provisionedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")

        expect(await ethers.provider.getBalance(htlcAddress)).to.equal(ethers.parseEther("1.0"))

        const HTLCInstance = await ethers.getContractAt("SignedHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.from()).to.equal(await proxy.getAddress())
        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(accounts[0].address);
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther("1.0"))
        expect(await HTLCInstance.lockTime()).to.equal(lockTime)
    })

    it("change implementation", async () => {
        const { proxy, accounts, archPoolSigner } = await loadFixture(deployPool)
        expect(await proxy.lockTimePeriod()).to.equal(60)

        const poolv2 = await ethers.getContractFactory("ETHPoolV2");

        await upgradeProxy(await proxy.getAddress(), poolv2, [archPoolSigner.address, 60, accounts[4].address]);
        await expect(proxy.setLockTimePeriod(2))
            .to.emit(proxy, "LockTimePeriodChanged").withArgs(2 * 3600)

        expect(await proxy.lockTimePeriod()).to.equal(2 * 3600)
    })
})
