import hre, { deployments, ethers, getNamedAccounts } from 'hardhat'
import { MongoClient } from 'mongodb'
import simulationConfig from './simulate.config.json'
import { config } from 'dotenv'
import { multiplyBigNumberWithFixedPointNumber } from '../../test/utils/test-helpers'
import {
  BaseSUContract,
  CustomVRFCoordinatorV2Mock,
  DynamicRequester,
  FareToken,
  NFTorURBPPVSUContract,
} from '../../typechain-types'
import { deployablePlinkoMultipliers } from '../../calc/plinko'

const oneEther = ethers.utils.parseEther('1')

config()

interface IConfig {
  [key: string]: string | number
}

const createRandomSide = () => {
  const min = parseInt(simulationConfig.minSide)
  const max = parseInt(simulationConfig.maxSide)
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const createRandomFareAmount = () => {
  const min = parseInt(simulationConfig.minFareAmount)
  const max = parseInt(simulationConfig.maxFareAmount)
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const createRandomEntryCount = () => {
  const min = parseInt(simulationConfig.minEntryCount)
  const max = parseInt(simulationConfig.maxEntryCount)
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const main = async () => {
  const uri = process.env.MONGO_DB_URI ?? ''
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(`simulation`)
  const resultCollection = db.collection(`${simulationConfig.contractName}Result`)
  const configCollection = db.collection(`${simulationConfig.contractName}Config`)

  const { owner, rewards, resolver, host, protocol } = await getNamedAccounts()
  const {
    resolver: resolverSigner,
    rewards: rewardsSigner,
    protocol: protocolSigner,
    host: hostSigner,
  } = await hre.ethers.getNamedSigners()

  await deployments.fixture(['mocks', 'fare', 'ppv_nft'])
  const fare = (await hre.ethers.getContract('FareToken')) as FareToken

  const ppvNFT = await deployments.get('FarePPVNFT')
  const airnodeRrpMock = await deployments.get('AirnodeRrpMock')

  const vrfCoordinatorV2 = (await hre.ethers.getContract(
    'CustomVRFCoordinatorV2Mock'
  )) as CustomVRFCoordinatorV2Mock

  const transaction = await vrfCoordinatorV2.createSubscription()
  const transactionReceipt = await transaction.wait(1)
  const subscriptionId = hre.ethers.BigNumber.from(transactionReceipt.events![0].topics[1])
  await vrfCoordinatorV2.fundSubscription(subscriptionId, hre.ethers.utils.parseEther('1000'))

  const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, simulationConfig.ppv)

  if (simulationConfig.contractName === 'FarePlinko') {
    await deployments.deploy(`${simulationConfig.contractName}`, {
      contract: `${simulationConfig.contractName}`,
      from: owner,
      log: true,
      args: [
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: { subscriptionId: subscriptionId, vrfCoordinator: vrfCoordinatorV2.address },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        },
        deployablePlinkoMultipliers,
      ],
    })
  } else if (simulationConfig.ppvType === 'NFTorUR') {
    await deployments.deploy(`${simulationConfig.contractName}`, {
      contract: `${simulationConfig.contractName}`,
      from: owner,
      log: true,
      // autoMine: true,
      args: [
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: `${simulationConfig.contractName}`,
          },
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: { subscriptionId: subscriptionId, vrfCoordinator: vrfCoordinatorV2.address },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        },
      ],
    })
  } else {
    await deployments.deploy(`${simulationConfig.contractName}`, {
      contract: `${simulationConfig.contractName}`,
      from: owner,
      log: true,
      args: [
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: { subscriptionId: subscriptionId, vrfCoordinator: vrfCoordinatorV2.address },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        },
      ],
    })
  }
  const contract = (await hre.ethers.getContract(
    simulationConfig.contractName
  )) as NFTorURBPPVSUContract & BaseSUContract & DynamicRequester
  if (simulationConfig.ppvType === 'NFTorUR') {
    const setPPVTypeTx = await contract.setPPVType(1)
    await setPPVTypeTx.wait()
  }

  const fareToken = (await hre.ethers.getContract('FareToken')) as FareToken
  await fareToken.setWhitelistAddress(contract.address, true)
  await fareToken.setAllowContractMintBurn(contract.address, true)
  await fareToken.connect(rewardsSigner).setAllowContractMintBurn(contract.address, true)
  await fareToken.connect(protocolSigner).setAllowContractMintBurn(contract.address, true)
  await fareToken.connect(hostSigner).setAllowContractMintBurn(contract.address, true)

  const initialProtocolBalance = ethers.utils.formatEther(await fare.balanceOf(protocol))
  console.log()
  console.log(`Initial Protocol Balance: ${initialProtocolBalance.toString()}`)
  const initialHostBalance = ethers.utils.formatEther(await fare.balanceOf(host))
  console.log(`Initial Host Balance: ${initialHostBalance.toString()}`)
  const initialFareSupply = ethers.utils.formatEther(await fare.totalSupply())
  console.log(`Initial Fare Supply: ${initialFareSupply.toString()}`)
  console.log()

  const totalRoundCount = parseInt(simulationConfig.totalRoundCount)
  for (let i = 0; i < totalRoundCount; i++) {
    if (i % (totalRoundCount / 10) === 0) {
      console.log(`${i} th repeat`)
    }

    const userSide = createRandomSide()
    const fareAmount = oneEther.mul(createRandomFareAmount())
    const entryCount = createRandomEntryCount()
    const entryTx = await contract.submitEntry(userSide, fareAmount, 0, 0, entryCount)
    const entryReceipt = await entryTx.wait()
    const entrySubmittedEvent = entryReceipt.events?.filter(
      (event) => event.event === 'EntrySubmitted'
    )[0].args
    const requestId = entrySubmittedEvent!.requestId
    const resolveTx = await contract.connect(resolverSigner).batchResolveKeccak([requestId])
    // const resolveTx = await contract.connect(resolverSigner).resolveKeccak(requestId)
    await resolveTx.wait()
  }

  console.log()
  const finalProtocolBalance = ethers.utils.formatEther(await fare.balanceOf(protocol))
  console.log(`Final Protocol Balance: ${finalProtocolBalance.toString()}`)
  const finalHostBalance = ethers.utils.formatEther(await fare.balanceOf(host))
  console.log(`Final Host Balance: ${finalHostBalance.toString()}`)
  const finalFareSupply = ethers.utils.formatEther(await fare.totalSupply())
  console.log(`Final Fare Supply: ${finalFareSupply.toString()}`)
  console.log()

  const changeOfProtocolBalance =
    parseFloat(finalProtocolBalance) - parseFloat(initialProtocolBalance)
  console.log(`Change of protocol balance: ${changeOfProtocolBalance.toString()}`)
  const changeOfHostBalance = parseFloat(finalHostBalance) - parseFloat(initialHostBalance)
  console.log(`Change of host balance: ${changeOfHostBalance.toString()}`)
  const changeOfFareSupply = parseFloat(finalFareSupply) - parseFloat(initialFareSupply)
  console.log(`Change of fare supply: ${changeOfFareSupply.toString()}`)

  const { contractName, ppvType, ...importantSimulationConfig } = simulationConfig as IConfig
  Object.keys(importantSimulationConfig).forEach((key) => {
    importantSimulationConfig[key] = parseFloat(importantSimulationConfig[key] as string)
  })

  let config
  let keyOfId
  // Check if same config exists, if it exists dont create a new one and use that ones id. If it does not exist create one
  let existingConfig = await configCollection.findOne({
    ...importantSimulationConfig,
  })
  if (!existingConfig) {
    let createdConfig = await configCollection.insertOne({
      ...importantSimulationConfig,
    })
    config = createdConfig
    keyOfId = 'insertedId'
  } else {
    config = existingConfig
    keyOfId = '_id'
  }

  await resultCollection.insertOne({
    initialProtocolBalance: initialProtocolBalance.toString(),
    finalProtocolBalance: finalProtocolBalance.toString(),
    changeOfProtocolBalance: changeOfProtocolBalance.toString(),
    initialHostBalance: initialHostBalance.toString(),
    finalHostBalance: finalHostBalance.toString(),
    changeOfHostBalance: changeOfHostBalance.toString(),
    initialFareSupply: initialFareSupply.toString(),
    finalFareSupply: finalFareSupply.toString(),
    changeOfFareSupply: changeOfFareSupply.toString(),
    configId: (config as any)[keyOfId],
    createdAt: Date.now(),
  })

  await client.close()
}

main().catch((err) => {
  console.log(err)
  throw err
})
