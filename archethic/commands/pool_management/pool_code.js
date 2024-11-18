import Archethic from "@archethicjs/sdk"
import { getPoolCode } from "../utils.js"
import config from "../../config.js"

const command = "pool_code"
const describe = "Get the pool's code"
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
  const token = argv["token"]

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

  const poolCode = getPoolCode(envName, keychain, token)
  console.log(poolCode)
  process.exit(0)
}


export default {
  command,
  describe,
  builder,
  handler
}
