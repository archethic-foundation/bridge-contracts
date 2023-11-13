const hre = { ethers, upgrades } = require("hardhat");

async function main() {

    const proxyAddress = hre.network.config.natif.pool

    const adminPrivateKey = process.env["ADMIN_PRIVATE_KEY"]
    if (adminPrivateKey === undefined) {
        throw "ADMIN_PRIVATE_KEY is not defined"
    }

    const signer = new ethers.Wallet(adminPrivateKey, ethers.provider)
    const pool = await ethers.getContractAt("ERCPool", proxyAddress)

    // Ensure this pool is a ERCPool by calling the token() function
    try {
        await pool.token()
        console.log("This pool is not an ETHPool")
        process.exit(1)
    } catch (_err) {
        null
    }

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
