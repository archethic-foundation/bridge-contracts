import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { getGenesisAddress, getPoolInfo, getTokenAddress } from "../utils.js"

const command = "provision_htlc"
const describe = "Provision a signed HTLC address and request the pool the create a secret"
const builder = {
  token: {
    describe: "The token to send to the htlc contract",
    demandOption: true, // Required
    type: "string"
  },
  htlc_address: {
    describe: "The genesis address of the HTLC contract to provision",
    demandOption: true,
    type: "string"
  },
  amount: {
    describe: "The amount to send to the htlc contract",
    demandOption: true,
    type: "float"
  },
  chainID: {
    describe: "The chain ID of the destination EVM blockchain",
    demandOption: false,
    type: "integer"
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
  const amount = argv["amount"]
  const chainId = argv["chainID"] ? argv["chainID"] : 1337

  const tokenAddress = getTokenAddress(token)

  const { poolGenesisAddress } = getPoolInfo(token)
  const userAddress = getGenesisAddress(env.userSeed)

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const index = await archethic.transaction.getTransactionIndex(userAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(poolGenesisAddress, "request_secret_hash", [htlcGenesisAddress, amount, userAddress, chainId])

  if (tokenAddress == "UCO") {
    tx.addUCOTransfer(htlcGenesisAddress, Utils.toBigInt(amount))
  } else {
    tx.addTokenTransfer(htlcGenesisAddress, Utils.toBigInt(amount), tokenAddress)
  }

  tx.build(env.userSeed, index)
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
