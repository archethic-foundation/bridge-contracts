# Swap UCO from ARCH to EVM

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
node bridge derive_eth_address --token UCO # give you the pool signer
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

THE CONFIG.JS PROXY_ADDRESS MUST BE SET BECAUSE IT WILL BE WRITTEN IN THE POOL CONTRACT

```bash
node bridge deploy_pool --token UCO
```

---

---

---

## Create Archethic HTLC

```bash
node bridge deploy_signed_htlc --token UCO --seed htlc1 --amount 11
```

## Provision Archethic HTLC & request secret hash from LP

```bash
node bridge provision_htlc --token UCO --htlc_address 00008ec119cb4df590468ebf29651bf993f7a807f045c66b5aabec16162d91332776 --amount --evm_user_address 0x5bA1D8DC7E0baC18D7dD7664AAB59998FC6d3229 11
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
node bridge.js request_secret --token UCO --htlc_address 00003c4ab952924fc90236b0192a9692833ade9fa685c0377c557d4496250e188f7b --evm_contract_address 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492 --evm_tx_address 0x01f16433be6afae20c200c2b663133822cbab80faec83e2130e6b11159c9b0c8
```

## Reveal secret to EVM HTLC

the secret is in the transaction 3 of the Archethic HTLC

```bash
npx hardhat run scripts/cli/reveal_signed_secret.js --network localhost
```
