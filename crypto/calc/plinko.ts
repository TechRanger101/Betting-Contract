import { config } from 'dotenv'
import { multiplyBigNumberWithFixedPointNumber } from '../test/utils/test-helpers'
import { ethers } from 'ethers'
config()

export const plinkoMultipliers = [
  [
    [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  ],
  [
    [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  ],
  [
    [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
    [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
    [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
    [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
    [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
    [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
    [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  ],
]

const getDeployablePlinkoMultipliers = (someMultiplier: any) => {
  const copiedMultipliers = deepCopyArray(someMultiplier)
  // Multipliers give multipliers with rowCount, resize all of them to have 17 elements, fill empty ones with 0
  for (let rL = 0; rL < 3; rL++) {
    for (let rC = 0; rC < 9; rC++) {
      const changeSize = 17 - copiedMultipliers[rL][rC].length
      if (changeSize > 0) {
        copiedMultipliers[rL][rC] = copiedMultipliers[rL][rC].concat(Array(changeSize).fill(0))
      } else {
        copiedMultipliers[rL][rC] = copiedMultipliers[rL][rC].slice(0, 17)
      }
    }
  }

  // Multiply floating numbers with ether
  for (let rL = 0; rL < 3; rL++) {
    for (let rC = 0; rC < 9; rC++) {
      for (let pos = 0; pos < 17; pos++) {
        copiedMultipliers[rL][rC][pos] = <any>(
          multiplyBigNumberWithFixedPointNumber(
            ethers.utils.parseEther('1'),
            copiedMultipliers[rL][rC][pos] + ''
          )
        )
      }
    }
  }
  return copiedMultipliers
}

const deepCopyArray = (array: any): any => {
  if (!Array.isArray(array)) {
    return array // Return non-array values as is
  }

  return array.map((item) => deepCopyArray(item))
}

export const deployablePlinkoMultipliers = getDeployablePlinkoMultipliers(plinkoMultipliers)

function productRange(a: number, b: number) {
  let prd = a
  let i = a

  while (i++ < b) {
    prd *= i
  }
  return prd
}

function combinations(n: number, r: number) {
  if (n === r || r === 0) {
    return 1
  } else {
    r = r < n - r ? n - r : r
    return productRange(r + 1, n) / productRange(1, n - r)
  }
}

const main = async () => {
  const plinkoProbabilities = [] as any
  // Create probabilities
  for (let rowCount = 8; rowCount <= 16; rowCount++) {
    plinkoProbabilities[rowCount - 8] = [] as any
    for (let pos = 0; pos <= rowCount; pos++) {
      plinkoProbabilities[rowCount - 8][pos] = combinations(rowCount, pos) / 2 ** rowCount
    }
  }
  // Make sure that probabilities are correct by checking the sum of each row eauals to 1 (because probabilites are represented from 0 to 1)
  for (let rowCount = 8; rowCount <= 16; rowCount++) {
    let oneRow = plinkoProbabilities[rowCount - 8]
    let totalProb = oneRow.reduce((a: number, b: number) => a + b)
    if (totalProb !== 1) {
      throw Error('Sum of probabilities of a row should be 1')
    }
  }

  // Create expected value for a row
  for (let riskLevel = 0; riskLevel < 3; riskLevel++) {
    for (let rowCount = 8; rowCount <= 16; rowCount++) {
      let expectedValue = 0
      for (let pos = 0; pos <= rowCount; pos++) {
        expectedValue +=
          plinkoProbabilities[rowCount - 8][pos] * plinkoMultipliers[riskLevel][rowCount - 8][pos]
      }
      if (expectedValue >= 1) {
        throw Error('Given multipliers, expected value is >= 1')
      }
      console.log(`For riskLevel: ${riskLevel}, rowCount: ${rowCount}`)
      console.log(`Expected value: ${expectedValue}`)
      console.log(`PPV: ${1 - expectedValue}`)
      console.log()
    }
  }
}

main().catch((err) => {
  console.log(err)
  throw err
})
