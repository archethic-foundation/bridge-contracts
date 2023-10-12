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

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  