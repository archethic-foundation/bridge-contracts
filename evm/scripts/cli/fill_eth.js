const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptAmount() {
    return new Promise(r => {
        readline.question("Amount to transfer [3000 default]: ", input => {
            if (input == "")
                return r(ethers.parseEther("3000"))

            r(ethers.parseEther(input))
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
    const amount = await promptAmount()
    const destinationAddress = await promptDestinationAddress()

    const accounts = await ethers.getSigners()
    return accounts[0].sendTransaction({
        to: destinationAddress,
        value: amount,
    });
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
