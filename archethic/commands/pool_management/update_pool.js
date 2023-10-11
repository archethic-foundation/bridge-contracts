import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getPoolCode, getServiceGenesisAddress } from "../utils.js"

const command = "update_pool"
const describe = "Update an existing pool"
const builder = {
  token: {
    describe: "The token of the pool to update, UCO or token symbol",
    demandOption: true, // Required
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
  const serviceName = token + "_pool"
  const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)

  const indexPool = await archethic.transaction.getTransactionIndex(poolGenesisAddress)
  if (indexPool == 0) {
    console.log("Pool doesn't exists !")
    process.exit(1)
  }

  const poolCode = getPoolCode(env, keychain, serviceName)

  const masterGenesisAddress = getServiceGenesisAddress(keychain, "Master")
  console.log("Master genesis address:", masterGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(masterGenesisAddress)

  let updateTx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "update_code", [poolCode])

  updateTx = keychain.buildTransaction(updateTx, "Master", index).originSign(Utils.originPrivateKey)

  updateTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(updateTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}

export default {
  command,
  describe,
  builder,
  handler
}
