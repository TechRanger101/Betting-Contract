import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'

import type { CustomVRFCoordinatorV2Mock, FarePlinkoMock, FareToken } from '../typechain-types'
import { parseEther } from 'ethers/lib/utils'

import { execSync } from 'child_process'
import { deployablePlinkoMultipliers } from '../calc/plinko'
import { multiplyBigNumberWithFixedPointNumber } from '../test/utils/test-helpers'
import {
  VRF_CALLBACK_GAS_LIMIT,
  VRF_KEYHASH,
  VRF_REQUEST_CONFIRMATIONS,
} from '../test/utils/test-constants'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env
const oneEther = parseEther('1')

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  ethers: { getNamedSigners },
}: HardhatRuntimeEnvironment | any) {
  const { deploy, log, get } = deployments
  const { owner, rewards, resolver, protocol, host } = await getNamedAccounts()
  const {
    rewards: rewardsSigner,
    protocol: protocolSigner,
    host: hostSigner,
    user: userSigner,
  } = await getNamedSigners()

  execSync('ts-node calc/plinko.ts', { encoding: 'utf-8' }) // the default is 'buffer'

  const chainId = await getChainId()
  if (chainId === '31337' || TESTNET_DEPLOYMENT || RUNNING_TESTS) {
    const vrfCoordinatorV2 = (await hre.ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock

    const transaction = await vrfCoordinatorV2.createSubscription()
    const transactionReceipt = await transaction.wait(1)
    const subscriptionId = hre.ethers.BigNumber.from(transactionReceipt.events![0].topics[1])
    await vrfCoordinatorV2.fundSubscription(subscriptionId, hre.ethers.utils.parseEther('1000'))

    const fare = await get('FareToken')
    // const farePPVNFT = await get('FarePPVNFT')
    const airnodeRrpMock = await get('AirnodeRrpMock')

    log('Local network detected! Deploying mocks...')
    const deploymentInfo = await deploy('FarePlinkoMock', {
      contract: 'FarePlinkoMock',
      from: owner,
      log: true,
      // autoMine: true,
      // @NOTE failing tests
      // @NOTE the protocolProbabilityValue that is set here is preventing deployment
      // @NOTE `protocolProbabilityValue: 0.01 eth or greater` triggers an InvalidMultipliers() custom error
      // @NOTE `protocolProbabilityValue: any value less than 0.01 eth` --> triggers an InvalidPPV() custom error
      args: [
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'),
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: {
            subscriptionId: subscriptionId,
            vrfCoordinator: vrfCoordinatorV2.address,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        },
        deployablePlinkoMultipliers,
      ],
    })

    await vrfCoordinatorV2.addConsumer(subscriptionId, deploymentInfo.address)

    if (!RUNNING_TESTS || LOCAL_DEV) {
      const plinko = (await hre.ethers.getContract('FarePlinkoMock')) as FarePlinkoMock

      const fareToken = (await hre.ethers.getContract('FareToken')) as FareToken
      await fareToken.setWhitelistAddress(plinko.address, true)
      console.log(
        `Set plinkoAddress(${plinko.address}) to whitelistAddressList on fareToken(${fareToken.address})!`
      )
      await fareToken.setAllowContractMintBurn(plinko.address, true)
      console.log('Added allow mint/burn for FarePlinko to owner address.')

      await fareToken.connect(protocolSigner).setAllowContractMintBurn(plinko.address, true)
      console.log('Added allow mint/burn for FarePlinko to protocol address.')

      await fareToken.connect(hostSigner).setAllowContractMintBurn(plinko.address, true)
      console.log('Added allow mint/burn for FarePlinko to host address.')

      await fareToken.connect(userSigner).setAllowContractMintBurn(plinko.address, true)
      console.log('Added allow mint/burn for FarePlinko to user address.')
    }

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS) {
      log('FarePlinko')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['plinko']
