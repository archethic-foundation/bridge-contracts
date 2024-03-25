const hre = { ethers, defender } = require("hardhat");

async function main() {

    //const proxyAddress = hre.network.config.natif.pool
    const proxyAddress = process.env["PROXY_ADDRESS"]
    if (!proxyAddress) {
        throw "PROXY_ADDRESS env variable is required"
    }

    const ETHPool = await ethers.getContractFactory("ETHPool");

    const proposal = await defender.proposeUpgradeWithApproval(
        proxyAddress,
        ETHPool,
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
