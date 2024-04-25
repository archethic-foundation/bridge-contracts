module.exports = {
  apps: [
    {
      name: "bridge-metrics-server-testnet",
      script: "npm run testnet",
    },
    {
      name: "bridge-metrics-server-mainnet",
      script: "npm run mainnet",
    },
  ],
};
