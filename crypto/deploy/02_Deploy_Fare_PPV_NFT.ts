import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { ethers } from 'ethers'
import { FarePPVNFT, FareToken } from '../typechain-types'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env

const {
  utils: { parseEther: toEth },
} = ethers

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
}: HardhatRuntimeEnvironment) {
  const { deploy, log, get } = deployments
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
    const fareToken = (await hre.ethers.getContract('FareToken')) as FareToken

    await deploy('FarePPVNFT', {
      contract: 'FarePPVNFT',
      from: owner,
      log: true,
      args: ['Fare PPVNFT', 'FPPVNFT', fareToken.address],
      // autoMine: true,
    })
    const fareNFT = (await hre.ethers.getContract('FarePPVNFT')) as FarePPVNFT

    await fareToken.setWhitelistAddress(fareNFT.address, true)
    console.log(
      `Set FarePPVNFT(${fareNFT.address}) to whitelistAddressList on fareToken(${fareToken.address})!`
    )
    await fareToken.setAllowContractMintBurn(fareNFT.address, true)
    console.log('Added allow mint/burn for FarePPVNFT to owner address.')

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS || LOCAL_DEV) {
      log('FareNFT Deployed')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['ppv_nft']
