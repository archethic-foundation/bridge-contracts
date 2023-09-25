const LiquidityPool = artifacts.require("ERCPool")
const DummyToken = artifacts.require("DummyToken")

const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer, network, accounts) {
    let reserveAddress, safetyModuleAddress, archethicPoolSigner, poolCap, tokenAddress
    const safetyModuleFeeRate = 5 // 0.05%

    if (network == "development") {
        reserveAddress = accounts[4]
        safetyModuleAddress = accounts[5]
        archethicPoolSigner = '0xb2ebd20cc1b50bd1c68e84f1148a304fff15706c'
        poolCap = web3.utils.toWei('200')

        await deployer.deploy(DummyToken, web3.utils.toWei('200000'))

        const tokenInstance = await DummyToken.deployed()
        tokenAddress = tokenInstance.address

        console.log(`Deployed token: ${tokenAddress}`)
    }

    if (network == "sepolia") {
        reserveAddress = "0x4c5B45aD4347bAAF2E2d1817D0e1eea483910acc"
        safetyModuleAddress = "0xbEF25E2b992494aF270092562e92aAC8394e0982"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
        tokenAddress = '0xCBBd3374090113732393DAE1433Bc14E5233d5d7'
    }

    if (network == "mumbai") {
        reserveAddress = "0x5aAD864466491E81701103F04775EA7dE6d76fE3"
        safetyModuleAddress = "0xbADc499dA1F766599d19dBa805CB62eFaa439Adc"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
        tokenAddress = '0x51279e98d99AA8D65763a885BEFA5463dCd84Af6'
    }

    if (network == "bsc_testnet") {
        reserveAddress = "0x157aB6F84d3a3874d1dEd1b0a63EC834C640FBda"
        safetyModuleAddress = "0x95Cc38814d37E0A9b08f77a02Ff4045CeAd2106c"
        poolCap = web3.utils.toWei('5')
        archethicPoolSigner = '0xaf08762b5c7001314dca6e9c3aa56c1a603f9369'
        tokenAddress = '0x51279e98d99AA8D65763a885BEFA5463dCd84Af6'
    }

    const instance = await deployProxy(LiquidityPool, [reserveAddress, safetyModuleAddress, safetyModuleFeeRate, archethicPoolSigner, poolCap, tokenAddress], { deployer });

    if (network == "development") {
        await instance.unlock()
    }
}