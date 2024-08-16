// let tokenInstance = await DummyToken.deployed()
// let recipientAddress = '0x24e57fc6cFb7F67928E32Aee3e3FF98f0e968a5d';
// let amountToSend = web3.utils.toWei('3000', 'ether');
// await tokenInstance.transfer(recipientAddress, amountToSend, { from: accounts[0] });


const { ethers } = require("hardhat");


async function main() {
    const tokenInstance = await ethers.getContractAt("DummyToken", "0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da")
    const ethPoolAddress = "0x26F8C6DB23a4aa5293eEeEe8A3317773e849CF44"
    await tokenInstance.transfer(ethPoolAddress, ethers.parseEther("3000"))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
