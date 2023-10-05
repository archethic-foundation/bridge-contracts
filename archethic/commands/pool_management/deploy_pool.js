import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import {
  getPoolInfo,
  getStateInfo,
  getPoolCode,
  getStateCode,
  encryptSecret,
  getTokenDefinition,
  getGenesisAddress
} from "../utils.js"

const command = "deploy_pool"
const describe = "Deploy a pool"
const builder = {
  token: {
    describe: "The token to create a pool, UCO or token symbol",
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
  const { poolSeed, poolGenesisAddress } = getPoolInfo(token)
  const { stateSeed, stateContractAddress } = getStateInfo(token)

  console.log("Pool genesis address:", poolGenesisAddress)

  const poolCode = getPoolCode(env, token)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSecret, authorizedKeys } = encryptSecret(poolSeed, storageNonce)

  const index = await archethic.transaction.getTransactionIndex(poolGenesisAddress)
  if (index > 0) {
    console.log("Pool already exists !")
    process.exit(1)
  }

  const poolTx = archethic.transaction.new()
    .setCode(poolCode)
    .addOwnership(encryptedSecret, authorizedKeys)

  if (token != "UCO") {
    poolTx.setType("token")
      .setContent(getTokenDefinition(token))
      .addUCOTransfer(stateContractAddress, Utils.toBigInt(50))
  } else {
    poolTx.setType("contract")
  }

  poolTx.build(poolSeed, index).originSign(Utils.originPrivateKey)

  poolTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(poolTx.address)
    console.log("Transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    if (token != "UCO") {
      deployStateContract(archethic, stateSeed, storageNonce)
        .then(() => process.exit(0))
        .catch(() => process.exit(1))
    } else {
      process.exit(0)
    }
  }).on("error", (context, reason) => {
    console.log("Error while sending pool transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send()
}

async function deployStateContract(archethic, seed, storageNonce) {
  return new Promise(async (resolve, reject) => {
    const genesisAddress = getGenesisAddress(seed)
    const { encryptedSecret, authorizedKeys } = encryptSecret(seed, storageNonce)

    const code = getStateCode()

    const index = await archethic.transaction.getTransactionIndex(genesisAddress)

    const tx = archethic.transaction.new()
      .setType("contract")
      .setCode(code)
      .setContent("{}")
      .addOwnership(encryptedSecret, authorizedKeys)
      .build(seed, index).originSign(Utils.originPrivateKey)

    tx.on("fullConfirmation", async (_confirmations) => {
      resolve()
    }).on("error", (context, reason) => {
      console.log("Error while sending state transaction")
      console.log("Contest:", context)
      console.log("Reason:", reason)
      reject()
    }).send()
  })
}

export default {
  command,
  describe,
  builder,
  handler
}
