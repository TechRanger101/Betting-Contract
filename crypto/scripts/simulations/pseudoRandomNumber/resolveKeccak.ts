import * as fs from 'fs'
import * as path from 'path'

import { mine } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { ResolveKeccakMock } from '../../../typechain-types'

// NOTE: Uses GetRandomnessMock to get initial random number and nexpands that random number. Therefore, assumes that GetRandomNumberMock is creating well distributed random numbers
// NOTE: Maybe I should start with using a randomNumber created by JS ???

// @NOTE: Psuedo randomNumbers being distributed fairly after (mod 100) does not mean they are well distributed directly.
// @NOTE: Example: result of [1, 1, 1, 2, 2, 2, 3, 3, 3] could be from [101, 201, 301, 102, 102, 102, 103, 203, 303]

const main = async () => {
  // Deploy GetRandomnessMock
  const ResolveKeccakMockFactory = await ethers.getContractFactory('ResolveKeccakMock')
  const ResolveKeccakMock = await ResolveKeccakMockFactory.deploy()
  const resolveKeccakMock = (await ResolveKeccakMock.deployed()) as ResolveKeccakMock
  console.log('deployed resolveKeccakMock to: ', resolveKeccakMock.address)

  const res = {} as any
  const repeatCount = 100000

  for (let i = 0; i < repeatCount; i++) {
    if (i % (repeatCount / 10) === 0) console.log(`${i} th repeat`)
    // from 1 to 10
    const randomNumberAmount = Math.floor(Math.random() * 10) + 1

    const randomNumbers = await resolveKeccakMock.mockResolve(randomNumberAmount)
    randomNumbers
      .map((randomNumber) => randomNumber.mod(100).toNumber())
      .map((randomNumber) =>
        res[randomNumber] === null || res[randomNumber] === undefined
          ? (res[randomNumber] = 1)
          : res[randomNumber]++
      )
    // randomly mine 1 to 5 block
    const minedBlockAmount = Math.floor(Math.random() * 5) + 1
    await mine(minedBlockAmount)
    // await mine(1)
  }

  const resJSON = JSON.stringify(res)
  const filePath = `./pseudoRNSimulationResults/resolveKeccak/${Math.floor(Date.now() / 1000)}.json`

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
