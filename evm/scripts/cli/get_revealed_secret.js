const { ethers } = require("hardhat");
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptAddress() {
    return new Promise(r => {
        readline.question("HTLC contract's address [default: 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492]: ", input => {
            if (input == "")
                return r("0xdA1eC8398C9dd5482dF534135f11bAC6A802E492")

            r(input)
        })
    })
}

async function main() {
    const contractAddress = await promptAddress()

    const htlc = await ethers.getContractAt("HTLCBase", contractAddress)

    if (await htlc.status() != 1) {
        console.log("HTLC is not withdrawn")
    } else {
        console.log("secret:", await htlc.secret())
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
