import Archethic, { Utils } from "@archethicjs/sdk"
import config from "../../config.js"
import { getGenesisAddress } from "../utils.js"

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
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string"
  }
}

const handler = async function(argv) {
  const envName = argv["env"] ? argv["env"] : "local"
  const env = config.environments[envName]

  const htlcAddress = argv["htlc_address"]
  const secret = argv["secret"]

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const htlcAddressBefore = await getLastAddress(archethic, htlcAddress)

  const genesisAddress = getGenesisAddress(env.userSeed)
  console.log("User genesis address:", genesisAddress)
  const index = await archethic.transaction.getTransactionIndex(genesisAddress)

  // Get faucet before sending transaction
  // await requestFaucet(env.endpoint, poolGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("transfer")
    .addRecipient(htlcAddress, "reveal_secret", [secret])
    .build(env.userSeed, index)
    .originSign(Utils.originPrivateKey)

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
  if (i == 5) {
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
