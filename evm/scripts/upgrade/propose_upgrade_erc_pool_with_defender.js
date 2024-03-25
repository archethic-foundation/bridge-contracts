const hre = { ethers, defender } = require("hardhat");

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
    const proposal = await defender.proposeUpgradeWithApproval(
        proxyAddress,
        ERCPool,
        {redeployImplementation: "always"}
      )

   console.log(`Upgrade proposed with URL: ${proposal.url}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
