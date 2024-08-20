import { Utils } from "@archethicjs/sdk";

export default async function(archethic, address, tokenAddress) {
  address = address.toUpperCase();
  tokenAddress = tokenAddress.toUpperCase();

  const query = `query {
    balance (address: "${address}") {
      token {
        address,
        amount
      }
    }
  }`;

  // this query returns all the tokens
  const {
    balance: { token: tokens },
  } = await archethic.network.rawGraphQLQuery(query);

  const relevantToken = tokens.filter((t) => t.address == tokenAddress);

  if (relevantToken.length == 1) {
    return parseFloat(Utils.formatBigInt(relevantToken[0].amount));
  }
  return 0;
}
