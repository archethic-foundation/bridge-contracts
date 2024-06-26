require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-tracer");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-ledger");

const { subtask } = require("hardhat/config");
const {
  TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS,
} = require("hardhat/builtin-tasks/task-names");
require("@nomicfoundation/hardhat-verify");

require("dotenv").config();

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      accounts: {
        mnemonic:
          "inflict author desk anxiety music swear acquire achieve link young benefit biology",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      },
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic:
          "inflict author desk anxiety music swear acquire achieve link young benefit biology",
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
        count: 10,
      },
    },
    sepolia: {
      url: "https://sepolia.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      timeout: 100000,
      natif: {
        pool: "0xcfBA4FA32527bFf23E073406c772e9a8b8D02650",
        reserve: "0x3FDf8f04cBe76c1376F593634096A5299B494678",
        safety: "0x57B5Fe2F6A28E108208BA4965d9879FACF629442",
        poolCap: BigInt('5000000000000000000'), // 5.0
        archethicPoolSigner: '0x28c9efc42e2cbdfb581c212fe1e918a480ca1421',
        multisig: "0x301fBf74d415D0452E1D2Ea0679C9E0077AF5246" // Safe
      },
      uco: {
        pool: "0x50b8B73327613468e5605eD59B980555DAAC354a",
        reserve: "0x4c5B45aD4347bAAF2E2d1817D0e1eea483910acc",
        safety: "0xbEF25E2b992494aF270092562e92aAC8394e0982",
        token: "0xCBBd3374090113732393DAE1433Bc14E5233d5d7",
        poolCap: BigInt('5000000000000000000'), // 5.0
        multisig: "0x301fBf74d415D0452E1D2Ea0679C9E0077AF5246" // Safe
      },
      usdc: {
        pool: "0xC53A7c2f8C988AA319F0ACAd211dBb7206D5586e",
        reserve: "0x4c5B45aD4347bAAF2E2d1817D0e1eea483910acc",
        safety: "0xbEF25E2b992494aF270092562e92aAC8394e0982",
        token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        poolCap: BigInt('5000000000000000000') // 5.0
      }
    },

    ethereum: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://eth-mainnet.g.alchemy.com/v2/GIMnNlCFM3_7oQcUXOhKO4jIDLEA60q4",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        reserve: '0x59074485D293523168459C02DA0fbbd2a47A8973',
        safety: '0x7F872fBf5b4a71D5CfCC35175bF93EAcAB0e50b1',
        token: '0x8a3d77e9d6968b780564936d15B09805827C21fa',
        poolCap: BigInt('200000000000000000000000'), // 200 000.0
        multisig: '0xEcA37F68c9ca7964fC0b3A7aB4f0D6e964f8FD68' // Safe
      },
    },

    mumbai: {
      url: "https://polygon-mumbai.infura.io/v3/3a7a2dbdbec046a4961550ddf8c7d78a",
      timeout: 100000,
      natif: {
        pool: "0x56c86b45fCe906af9dF535EB27968aE46CBF170E",
        reserve: "0x64d75D315c592cCE1F83c53A201313C82b30FA8d",
        safety: "0xc20BcA1a8155c65964e5280D93d379aeB3A4c2e7",
        poolCap: BigInt('5000000000000000000'), // 5.0
        archethicPoolSigner: '0x4e57f0bf5813f5a516d23a59df1c767c4a3e8eef',
      },
      uco: {
        pool: "0xe55915D112711127339f073e75185E6311Dd72C8",
        reserve: "0x5aAD864466491E81701103F04775EA7dE6d76fE3",
        safety: "0xbADc499dA1F766599d19dBa805CB62eFaa439Adc",
        token: "0x51279e98d99AA8D65763a885BEFA5463dCd84Af6",
        poolCap: BigInt('5000000000000000000') // 5.0
      },
    },

    polygon: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://polygon-mainnet.g.alchemy.com/v2/DynWKvz6PUFaeZNmlxPXNiV1nK4Ac_2D",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        reserve: '0xacb2AfF4bed7De894A3f3bc3b836e2caA38a4CcD',
        safety: '0x68aC810D6a86801c7ACC3D71BfCda5d88a64b54b',
        token: '0x3C720206bFaCB2d16fA3ac0ed87D2048Dbc401Fc',
        poolCap: BigInt('200000000000000000000000'), // 200 000.0
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      },
      weth: {
        archethicPoolSigner: '0xbd788947035dc3edee57f38c82b143c2c529470c',
        token: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        reserve: '0xacb2AfF4bed7De894A3f3bc3b836e2caA38a4CcD',
        safety: '0x68aC810D6a86801c7ACC3D71BfCda5d88a64b54b',
        poolCap: BigInt('3250000000000000000'), // 3.25
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      },
      eure: {
        archethicPoolSigner: '0xf12bf6064165c24df79f268b7be7dc3213970df4',
        token: '0x18ec0A6E18E5bc3784fDd3a3634b31245ab704F6',
        reserve: '0xacb2AfF4bed7De894A3f3bc3b836e2caA38a4CcD',
        safety: '0x68aC810D6a86801c7ACC3D71BfCda5d88a64b54b',
        poolCap: BigInt('10000000000000000000000'), // 10 000
        multisig: '0x114F7a61F436f85f3Dba03da7a7c744689aA6a42'
      }
    },

    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s2.bnbchain.org:8545",
      timeout: 100000,
      natif: {
        pool: "0xEF695C0C4034304300bD01f6C300a28000F2c163",
        reserve: "0x7F9E1c2Bb1Ab391bA9987070ED8e7db77A9c8818",
        safety: "0x6f3dec2738b063D9aFe4436b1ec307D84f9C2EDe",
        poolCap: BigInt('5000000000000000000'), // 5.0
        archethicPoolSigner: '0x461ac2fa849767e4059fd98903a61315434ccf64',
      },
      uco: {
        pool: "0xacc408CB6D6D9C73C6003269D322cb78150fc137",
        reserve: "0x157aB6F84d3a3874d1dEd1b0a63EC834C640FBda",
        safety: "0x95Cc38814d37E0A9b08f77a02Ff4045CeAd2106c",
        token: "0x5e6554593E4fe61276AD09094f16A6D5133461A5",
        poolCap: BigInt('5000000000000000000') // 5.0
      },
    },

    bsc_mainnet: {
      ledgerAccounts: [
        "0xfD7C90fA69f76712239c733E564eE3D1EDCeCC12"
      ],
      url: "https://bsc-dataseed.binance.org",
      timeout: 100000,
      uco: {
        archethicPoolSigner: '0x16c1c9f1abcf2ba9e8d853827339dbeceaa91077',
        reserve: '0x20a2bf7Ea2A6c86aF78b41ca83E35C929D19aA61',
        safety: '0x05ADf7de77d86fDebE406D5171e781D918E50207',
        token: '0xb001f1E7c8bda414aC7Cf7Ecba5469fE8d24B6de',
        poolCap: BigInt('200000000000000000000000'), // 200 000.0
        multisig: '0x9D1392165debAAA889dE2328b0626aD1BCd9F6a8'
      }
    }
  },

  etherscan: {
    apiKey: {
      mainnet: process.env["ETHERSCAN_API_KEY"],
      sepolia: process.env["ETHERSCAN_API_KEY"],
      bsc: process.env["BSCSCAN_API_KEY"],
      polygon: process.env["POLYGONSSCAN_API_KEY"]
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  solidity: {
    version: "0.8.21", // Fetch exact version from solc-bin
    settings: {
      optimizer: {
        enabled: true,
        runs: 100, // Optimize gas for function call instead of deployment
      },
    },
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    strict: true,
  },

  defender: {
    apiKey: process.env.DEFENDER_KEY,
    apiSecret: process.env.DEFENDER_SECRET,
  },
};

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(
  async (_, __, runSuper) => {
    const paths = await runSuper();
    const inclusionContract = process.env["ONLY_CONTRACT"];

    return paths.filter((p) => {
      if (inclusionContract) {
        return p.includes(inclusionContract);
      }
      return true;
    });
  },
);
