export default {
  environments: {
    local: {
      endpoint: "http://127.0.0.1:4000",
      availableEvmNetworks: ["local"],
      defaultChainId: 1337,
      factorySeed: "factory",
      userSeed: "user",
      // Genesis address of seed "protocolFee"
      protocolFeeAddress: "000001F449ABE3971623E30C10DA5E692DFCF9C795E4E0BC66BCD130F3FC5553552E"
    }
  },
  evmNetworks: {
    local: {
      endpoint: "http://127.0.0.1:8545",
      chainId: 1337
    }
  }
}
