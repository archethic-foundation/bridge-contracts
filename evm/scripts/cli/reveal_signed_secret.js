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

async function promptSecret() {
    return new Promise(r => {
        readline.question("Secret (with 0x): ", input => {
            r(input)
        })
    })
}

async function promptSignature() {
    return new Promise(resolve => {
        readline.question("Signature.r: ", r => {
            readline.question("Signature.s: ", s => {
                readline.question("Signature.v: ", v => {
                    resolve({ r, s, v: parseInt(v) })
                })
            })
        })
    })
}


async function main() {
    const contractAddress = await promptAddress()
    const secret = await promptSecret()
    const secretSignature = await promptSignature()

    const htlc = await ethers.getContractAt("SignedHTLC_ETH", contractAddress)

    return htlc.withdraw(secret, secretSignature.r, secretSignature.s, secretSignature.v)
        .then(() => console.log("Withdraw successful"))
        .catch(er => console.log(er.message))
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
