import 'dotenv/config'

import type { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
// import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-solhint'
import 'hardhat-deploy'
import 'hardhat-deploy-ethers'
import 'hardhat-gas-reporter'
import 'hardhat-abi-exporter'
import 'hardhat-contract-sizer'
import 'hardhat-ethernal'
import 'solidity-coverage'

import './tasks'
import * as config from './config'
import testnetSeedAccounts from './keys/testnetSeedAccounts'
import localSeedAccounts from './keys/localSeedAccounts'

const hardhatUserConfig: HardhatUserConfig = {
  defaultNetwork: config.DEFAULT_HARDHAT_NETWORK,
  namedAccounts: {
    owner: {
      default: 0,
    },
    dev: {
      default: 1,
    },
    rewards: {
      default: 2,
    },
    resolver: {
      default: 3,
    },
    protocol: {
      default: 4,
    },
    host: {
      default: 5,
    },
    user: {
      default: 6,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.9',
        settings: {
          optimizer: {
            enabled: true,
            // runs: 200,
            runs: 1_000_000,
          },
        },
      },
      {
        version: '0.8.0',
      },
      {
        version: '0.4.24',
      },
    ],
    overrides: {
      'contracts/test/LinkToken.sol': {
        version: '0.4.24',
      },
      'contracts/test/VRFCoordinatorMock.sol': {
        version: '0.8.0',
      },
      'contracts/test/CustomVRFCoordinatorV2Mock.sol': {
        version: '0.8.4',
      },
    },
  },
  networks: {
    hardhat: {
      loggingEnabled: config.HARDHAT_LOGGING,
      tags: ['fare', 'spin-testnet'],
      chainId: 31337,
    },
    localhost: {
      live: false,
      saveDeployments: true,
      tags: ['fare', 'spin-testnet'],
    },
    testchain: {
      url: 'http://0.0.0.0:50174/',
      saveDeployments: false,
      accounts: testnetSeedAccounts,
      tags: ['fare', 'spin-testnet'],
      chainId: 51337,
    },
    localchain: {
      url: 'http://0.0.0.0:50174/',
      saveDeployments: false,
      accounts: localSeedAccounts,
      tags: ['fare', 'spin-testnet'],
      chainId: 51338,
    },
    kovan: {
      url: config.KOVAN_RPC_URL,
      chainId: 42,
      accounts: config.TESTNET_PRIVATE_KEYS,
    },
    mumbai: {
      url: config.MUMBAI_RPC_URL,
      chainId: 80001,
      accounts: config.TESTNET_PRIVATE_KEYS,
      gas: 2100000,
      gasPrice: 8000000000,
    },
    fuji: {
      url: config.FUJI_RPC_URL,
      chainId: 43113,
      accounts: config.TESTNET_PRIVATE_KEYS,
      live: true,
      saveDeployments: true,
      tags: ['fare', 'fareProxyOFT'],
    },
    'bsc-testnet': {
      url: config.BSC_TESTNET_RPC_URL,
      chainId: 97,
      accounts: config.TESTNET_PRIVATE_KEYS,
      live: true,
      saveDeployments: true,
      tags: ['fare', 'fareProxyOFT'],
    },
  },
  contractSizer: {
    runOnCompile: config.CONTRACT_SIZER,
    alphaSort: true,
    disambiguatePaths: false,
    strict: true,
    only: [':Fare'],
    except: [],
  },
  abiExporter: {
    runOnCompile: config.ABI_EXPORTER,
    path: './abis',
    clear: true,
    flat: true,
    pretty: false,
    only: [':Fare'],
    spacing: 2,
  },
  gasReporter: {
    enabled: config.REPORT_GAS,
    // outputFile: 'random/gas-report.txt',
    currency: 'USD',
  },
  etherscan: {
    apiKey: config.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 600000,
    bail: true,
  },
  ethernal: {
    email: config.ETHERNAL_EMAIL,
    password: config.ETHERNAL_PASSWORD,
    disableSync: false, // If set to true, plugin will not sync blocks & txs
    disableTrace: false, // If set to true, plugin won't trace transaction
    workspace: undefined, // Set the workspace to use, will default to the default workspace (latest one used in the dashboard). It is also possible to set it through the ETHERNAL_WORKSPACE env variable
    uploadAst: false, // If set to true, plugin will upload AST, and you'll be able to use the storage feature (longer sync time though)
    disabled: config.DISABLE_ETHERNAL, // If set to true, the plugin will be disabled, nohting will be synced, ethernal.push won't do anything either
    resetOnStart: undefined, // Pass a workspace name to reset it automatically when restarting the node, note that if the workspace doesn't exist it won't error
    serverSync: false, // If set to true, blocks & txs will be synced by the server. For this to work, your chain needs to be accessible from the internet. Also, trace won't be synced for now when this is enabled.
  },
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
    externalArtifacts: [
      // 'artifacts/contracts/FareItems.sol/FareItems.json',
      // 'artifacts/contracts/FareNFTLootBox.sol/FareNFTLootBox.json',
      // 'artifacts/contracts/FareSpinOld.sol/FareSpinOld.json',
      'artifacts/contracts/FareSpin.sol/FareSpin.json',
      'artifacts/contracts/FareToken.sol/FareToken.json',
    ],
  },
}

export default hardhatUserConfig
