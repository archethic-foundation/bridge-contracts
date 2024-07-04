# Swap WETH token from ARCH to EVM

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

## Deploy ETH pool

```bash
node bridge derive_eth_address --token aeETH # give you the pool signer
npx hardhat run scripts/cli/deploy_eth_pool.js --network localhost
```

## Fill ETH pool

```bash
npx hardhat run scripts/cli/fill_eth.js --network localhost
```

## Create Archethic Factory

```bash
node bridge deploy_factory
```

## Create Archethic WETH pool

```bash
node bridge deploy_pool --token aeETH
```

---

---

---

## Create Archethic HTLC

You need some aeETH to block.
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
node bridge deploy_signed_htlc --token aeETH --seed htlc1 --amount 10
```

## Provision Archethic HTLC & request secret hash from LP

```bash
node bridge provision_htlc --token aeETH --htlc_address 00003c4ab952924fc90236b0192a9692833ade9fa685c0377c557d4496250e188f7b --amount 10 --evm_user_address 0x5bA1D8DC7E0baC18D7dD7664AAB59998FC6d3229
```

## Create EVM HTLC

using variables from the get_htlc_data that is written in the 2nd transaction of the archethic HTLC

```bash
npx hardhat run scripts/cli/deploy_eth_signed_htlc.js --network localhost
```

## Request secret from Archethic LP

```bash
node bridge.js request_secret --token aeETH --htlc_address 00003C4AB952924FC90236B0192A9692833ADE9FA685C0377C557D4496250E188F7B --evm_contract_address 0xc1717306f1066e7D311f6193Fa727195Ad02Ba25 --evm_tx_address 0x2a8a593e19069094194c4fb138c8c3ac4da29b45327b4f4fde7becab64fae912
```

## Reveal secret to EVM HTLC

the secret is in the transaction 3 of the Archethic HTLC

```bash
npx hardhat run scripts/cli/reveal_signed_secret.js --network localhost
```
