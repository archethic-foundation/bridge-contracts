const { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (proxyAddress === undefined) {
        throw "PROXY_ADDRESS is not defined"
    }

    const pool = await ethers.getContractAt("ERCPool", proxyAddress)
    try {
        // Ensure this pool is a ERCPool by calling the token() function
        await pool.token()
        const ERCPool = await ethers.getContractFactory("ERCPool");
        await upgrades.upgradeProxy(proxyAddress, ERCPool);

        console.log("ERC Pool upgraded");
    } catch (_err) {
        console.log("This pool is not an ERCPool")
        process.exit(1)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
