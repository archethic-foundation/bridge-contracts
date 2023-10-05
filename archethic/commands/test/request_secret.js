import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { getGenesisAddress, getPoolInfo } from "../utils.js"

const command = "request_secret"
const describe = "Request a pool to reveal the secret for a HTLC contract"
const builder = {
  token: {
    describe: "The token of the pool (used to retrieve pool address)",
    demandOption: true, // Required
    type: "string"
  },
  htlc_address: {
    describe: "The genesis address of the HTLC contract",
    demandOption: true,
    type: "string"
  },
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string"
  }
}

const handler = async function(argv) {
  const envName = argv["env"] ? argv["env"] : "local"
  const env = config.environments[envName]

  const token = argv["token"]
  const htlcGenesisAddress = argv["htlc_address"]

  const { poolGenesisAddress } = getPoolInfo(token)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const htlcAddressBefore = await getLastAddress(archethic, htlcGenesisAddress)

  const genesisAddress = getGenesisAddress(env.userSeed)
  console.log("User genesis address:", genesisAddress)
  const index = await archethic.transaction.getTransactionIndex(genesisAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "reveal_secret", [htlcGenesisAddress])
    .build(env.userSeed, index)
    .originSign(Utils.originPrivateKey)

  tx.on("fullConfirmation", (_confirmations) => {
    console.log("Secret request successfully sent !")
    console.log("Waiting for HTLC to withdraw ...")
    wait(htlcAddressBefore, htlcGenesisAddress, env.endpoint, archethic)
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

export default {
  command,
  describe,
  builder,
  handler
}
