const { ethers, toNumber } = require("ethers")

let args = []
process.argv.forEach(function (val, index, array) {
    if (index > 1) {
        args.push(val)
    }
});

if (args.length != 1) {
    console.log("Invalid arguments")
    console.log("Usage: node refundable_contracts.js [pool address as 0x......]")
    return
}

const poolAddress = args[0]

if(! /^0x[0-9a-fA-F]+$/.test(poolAddress)) {
    console.log("Pool address must be like 0x...")
    return;
}

const PROVIDER_URL = process.env["PROVIDER_URL"] || "http://127.0.0.1:7545"
const provider = new ethers.JsonRpcProvider(PROVIDER_URL)

const poolABI = [
    "function provisionedSwaps() view returns (address[] memory)"
]

const poolContract = new ethers.Contract(poolAddress, poolABI, provider);

poolContract.provisionedSwaps().then(async swaps => {

    const HTLC_ABI = [
        "function finished() view returns(bool)",
        "function startTime() view returns(uint256)",
        "function lockTime() view returns(uint256)"
    ]

    let htlcToRefund = []

    for (let i = 0; i < swaps.length; i++) {
        const swapAddress = swaps[i];

        const htlcContract = new ethers.Contract(swapAddress, HTLC_ABI, provider);

        const finished = await htlcContract.finished()
        const startTime = await htlcContract.startTime()
        const lockTime = await htlcContract.lockTime()

        const lockDate = new Date((toNumber(startTime) + toNumber(lockTime)) * 1000)
        const currentDate = new Date()

        if (!finished && lockDate.getTime() < currentDate.getTime()) {
            htlcToRefund.push(swapAddress)
        }
    }

    console.log("--------------------------")
    console.log("List of contracts to refund:")
    console.log("--------------------------")
    for (let i = 0; i < htlcToRefund.length; i++) {
        console.log("- ", htlcToRefund[i]);
    }
})
