import fs from 'fs'
import * as hre from 'hardhat'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/dist/types'
import { FareKeyNFTMetadata } from '../scripts/keyNFT/collectionMetadatas'

const { TESTNET_DEPLOYMENT = false, RUNNING_TESTS = false, LOCAL_DEV = false } = process.env

const func: DeployFunction = async function ({
  getNamedAccounts,
  deployments,
  getChainId,
  ethers: { getNamedSigners },
}: HardhatRuntimeEnvironment | any) {
  const { deploy, log } = deployments
  const { owner } = await getNamedAccounts()

  const chainId = await getChainId()
  // If we are on a local development network, we need to deploy mocks!
  if (chainId === '31337' || TESTNET_DEPLOYMENT || RUNNING_TESTS) {
    await deploy(`${FareKeyNFTMetadata.contractName}`, {
      contract: `${FareKeyNFTMetadata.contractName}`,
      from: owner,
      log: true,
      // autoMine: true,
      args: [`${FareKeyNFTMetadata.name}`, `${FareKeyNFTMetadata.symbol}`],
    })

    // Reset the mintedNFTInfo if we are not testing
    if (chainId !== '31337') {
      const resettedMintedNFTInfo = { addresses: [], tokenIds: [] }
      fs.writeFileSync(
        `./scripts/keyNFT/mintedNFTInfo.json`,
        JSON.stringify(resettedMintedNFTInfo, null, 4),
        'utf8'
      )
    }

    if (!TESTNET_DEPLOYMENT || RUNNING_TESTS) {
      log('FareKeyNFT')
      log('----------------------------------------------------')
      log("You are deploying to a local network, you'll need a local network running to interact")
      log('Please run `yarn hardhat console` to interact with the deployed smart contracts!')
      log('----------------------------------------------------')
    }
  }
}
export default func

func.tags = ['key_nft']
