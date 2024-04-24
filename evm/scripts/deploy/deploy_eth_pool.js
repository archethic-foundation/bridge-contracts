const hre = { ethers, upgrades, network }  = require("hardhat");

async function main() {
    const { reserveAddress, safetyModuleAddress, archethicPoolSigner, poolCap, multisigAddress } = await poolConfiguration()
    const safetyModuleFeeRate = 5 // 0.05%
    const lockTimePeriod = 7200; // 2H

    const ETHPool = await ethers.getContractFactory("ETHPool");
    const accounts = await ethers.getSigners()
    const instance = await upgrades.deployProxy(ETHPool, [
        reserveAddress,
        safetyModuleAddress,
        safetyModuleFeeRate,
        archethicPoolSigner,
        poolCap,
        lockTimePeriod,
        multisigAddress || accounts[0].address
    ]);

    console.log(`ETH pool deployed at: ${await instance.getAddress()}`)
    if (multisigAddress) {
      console.log(`You have to accept the ownership using the multisig wallet (${multisigAddress}) to allow further upgrades`)
    }
}

async function poolConfiguration() {
    if (network.name == "localhost") {
      const accounts = await ethers.getSigners()
      return {
        reserveAddress: accounts[4].address,
        safetyModuleAddress: accounts[5].address,
        archethicPoolSigner: '0x200066681c09a9a8c9352fac9b96a688a4ae0b39',
        poolCap: ethers.parseEther('200')
      }
    }

    const config = hre.network.config
    const { reserve, safety, poolCap, archethicPoolSigner, multisig } = config.natif
    return {
      reserveAddress: reserve,
      safetyModuleAddress: safety,
      poolCap: poolCap,
      archethicPoolSigner: archethicPoolSigner,
      multisigAddress: multisig
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
