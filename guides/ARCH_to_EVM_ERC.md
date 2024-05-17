# Swap token from ARCH(AEIP2) to EVM(ERC20)

## Start 2 blockchains

```bash
cd evm
npm run start-node
```

```bash
cd archethic
iex -S mix
```

## Create Archethic Keychain

```bash
node bridge init_keychain
```

## Create ERC20 Token on EVM

```bash
npx hardhat run scripts/cli/deploy_erc_token.js --network localhost
```

## Deploy ERC20 pool on EVM

```bash
node bridge derive_eth_address --token aeDTK # give you the pool signer
npx hardhat run scripts/cli/deploy_erc_pool.js --network localhost
```

## Fill ERC20 pool on EVM

```bash
npx hardhat run scripts/cli/fill_erc.js --network localhost
```

## Create Archethic Factory

```bash
node bridge deploy_factory
```

## Create Archethic WETH pool

THE CONFIG.JS PROXY_ADDRESS MUST BE SET BECAUSE IT WILL BE WRITTEN IN THE POOL CONTRACT. PROXY_ADDRESS => EVM ERC20 POOL ADDRESS

ALSO READ NEXT STEP FIRST

```bash
node bridge deploy_pool --token aeDTK
```

## Create Archethic HTLC

You need some aeDTK to block.
I updated the token definition so I can get free tokens without having to do the EVM->ARCH first:

```javascript
export function getTokenDefinition(token) {
  return JSON.stringify({
    aeip: [2, 8, 18, 19],
    supply: 100_000_000_001,
    type: "fungible",
    symbol: token,
    name: token,
    allow_mint: true,
    properties: {},
    recipients: [
      {
        to: "0000b620e024f1c5f84d3b016ff5e9fcfbba79af2a4fb88a154ddaa0e52ba20d2cd7",
        amount: 100_000_000_000,
      },
      {
        to: "00000000000000000000000000000000000000000000000000000000000000000000",
        amount: 1,
      },
    ],
  });
}
```

```bash
node bridge deploy_signed_htlc --token aeDTK --seed htlc1 --amount 11
```

## Provision Archethic HTLC & request secret hash from LP

```bash
node bridge provision_htlc --token aeDTK --htlc_address 00003c4ab952924fc90236b0192a9692833ade9fa685c0377c557d4496250e188f7b --amount 11
```

## Create EVM HTLC

using variables from the get_htlc_data that is written in the 2nd transaction of the archethic HTLC

```bash
npx hardhat run scripts/cli/deploy_erc_signed_htlc.js --network localhost
```

## Request secret from Archethic LP

at this step you need the config.js to have the correct proxy address for the token
(proxy address == pool address)
you may use update_pool to fix the issue

```bash
node bridge.js request_secret --token aeDTK --htlc_address 00003c4ab952924fc90236b0192a9692833ade9fa685c0377c557d4496250e188f7b --evm_contract_address 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492 --evm_tx_address 0x01f16433be6afae20c200c2b663133822cbab80faec83e2130e6b11159c9b0c8
```

## Reveal secret to EVM HTLC

the secret is in the transaction 3 of the Archethic HTLC

```bash
npx hardhat run scripts/cli/reveal_signed_secret.js --network localhost
```
