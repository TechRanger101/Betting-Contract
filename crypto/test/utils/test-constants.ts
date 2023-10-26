import * as hre from 'hardhat'

import type { ContractMode } from './test.types'

export const OWNER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const INITIAL_SUPPLY = hre.ethers.utils.parseEther((50 * Math.pow(10, 9)).toString())
// export const REWARDS_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
export const VRF_COORDINATOR_ADDRESS = '0x8C7382F9D8f56b33781fE506E897a4F1e2d17255'
export const LINK_TOKEN_ADDRESS = '0x326C977E6efc84E512bB9C30f76E30c160eD06FB'
export const CL_KEY_HASH = '0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4'
export const VRF_LINK_FEE = hre.ethers.utils.parseUnits('1', 14) // 0.0001 LINK fee
export const ITEMS_BASE_URL = 'http://localhost:7777/api/item/{id}.json'
export const LOOTBOX_BASE_URL = 'http://localhost:7777/api/lootbox/'

export const toBN = hre.ethers.BigNumber.from

export const ContractModes: ContractMode[] = [
  {
    id: toBN(0),
    cardinality: toBN(2),
    mintMultiplier: toBN(2),
    contractExpectedValueFloor: toBN('980321568627440000'), // 2 out of 102 eliminator ticks
    minAmount: toBN(0),
    maxAmount: toBN(0),
    entryLimit: toBN(1),
    isActive: true,
  },
  {
    id: toBN(1),
    cardinality: toBN(10),
    mintMultiplier: toBN(10),
    contractExpectedValueFloor: toBN('970873786407767000'), // 3 out of 103 eliminator ticks
    minAmount: toBN(0),
    maxAmount: toBN(0),
    entryLimit: toBN(5),
    isActive: true,
  },
  {
    id: toBN(2),
    cardinality: toBN(100),
    mintMultiplier: toBN(100),
    contractExpectedValueFloor: toBN('961538461538462000'), // 4 out of 104 eliminator ricks
    minAmount: toBN(0),
    maxAmount: toBN(0),
    entryLimit: toBN(10),
    isActive: true,
  },
]

export const VRF_KEYHASH = '0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61'
export const VRF_CALLBACK_GAS_LIMIT = 2500000
export const VRF_REQUEST_CONFIRMATIONS = 1
