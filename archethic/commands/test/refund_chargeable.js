import Archethic, { Utils } from "@archethicjs/sdk";
import config from "../../config.js";
import { getGenesisAddress } from "../utils.js";

const command = "refund_chargeable";
const describe = "Request a Chargeable HTLC to refund";
const builder = {
  htlc_address: {
    describe: "The genesis address of the HTLC contract",
    demandOption: true,
    type: "string",
  },
  evm_contract: {
    describe: "The HTLC EVM contract address",
    demandOption: true,
    type: "string",
  },
  env: {
    describe: "The environment config to use (default to local)",
    demandOption: false,
    type: "string",
  },
};

const handler = async function (argv) {
  const envName = argv["env"] ? argv["env"] : "local";
  const env = config.environments[envName];

  const htlcAddress = argv["htlc_address"];
  const evm_contract = argv["evm_contract"];

  const archethic = new Archethic(env.endpoint);
  await archethic.connect();

  const htlcAddressBefore = await getLastAddress(archethic, htlcAddress);

  const genesisAddress = getGenesisAddress(env.userSeed);
  console.log("User genesis address:", genesisAddress);
  const index = await archethic.transaction.getTransactionIndex(genesisAddress);

  // Get faucet before sending transaction
  // await requestFaucet(env.endpoint, poolGenesisAddress)

  const tx = archethic.transaction
    .new()
    .setType("transfer")
    .addRecipient(htlcAddress, "refund", [evm_contract])
    .build(env.userSeed, index)
    .originSign(Utils.originPrivateKey);

  tx.on("requiredConfirmation", (_confirmations) => {
    console.log("Secret successfully sent !");
    console.log("Waiting for HTLC to refund ...");
    wait(htlcAddressBefore, htlcAddress, env.endpoint, archethic);
  })
    .on("error", (context, reason) => {
      console.log("Error while sending transaction");
      console.log("Contest:", context);
      console.log("Reason:", reason);
      process.exit(1);
    })
    .send(50);
};

async function getLastAddress(archethic, address) {
  return new Promise(async (resolve, reject) => {
    const query = `
    {
      lastTransaction(address: "${address}") {
        address
      }
    }
    `;

    archethic.network
      .rawGraphQLQuery(query)
      .then((res) => resolve(res.lastTransaction.address))
      .catch((err) => reject(err));
  });
}

async function wait(
  htlcAddressBefore,
  htlcAddress,
  endpoint,
  archethic,
  i = 0,
) {
  const htlcAddressAfter = await getLastAddress(archethic, htlcAddress);
  if (i == 5) {
    console.log("HTLC didn't refund");
    process.exit(1);
  } else if (htlcAddressBefore == htlcAddressAfter) {
    setTimeout(
      () => wait(htlcAddressBefore, htlcAddress, endpoint, archethic, i + 1),
      500,
    );
  } else {
    console.log("HTLC succesfully refunded !");
    console.log("Address:", htlcAddressAfter);
    console.log(endpoint + "/explorer/transaction/" + htlcAddressAfter);
    process.exit(0);
  }
}

export default {
  command,
  describe,
  builder,
  handler,
};
