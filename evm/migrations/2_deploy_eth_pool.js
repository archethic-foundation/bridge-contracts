const LiquidityPool = artifacts.require("ETHPool")
const ETHPool_HTLCDeployer = artifacts.require("ETHPool_HTLCDeployer")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    let reserveAddress, safetyModuleAddress, archethicPoolSigner, poolCap
    const safeteModuleFeeRate = 500

    await deployer.deploy(ETHPool_HTLCDeployer)
    await deployer.link(ETHPool_HTLCDeployer, LiquidityPool)

    if (network == "development") {
        reserveAddress = accounts[4]
        safetyModuleAddress = accounts[5]
        archethicPoolSigner = '0x3f6e4b7cde77901603425009c4a65177270156b2'
        poolCap = web3.utils.toWei('200')
    }

    const instance = await deployProxy(LiquidityPool, [reserveAddress, safetyModuleAddress, safeteModuleFeeRate, archethicPoolSigner, poolCap], { deployer });

    if (network == "development") {
        await instance.unlock()
    }
}