import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { parseEther } from 'ethers/lib/utils'

import type {
  CustomVRFCoordinatorV2Mock,
  FareCoinFlipNFTBasedPPV,
  FareToken,
} from '../typechain-types'
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

  const chainId = await getChainId()
  // If we are on a local development network, we need to deploy mocks!
  if (chainId === '31337' || TESTNET_DEPLOYMENT || RUNNING_TESTS) {
    const vrfCoordinatorV2 = (await hre.ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock

    const transaction = await vrfCoordinatorV2.createSubscription()
    const transactionReceipt = await transaction.wait(1)
    const subscriptionId = hre.ethers.BigNumber.from(transactionReceipt.events![0].topics[1])
    await vrfCoordinatorV2.fundSubscription(subscriptionId, hre.ethers.utils.parseEther('1000'))

    const fare = await get('FareToken')
    const farePPVNFT = await get('FarePPVNFT')
    const airnodeRrpMock = await get('AirnodeRrpMock')

    log('Local network detected! Deploying mocks...')
    const deploymentInfo = await deploy('FareCoinFlipNFTBasedPPV', {
      contract: 'FareCoinFlipNFTBasedPPV',
      from: owner,
      log: true,
      // autoMine: true,
      args: [
        {
          baseContractParams: {
            fareTokenAddress: fare.address,
            protocolAddress: protocol,
            hostAddress: host,
            protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'),
          },
          farePPVNFTAddress: farePPVNFT.address,
          contractName: 'FareCoinFlipNFTBasedPPV',
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
      ],
    })

    await vrfCoordinatorV2.addConsumer(subscriptionId, deploymentInfo.address)

    if (!RUNNING_TESTS || LOCAL_DEV) {
      const coinFlip = (await hre.ethers.getContract(
        'FareCoinFlipNFTBasedPPV'
      )) as FareCoinFlipNFTBasedPPV

      const fareToken = (await hre.ethers.getContract('FareToken')) as FareToken
      await fareToken.setWhitelistAddress(coinFlip.address, true)
      console.log(
        `Set coinFlipAddress(${coinFlip.address}) to whitelistAddressList on fareToken(${fareToken.address})!`
      )
      await fareToken.setAllowContractMintBurn(coinFlip.address, true)
      console.log('Added allow mint/burn for FareCoinFlipNFTBasedPPV to owner address.')

      await fareToken.connect(protocolSigner).setAllowContractMintBurn(coinFlip.address, true)
      console.log('Added allow mint/burn for FareCoinFlipNFTBasedPPV to protocol address.')

      await fareToken.connect(hostSigner).setAllowContractMintBurn(coinFlip.address, true)
      console.log('Added allow mint/burn for FareCoinFlipNFTBasedPPV to host address.')

      await fareToken.connect(userSigner).setAllowContractMintBurn(coinFlip.address, true)
      console.log('Added allow mint/burn for FareCoinFlipNFTBasedPPV to user address.')

      // await fareToken.connect(rewardsSigner).setAllowContractMintBurn(spin.address, true)
      // console.log('Added allow mint/burn for FareSpin to rewards address.')

      // const linkToken = (await hre.ethers.getContract('LinkToken')) as LinkToken
      // await linkToken.transfer(spin.address, hre.ethers.utils.parseEther('1000'))
      // console.log('Transfered 1000 LINK token to FareSpin contract!')
    }

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS) {
      log('FareCoinFlipNFTBasedPPV')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['cf_nftBasedPPV']
