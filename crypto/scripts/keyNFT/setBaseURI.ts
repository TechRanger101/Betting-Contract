import { ethers } from 'hardhat'
import { FareKeyNFT } from '../../typechain-types'

// @NOTE: Requires to be run with `URI` environment variable inside cli
// Allows you to set contractURI for the deployed FareKeyNFT
// Example way to run => `URI=<some-url> npx hardhat run scripts/keyNFT/setBaseURI.ts --network <your-prefered-network>`
const main = async () => {
  const nft = (await ethers.getContract('FareKeyNFT')) as FareKeyNFT
  if (!process.env.URI) {
    throw Error(
      'Should provide URI as environment variable while running. Example: `URI=<some-url> npx hardhat run scripts/keyNFT/setBaseURI.ts --network <your-prefered-network>`'
    )
  }
  const setURITx = await nft.setBaseTokenURI(process.env.URI)
  await setURITx.wait()
  console.log('base URI updated')
  console.log(process.env.URI)
}
main()
