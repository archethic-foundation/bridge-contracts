const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if(proxyAddress === undefined) {
        throw "PROXY_ADDRESS is not defined"
    }

    const ERCPool = await ethers.getContractFactory("ERCPool");
    await upgrades.upgradeProxy(proxyAddress, ERCPool);

    console.log("ERC Pool upgraded");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });