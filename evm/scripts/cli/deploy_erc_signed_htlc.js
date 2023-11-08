const { ethers } = require("hardhat");
const crypto = require("crypto")
const { concatUint8Arrays, hexToUintArray, uintArrayToHex } = require("../../test/utils")
const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptSecretHash() {
    return new Promise(r => {
        readline.question("Secret hash (with 0x): ", input => {
            r(input)
        })
    })
}

async function promptEndTime() {
    return new Promise(r => {
        readline.question("End time (unix): ", input => {
            r(parseInt(input))
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

async function promptAmount() {
    return new Promise(r => {
        readline.question("Amount: ", input => {
            r(ethers.parseEther(input))
        })
    })
}

async function promptPoolAddress() {
    return new Promise(r => {
        readline.question("ERC20 pool's address [default: 0xBdEC1c3Bd0719DBa0B82a06C66EBab35dc71240B]: ", input => {
            if (input == "")
                return r("0xBdEC1c3Bd0719DBa0B82a06C66EBab35dc71240B")

            r(input)
        })
    })
}


async function main() {
    const poolAddr = await promptPoolAddress()
    const amount = await promptAmount()
    const lockTimeUnix = await promptEndTime()
    const hash = await promptSecretHash()
    const signature = await promptSignature()

    const pool = await ethers.getContractAt("ERCPool", poolAddr)

    const tx = await pool.provisionHTLC(hash, amount, lockTimeUnix, signature.r, signature.s, signature.v)
    const htlcContract = await pool.provisionedSwap(hash)

    console.log(`HTLC CONTRACT address: ${htlcContract}`)
    console.log(`HTLC TX address: ${tx.hash}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });


