import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false } = process.env

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments
  const { owner } = await getNamedAccounts()
  const chainId = await getChainId()
  // If we are on a local development network, we need to deploy mocks!
  if (chainId === '50174' || chainId === '31337' || TESTNET_DEPLOYMENT || RUNNING_TESTS) {
    log('Local network detected! Deploying mocks...')
    const linkToken = await deploy('LinkToken', {
      contract: 'LinkToken',
      from: owner,
      log: true,
      // autoMine: true,
    })
    await deploy('VRFCoordinatorMock', {
      contract: 'VRFCoordinatorMock',
      from: owner,
      log: true,
      args: [linkToken.address],
      // autoMine: true,
    })

    await deploy('CustomVRFCoordinatorV2Mock', {
      contract: 'CustomVRFCoordinatorV2Mock',
      from: owner,
      log: true,
      args: ['1', '1'],
    })

    await deploy('AirnodeRrpMock', {
      contract: 'AirnodeRrpMock',
      from: owner,
      log: true,
    })

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS) {
      log('Mocks Deployed!')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['mocks']
