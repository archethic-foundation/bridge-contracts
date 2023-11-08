# Swap ETH from EVM to ARCH

## Start 2 blockchains

```bash
cd evm
npm run start-node
```

```bash
cd archethic
iex -S mix
```

## Deploy ETH pool

```bash
npx hardhat run scripts/cli/deploy_eth_pool.js --network localhost
```

## Fill ETH pool

```bash
npx hardhat run scripts/cli/fill_eth.js --network localhost
```

## Create Archethic Keychain

```bash
node bridge init_keychain
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

## Create the EVM HTLC

```bash
npx hardhat run scripts/cli/deploy_eth_chargeable_htlc.js --network localhost
```

## Create the Archethic HTLC

the endtime / amount / hash are given by the previous command
No 0x in the secret

proxy_address in config.js must be the ETH pool address on EVM (you may use update_pool to quickly fix it)

```bash
node bridge.js deploy_chargeable_htlc --token aeETH --seed htlc1 --endtime 1699461240 --amount 14.925 --secret_hash ea83a8316cfd3ff0706bc2e63932446316cd2d2df9367199108fc9a475bbf45f --evm_tx_address 0xd018b746af5bcfc9a2e2f82e8ca01724876daca8eb421cda7ee3f77d0f3a2560 --evm_contract_address 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492
```

## Reveal EVM

```bash
npx hardhat run scripts/cli/reveal_chargeable_secret.js --network localhost
```

## Reveal Archethic

No 0x in the secret

```bash
node bridge reveal_secret --htlc_address 0000ffa50244e43f07a1d2bfbc280cfa456d930a5b2f1020aaa39ad72651a12ec34b --secret 147c74712e10a11d3dd0deb43b0eadc3390c2f3c3e1efb7946462c0998f450aa
```
