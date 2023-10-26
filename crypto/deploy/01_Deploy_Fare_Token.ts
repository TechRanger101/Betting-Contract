import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers } from 'ethers'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env

const {
  utils: { parseEther: toEth },
} = ethers

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments
  const { owner } = await getNamedAccounts()
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
    log('Local network detected! Deploying mocks...')
    await deploy('FareToken', {
      contract: 'FareToken',
      from: owner,
      log: true,
      args: [toEth('6000000000'), toEth('4000000000')],
      // autoMine: true,
    })

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS || LOCAL_DEV) {
      log('FareToken Deployed')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['fare']
