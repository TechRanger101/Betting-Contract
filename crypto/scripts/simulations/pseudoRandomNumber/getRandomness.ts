import * as fs from 'fs'
import * as path from 'path'

import { mine } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { GetRandomnessMock } from '../../../typechain-types'

// @NOTE: Psuedo randomNumbers being distributed fairly after (mod 100) does not mean they are well distributed directly.
// @NOTE: Example: result of [1, 1, 1, 2, 2, 2, 3, 3, 3] could be from [101, 201, 301, 102, 102, 102, 103, 203, 303]

const main = async () => {
  // Deploy GetRandomnessMock
  const GetRandomnessMockFactory = await ethers.getContractFactory('GetRandomnessMock')
  const GetRandomnessMock = await GetRandomnessMockFactory.deploy()
  const getRandomnessMock = (await GetRandomnessMock.deployed()) as GetRandomnessMock
  console.log('deployed getRandomnessMock to: ', getRandomnessMock.address)

  const res = {} as any
  const modForRandomNumber = 100
  const repeatCount = 100

  for (let i = 0; i < repeatCount; i++) {
    if (i % (repeatCount / 10) === 0) console.log(`${i} th repeat`)
    const randomNumber = await getRandomnessMock.getRandomness()
    // randomly mine 1 to 10 block
    const minedBlockAmount = Math.floor(Math.random() * 10) + 1
    await mine(minedBlockAmount)
    const randomNumberMod = randomNumber.mod(modForRandomNumber).toNumber()
    res[randomNumberMod] === null || res[randomNumberMod] === undefined
      ? (res[randomNumberMod] = 1)
      : res[randomNumberMod]++
  }

  const resJSON = JSON.stringify(res)
  const filePath = `./pseudoRNSimulationResults/getRandomness/${Math.floor(Date.now() / 1000)}.json`

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
