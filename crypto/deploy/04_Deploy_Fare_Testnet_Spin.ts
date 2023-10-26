import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'

import type { FareSpin, FareToken } from '../typechain-types'
import { seedContractModes } from '../test/utils/test-helpers'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  ethers: { getNamedSigners },
}: HardhatRuntimeEnvironment | any) {
  const { deploy, log, get } = deployments
  const { owner, rewards } = await getNamedAccounts()
  const { rewards: rewardsSigner } = await getNamedSigners()

  const chainId = await getChainId()
  // If we are on a local development network, we need to deploy mocks!
  if (
    chainId === '51337' ||
    chainId === '51338' ||
    chainId === '50174' ||
    chainId === '31337' ||
    TESTNET_DEPLOYMENT ||
    RUNNING_TESTS
  ) {
    const fare = await get('FareToken')

    log('Local network detected! Deploying mocks...')
    const deployResults = await deploy('FareSpin', {
      contract: 'FareSpin',
      from: owner,
      log: true,
      // autoMine: true,
      args: [fare.address, rewards],
    })

    if (!RUNNING_TESTS || LOCAL_DEV) {
      const spin = (await hre.ethers.getContract('FareSpin')) as FareSpin
      await seedContractModes(spin)
      console.log('Seeded contract modes!')

      const fareToken = (await hre.ethers.getContract('FareToken')) as FareToken
      await fareToken.setWhitelistAddress(deployResults.address, true)
      console.log(
        `Set spinAddress(${spin.address}) to whitelistAddressList on fareToken(${fareToken.address})!`
      )
      await fareToken.setAllowContractMintBurn(spin.address, true)

      console.log('Added allow mint/burn for FareSpin to owner address.')
      await fareToken.connect(rewardsSigner).setAllowContractMintBurn(spin.address, true)
      console.log('Added allow mint/burn for FareSpin to rewards address.')
    }

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS) {
      log('Fare Spin')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['spin-testnet']
