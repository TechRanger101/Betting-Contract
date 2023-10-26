import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { LZ_ENDPOINTS } from '../scripts/constants/environment'
import { FareProxyOFT, FareToken } from '../typechain-types'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
}: HardhatRuntimeEnvironment) {
  const { deploy, log } = deployments
  const { owner } = await getNamedAccounts()
  const fare = (await hre.ethers.getContract('FareToken')) as FareToken
  const networkName = hre.network.name as keyof typeof LZ_ENDPOINTS

  const lzEndpointAddress = LZ_ENDPOINTS[networkName]

  const deployResults = await deploy('FareProxyOFT', {
    contract: 'FareProxyOFT',
    from: owner,
    log: true,
    args: [lzEndpointAddress, fare.address],
    waitConfirmations: 1,
    // autoMine: true,
  })
  console.log('FareProxyOFT deployed to: ', deployResults.address)
  const fareProxyOFT = (await hre.ethers.getContract('FareProxyOFT')) as FareProxyOFT

  const whitelistTx = await fare.setWhitelistAddress(deployResults.address, true)
  await whitelistTx.wait()
  console.log('Whitelisted FareProxyOFT contract for FareToken')
  const allowTx = await fare.setAllowContractMintBurn(fareProxyOFT.address, true)
  await allowTx.wait()
  console.log('Allow contract to mint and burn for the user')

  if (!TESTNET_DEPLOYMENT || RUNNING_TESTS || LOCAL_DEV) {
    log('FareProxyOFT Deployed')
    log('----------------------------------------------------')
    log("You are deploying to a local network, you'll need a local network running to interact")
    log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
    log('----------------------------------------------------')
  }
}
export default func

func.tags = ['fareProxyOFT']
