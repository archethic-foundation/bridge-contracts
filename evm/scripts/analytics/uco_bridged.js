const { ethers }  = require("hardhat");


async function main() {
  const network = process.env["HARDHAT_NETWORK"]

  console.log(`Fetching cumul of UCO bridged from pools for ${network}...`)

  let poolAddr
  switch(network) {
    case "sepolia":
      poolAddr = "0x50b8B73327613468e5605eD59B980555DAAC354a"
      break
    case "mumbai":
      poolAddr = "0xe55915D112711127339f073e75185E6311Dd72C8"
      break

    case "bsc_testnet":
      poolAddr = "0xacc408CB6D6D9C73C6003269D322cb78150fc137"
      break
  }

  const pool = await getPoolContract(poolAddr)
  const { total: chargeableAmount, count: nbChargeableSwaps} = await getChargeableCumul(pool)
  const { total: signedAmount, count: nbSignedSwaps} = await getSignedCumul(pool)

  console.log("------------------------------------------")
  console.log(`Cumul UCO bridged ${network}->Archethic: ${chargeableAmount} (for ${nbChargeableSwaps} swaps)`)
  console.log(`Cumul UCO bridged Archethic->${network}: ${signedAmount} (for ${nbSignedSwaps} swaps)`)
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

