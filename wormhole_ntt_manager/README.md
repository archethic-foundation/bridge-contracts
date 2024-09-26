## Install NTT CLI manager
https://wormhole.com/docs/build/contract-integrations/native-token-transfers/deployment-process/installation/

## Update contract config
As the owner of the contracts is a multisig, the `ntt push` command will fail as we don't have any private key for the multisig. So we can use any private key and check the failed transaction in explorer to get the called function with parameters and then use Safe to create the same transaction.

```bash
# Sync config file with on chain data
ntt pull

# Update config file

# Push update
# Push will require a private key with env variable ETH_PRIVATE_KEY
ntt push
```

## Wormhole Chain ID mapping

https://wormhole.com/docs/build/reference/chain-ids/
