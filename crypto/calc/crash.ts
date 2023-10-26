import cp from '../pseudoRNSimulationResults/crashPoint/1680628922.json'

// @NOTE: While running this script (`ts-node calc/crash.ts 101 200`) you have to provide min and max range for testing
// Example above tests from multipliers 1.01 between 2.00 (inclusive on both sides)
// @NOTE: Suggested arguments: 101 5000 (1.01, 50.00)
const minRange = parseInt(process.argv[2])
const maxRange = parseInt(process.argv[3])
if (process.argv[2] === null || process.argv[2] === undefined) {
  throw Error('You have to provide minRange for testing (Ex: 101 for 1.01)')
}
if (minRange < 100) {
  throw Error('MinRange lowest cap is 100, representing x1.00')
}
if (process.argv[3] === null || process.argv[3] === undefined) {
  throw Error('You have to provide maxRange for testing (Ex: 1000 for 10.00)')
}

const crashPoints = cp as any
const multiplierCount = Object.values(crashPoints).reduce((a: any, b: any) => a + b)
console.log(`Simulated multiplier count: ${multiplierCount}`)

// P(X <= x) ~ 1 - 1/x
// Probability of a number coming below x should be around 1 - 1/x
// Example: p(X <= 2) ~ 1 - 1/2 ~ 1/2 => probability of random number being below 2 has a probability around 1/2

// P(X <= x) ~ 1 - 1/x
// Probability of a number coming below x should be around 1 - 1/x
// Another way to calculate it is: 1/33 + 32/33(0.01 + 0.99(1 - 1/x))

let grossEVFromData = 0
let grossEVFromFormula = 0
// Compute ppv edge from 1.01 to 50.00 (101 to 5000)
for (let i = minRange; i <= maxRange; i++) {
  const expectedValueFromFormula =
    (i / 100) * (1 - (1 / 33 + (32 / 33) * (0.01 + 0.99 * (1 - 1 / (i / 100 - 0.01)))))

  const wonCount = Object.keys(crashPoints)
    .filter((crashPoint) => parseInt(crashPoint) >= i)
    .map((multiplier) => crashPoints[multiplier])
    .reduce((a, b) => a + b)

  const expectedValueFromData = (wonCount * (i / 100)) / (multiplierCount as number)

  grossEVFromData += expectedValueFromData
  grossEVFromFormula += expectedValueFromFormula

  if (expectedValueFromData >= 0.97 || expectedValueFromFormula >= 0.97) {
    throw Error(`Given formula and data, expected value for ${i / 100} is >= 0.97`)
  }

  if (Math.abs(expectedValueFromData - expectedValueFromFormula) > 0.01) {
    throw Error(
      `Given formula and data, expected and calculated expected values for ${
        i / 100
      } differ more than 1%`
    )
  }
}

const averageEVFromData = grossEVFromData / (maxRange - minRange + 1)
const averageEVFromFormula = grossEVFromFormula / (maxRange - minRange + 1)

if (averageEVFromData >= 0.965 || averageEVFromFormula >= 0.965) {
  throw Error(`Average EV from data or formula is more than 0.965`)
}
