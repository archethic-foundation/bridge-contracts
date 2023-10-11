import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import {
  getPoolCode,
  getStateCode,
  getTokenDefinition,
  getServiceGenesisAddress,
  sendTransactionWithFunding,
  updateKeychain
} from "../utils.js"

const command = "deploy_pool"
const describe = "Deploy a pool"
const builder = {
  token: {
    describe: "The token to create a pool, UCO or token symbol",
    demandOption: true, // Required
    type: "string"
  },
  access_seed: {
    describe: "The Keychain access seed (default in env config)",
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

  keychain.addService(serviceName, "m/650'/" + serviceName)
  const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)

  console.log("Pool genesis address:", poolGenesisAddress)

  const poolCode = getPoolCode(env, keychain, serviceName)

  const index = await archethic.transaction.getTransactionIndex(poolGenesisAddress)
  if (index > 0) {
    console.log("Pool already exists !")
    process.exit(1)
  }

  const storageNonce = await archethic.network.getStorageNoncePublicKey()
  const { secret, authorizedPublicKeys } = keychain.ecEncryptServiceSeed(serviceName, [storageNonce])

  let poolTx = archethic.transaction.new()
    .setCode(poolCode)
    .addOwnership(secret, authorizedPublicKeys)

  if (token != "UCO") {
    poolTx.setType("token").setContent(getTokenDefinition(token))
  } else {
    poolTx.setType("contract")
  }

  poolTx = keychain.buildTransaction(poolTx, serviceName, index).originSign(Utils.originPrivateKey)

  updateKeychain(keychain, archethic)
    .then(() => sendTransactionWithFunding(poolTx, keychain, archethic))
    .then(() => {
      if (token != "UCO") {
        console.log("=======================")
        console.log("Deploying contract state")
        return deployStateContract(archethic, keychain, serviceName, storageNonce)
      } else {
        process.exit(0)
      }
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

async function deployStateContract(archethic, keychain, serviceName, storageNonce) {
  const stateName = serviceName + "_state"
  keychain.addService(stateName, "m/650'/" + stateName)
  const { secret, authorizedPublicKeys } = keychain.ecEncryptServiceSeed(stateName, [storageNonce])

  const code = getStateCode(keychain, serviceName)

  let tx = archethic.transaction.new()
    .setType("contract")
    .setCode(code)
    .setContent("{}")
    .addOwnership(secret, authorizedPublicKeys)

  tx = keychain.buildTransaction(tx, stateName, 0).originSign(Utils.originPrivateKey)

  return sendTransactionWithFunding(tx, keychain, archethic)
}

export default {
  command,
  describe,
  builder,
  handler
}
