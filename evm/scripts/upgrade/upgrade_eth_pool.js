const hre = { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = hre.network.config.natif.pool

    const adminPrivateKey = process.env["ADMIN_PRIVATE_KEY"]
    if (adminPrivateKey === undefined) {
        throw "ADMIN_PRIVATE_KEY is not defined"
    }

    const signer = new ethers.Wallet(adminPrivateKey, ethers.provider)
    const ETHPool = await ethers.getContractFactory("ETHPool", signer);
    await upgrades.upgradeProxy(proxyAddress, ETHPool);

    console.log("ETH Pool upgraded");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
