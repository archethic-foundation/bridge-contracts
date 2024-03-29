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
    const poolNativeAddress = networkConf.pools.NATIVE;
    const poolUCOAddress = networkConf.pools.UCO;
    const reserveNativeAddress = networkConf.reserves.NATIVE;
    const reserveUCOAddress = networkConf.reserves.UCO;
    const safetyModuleNativeAddress = networkConf.safetyModules.NATIVE;
    const safetyModuleUCOAddress = networkConf.safetyModules.UCO;

    const tokenContract = new ethers.Contract(
      networkConf.tokens.UCO,
      ERC20.abi,
      provider,
    );

    // balances (concurrently)
    metrics.push(
      await Promise.all([
        provider.getBalance(poolNativeAddress).then((value) => {
          return {
            name: `evm_pools_balance{asset=NATIVE,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
        tokenContract.balanceOf(poolUCOAddress).then((value) => {
          return {
            name: `evm_pools_balance{asset=UCO,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
        provider.getBalance(safetyModuleNativeAddress).then((value) => {
          return {
            name: `evm_safetyModule_balance{asset=NATIVE,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
        tokenContract.balanceOf(safetyModuleUCOAddress).then((value) => {
          return {
            name: `evm_safetyModule_balance{asset=UCO,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
        provider.getBalance(reserveNativeAddress).then((value) => {
          return {
            name: `evm_reserve_balance{asset=NATIVE,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
        tokenContract.balanceOf(reserveUCOAddress).then((value) => {
          return {
            name: `evm_reserve_balance{asset=UCO,network=${networkName}}`,
            value: ethers.formatEther(value),
          };
        }),
      ]),
    );

    // HTLCs (sequentially)
    metrics.push(
      await getHTLCStats(
        db,
        provider,
        poolNativeAddress,
        "CHARGEABLE_NATIVE",
      ).then((stats) =>
        htlcStatsToMetrics(networkName, "CHARGEABLE_NATIVE", stats),
      ),
    );

    metrics.push(
      await getHTLCStats(db, provider, poolUCOAddress, "CHARGEABLE_UCO").then(
        (stats) => htlcStatsToMetrics(networkName, "CHARGEABLE_UCO", stats),
      ),
    );

    metrics.push(
      await getHTLCStats(db, provider, poolNativeAddress, "SIGNED_NATIVE").then(
        (stats) => htlcStatsToMetrics(networkName, "SIGNED_NATIVE", stats),
      ),
    );

    metrics.push(
      await getHTLCStats(db, provider, poolUCOAddress, "SIGNED_UCO").then(
        (stats) => htlcStatsToMetrics(networkName, "SIGNED_UCO", stats),
      ),
    );
  }

  return metrics.flat();
}

function htlcStatsToMetrics(networkName, htlcType, stats) {
  return [
    {
      name: `evm_htlcs_count{status=PENDING,type=${htlcType},network=${networkName}}`,
      value: stats.countPending,
    },
    {
      name: `evm_htlcs_count{status=WITHDRAWN,type=${htlcType},network=${networkName}}`,
      value: stats.countWithdrawn,
    },
    {
      name: `evm_htlcs_count{status=REFUNDED,type=${htlcType},network=${networkName}}`,
      value: stats.countRefunded,
    },
    {
      name: `evm_htlcs_amount{status=PENDING,type=${htlcType},network=${networkName}}`,
      value: ethers.formatEther(stats.amountPending),
    },
    {
      name: `evm_htlcs_amount{status=WITHDRAWN,type=${htlcType},network=${networkName}}`,
      value: ethers.formatEther(stats.amountWithdrawn),
    },
    {
      name: `evm_htlcs_amount{status=REFUNDED,type=${htlcType},network=${networkName}}`,
      value: ethers.formatEther(stats.amountRefunded),
    },
  ];
}
