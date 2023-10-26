// Should run with `ts-node` cannot run with `npx hardhat run` because we need to take command line argument and I did not want to add a hardhat task just for this
import { MongoClient } from 'mongodb'
import { config } from 'dotenv'

config()

interface IConfig {
  minEntryCount: number
  maxEntryCount: number
  minSide: number
  maxSide: number
  minFareAmount: number
  maxFareAmount: number
  totalRoundCount: number
  ppv: number
}

const main = async () => {
  if (process.argv[2] === null || process.argv[2] === undefined) {
    throw Error(
      'Should give contract name as a command line argument to show results of. Ex: FareCoinFlip\nExample way to run: `ts-node ./scripts/simulations/simulationResults.ts FareCoinFlip`'
    )
  }
  const contractName = process.argv[2]
  const uri = process.env.MONGO_DB_URI ?? ''
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(`simulation`)

  const resultCollection = db.collection(`${contractName}Result`)
  const configCollection = db.collection(`${contractName}Config`)

  // @NOTE: Assumes that each result uses the same config
  const results = await (await resultCollection.find({ createdAt: { $exists: true } })).toArray()
  const config = (await configCollection.findOne({
    _id: results[0].configId,
  })) as unknown as IConfig
  const averageFareAmount = (config.minFareAmount + config.maxFareAmount) / 2
  const totalRoundCount = config.totalRoundCount
  const averageEntryCount = (config.minEntryCount + config.maxEntryCount) / 2

  const averageTotalUsedFare = averageEntryCount * totalRoundCount * averageFareAmount
  const ppv = config.ppv
  const protocolPercent = 0.05
  const hostPercent = 0.15

  console.log()
  console.log('ASSUMES THAT EVERY RESULT USES THE SAME CONFIG')
  console.log(`Given protocol probability value is ${ppv}`)
  console.log(
    `We are expecting ${ppv * hostPercent} mint for host and ${
      ppv * protocolPercent
    } mint for protocol`
  )
  console.log(
    `For the fare supply change, since we have ${ppv} of burn and ${
      ppv * (hostPercent + protocolPercent)
    } mint\nWe are expecting ${ppv - ppv * (hostPercent + protocolPercent)} burn`
  )
  console.log()
  console.log(`Used average of ${averageTotalUsedFare} FARE`)
  console.log(`Based on ${results.length} simulation results`)
  console.log()

  const averageChangeOfHostBalance =
    results
      .map((result) => result.changeOfHostBalance)
      .reduce((sum, newInstance) => parseInt(sum) + parseInt(newInstance)) / results.length
  console.log(`expected host balance change: ${averageTotalUsedFare * ppv * hostPercent}`)
  console.log(`average host balance change: ${averageChangeOfHostBalance}`)
  console.log()

  const averageChangeOfProtocolBalance =
    results
      .map((result) => result.changeOfProtocolBalance)
      .reduce((sum, newInstance) => parseInt(sum) + parseInt(newInstance)) / results.length
  console.log(`expected protocol balance change: ${averageTotalUsedFare * ppv * protocolPercent}`)
  console.log(`average protocol balance change: ${averageChangeOfProtocolBalance}`)
  console.log()

  const averageChangeOfFareSupply =
    results
      .map((result) => result.changeOfFareSupply)
      .reduce((sum, newInstance) => parseInt(sum) + parseInt(newInstance)) / results.length
  const expectedChangeOfFareSupply = -(
    averageTotalUsedFare * ppv -
    (averageTotalUsedFare * ppv * protocolPercent + averageTotalUsedFare * ppv * hostPercent)
  )
  console.log(`expected fare supply change: ${expectedChangeOfFareSupply}`)
  console.log(`average fare supply change: ${averageChangeOfFareSupply}`)

  console.log(
    `difference between expected and average fare supply change: ${
      (averageChangeOfFareSupply / expectedChangeOfFareSupply - 1) * 100
    }%`
  )

  await client.close()
}

main().catch((err) => {
  //   console.log(err)
  throw err
})
