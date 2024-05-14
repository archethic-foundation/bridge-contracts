import config from "config";

const CHAIN_BY_POOL_ADDRESS = {};
const evmNetworks = Object.keys(config.get("evm"));
for (const evmNetwork of evmNetworks) {
  const poolAddresses = Object.values(config.get(`evm.${evmNetwork}.pools`));

  for (const poolAddress of poolAddresses) {
    CHAIN_BY_POOL_ADDRESS[poolAddress] = evmNetwork;
  }
}

export async function getHTLCs(db, htlcType, asset, poolAddress) {
  let htlcs = [];
  if (!poolAddress) {
    for await (const [key, value] of db.iterator()) {
      const regex =
        htlcType == "chargeable"
          ? /htlc:evm:chargeable:(.*):(0x[a-fA-F0-9]*):(0x[a-fA-F0-9]*)/
          : /htlc:evm:signed:(.*):(0x[a-fA-F0-9]*):(0x[a-fA-F0-9]*)/;
      const r = key.match(regex);
      if (r && r.length == 4) {
        const asset = r[1];
        const poolAddress = r[2];
        const htlcAddress = r[3];

        htlcs.push({
          asset,
          chain: CHAIN_BY_POOL_ADDRESS[poolAddress],
          explorer: config.get(
            `evm.${CHAIN_BY_POOL_ADDRESS[poolAddress]}.explorer`,
          ),
          type: htlcType,
          poolAddress: poolAddress,
          address: htlcAddress,
          userAddress: value.userAddress,
          lockTime: value.lockTime,
          status: value.status,
          secretHash: value.secretHash,
          amount: value.amount / 10 ** 18,
        });
      }
    }
  } else {
    // this is used only to do the stats so we just need status & amount
    for await (const [key, value] of db.iterator()) {
      if (key.startsWith(htlcNamespaceKey(poolAddress, htlcType, asset))) {
        htlcs.push({
          status: value.status,
          amount: deserializeBigInt(value.amount),
        });
      }
    }
  }
  return htlcs;
}

export async function persistHTLCs(db, htlcs, poolAddress, htlcType, asset) {
  let newAddressesToDiscard = [];

  await Promise.all(
    htlcs.map(
      async ({
        address,
        status,
        amount,
        lockTime,
        userAddress,
        secretHash,
      }) => {
        if (status != "PENDING") {
          newAddressesToDiscard.push(address);
        }

        await db.put(
          `${htlcNamespaceKey(poolAddress, htlcType, asset)}:${address}`,
          {
            status,
            lockTime: serializeBigInt(lockTime),
            amount: serializeBigInt(amount),
            userAddress,
            secretHash,
          },
        );
      },
    ),
  );

  // FIXME: NOT ATOMIC
  const prevAddressesToDiscard = await getAddressesToDiscard(
    db,
    poolAddress,
    htlcType,
  );
  const toDiscard = [
    ...new Set([...prevAddressesToDiscard, ...newAddressesToDiscard]),
  ];
  await db.put(discardedAddressesKey(poolAddress, htlcType, asset), toDiscard);
  // FIXME: NOT ATOMIC

  return;
}

export async function getAddressesToDiscard(db, poolAddress, htlcType, asset) {
  let addresses = [];
  try {
    addresses = await db.get(
      discardedAddressesKey(poolAddress, htlcType, asset),
    );
  } catch (_) {}
  return addresses;
}

function serializeBigInt(amount) {
  return amount + "";
}
function deserializeBigInt(amount) {
  return BigInt(amount);
}
function discardedAddressesKey(poolAddress, htlcType, asset) {
  return `htlc:evm:discard:${htlcType}:${asset}:${poolAddress}`;
}
function htlcNamespaceKey(poolAddress, htlcType, asset) {
  return `htlc:evm:${htlcType}:${asset}:${poolAddress}`;
}
