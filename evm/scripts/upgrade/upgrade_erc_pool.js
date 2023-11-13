const hre = { ethers, upgrades } = require("hardhat");

async function main() {
    const proxyAddress = hre.network.config.uco.pool

    const adminPrivateKey = process.env["ADMIN_PRIVATE_KEY"]
    if (adminPrivateKey === undefined) {
        throw "ADMIN_PRIVATE_KEY is not defined"
    }

    const signer = new ethers.Wallet(adminPrivateKey, ethers.provider)
    const pool = await ethers.getContractAt("ERCPool", proxyAddress)

    // Ensure this pool is a ERCPool by calling the token() function
    try {
        await pool.token()
    } catch (_err) {
        throw "This pool is not an ERCPool"
    }

    const ERCPool = await ethers.getContractFactory("ERCPool", signer);
    await upgrades.upgradeProxy(proxyAddress, ERCPool);

    console.log("ERC Pool upgraded");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
