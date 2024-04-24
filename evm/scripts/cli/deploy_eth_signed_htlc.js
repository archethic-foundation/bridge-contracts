const { ethers } = require("hardhat");
const crypto = require("crypto")
const { concatUint8Arrays, hexToUintArray, uintArrayToHex } = require("../../test/utils")

const readline = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
})

async function promptArchethicHTLCAddress() {
    return new Promise(r => {
        readline.question("Archethic HTLC address: ", input => {
            r(input)
        })
    })
}

async function promptSecretHash() {
    return new Promise(r => {
        readline.question("secret hash (with 0x): ", input => {

            r(input)
        })
    })
}

async function promptEndTime() {
    return new Promise(r => {
        readline.question("end time (unix): ", input => {

            r(parseInt(input))
        })
    })
}

async function promptSignature() {
    return new Promise(resolve => {
        readline.question("r: ", r => {
            readline.question("s: ", s => {
                readline.question("v: ", v => {

                    resolve({ r, s, v: parseInt(v) })
                })
            })
        })
    })
}

async function promptAmount() {
    return new Promise(r => {
        readline.question("amount: ", input => {

            r(ethers.parseEther(input))
        })
    })
}
async function promptPoolAddress() {
    return new Promise(r => {
        readline.question("ETH pool's address [default: 0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da]: ", input => {
            if (input == "")
                return r("0x39C9DBD60B0eAF256Ebc509D2b837d508dD4F2Da")

            r(input)
        })
    })
}


async function main() {
    const poolAddress = await promptPoolAddress()
    const amount = await promptAmount()
    const lockTimeUnix = await promptEndTime()
    const hash = await promptSecretHash()
    const signature = await promptSignature()
    const archethicHTLCAddress = await promptArchethicHTLCAddress()

    const pool = await ethers.getContractAt("ETHPool", poolAddress)
    const tx = await pool.provisionHTLC(hash, amount, lockTimeUnix, `0x${archethicHTLCAddress}`, signature.r, signature.s, signature.v, { gasLimit: 10000000 })
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
