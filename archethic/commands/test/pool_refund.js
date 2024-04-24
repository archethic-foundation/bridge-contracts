import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getGenesisAddress, getPoolServiceName, getServiceGenesisAddress } from "../utils.js"

const command = "pool_refund"
const describe = "Request a pool to refund a signed htlc"
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
  access_seed: {
    describe: "the keychain access seed (default in env config)",
    demandOption: false,
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

  const keychainAccessSeed = argv["access_seed"] ? argv["access_seed"] : env.keychainAccessSeed

  if (keychainAccessSeed == undefined) {
    console.log("Keychain access seed not defined")
    process.exit(1)
  }

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  let keychain

  try {
    keychain = await archethic.account.getKeychain(keychainAccessSeed)
  } catch (err) {
    console.log(err)
    process.exit(1)
  }

  const token = argv["token"]
  const htlcGenesisAddress = argv["htlc_address"]

  const serviceName = getPoolServiceName(token)
  const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)

  const htlcAddressBefore = await getLastAddress(archethic, htlcGenesisAddress)

  const genesisAddress = getGenesisAddress(env.userSeed)
  console.log("User genesis address:", genesisAddress)
  const index = await archethic.transaction.getTransactionIndex(genesisAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "refund", [htlcGenesisAddress])
    .build(env.userSeed, index)
    .originSign(Utils.originPrivateKey)

  tx.on("requiredConfirmation", (_confirmations) => {
    console.log("Refund request successfully sent !")
    console.log("Waiting for HTLC to refund ...")
    wait(htlcAddressBefore, htlcGenesisAddress, env.endpoint, archethic)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send(50)
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
    console.log("HTLC didn't refund")
    process.exit(1)
  } else if (htlcAddressBefore == htlcAddressAfter) {
    setTimeout(() => wait(htlcAddressBefore, htlcGenesisAddress, endpoint, archethic, i + 1), 500)
  } else {
    console.log("HTLC succesfully refunded !")
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
