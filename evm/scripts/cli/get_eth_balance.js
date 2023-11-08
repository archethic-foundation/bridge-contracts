const hre = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptAddress() {
    return new Promise(r => {
        readline.question("address: ", input => {
            readline.close()
            r(input)
        })
    })
}

async function main() {
    const address = await promptAddress()
    const balance = await hre.ethers.provider.getBalance(address)
    console.log(`wallet balance: ${hre.ethers.formatEther(balance)} ETH`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });