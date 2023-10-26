function parseEnvBool(value: string | undefined) {
  return !!JSON.parse(value || 'true')
}

export const {
  DEFAULT_HARDHAT_NETWORK = 'hardhat',
  INFURA_API_KEY,
  ETHERSCAN_API_KEY,
  TESTNET_PRIVATE_KEY,
  TESTNET_REWARDS_KEY,
  TESTNET_DEV_KEY,
  RUNNING_TESTS = false,
  LOCAL_AVAX_RPC_PORT,
  ETHERNAL_EMAIL,
  ETHERNAL_PASSWORD,
} = process.env

export const HARDHAT_LOGGING = parseEnvBool(process.env.HARDHAT_LOGGING)
export const REPORT_GAS = parseEnvBool(process.env.REPORT_GAS)
export const CONTRACT_SIZER = parseEnvBool(process.env.CONTRACT_SIZER)
export const ABI_EXPORTER = parseEnvBool(process.env.ABI_EXPORTER)
export const DISABLE_ETHERNAL = !!(!ETHERNAL_EMAIL || !ETHERNAL_PASSWORD || RUNNING_TESTS)

export const TESTCHAIN_URL = process.env.TESTCHAIN_URL || 'http://localhost:50174'
export const LOCAL_AVAX_RPC_URL = `http://127.0.0.1:${LOCAL_AVAX_RPC_PORT}/ext/bc/C/rpc`
export const LOCAL_SUBNET_RPC_URL =
  process.env.LOCAL_SUBNET_RPC_URL ||
  'http://127.0.0.1:9650/ext/bc/2ukkYYDvoeqQcQcB742eoWcTnoSftgSyx1LFJBAXAVc3BgeAEM/rpc'
export const KOVAN_RPC_URL = `https://kovan.infura.io/v3/${
  INFURA_API_KEY || '84842078b09946638c03157f83405213'
}`
export const MUMBAI_RPC_URL = INFURA_API_KEY
  ? `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`
  : 'https://matic-mumbai.chainstacklabs.com'
export const FUJI_RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc'
export const BSC_TESTNET_RPC_URL = 'https://data-seed-prebsc-1-s1.binance.org:8545/'

export const TESTNET_PRIVATE_KEYS = [
  TESTNET_PRIVATE_KEY,
  TESTNET_DEV_KEY,
  TESTNET_REWARDS_KEY,
].filter((key) => !!key) as string[]
