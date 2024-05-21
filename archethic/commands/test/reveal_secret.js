import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getServiceGenesisAddress } from "../utils.js"

const command = "reveal_secret"
const describe = "Reveal a secret to an HTLC contract when swapping from EVM to Archethic"
const builder = {
  htlc_address: {
    describe: "The address of the HTLC contract",
    demandOption: true, // Required
    type: "string"
  },
  secret: {
    describe: "The secret allowing the contract to withdraw",
    demandOption: true,
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

  const htlcAddress = argv["htlc_address"]
  const secret = argv["secret"]

  const htlcAddressBefore = await getLastAddress(archethic, htlcAddress)

  const genesisAddress = getServiceGenesisAddress(keychain, "Master")
  console.log("Master genesis address:", genesisAddress)
  const index = await archethic.transaction.getTransactionIndex(genesisAddress)

  let tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(htlcAddress, "reveal_secret", [secret])

  tx = keychain.buildTransaction(tx, "Master", index).originSign(Utils.originPrivateKey)

  tx.on("requiredConfirmation", (_confirmations) => {
    console.log("Secret successfully sent !")
    console.log("Waiting for HTLC to withdraw ...")
    wait(htlcAddressBefore, htlcAddress, env.endpoint, archethic)
  }).on("error", (context, reason) => {
    console.log("Error while sending transaction")
    console.log("Contest:", context)
    console.log("Reason:", reason)
    process.exit(1)
  }).send(50)
}

async function getLastAddress(archethic, address) {
  return new Promise(async (resolve, reject) => {

    const query = `
    {
      lastTransaction(address: "${address}") {
        address
      }
    }
    `

    archethic.network.rawGraphQLQuery(query)
      .then(res => resolve(res.lastTransaction.address))
      .catch(err => reject(err))
  })
}

async function wait(htlcAddressBefore, htlcAddress, endpoint, archethic, i = 0) {
  const htlcAddressAfter = await getLastAddress(archethic, htlcAddress)
  if (i == 30) {
    console.log("HTLC didn't withdrawn")
    process.exit(1)
  } else if (htlcAddressBefore == htlcAddressAfter) {
    setTimeout(() => wait(htlcAddressBefore, htlcAddress, endpoint, archethic, i + 1), 500)
  } else {
    console.log("HTLC succesfully withdraw !")
    console.log("Address:", htlcAddressAfter)
    console.log(endpoint + "/explorer/transaction/" + htlcAddressAfter)
    process.exit(0)
  }
}

export default {
  command,
  describe,
  builder,
  handler
}
