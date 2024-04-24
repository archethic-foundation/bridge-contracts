const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (!proxyAddress) {
        throw "PROXY_ADDRESS env variable is required"
    }

    const ETHPool = await ethers.getContractFactory("ETHPool");

    const implementationAddress = await upgrades.deployImplementation(ETHPool)
    console.log(`New implementation at: ${implementationAddress}`);
    console.log("You have to make the upgrade transaction using the multisig wallet")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
