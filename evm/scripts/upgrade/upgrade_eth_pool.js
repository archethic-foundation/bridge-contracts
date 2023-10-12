const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if(proxyAddress === undefined) {
        throw "PROXY_ADDRESS is not defined"
    }

    const ETHPool = await ethers.getContractFactory("ETHPool");
    await upgrades.upgradeProxy(proxyAddress, ETHPool);

    console.log("ETH Pool upgraded");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  