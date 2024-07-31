import config from "config";
import Debug from "debug";
import { ethers } from "ethers";
import { Op } from "sequelize";

import registry from "../registry/index.js";
import { getHTLCData } from "../evm/get-htlc-data.js";

const debug = Debug("bridge:cron:evm:htlc");
const EVM_NETWORKS = config.get("evm");

(async () => {
  debug("start");

  for (const [networkName, networkConf] of Object.entries(EVM_NETWORKS)) {
    debug(`Network: ${networkName}`);
    const provider = new ethers.JsonRpcProvider(
      networkConf.providerEndpoint,
      undefined,
      { batchMaxCount: 10, batchStallTime: 1000 },
    );

    for (const [tokenName, poolAddress] of Object.entries(networkConf.pools)) {
      const chargeableToDiscard = await registry.models.htlcEVMChargeable
        .findAll({
          attributes: ["addressCreation"],
          where: {
            chainId: networkConf.chainID,
            status: {
              [Op.not]: "PENDING",
            },
          },
        })
        .then((htlcs) => htlcs.map((htlc) => htlc.addressCreation));

      const chargeableHTLCs = await getHTLCData(
        provider,
        poolAddress,
        "CHARGEABLE",
        tokenName,
        chargeableToDiscard,
        networkConf.chainID,
      );

      for (const htlc of chargeableHTLCs) {
        await registry.models.htlcEVMChargeable
          .findOrBuild({
            where: {
              chainId: networkConf.chainID,
              addressCreation: htlc.addressCreation,
            },
          })
          .then(([instance, init]) => instance.set(htlc).save());
      }

      const signedToDiscard = await registry.models.htlcEVMSigned
        .findAll({
          attributes: ["addressCreation"],
          where: {
            chainId: networkConf.chainID,
            status: {
              [Op.not]: "PENDING",
            },
          },
        })
        .then((htlcs) => htlcs.map((htlc) => htlc.addressCreation));

      const signedHTLCs = await getHTLCData(
        provider,
        poolAddress,
        "SIGNED",
        tokenName,
        signedToDiscard,
        networkConf.chainID,
      );

      for (const htlc of signedHTLCs) {
        await registry.models.htlcEVMSigned
          .findOrBuild({
            where: {
              chainId: networkConf.chainID,
              addressCreation: htlc.addressCreation,
            },
          })
          .then(([instance, init]) => instance.set(htlc).save());
      }
    }
  }

  debug("done");
})();
