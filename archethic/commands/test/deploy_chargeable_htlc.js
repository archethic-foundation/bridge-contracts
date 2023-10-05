import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { encryptSecret, getGenesisAddress, getPoolInfo, getTokenAddress } from "../utils.js"

const command = "deploy_chargeable_htlc"
const describe = "Deploy a chargeable HTLC to swap from EVM to Archethic"
const builder = {
  token: {
    describe: "The token to receive on Archethic",
    demandOption: true, // Required
    type: "string"
  },
  seed: {
    describe: "The seed to use for create the HTLC contract",
    demandOption: true,
    type: "string"
  },
  endtime: {
    describe: "The end time provided by the EVM contract",
    demandOption: true,
    type: "integer"
  },
  amount: {
    describe: "The amount to receive from the swap",
    demandOption: true,
    type: "float"
  },
  secret_hash: {
    describe: "The hash of the secret",
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
  const seed = argv["seed"]
  const endTime = argv["endtime"]
  const amount = argv["amount"]
  const secretHash = argv["secret_hash"]

  const tokenAddress = getTokenAddress(token)

  const { poolGenesisAddress } = getPoolInfo(token)
  const factoryGenesisAddress = getGenesisAddress(env.factorySeed)
  const userAddress = getGenesisAddress(env.userSeed)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const params = [endTime, userAddress, poolGenesisAddress, secretHash, tokenAddress, amount]
  const htlcCode = await archethic.network.callFunction(factoryGenesisAddress, "get_chargeable_htlc", params)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSecret, authorizedKeys } = encryptSecret(seed, storageNonce)

  const htlcGenesisAddress = getGenesisAddress(seed)
  console.log("Chargeable HTLC genesis address:", htlcGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(htlcGenesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(env.endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(htlcCode)
    .addRecipient(poolGenesisAddress, "request_funds", [endTime, amount, userAddress, secretHash])
    .addOwnership(encryptedSecret, authorizedKeys)
    .build(seed, index)
    .originSign(Utils.originPrivateKey)

  tx.on("fullConfirmation", (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(tx.address)
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
