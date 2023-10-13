// let tokenInstance = await DummyToken.deployed()
// let recipientAddress = '0x24e57fc6cFb7F67928E32Aee3e3FF98f0e968a5d';
// let amountToSend = web3.utils.toWei('3000', 'ether');
// await tokenInstance.transfer(recipientAddress, amountToSend, { from: accounts[0] });


const { ethers }  = require("hardhat");


async function main() {
    const tokenInstance = await ethers.getContractAt("DummyToken", "0xBdEC1c3Bd0719DBa0B82a06C66EBab35dc71240B")
    const ethPoolAddress = "0xaa74722D2cB78D4b5e52c2Ee7F12fe08851baa5F"
    await tokenInstance.transfer(ethPoolAddress, ethers.parseEther("3000"))
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  