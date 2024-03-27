export default async function (archethic, poolGenesisAddress, pagingAddress) {
  let fundsCalls = [];
  let secretHashCalls = [];
  let setSecretHashCalls = [];
  let revealSecretCalls = [];
  let failedCalls = [];
  let previousPagingAddress;

  do {
    previousPagingAddress = pagingAddress;
    // Fetch pool chain (batch of 10 txs), retrieve each transaction's inputs
    // filter call inputs and retrieve call details
    const res = await nextPage(archethic, poolGenesisAddress, pagingAddress);

    fundsCalls.push(...res.fundsCalls);
    secretHashCalls.push(...res.secretHashCalls);
    setSecretHashCalls.push(...res.setSecretHashCalls);
    revealSecretCalls.push(...res.revealSecretCalls);
    failedCalls.push(...res.failedCalls);
    pagingAddress = res.pagingAddress;
  } while (previousPagingAddress != pagingAddress);

  return {
    fundsCalls,
    secretHashCalls,
    setSecretHashCalls,
    revealSecretCalls,
    failedCalls,
    pagingAddress,
  };
}

async function nextPage(archethic, poolGenesisAddress, pagingAddress) {
  let query = poolChainQuery(poolGenesisAddress, pagingAddress);
  const { transactionChain: poolTxs } =
    await archethic.network.rawGraphQLQuery(query);

  if (poolTxs.length == 0) {
    // returning the same pagingAddress wil break the while loop
    return {
      fundsCalls: [],
      secretHashCalls: [],
      setSecretHashCalls: [],
      revealSecretCalls: [],
      failedCalls: [],
      pagingAddress,
    };
  }

  const failedCalls = [];
  const setSecretHashCalls = [];

  const callQueries = poolTxs.reduce((acc, poolTx) => {
    const calls = filterAndSortInputCalls(poolTx.inputs);
    let call;

    if (calls.length > 1) {
      [call] = calls.splice(-1);
      failedCalls.push(...calls);
    } else {
      call = calls[0];
    }

    const recipients = poolTx.data.actionRecipients;
    if (recipients.length > 0 && recipients[0].action == "set_secret_hash") {
      setSecretHashCalls.push(poolTx);
    }

    return call ? acc + "\n" + callQuery(poolTx.address, call.from) : acc;
  }, "");

  query = `query {
    ${callQueries}
  }`;

  const callTxs = await archethic.network.rawGraphQLQuery(query);

  const { fundsCalls, secretHashCalls, revealSecretCalls } =
    splitCallTxs(callTxs);

  const [{ address: nextPagingAddress }] = poolTxs.slice(-1);

  return {
    fundsCalls,
    secretHashCalls,
    setSecretHashCalls,
    revealSecretCalls,
    failedCalls,
    pagingAddress: nextPagingAddress,
  };
}

function filterAndSortInputCalls(inputs) {
  return inputs
    .filter((input) => input.type == "call")
    .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}

function splitCallTxs(callTxs) {
  const fundsCalls = [];
  const secretHashCalls = [];
  const revealSecretCalls = [];

  Object.values(callTxs).forEach((call) => {
    call.data.actionRecipients.forEach((recipient) => {
      switch (recipient.action) {
        case "request_funds":
          fundsCalls.push(call);
          break;

        case "request_secret_hash":
          secretHashCalls.push(call);
          break;

        case "reveal_secret":
          revealSecretCalls.push(call);
          break;

        default:
          break;
      }
    });
  });

  return { fundsCalls, secretHashCalls, revealSecretCalls };
}

function callQuery(address, callAddress) {
  return `X${address}: transaction(address: "${callAddress}") {
    address
    data {
      actionRecipients {
        action, args
      }
    }
    validationStamp {
      timestamp
      ledgerOperations {
        transactionMovements {
          to
        }
      }
    }
  }`;
}

function poolChainQuery(poolGenesisAddress, pagingAddress) {
  if (pagingAddress) {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}",
        pagingAddress: "${pagingAddress}"
      ) {
		    address
        inputs {
          type, from, timestamp
        }
        data {
          actionRecipients {
            address, action, args
          }
        }
      }
    }`;
  } else {
    return `query {
      transactionChain(
        address: "${poolGenesisAddress}"
      ) {
		    address
        inputs {
          type, from, timestamp
        }
        data {
          actionRecipients {
            address, action, args
          }
        }
      }
    }`;
  }
}
