import Archethic, { Utils } from "@archethicjs/sdk"
import keccak256 from "keccak256"
import config from "../../config.js"

const command = "derive_eth_address"
const describe = "Derive the corresponding EVM address from a pool service"
const builder = {
  token: {
    describe: "The token of the pool to derive the address",
    demandOption: true, // Required
    type: "string"
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

  const serviceName = token + "_pool"
  keychain.addService(serviceName, "m/650'/" + serviceName, "secp256k1")

  const { publicKey } = keychain.deriveKeypair(serviceName, 0)

  // Slice 3 to remove first 2 bytes (curve / origin) and 3rd byte hardcoded as 4 in ethereum
  const hash = keccak256(Buffer.from(publicKey.slice(3)))
  const eth_address = [...hash].slice(-20)

  console.log("0x" + Utils.uint8ArrayToHex(eth_address))

  process.exit(0)
}

export default {
  command,
  describe,
  builder,
  handler
}
