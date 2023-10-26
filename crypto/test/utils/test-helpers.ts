import * as hre from 'hardhat'
import type { BigNumber, Contract } from 'ethers'
import { BigNumber as BN } from 'ethers'

// import type { FareSpin, FareSpinTestnet } from '../../typechain-types'
import type { FareSpin } from '../../typechain-types'
import type { ContractModeParam, ContractModeReceipts, FlatEntry } from './test.types'
import { ContractModes } from './test-constants'

const {
  ethers: { utils },
} = hre

export async function getBalances(contract: Contract, addresses: string[]): Promise<BigNumber[]> {
  const balances: BigNumber[] = []

  for (const address of addresses) {
    balances.push((await contract.balanceOf(address)) as BigNumber)
  }

  return balances
}

export const sleep = (ms: any) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Returns ethersjs array+object format as object format
 */
export function objectify(obj: any) {
  const newObj: any = {}
  Object.keys(obj).forEach((key: any) => {
    if (isNaN(Number(key))) {
      newObj[key] = obj[key]
    }
  })
  return newObj
}

export function arrayify(arr: any[]) {
  return arr.map((val) => objectify(val))
}

export function objectifyFormatBN(obj: any) {
  const newObj: any = {}
  Object.keys(obj).forEach((key: any) => {
    if (isNaN(Number(key))) {
      if (obj[key] instanceof BN) {
        console.log('BigNumber')
        newObj[key] = utils.formatEther(obj[key])
      } else {
        newObj[key] = obj[key]
      }
    }
  })
  return newObj
}

export function arrayifyFormatBN(arr: any[]) {
  return arr.map((val) => objectifyFormatBN(val))
}

/**
 * Returns a new contract mode object with overriden values
 */
export function createContractModeParams(overrides: any[] = []): ContractModeParam[] {
  return ContractModes.map((gm, idx) => [
    (overrides[idx] && overrides[idx].cardinality) || gm.cardinality,
    (overrides[idx] && overrides[idx].contractExpectedValueFloor) || gm.contractExpectedValueFloor,
    (overrides[idx] && overrides[idx].mintMultiplier) || gm.mintMultiplier,
    (overrides[idx] && overrides[idx].minAmount) || gm.minAmount,
    (overrides[idx] && overrides[idx].maxAmount) || gm.maxAmount,
    (overrides[idx] && overrides[idx].entryLimit) || gm.entryLimit,
  ])
}

export function createEntry(amount: number, contractModeId: BigNumber, pickedNumber: number) {
  return {
    amount: utils.parseEther(amount.toString()),
    contractModeId,
    pickedNumber: BN.from(pickedNumber),
  }
}

export function createBatchEntry(entries: FlatEntry[]) {
  return entries.map((entry) => createEntry(...entry))
}

/**
 * A function that seeds the ContractModes for FareSpin
 */
export async function seedContractModes(
  // contract: FareSpin | FareSpinTestnet,
  contract: FareSpin,
  _contractModes?: ContractModeParam[]
): Promise<ContractModeReceipts> {
  const receipts: ContractModeReceipts = []
  let contractModes: ContractModeParam[] = _contractModes || createContractModeParams()

  for (const contractMode of contractModes) {
    const receipt = await (await contract.setContractMode(...contractMode)).wait()

    receipts.push({
      contractMode,
      receipt,
    })
  }

  return receipts
}

const ErrorMessage = 'Invalid number of bits to generate. Bits must be a positive integer.'

export function randomHexString(bits: number) {
  if (bits === undefined) {
    bits = 64
  }

  if (!Number.isInteger(bits) || bits < 1) {
    throw new Error(ErrorMessage)
  }

  const nibbles = Math.floor(bits / 4)
  const remainder = bits % 4
  let hex = ''

  if (remainder) {
    hex = Math.floor(Math.random() * (1 << remainder)).toString(16)
  }

  for (let i = 0; i < nibbles; i++) {
    hex += Math.floor(Math.random() * 15).toString(16)
  }

  return hex
}

export function multiplyBigNumberWithFixedPointNumber(
  bigNumber: BigNumber,
  fixedPointNumber: string
): BigNumber {
  const dotIndex = fixedPointNumber.indexOf('.')
  if (dotIndex === -1) {
    return bigNumber.mul(fixedPointNumber)
  }
  const digitCountAfterDot = fixedPointNumber.slice(dotIndex + 1).length
  const divisor = 10 ** digitCountAfterDot
  const multiplier = fixedPointNumber.replace('.', '')

  return bigNumber.mul(multiplier).div(divisor)
}
