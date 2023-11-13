const hre = { ethers } = require("hardhat");

async function main() {
    const reservePrivateKey = process.env["RESERVE_PRIVATE_KEY"]
    if (reservePrivateKey === undefined) {
        throw "RESERVE_PRIVATE_KEY is not defined"
    }

    const signer = new ethers.Wallet(reservePrivateKey, ethers.provider)

    if (signer.address != hre.network.config.uco.reserve) {
        throw "Private key do not correspond to reserve account"
    }

    const poolAddress = hre.network.config.uco.pool

    const tokenInstance = await ethers.getContractAt("ERC20", hre.network.config.uco.token)
    const poolInstance = await ethers.getContractAt("ERCPool", poolAddress)

    const poolBalance = await tokenInstance.balanceOf(poolAddress)
    const poolCap = await poolInstance.poolCap()

    if (poolCap <= poolBalance) {
        throw "PoolCap is already reached"
    }

    // Keep 10% free
    const amountToRefill = (poolCap - poolBalance) * 90n / 100n

    const reserveBalance = await tokenInstance.balanceOf(hre.network.config.uco.reserve)

    if (reserveBalance <= 0) {
        throw "Reserve balance is empty"
    }

    let amount = amountToRefill
    if (amount > reserveBalance) {
        amount = reserveBalance
    }

    console.log("Amount to refill:", ethers.formatEther(amount))

    const tx = await tokenInstance.connect(signer).transfer(poolAddress, amount)
    console.log("Transaction sent:", tx.hash)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });
