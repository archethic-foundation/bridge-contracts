import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { encryptSecret, getGenesisAddress, getPoolInfo, getTokenAddress } from "../utils.js"

const command = "deploy_signed_htlc"
const describe = "Deploy a signed HTLC to swap from Archethic to EVM"
const builder = {
  token: {
    describe: "The token to send to EVM",
    demandOption: true, // Required
    type: "string"
  },
  seed: {
    describe: "The seed to use for create the HTLC contract",
    demandOption: true,
    type: "string"
  },
  amount: {
    describe: "The amount to send to the swap",
    demandOption: true,
    type: "float"
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
  const amount = argv["amount"]

  const tokenAddress = getTokenAddress(token)

  const { poolGenesisAddress } = getPoolInfo(token)
  const factoryGenesisAddress = getGenesisAddress(env.factorySeed)
  const userAddress = getGenesisAddress(env.userSeed)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const params = [userAddress, poolGenesisAddress, tokenAddress, amount]
  const htlcCode = await archethic.network.callFunction(factoryGenesisAddress, "get_signed_htlc", params)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSecret, authorizedKeys } = encryptSecret(seed, storageNonce)

  const htlcGenesisAddress = getGenesisAddress(seed)
  console.log("Signed HTLC genesis address:", htlcGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(htlcGenesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(env.endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(htlcCode)
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
