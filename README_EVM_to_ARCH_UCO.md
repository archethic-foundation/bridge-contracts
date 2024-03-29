# Swap UCO from EVM to ARCH

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

- make sure the config.js is set accordingly.
- proxyAddress=ERC20 Pool Address

```bash
node bridge deploy_pool --token UCO
```

**/!\ DO A FAUCET ON THE POOL GENESIS**

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
node bridge.js deploy_chargeable_htlc --token UCO --seed htlc1 --endtime 1711128300 --amount 9.95 --secret_hash ed08914866b945eab4784e378d8cf1840eba34679dec0e5fcbe3777d9870be27 --evm_tx_address 0x31c4f2a1a8549d4f59d0c11b68f417d6194a14fed7de5859ad8726dfde07a8c9 --evm_contract_address 0xdA1eC8398C9dd5482dF534135f11bAC6A802E492
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
