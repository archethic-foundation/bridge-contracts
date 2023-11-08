const hre = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptTokenAddress() {
    return new Promise(r => {
        readline.question("token address: ", input => {
            r(input)
        })
    })
}
async function promptWalletAddress() {
    return new Promise(r => {
        readline.question("wallet address: ", input => {
            r(input)
        })
    })
}
async function promptTokenName() {
    return new Promise(r => {
        readline.question("Token's definition [default: DummyToken]: ", input => {
            if (input == "")
                return r("DummyToken")

            r(input)
        })
    })
}

async function main() {
    const tokenName = await promptTokenName()
    const tokenAddr = await promptTokenAddress()
    const walletAddr = await promptWalletAddress()

    const tokenInstance = await hre.ethers.getContractAt(tokenName, tokenAddr)
    const balance = await tokenInstance.balanceOf(walletAddr)
    const symbol = await tokenInstance.symbol();

    console.log(`wallet balance: ${hre.ethers.formatEther(balance)} ${symbol}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });