import type { BigNumber, ContractReceipt } from 'ethers'

export type ContractModeParam = [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]
export type ContractMode = {
  id: BigNumber
  cardinality: BigNumber
  mintMultiplier: BigNumber
  contractExpectedValueFloor: BigNumber
  minAmount: BigNumber
  maxAmount: BigNumber
  entryLimit: BigNumber
  isActive: boolean
}

export type ContractModeReceipts = { contractMode: ContractModeParam; receipt: ContractReceipt }[]
export type Entry = { amount: BigNumber; contractModeId: BigNumber; pickedNumber: BigNumber }
export type FlatEntry = [number, BigNumber, number]
