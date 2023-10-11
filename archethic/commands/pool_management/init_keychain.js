import Archethic, { Utils, Keychain, Crypto } from "@archethicjs/sdk"
import config from "../../config.js"
import { getGenesisAddress, getServiceGenesisAddress } from "../utils.js"

const command = "init_keychain"
const describe = "Initialize the bridge keychain with the primary services"
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

  try {
    const keychain = await archethic.account.getKeychain(keychainAccessSeed)
    const keychainAddress = getGenesisAddress(keychain.seed)
    console.log("Keychain already exists !")
    console.log("Keychain address:", keychainAddress)
    process.exit(1)
  } catch (_err) { }

  const { publicKey: accessPublicKey } = Crypto.deriveKeyPair(keychainAccessSeed, 0)

  const keychainSeed = env.keychainSeed ? env.keychainSeed : Crypto.randomSecretKey()
  const keychain = new Keychain(keychainSeed)
    .addService("Master", "m/650'/Master")
    .addService("ProtocolFee", "m/650'/ProtocolFee")
    .addService("Factory", "m/650'/Factory")
    .addAuthorizedPublicKey(accessPublicKey);

  console.log("Master genesis address:", getServiceGenesisAddress(keychain, "Master"))
  console.log("ProtocolFee genesis address:", getServiceGenesisAddress(keychain, "ProtocolFee"))
  console.log("Factory genesis address:", getServiceGenesisAddress(keychain, "Factory"))
  console.log("=======================")

  const keychainGenesisAddress = Crypto.deriveAddress(keychain.seed, 0)
  const keychainAccessTx = archethic.account.newAccessTransaction(keychainAccessSeed, keychainGenesisAddress)
    .originSign(Utils.originPrivateKey)

  keychainAccessTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(keychainAccessTx.address)
    console.log("Keychain Access transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    process.exit(0)
  }).on("error", (context, reason) => {
    console.log("Error while sending Keychain Access transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  })

  const keychainTx = archethic.account.newKeychainTransaction(keychain, 0)
    .originSign(Utils.originPrivateKey)

  keychainTx.on("fullConfirmation", async (_confirmations) => {
    const txAddress = Utils.uint8ArrayToHex(keychainTx.address)
    console.log("Keychain transaction validated !")
    console.log("Address:", txAddress)
    console.log(env.endpoint + "/explorer/transaction/" + txAddress)
    console.log("=======================")
    keychainAccessTx.send()
  }).on("error", (context, reason) => {
    console.log("Error while sending Keychain transaction")
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
