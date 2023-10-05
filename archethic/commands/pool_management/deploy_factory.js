import Archethic, { Utils } from "archethic"
import config from "../../config.js"
import { getGenesisAddress, getFactoryCode } from "../utils.js"

const command = "deploy_factory"
const describe = "Deploy the factory"
const builder = {
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string"
  }
}

const handler = async function(argv) {
  const envName = argv["env"] ? argv["env"] : "local"
  const env = config.environments[envName]

  const archethic = new Archethic(env.endpoint)
  await archethic.connect()

  const factoryGenesisAddress = getGenesisAddress(env.factorySeed)
  console.log("Factory genesis address:", factoryGenesisAddress)

  let factoryCode = getFactoryCode()
  // Replace protocol fee address
  factoryCode = factoryCode.replaceAll("#PROTOCOL_FEE_ADDRESS#", "0x" + env.protocolFeeAddress)

  const index = await archethic.transaction.getTransactionIndex(factoryGenesisAddress)

  const tx = archethic.transaction.new()
    .setType("contract")
    .setCode(factoryCode)
    .build(env.factorySeed, index)
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
