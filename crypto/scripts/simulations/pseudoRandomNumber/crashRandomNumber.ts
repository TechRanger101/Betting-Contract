import * as fs from 'fs'
import * as path from 'path'

import { mine } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { GetRandomnessMock, FareCrashMock } from '../../../typechain-types'

const main = async () => {
  // Deploy GetRandomnessMock
  const GetRandomnessMockFactory = await ethers.getContractFactory('GetRandomnessMock')
  const GetRandomnessMock = await GetRandomnessMockFactory.deploy()
  const getRandomnessMock = (await GetRandomnessMock.deployed()) as GetRandomnessMock
  console.log('deployed getRandomnessMock to: ', getRandomnessMock.address)
  // Deploy FareCrash
  const FareCrashFactory = await ethers.getContractFactory('FareCrashMock')
  const FareCrash = await FareCrashFactory.deploy()
  const fareCrash = (await FareCrash.deployed()) as FareCrashMock
  console.log('deployed fareCrash to: ', fareCrash.address)

  const res = {} as any
  const repeatCount = 1000000

  for (let i = 0; i < repeatCount; i++) {
    if (i % (repeatCount / 100) === 0) console.log(`${i} th repeat`)
    const randomNumber = await getRandomnessMock.getRandomness()
    const crashPoint = (
      await fareCrash.getCrashMultiplierFromRandomNumberForSimulation(randomNumber)
    ).toNumber()
    // randomly mine 1 to 10 block
    // const minedBlockAmount = Math.floor(Math.random() * 10) + 1
    // await mine(minedBlockAmount)
    await mine(1)
    res[crashPoint] === null || res[crashPoint] === undefined
      ? (res[crashPoint] = 1)
      : res[crashPoint]++
  }

  const resJSON = JSON.stringify(res)
  const filePath = `./pseudoRNSimulationResults/crashPoint/${Math.floor(Date.now() / 1000)}.json`

  // create directories if they don't already exist
  const dirname = path.dirname(filePath)
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true })
  }

  fs.writeFile(filePath, resJSON, (err) => {
    if (err) {
      console.log('Error writing file:', err)
      console.log(res)
    } else {
      console.log(`Simulation results written to ${filePath}`)
    }
  })
}
main()
