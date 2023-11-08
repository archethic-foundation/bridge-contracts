# Swap token from EVM(ERC20) to ARCH(AEIP2)

## Start 2 blockchains

```bash
cd evm
npm run start-node
```

```bash
cd archethic
iex -S mix
```

## Create ERC20 Token on EVM

```bash
npx hardhat run scripts/cli/deploy_erc_token.js --network localhost
```

## Deploy ERC20 pool on EVM

```bash
npx hardhat run scripts/cli/deploy_erc_pool.js --network localhost
```

## Fill ERC20 pool on EVM

```bash
npx hardhat run scripts/cli/fill_erc.js --network localhost
```

## Create Archethic Keychain

```bash
node bridge init_keychain
```

## Create Archethic Factory

```bash
node bridge deploy_factory
```

## Create Archethic aeDTK pool

- add the aeDTK in the config (pools & evmNetworks.local)
- proxyAddress=ERC20 Pool Address

```bash
node bridge deploy_pool --token aeDTK
```

---
---
---

## Create the EVM HTLC

```bash
npx hardhat run scripts/cli/deploy_erc_chargeable_htlc.js --network localhost
```

## Create the Archethic HTLC

the endtime / amount / hash are given by the previous command
No 0x in the secret

```bash
node bridge.js deploy_chargeable_htlc --token aeDTK --seed htlc1 --endtime 1699461240 --amount 14.925 --secret_hash ea83a8316cfd3ff0706bc2e63932446316cd2d2df9367199108fc9a475bbf45f --evm_tx_address 0xd018b746af5bcfc9a2e2f82e8ca01724876daca8eb421cda7ee3f77d0f3a2560 --evm_contract_address 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492
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
