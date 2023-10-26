export const {
  DEFAULT_HARDHAT_NETWORK = 'localhost',
  INFURA_API_KEY,
  ETHERSCAN_API_KEY,
  LOCAL_AVAX_RPC_PORT = 9650,
} = process.env

export const HARDHAT_LOGGING = !!JSON.parse(process.env.HARDHAT_LOGGING || 'true')
export const REPORT_GAS = !!JSON.parse(process.env.REPORT_GAS || 'false')
export const SIMULATION_LOGGING = !!JSON.parse(process.env.SIMULATION_LOGGING || 'true')

export const LOCAL_AVAX_RPC_URL = `http://127.0.0.1:${LOCAL_AVAX_RPC_PORT}/ext/bc/C/rpc`
export const LOCAL_SUBNET_RPC_URL =
  'http://localhost:52878/ext/bc/8W3xGp7KQZFawa9bNLEUfaHBGMTJLRgoXcsC4618h4idn4Dm6/rpc'
export const KOVAN_RPC_URL = `https://kovan.infura.io/v3/${
  INFURA_API_KEY || '84842078b09946638c03157f83405213'
}`
export const MUMBI_RPC_URL = INFURA_API_KEY
  ? `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`
  : 'https://matic-mumbai.chainstacklabs.com'
export const FUJI_RPC_URL = `https://api.avax-test.network/ext/bc/C/rpc`
export const BSC_TESTNET_RPC_URL = 'https://endpoints.omniatech.io/v1/bsc/testnet/public'

export const LZ_ENDPOINTS = {
  hardhat: '0x0000000000000000000000000000000000000000',
  mumbai: '0xf69186dfBa60DdB133E91E9A4B5673624293d8F8',
  fuji: '0x93f54D755A063cE7bB9e6Ac47Eccc8e33411d706',
  'bsc-testnet': '0x6Fcb97553D41516Cb228ac03FdC8B9a0a9df04A1',
}
