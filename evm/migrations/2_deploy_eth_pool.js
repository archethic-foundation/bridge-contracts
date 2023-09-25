const LiquidityPool = artifacts.require("ETHPool")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    let reserveAddress, safetyModuleAddress, archethicPoolSigner, poolCap
    const safetyModuleFeeRate = 5 // 0.05%

    if (network == "development") {
        reserveAddress = accounts[4]
        safetyModuleAddress = accounts[5]
        archethicPoolSigner = '0x3f6e4b7cde77901603425009c4a65177270156b2'
        poolCap = web3.utils.toWei('200')
    }

    if (network == "sepolia") {
        reserveAddress = "0x3FDf8f04cBe76c1376F593634096A5299B494678"
        safetyModuleAddress = "0x57B5Fe2F6A28E108208BA4965d9879FACF629442"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
    }

    if (network == "mumbai") {
        reserveAddress = "0x64d75D315c592cCE1F83c53A201313C82b30FA8d"
        safetyModuleAddress = "0xc20BcA1a8155c65964e5280D93d379aeB3A4c2e7"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
    }

    if (network == "bsc_testnet") {
        reserveAddress = "0x7F9E1c2Bb1Ab391bA9987070ED8e7db77A9c8818"
        safetyModuleAddress = "0x6f3dec2738b063D9aFe4436b1ec307D84f9C2EDe"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
    }

    const instance = await deployProxy(LiquidityPool, [reserveAddress, safetyModuleAddress, safetyModuleFeeRate, archethicPoolSigner, poolCap], { deployer });

    if (network == "development") {
        await instance.unlock()
    }
}