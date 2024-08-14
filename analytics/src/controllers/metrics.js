import config from "config";
import { ethers } from "ethers";
import registry from "../registry/index.js";
import { Op } from "sequelize";

export default function () {
  return async (req, res) => {
    const metrics = await Promise.all([
      await registry.models.kv.findAll({
        order: ["key"],
        where: {
          [Op.or]: [
            { key: { [Op.startsWith]: "evm_" } },
            { key: { [Op.startsWith]: "archethic_" } },
          ],
        },
      }),
      await reduceHtlcs(
        registry.models.htlcAEChargeable,
        "archethic",
        "chargeable",
      ),
      await reduceHtlcs(registry.models.htlcAESigned, "archethic", "signed"),
      await reduceHtlcs(registry.models.htlcEVMChargeable, "evm", "chargeable"),
      await reduceHtlcs(registry.models.htlcEVMSigned, "evm", "signed"),
    ]);

    const sortedMetrics = metrics.flat().sort((a, b) => {
      if (a.key > b.key) return 1;
      else return -1;
    });
    let text = "";
    let previousBaseName = null;
    for (const metric of sortedMetrics) {
      const baseName = metric.key.split("{")[0];

      // the type must not be set on each metrics
      if (baseName != previousBaseName) {
        text += `# TYPE ${baseName} gauge\n`;
      }

      text += `${metric.key} ${metric.value}\n`;
      previousBaseName = baseName;
    }

    if (req.get("accept").includes("html")) {
      res.send(`<html><body><pre>${text}</pre></body></html>`);
    } else {
      res.send(text);
    }
  };
}

async function reduceHtlcs(model, blockchain, type) {
  const htlcs = await model.findAll();

  const stats = htlcs.reduce((acc, htlc) => {
    const key =
      htlc.addressPool +
      "-" +
      htlc.status +
      "-" +
      (htlc.evmChainId || htlc.chainId);
    acc["count-" + key] = (acc["count-" + key] || 0) + 1;
    acc["amount-" + key] =
      (acc["amount-" + key] || 0n) + cast_amount(htlc.amount, blockchain);
    return acc;
  }, {});

  let metrics = [];
  for (const [key, value] of Object.entries(stats)) {
    const [statName, addressPool, status, chainId] = key.split("-");
    const asset = pool_to_asset(blockchain, addressPool);
    const network = chain_id_to_network(chainId);

    metrics.push({
      key: `${blockchain}_htlcs_${statName}{asset="${asset}",type="${type}",status="${status}",network="${network}"}`,
      value,
    });
  }

  return metrics;
}

function pool_to_asset(blockchain, addressPool) {
  const poolsList =
    blockchain == "evm"
      ? Object.values(config.get("evm")).map((network) => network.pools)
      : [config.get("archethic").pools];

  for (const pools of poolsList) {
    for (const [asset, addressPool2] of Object.entries(pools)) {
      if (addressPool2.toUpperCase() == addressPool.toUpperCase()) return asset;
    }
  }
}

function chain_id_to_network(chainId) {
  for (const [networkName, networkConf] of Object.entries(config.get("evm"))) {
    if (networkConf.chainID == chainId) {
      return networkName;
    }
  }
}

function cast_amount(amount, blockchain) {
  amount = BigInt(Math.floor(amount));
  if (blockchain == "evm") {
    return amount / BigInt(1e18);
  }
  return amount / BigInt(1e8);
}
