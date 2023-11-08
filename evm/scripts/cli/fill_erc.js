const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptTokenName() {
    return new Promise(r => {
        readline.question("Token's definition [default: DummyToken]: ", input => {
            if (input == "")
                return r("DummyToken")

            r(input)
        })
    })
}

async function promptAmount() {
    return new Promise(r => {
        readline.question("Amount to transfer [default: 3000]: ", input => {
            if (input == "")
                return r(ethers.parseEther("3000"))

            r(ethers.parseEther(input))
        })
    })
}

async function promptTokenAddress() {
    return new Promise(r => {
        readline.question("Token's contract address: ", input => {
            r(input)
        })
    })
}
async function promptDestinationAddress() {
    return new Promise(r => {
        readline.question("Destination's address: ", input => {
            r(input)
        })
    })
}


async function main() {
    const tokenName = await promptTokenName()
    const tokenAddr = await promptTokenAddress()
    const destinationAddr = await promptDestinationAddress()
    const amount = await promptAmount()

    const tokenInstance = await ethers.getContractAt(tokenName, tokenAddr)
    return tokenInstance.transfer(destinationAddr, amount)
}

main()
    .then(() => {
        console.log("Transfer success")
        process.exit(0)
    })
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
