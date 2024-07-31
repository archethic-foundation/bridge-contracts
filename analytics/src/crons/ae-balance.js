import config from "config";
import Archethic from "@archethicjs/sdk";
import Debug from "debug";

import registry from "../registry/index.js";
import getTokenBalance from "../archethic/get-token-balance.js";
import getUCOBalance from "../archethic/get-uco-balance.js";

const debug = Debug("bridge:cron:ae:balance");
const PROTOCOL_FEES = config.get("archethic.protocolFeesAddress");
const POOLS = config.get("archethic.pools");
const TOKENS = config.get("archethic.tokens");
const ENDPOINT = config.get("archethic.endpoint");

(async () => {
  debug("start");
  debug(`Connecting to endpoint ${ENDPOINT}...`);
  const archethic = new Archethic(ENDPOINT);
  await archethic.connect();
  debug(`Connected!`);

  let promises = [];

  // protocol fees
  promises.push(
    getUCOBalance(archethic, PROTOCOL_FEES).then((value) => {
      return registry.models.kv
        .findOrBuild({ where: { key: `archethic_fees_balance{asset="UCO"}` } })
        .then(([kv, init]) => kv.set({ value }).save());
    }),
  );
  for (const [asset, tokenAddress] of Object.entries(TOKENS)) {
    promises.push(
      getTokenBalance(archethic, PROTOCOL_FEES, tokenAddress).then((value) => {
        return registry.models.kv
          .findOrBuild({
            where: { key: `archethic_fees_balance{asset="${asset}"}` },
          })
          .then(([kv, init]) => kv.set({ value }).save());
      }),
    );
  }

  // pools
  for (const [asset, poolGenesisAddress] of Object.entries(POOLS)) {
    if (asset == "UCO") {
      promises.push(
        getUCOBalance(archethic, poolGenesisAddress).then((value) => {
          return registry.models.kv
            .findOrBuild({
              where: { key: `archethic_pools_balance{asset="UCO"}` },
            })
            .then(([kv, init]) => kv.set({ value }).save());
        }),
      );
    } else {
      promises.push(
        getTokenBalance(archethic, poolGenesisAddress, TOKENS[asset]).then(
          (value) => {
            return registry.models.kv
              .findOrBuild({
                where: { key: `archethic_pools_balance{asset="${asset}"}` },
              })
              .then(([kv, init]) => kv.set({ value }).save());
          },
        ),
      );
    }
  }

  await Promise.all(promises);
  debug("done");
})();
