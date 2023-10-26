import * as fs from 'fs'
import * as path from 'path'

import { mine } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { BigNumber } from 'ethers'
import { ExpandRandomNumberToMock, GetRandomnessMock } from '../../../typechain-types'

// NOTE: Uses GetRandomnessMock to get initial random number and nexpands that random number. Therefore, assumes that GetRandomNumberMock is creating well distributed random numbers
// NOTE: Maybe I should start with using a randomNumber created by JS ???

// @NOTE: Psuedo randomNumbers being distributed fairly after (mod 100) does not mean they are well distributed directly.
// @NOTE: Example: result of [1, 1, 1, 2, 2, 2, 3, 3, 3] could be from [101, 201, 301, 102, 102, 102, 103, 203, 303]

const main = async () => {
  // Deploy GetRandomnessMock
  const GetRandomnessMockFactory = await ethers.getContractFactory('GetRandomnessMock')
  const GetRandomnessMock = await GetRandomnessMockFactory.deploy()
  const getRandomnessMock = (await GetRandomnessMock.deployed()) as GetRandomnessMock
  console.log('deployed getRandomnessMock to: ', getRandomnessMock.address)
  // Deploy ExpandRandomNumberToMock
  const ExpandRandomNumberToMockFactory = await ethers.getContractFactory(
    'ExpandRandomNumberToMock'
  )
  const ExpandRandomNumberToMock = await ExpandRandomNumberToMockFactory.deploy()
  const expandRandomNumberToMock =
    (await ExpandRandomNumberToMock.deployed()) as ExpandRandomNumberToMock
  console.log('deployed expandRandomNumberToMock to: ', expandRandomNumberToMock.address)

  const res = {} as any
  const expandCount = 100

  for (let i = 0; i < 10000; i++) {
    const randomNumber = await getRandomnessMock.getRandomness()
    const randomNumbers = (await expandRandomNumberToMock.expandRandomNumberTo(
      randomNumber,
      expandCount
    )) as BigNumber[]
    randomNumbers
      .map((randomNumber) => randomNumber.mod(100).toNumber())
      .map((randomNumber) =>
        res[randomNumber] === null || res[randomNumber] === undefined
          ? (res[randomNumber] = 1)
          : res[randomNumber]++
      )
    // randomly mine 1 to 10 block
    const minedBlockAmount = Math.floor(Math.random() * 10) + 1
    await mine(minedBlockAmount)
  }

  const resJSON = JSON.stringify(res)
  const filePath = `./pseudoRNSimulationResults/expandRandomNumberTo/${Math.floor(
    Date.now() / 1000
  )}.json`

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
