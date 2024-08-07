const hre = { ethers, upgrades, network }  = require("hardhat");

async function main() {
    const { archethicPoolSigner, multisigAddress } = await poolConfiguration()
    const lockTimePeriod = 7200; // 2H

    const ETHPool = await ethers.getContractFactory("ETHPool");
    const accounts = await ethers.getSigners()
    const instance = await upgrades.deployProxy(ETHPool, [
        archethicPoolSigner,
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
      return {
        archethicPoolSigner: '0x200066681c09a9a8c9352fac9b96a688a4ae0b39',
      }
    }

    const config = hre.network.config
    const { archethicPoolSigner, multisig } = config.natif
    return {
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
