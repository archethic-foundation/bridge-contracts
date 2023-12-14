const { ethers }  = require("hardhat");


async function main() {
  const network = process.env["HARDHAT_NETWORK"]
  
  let coin
  switch(network) {
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

  console.log(`Fetching cumul of ${coin} bridged from pools for ${network}...`)

  const pool = await getPoolContract(poolAddr)
  const { total: chargeableAmount, count: nbChargeableSwaps} = await getChargeableCumul(pool)
  const { total: signedAmount, count: nbSignedSwaps} = await getSignedCumul(pool)

  console.log("------------------------------------------")
  console.log(`Cumul ${coin} bridged ${network}->Archethic: ${chargeableAmount} (for ${nbChargeableSwaps} swaps)`)
  console.log(`Cumul ${coin} bridged Archethic->${network}: ${signedAmount} (for ${nbSignedSwaps} swaps)`)
  console.log("------------------------------------------")
}

async function getChargeableCumul(pool) {
  const swapsAddresses = await pool.mintedSwaps()
  return await getCumulAmount(swapsAddresses, "ChargeableHTLC_ERC")
}

async function getSignedCumul(pool) {
  const swapsAddresses = await pool.provisionedSwaps()
  return await getCumulAmount(swapsAddresses, "SignedHTLC_ERC")
}

async function getPoolContract(address) {
  return await ethers.getContractAt("ERCPool", address)
}

async function getCumulAmount(swapsAddresses, contractType) {
  promises = await Promise.all(swapsAddresses.map(async (swapAddress) => {
    const htlc = await ethers.getContractAt(contractType, swapAddress)
    const htlcStatus = await htlc.status()
    if (htlcStatus == 1) {
      const htlcAmount = await htlc.amount()
      return htlcAmount
    } else {
      return 0
    }
  }))


  let bridgedAmount = 0.0
  promises.forEach(amount => {
    bridgedAmount += new Number(ethers.formatEther(amount))
  })

  return { total: bridgedAmount, count: swapsAddresses.length }

}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1)
    });

