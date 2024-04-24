const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (!proxyAddress) {
        throw "PROXY_ADDRESS env variable is required"
    }

    const pool = await ethers.getContractAt("ERCPool", proxyAddress)
    // Ensure this pool is a ERCPool by calling the token() function
    try {
        await pool.token()
    } catch (_err) {
        throw "This pool is not an ERCPool"
    }

    const ERCPool = await ethers.getContractFactory("ERCPool");

    const implementationAddress = await upgrades.deployImplementation(ERCPool)
    console.log(`New implementation at: ${implementationAddress}`);
    console.log("You have to make the upgrade using the multisig wallet")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
