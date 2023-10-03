import Archethic, { Crypto, Utils } from "archethic"
import config from "./config.js"

const env = config.environments.local

const args = []
process.argv.forEach(function(val, index, _array) { if (index > 1) { args.push(val) } })

if (args.length != 2) {
  console.log("Missing arguments")
  console.log("Usage: node deploy_htlc.js [poolAddress] [htlcGenesisAddress]")
  process.exit(1)
}

main()

async function main() {
  const endpoint = env.endpoint
  const seed = env.userSeed

  const poolGenesisAddress = args[0]
  const htlcGenesisAddress = args[1]

  const archethic = new Archethic(endpoint)
  await archethic.connect()

  const htlcAddressBefore = await getLastAddress(archethic, htlcGenesisAddress)

  const genesisAddress = Utils.uint8ArrayToHex(Crypto.deriveAddress(seed, 0))
  console.log("User genesis address:", genesisAddress)
  const index = await archethic.transaction.getTransactionIndex(genesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "reveal_secret", [htlcGenesisAddress])
    .build(seed, index)
    .originSign(Utils.originPrivateKey)

  tx.on("fullConfirmation", (_confirmations) => {
    console.log("Secret request successfully sent !")
    console.log("Waiting for HTLC to withdraw ...")
    wait(htlcAddressBefore, htlcGenesisAddress, endpoint, archethic)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}

async function getLastAddress(archethic, address) {
  return new Promise(async (resolve, reject) => {

    const query = `
    {
      lastTransaction(address: "${address}") {
        address
      }
    }
    `

    archethic.network.rawGraphQLQuery(query)
      .then(res => resolve(res.lastTransaction.address))
      .catch(err => reject(err))
  })
}

async function wait(htlcAddressBefore, htlcGenesisAddress, endpoint, archethic, i = 0) {
  const htlcAddressAfter = await getLastAddress(archethic, htlcGenesisAddress)
  if (i == 5) {
    console.log("HTLC didn't withdrawn")
    process.exit(1)
  } else if (htlcAddressBefore == htlcAddressAfter) {
    setTimeout(() => wait(htlcAddressBefore, htlcGenesisAddress, endpoint, archethic, i + 1), 500)
  } else {
    console.log("HTLC succesfully withdraw !")
    console.log("Address:", htlcAddressAfter)
    console.log(endpoint + "/explorer/transaction/" + htlcAddressAfter)
    process.exit(0)
  }
}
