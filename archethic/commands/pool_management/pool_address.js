import Archethic from "@archethicjs/sdk"
import config from "../../config.js"
import {
  getServiceGenesisAddress,
  getPoolServiceName
} from "../utils.js"

const command = "pool_address"
const describe = "Get pool address"
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
  const serviceName = getPoolServiceName(token)

  keychain.addService(serviceName, "m/650'/" + serviceName)
  const poolGenesisAddress = getServiceGenesisAddress(keychain, serviceName)

  console.log("Pool genesis address:", poolGenesisAddress)
}

export default {
  command,
  describe,
  builder,
  handler
}
