const hre = require("hardhat");
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

async function promptSupply() {
    return new Promise(r => {
        readline.question("Token's supply [default: 200_000]: ", input => {
            if (input == "")
                return r(hre.ethers.parseEther("200000"))

            r(hre.ethers.parseEther(input))
        })
    })
}


async function main() {
    const tokenName = await promptTokenName()
    const supply = await promptSupply()

    const contract = await hre.ethers.deployContract(tokenName, [supply])
    console.log(`Token's contract deployed at: ${await contract.getAddress()}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
