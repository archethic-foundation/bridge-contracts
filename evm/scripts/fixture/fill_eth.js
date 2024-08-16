const { ethers } = require("hardhat");

async function main() {
    const accounts = await ethers.getSigners()
    const ethPoolAddress = "0x727a6097967815885c51551961e6c3f022616f6A"
    await accounts[0].sendTransaction({
        to: ethPoolAddress,
        value: ethers.parseEther("50"),
    });
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
