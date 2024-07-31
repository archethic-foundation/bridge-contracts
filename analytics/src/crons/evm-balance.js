import config from "config";
import fs from "fs";
import Debug from "debug";
import { ethers } from "ethers";

import registry from "../registry/index.js";

const debug = Debug("bridge:cron:evm:balance");
const EVM_NETWORKS = config.get("evm");
const ERC20 = JSON.parse(
  fs.readFileSync(
    "../evm/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json",
  ),
);

(async () => {
  debug("start");

  for (const [networkName, networkConf] of Object.entries(EVM_NETWORKS)) {
    debug(`Network: ${networkName}`);
    const provider = new ethers.JsonRpcProvider(
      networkConf.providerEndpoint,
      undefined,
      { batchMaxCount: 10, batchStallTime: 1000 },
    );

    await balanceTokens(provider, networkConf, networkName);

    if (networkConf.pools.NATIVE) {
      await balanceNative(provider, networkConf, networkName);
    }
  }

  debug("done");
})();

async function balanceTokens(provider, networkConf, networkName) {
  for (const [tokenName, tokenContractAddress] of Object.entries(
    networkConf.tokens,
  )) {
    const tokenContract = new ethers.Contract(
      tokenContractAddress,
      ERC20.abi,
      provider,
    );

    const tokenPoolAddress = networkConf.pools[tokenName];

    await Promise.all([
      tokenContract.balanceOf(tokenPoolAddress).then((value) => {
        return registry.models.kv
          .findOrBuild({
            where: {
              key: `evm_pools_balance{asset="${tokenName}",network="${networkName}"}`,
            },
          })
          .then(([kv, init]) =>
            kv.set({ value: ethers.formatEther(value) }).save(),
          );
      }),
    ]);
  }
}

async function balanceNative(provider, networkConf, networkName) {
  await Promise.all([
    provider.getBalance(networkConf.pools.NATIVE).then((value) => {
      return registry.models.kv
        .findOrBuild({
          where: {
            key: `evm_pools_balance{asset="NATIVE",network="${networkName}"}`,
          },
        })
        .then(([kv, init]) =>
          kv.set({ value: ethers.formatEther(value) }).save(),
        );
    }),
  ]);
}
