import config from "config";

import getTokenBalance from "./archethic/get-token-balance.js";
import getUCOBalance from "./archethic/get-uco-balance.js";
import getHTLCStatuses, { HTLC_STATUS } from "./archethic/get-htlc-statuses.js";

const PROTOCOL_FEES = config.get("archethic.protocolFeesAddress");

const pools = config.get("archethic.pools");
const tokens = config.get("archethic.tokens");

export async function tick(archethic, db) {
  const promises = [];

  // pools uco amounts
  for (const [asset, poolGenesisAddress] of Object.entries(pools)) {
    promises.push(
      getUCOBalance(archethic, poolGenesisAddress).then((value) => {
        return { name: `archethic_pools_balance{asset=${asset}}`, value };
      }),
    );
  }

  // protocol fees
  promises.push(
    getUCOBalance(archethic, PROTOCOL_FEES).then((value) => {
      return { name: `archethic_fees_balance{asset=UCO}`, value };
    }),
  );
  for (const [asset, tokenAddress] of Object.entries(tokens)) {
    promises.push(
      getTokenBalance(archethic, PROTOCOL_FEES, tokenAddress).then((value) => {
        return { name: `archethic_fees_balance{asset=${asset}}`, value };
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
            name: `archethic_htlcs_count{asset=${asset},type=${HTLC_STATUS[key]}}`,
            value,
          });
        }
        return metrics;
      }),
    );
  }
  return Promise.all(promises).then((metrics) => metrics.flat());
}
