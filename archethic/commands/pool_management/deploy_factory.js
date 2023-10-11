import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getFactoryCode, getServiceGenesisAddress, sendTransactionWithFunding } from "../utils.js"

const command = "deploy_factory"
const describe = "Deploy the factory"
const builder = {
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

  const factoryGenesisAddress = getServiceGenesisAddress(keychain, "Factory")
  console.log("Factory genesis address:", factoryGenesisAddress)

  const factoryCode = getFactoryCode(keychain)

  const index = await archethic.transaction.getTransactionIndex(factoryGenesisAddress)

  let factoryTx = archethic.transaction.new()
    .setType("contract")
    .setCode(factoryCode)

  factoryTx = keychain.buildTransaction(factoryTx, "Factory", index).originSign(Utils.originPrivateKey)

  sendTransactionWithFunding(factoryTx, keychain, archethic)
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export default {
  command,
  describe,
  builder,
  handler
}
