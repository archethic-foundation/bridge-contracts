const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (proxyAddress === undefined) {
        throw "PROXY_ADDRESS is not defined"
    }

    const pool = await ethers.getContractAt("ERCPool", proxyAddress)
    try {
        // Ensure this pool is not an ERCPool by calling the token() function
        await pool.token()

        console.log("This pool is not an ETHPool")
        process.exit(1)
    } catch (_err) {
        const ETHPool = await ethers.getContractFactory("ETHPool");
        await upgrades.upgradeProxy(proxyAddress, ETHPool);

        console.log("ETH Pool upgraded");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
