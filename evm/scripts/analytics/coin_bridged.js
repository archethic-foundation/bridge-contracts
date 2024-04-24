const { ethers } = require("hardhat");
const bars = require('bars');

async function main() {
  const network = process.env["HARDHAT_NETWORK"]

  let coin
  switch (network) {
    case "sepolia":
      poolAddr = "0xcfBA4FA32527bFf23E073406c772e9a8b8D02650"
      coin = "ETH"
      break
    case "mumbai":
      coin = "MATIC"
      poolAddr = "0x56c86b45fCe906af9dF535EB27968aE46CBF170E"
      break

    case "bsc_testnet":
      coin = "BSC"
      poolAddr = "0xEF695C0C4034304300bD01f6C300a28000F2c163"
      break
  }

  console.log(`Fetching ${coin} swaps from pools for ${network}...`)

  const pool = await getPoolContract(poolAddr)
  const { total: chargeableAmount, count: nbChargeableSwaps, nbRefunds: nbRefundChargeable, nbIncompleted: nbIncompletedChargeable, history: chargeabelHistory } = await getChargeableStats(pool)
  const { total: signedAmount, count: nbSignedSwaps, nbRefunds: nbRefundSigned, nbIncompleted: nbIncompletedSigned, history: signedHistory } = await getSignedStats(pool)

  console.log("------------------------------------------")
  console.log(`${network} => Archethic`)
  console.log("------------------------------------------")
  console.log(`Cumul ${coin} bridged: ${chargeableAmount} (for ${nbChargeableSwaps} swaps)`)
  console.log(`Number of refunded swaps: ${nbRefundChargeable}`)
  console.log(`Number of incomplete swaps: ${nbIncompletedChargeable}`)
  console.log("---")
  console.log('History')
  console.log(bars(chargeabelHistory, { bar: '=', width: 20 }))

  console.log("")
  console.log("------------------------------------------")
  console.log(`Archethic => ${network}`)
  console.log("------------------------------------------")
  console.log(`Cumul ${coin} bridged: ${signedAmount} (for ${nbSignedSwaps} swaps)`)
  console.log(`Number of refunded swaps: ${nbRefundSigned}`)
  console.log(`Number of incomplete swaps: ${nbIncompletedSigned}`)
  console.log("---")
  console.log('History')
  console.log(bars(signedHistory, { bar: '=', width: 20 }))
}

async function getChargeableStats(pool) {
  const swapsAddresses = await pool.mintedSwaps()
  const swaps = await fetchSwaps(swapsAddresses, "ChargeableHTLC_ETH")
  return getStats(swaps)
}

async function getSignedStats(pool) {
  const swapsAddresses = await pool.provisionedSwaps()
  const swaps = await fetchSwaps(swapsAddresses, "SignedHTLC_ETH")
  return getStats(swaps)
}

async function getPoolContract(address) {
  return await ethers.getContractAt("ETHPool", address)
}

async function fetchSwaps(addresses, contractType) {
  return await Promise.all(addresses.map(async (swapAddress) => {
    const htlc = await ethers.getContractAt(contractType, swapAddress)
    return {
      status: await htlc.status(),
      lockTime: await htlc.lockTime(),
      amount: new Number(ethers.formatEther(await htlc.amount()))
    }
  }))
}

function getStats(swaps) {
  let bridgedAmount = 0.0
  let nbRefunds = 0
  let nbIncompleted = 0
  let nbSwaps = 0
  let history = {}

  swaps.forEach(({ status, amount, lockTime }) => {
    if (status == 0) {
      nbIncompleted++
    }
    if (status == 2) {
      nbRefunds++
    }
    bridgedAmount += amount
    nbSwaps++

    const date = new Date(lockTime.toString() * 1000)
    const day = date.toISOString().split('T')[0]
    history[day] ? history[day] += 1 : history[day] = 1
  })

  return { total: bridgedAmount, count: nbSwaps, nbRefunds, nbIncompleted, history }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1)
  });

