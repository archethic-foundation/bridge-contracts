const { upgrades, network: { config: networkConfig } } = require("hardhat");
const { deployProxy, upgradeProxy } = upgrades
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai")

const { hexToUintArray, concatUint8Arrays, uintArrayToHex } = require('./utils')

describe("LP Proxy", () => {

    async function deployPool() {
        const accounts = await ethers.getSigners()
        const archPoolSigner = ethers.Wallet.createRandom()

        const reserveAddress = accounts[3].address
        const satefyModuleAddress = accounts[4].address

        const pool = await ethers.getContractFactory("ETHPool");
        const proxiedPoolInstance = await deployProxy(pool, [reserveAddress, satefyModuleAddress, 5, archPoolSigner.address, ethers.parseEther('200'), 60, accounts[0].address]);

        return { proxy: proxiedPoolInstance, archPoolSigner, accounts }
    }

    it("initialize pool", async () => {
        const { proxy, accounts } = await loadFixture(deployPool)
        expect(await proxy.reserveAddress()).to.equal(accounts[3].address)
        expect(await proxy.poolCap()).to.equal(ethers.parseEther("200"))
    })

    it("delegate mint call", async () => {
        const { proxy, accounts } = await loadFixture(deployPool)
        await proxy.mintHTLC("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a", ethers.parseEther("1"), { value: ethers.parseEther("1") })
        const htlcAddress = await proxy.mintedSwap("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        const HTLCInstance = await ethers.getContractAt("ChargeableHTLC_ETH", htlcAddress)

        expect(await HTLCInstance.from()).to.equal(accounts[0].address)
        expect(await HTLCInstance.hash()).to.equal("0xbd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a")
        expect(await HTLCInstance.recipient()).to.equal(await proxy.reserveAddress());
        expect(await HTLCInstance.amount()).to.equal(ethers.parseEther('0.995'))
        expect(await HTLCInstance.fee()).to.equal(ethers.parseEther('0.005'))
    })

    it("delegate provision call", async () => {
        const { proxy, accounts, archPoolSigner } = await loadFixture(deployPool)

        await accounts[1].sendTransaction({
            to: proxy.getAddress(),
            value: ethers.parseEther("2.0"),
        });

        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        view.setUint32(0x0, networkConfig.chainId, true);
        const networkIdUint8Array = new Uint8Array(buffer).reverse();

        const archethicHtlcAddress = "00004970e9862b17e9b9441cdbe7bc13aeb4c906a75030bb261df1f87b4af9ee11a5"
        const archethicHtlcAddressHash = ethers.sha256(`0x${archethicHtlcAddress}`)

        const sigPayload = concatUint8Arrays([
            hexToUintArray(archethicHtlcAddressHash.slice(2)), // Archethic HTLC's address hash
            hexToUintArray("bd1eb30a0e6934af68c49d5dd5ad3e3c3d950ff977a730af56b55af55a54673a"), // HTLC's hash
            networkIdUint8Array
        ])

        const hashedSigPayload2 = hexToUintArray(ethers.keccak256(`0x${uintArrayToHex(sigPayload)}`).slice(2))
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
        expect(await proxy.safetyModuleFeeRate()).to.equal(500)

        const poolv2 = await ethers.getContractFactory("ETHPoolV2");

        const reserveAddress = accounts[3].address
        const safetyModuleAddress = accounts[4].address

        await upgradeProxy(await proxy.getAddress(), poolv2, [reserveAddress, safetyModuleAddress, 5, archPoolSigner.address, ethers.parseEther('200'), 60]);
        await expect(proxy.setSafetyModuleFeeRate(500))
            .to.emit(proxy, "SafetyModuleFeeRateChanged").withArgs(1000)

        expect(await proxy.safetyModuleFeeRate()).to.equal(1000)
    })
})
