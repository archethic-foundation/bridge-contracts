import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import {
  encryptSecret,
  getGenesisAddress,
  getServiceGenesisAddress,
  getTokenAddress,
  sendTransactionWithFunding
} from "../utils.js"

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
  const seed = argv["seed"]
  const amount = argv["amount"]

  const tokenAddress = getTokenAddress(keychain, token)

  const serviceName = token + "_pool"
  const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)
  const factoryGenesisAddress = getServiceGenesisAddress(keychain, "Factory")
  const userAddress = getGenesisAddress(env.userSeed)

  const params = [userAddress, poolGenesisAddress, tokenAddress, amount]
  const htlcCode = await archethic.network.callFunction(factoryGenesisAddress, "get_signed_htlc", params)

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { encryptedSecret, authorizedKeys } = encryptSecret(seed, storageNonce)

  const htlcGenesisAddress = getGenesisAddress(seed)
  console.log("Signed HTLC genesis address:", htlcGenesisAddress)
  const index = await archethic.transaction.getTransactionIndex(htlcGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(htlcCode)
    .addOwnership(encryptedSecret, authorizedKeys)
    .build(seed, index)
    .originSign(Utils.originPrivateKey)

  sendTransactionWithFunding(tx, keychain, archethic, env.userSeed)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export default {
  command,
  describe,
  builder,
  handler
}
