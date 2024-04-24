const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (proxyAddress === undefined) {
        throw "PROXY_ADDRESS is not defined"
    }

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
