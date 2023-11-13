const hre = { ethers } = require("hardhat");

async function main() {
    const reservePrivateKey = process.env["RESERVE_PRIVATE_KEY"]
    if (reservePrivateKey === undefined) {
        throw "RESERVE_PRIVATE_KEY is not defined"
    }

    const signer = new ethers.Wallet(reservePrivateKey, ethers.provider)

    if (signer.address != hre.network.config.natif.reserve) {
        throw "Private key do not correspond to reserve account"
    }

    const poolAddress = hre.network.config.natif.pool

    const poolInstance = await ethers.getContractAt("ETHPool", poolAddress)

    const poolBalance = await ethers.provider.getBalance(poolAddress)
    const poolCap = await poolInstance.poolCap()

    if (poolCap <= poolBalance) {
        throw "PoolCap is already reached"
    }

    // Keep 10% free
    const amountToRefill = (poolCap - poolBalance) * 90n / 100n

    const reserveBalance = await ethers.provider.getBalance(hre.network.config.natif.reserve)

    if (reserveBalance <= 0) {
        throw "Reserve balance is empty"
    }

    let amount = amountToRefill
    if (amount > reserveBalance) {
        amount = reserveBalance
    }

    console.log("Amount to refill:", ethers.formatEther(amount))

    // Calculate Fees
    const gasAmount = await ethers.provider.estimateGas({ to: poolAddress, value: amount })
    const feeData = await ethers.provider.getFeeData()

    const feeAmount = gasAmount * feeData.gasPrice

    if (amount == reserveBalance) {
        amount -= feeAmount
        console.log("New amount after fee deduction:", ethers.formatEther(amount))
    } else if (amount + feeAmount > reserveBalance) {
        const overflow = (reserveBalance + feeAmount) - amount
        amount -= overflow
        console.log("New amount after fee deduction:", ethers.formatEther(amount))
    }

    const tx = await signer.sendTransaction({ to: poolAddress, value: amount })
    console.log("Transaction sent:", tx.hash)
    console.log("Care you have to send fund to the reserve address as the equivalent of the fees of this transaction")
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
