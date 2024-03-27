import cron from "node-cron";
import config from "config";
import Archethic, { Utils } from "@archethicjs/sdk";
import { Level } from "level";

import getTokenBalance from "./src/archethic/get-token-balance.js";
import getUCOBalance from "./src/archethic/get-uco-balance.js";
import getHTLCStatuses, {
  HTLC_STATUS,
} from "./src/archethic/get-htlc-statuses.js";

const ENDPOINT = config.get("archethic.endpoint");
const PROTOCOL_FEES = config.get("archethic.protocolFeesAddress");

const pools = {
  UCO: config.get("archethic.pools.UCO.address"),
  aeETH: config.get("archethic.pools.aeETH.address"),
  aeBNB: config.get("archethic.pools.aeBNB.address"),
  aeMATIC: config.get("archethic.pools.aeMATIC.address"),
};

const tokens = {
  aeETH: config.get("archethic.pools.aeETH.tokenAddress"),
  aeBNB: config.get("archethic.pools.aeBNB.tokenAddress"),
  aeMATIC: config.get("archethic.pools.aeMATIC.tokenAddress"),
};

//
console.log(`Connecting to endpoint ${ENDPOINT}...`);
const archethic = new Archethic(ENDPOINT);
await archethic.connect();
console.log(`Connected!`);

console.log(`Opening database...`);
const db = new Level("./db", { valueEncoding: "json" });
await db.open();
console.log(`Opened!`);

cron.schedule("* * * * *", async () => {
  console.log("tick start");
  console.log(await tick());
  console.log("tick end");
});

async function tick() {
  const promises = [];

  // pools uco amounts
  for (const [asset, poolGenesisAddress] of Object.entries(pools)) {
    promises.push(
      getUCOBalance(archethic, poolGenesisAddress).then((value) => {
        return { name: `archethic.bridge.pools.${asset}.amount.UCO`, value };
      }),
    );
  }

  // protocol fees
  promises.push(
    getUCOBalance(archethic, PROTOCOL_FEES).then((value) => {
      return { name: `archethic.bridge.fees.UCO`, value };
    }),
  );
  for (const [asset, tokenAddress] of Object.entries(tokens)) {
    promises.push(
      getTokenBalance(archethic, PROTOCOL_FEES, tokenAddress).then((value) => {
        return { name: `archethic.bridge.fees.${asset}`, value };
      }),
    );
  }

  // htlcs statuses
  for (const [asset, poolGenesisAddress] of Object.entries(pools)) {
    promises.push(
      getHTLCStatuses(archethic, db, poolGenesisAddress).then((stats) => {
        let metrics = [];
        for (const [key, value] of Object.entries(stats)) {
          metrics.push({
            name: `archethic.bridge.pools.${asset}.htlcs.${HTLC_STATUS[key]}`,
            value,
          });
        }
        return metrics;
      }),
    );
  }
  return Promise.all(promises).then((metrics) => metrics.flat());
}
