export default {
  environments: {
    local: {
      endpoint: "http://127.0.0.1:4000",
      availableEvmNetworks: ["local"],
      userSeed: "user",
      keychainAccessSeed: "access",
      keychainSeed: "keychain"
    }
  },
  evmNetworks: {
    local: {
      endpoint: "http://127.0.0.1:8545",
      chainId: 1337
    }
  }
}
