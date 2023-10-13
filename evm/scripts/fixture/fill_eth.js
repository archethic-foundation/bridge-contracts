const { ethers }  = require("hardhat");

async function main() {
    const accounts = await ethers.getSigners()
    const ethPoolAddress = "0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da"
    await accounts[0].sendTransaction({
        to: ethPoolAddress,
        value: ethers.parseEther("50"),
    });
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  