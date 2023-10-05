import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { getGenesisAddress, getPoolCode, getPoolInfo } from "../utils.js"

const command = "update_pool"
const describe = "Update an existing pool"
const builder = {
  token: {
    describe: "The token of the pool to update, UCO or token symbol",
    demandOption: true, // Required
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
  const { poolGenesisAddress } = getPoolInfo(token)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const indexPool = await archethic.transaction.getTransactionIndex(poolGenesisAddress)
  if (indexPool == 0) {
    console.log("Pool doesn't exists !")
    process.exit(1)
  }

  const poolCode = getPoolCode(env, token)

  const masterGenesisAddress = getGenesisAddress(env.masterSeed)
  console.log("Master genesis address:", masterGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(masterGenesisAddress)

  const updateTx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "update_code", [poolCode])
    .build(env.masterSeed, index)
    .originSign(Utils.originPrivateKey)

  updateTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(updateTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending pool transaction")
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
