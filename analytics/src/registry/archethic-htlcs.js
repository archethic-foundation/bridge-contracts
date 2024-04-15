import { Utils } from "@archethicjs/sdk";

export async function getPagingAddress(db, poolGenesisAddress) {
  let address;
  try {
    address = await db.get(`pagingAddress:${poolGenesisAddress}`);
  } catch (_) {}
  return address;
}

export async function setPagingAddress(db, poolGenesisAddress, pagingAddress) {
  return db.put(`pagingAddress:${poolGenesisAddress}`, pagingAddress);
}

export async function updateHtlcDb(db, poolGenesisAddress, htlcStates) {
  var promises = [];
  for (const htlcState of htlcStates) {
    promises.push(
      db.put(
        `htlc:archethic:${poolGenesisAddress}:${htlcState.type}:${htlcState.creationAddress}`,
        htlcState,
      ),
    );
  }
  return Promise.all(promises);
}

export async function htlcStats(db, poolGenesisAddress) {
  let countByTypeAndStatus = {
    signed: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    chargeable: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };
  let amountByTypeAndStatus = {
    signed: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
    chargeable: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    },
  };

  for await (const [key, value] of db.iterator()) {
    if (key.startsWith(`htlc:archethic:${poolGenesisAddress}:`)) {
      const parts = key.split(":");
      const htlcType = parts[parts.length - 2];

      countByTypeAndStatus[htlcType][value.htlcStatus] += 1;
      amountByTypeAndStatus[htlcType][value.htlcStatus] += Utils.fromBigInt(
        value.amount,
      );
    }
  }

  return { countByTypeAndStatus, amountByTypeAndStatus };
}

export async function getChargeableHTLCs(db) {
  let htlcs = [];
  for await (const [key, value] of db.iterator()) {
    const r = key.match(
      /htlc:archethic:([a-fA-F0-9]*):chargeable:([a-fA-F0-9]*)/,
    );

    if (r && r.length == 3) {
      const poolAddress = r[1];
      const htlcAddress = r[2];

      htlcs.push({
        ...value,
        poolAddress,
        address: htlcAddress,
      });
    }
  }
  return htlcs;
}
