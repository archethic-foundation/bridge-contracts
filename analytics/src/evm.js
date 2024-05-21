import { ethers } from "ethers";
import config from "config";
import fs from "fs";
import Debug from "debug";

const debug = Debug("evm:htlc");

import { getHTLCStats } from "./evm/get-htlc-statuses.js";

const EVM_NETWORKS = config.get("evm");
const ERC20 = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json",
  ),
);

// we're doing most of I/O synchronously because of rate limiting
export async function tick(db) {
  var metrics = [];

  // for each networks (sequentially)
  for (const [networkName, networkConf] of Object.entries(EVM_NETWORKS)) {
    debug(`processing network: ${networkName}`);
    const provider = new ethers.JsonRpcProvider(
      networkConf.providerEndpoint,
      undefined,
      { batchMaxCount: 10, batchStallTime: 1000 },
    );

    // balances tokens (concurrently)
    for (const [tokenName, tokenContractAddress] of Object.entries(
      networkConf.tokens,
    )) {
      const tokenContract = new ethers.Contract(
        tokenContractAddress,
        ERC20.abi,
        provider,
      );

      const tokenPoolAddress = networkConf.pools[tokenName];
      const tokenReserveAddress = networkConf.reserves[tokenName];

      metrics.push(
        await Promise.all([
          tokenContract.balanceOf(tokenPoolAddress).then((value) => {
            return {
              name: `evm_pools_balance{asset="${tokenName}",network="${networkName}"}`,
              value: ethers.formatEther(value),
            };
          }),
          tokenContract.balanceOf(tokenReserveAddress).then((value) => {
            return {
              name: `evm_reserve_balance{asset="${tokenName}",network="${networkName}"}`,
              value: ethers.formatEther(value),
            };
          }),
        ]),
      );
    }

    if (networkConf.pools.NATIVE) {
      // balances native (concurrently)
      const poolNativeAddress = networkConf.pools.NATIVE;
      const reserveNativeAddress = networkConf.reserves.NATIVE;
      metrics.push(
        await Promise.all([
          provider.getBalance(poolNativeAddress).then((value) => {
            return {
              name: `evm_pools_balance{asset="NATIVE",network="${networkName}"}`,
              value: ethers.formatEther(value),
            };
          }),

          provider.getBalance(reserveNativeAddress).then((value) => {
            return {
              name: `evm_reserve_balance{asset="NATIVE",network="${networkName}"}`,
              value: ethers.formatEther(value),
            };
          }),
        ]),
      );
    }

    // HTLCs (sequentially)
    for (const [tokenName, poolAddress] of Object.entries(networkConf.pools)) {
      metrics.push(
        await getHTLCStats(
          db,
          provider,
          poolAddress,
          "chargeable",
          tokenName,
        ).then((stats) =>
          htlcStatsToMetrics(networkName, "chargeable", tokenName, stats),
        ),
      );
      metrics.push(
        await getHTLCStats(db, provider, poolAddress, "signed", tokenName).then(
          (stats) =>
            htlcStatsToMetrics(networkName, "signed", tokenName, stats),
        ),
      );
    }
  }

  return metrics.flat();
}

function htlcStatsToMetrics(networkName, htlcType, asset, stats) {
  return [
    {
      name: `evm_htlcs_count{status="PENDING",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: stats.countPending,
    },
    {
      name: `evm_htlcs_count{status="WITHDRAWN",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: stats.countWithdrawn,
    },
    {
      name: `evm_htlcs_count{status="REFUNDED",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: stats.countRefunded,
    },
    {
      name: `evm_htlcs_amount{status="PENDING",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: ethers.formatEther(stats.amountPending),
    },
    {
      name: `evm_htlcs_amount{status="WITHDRAWN",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: ethers.formatEther(stats.amountWithdrawn),
    },
    {
      name: `evm_htlcs_amount{status="REFUNDED",type="${htlcType}",asset="${asset}",network="${networkName}"}`,
      value: ethers.formatEther(stats.amountRefunded),
    },
  ];
}
