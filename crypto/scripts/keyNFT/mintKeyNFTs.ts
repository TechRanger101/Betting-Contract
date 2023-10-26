import fs from 'fs'
import { ethers } from 'hardhat'
import * as toMintNFTInfoJSON from './toMintNFTInfo.json'
import { FareKeyNFT } from '../../typechain-types'
import * as mintedNFTInfoJSON from './mintedNFTInfo.json'

// How to use =>
// First deploy the NFT contract using the following commnad => `npx hardhat deploy --tags key_nft --network <your-prefered-network>`
//      This should create json files inside `deployments` folder, hre will access the specific contract using that config file
// Second update the values inside `./constants/keyNFTMintAddresses` to indicate which addresses to mint nfts to
// Then use this script to mint to with the same `--network <your-prefered-network>` argument to make sure that you are using the same network as you deployed the contract to
const main = async () => {
  const nft = (await ethers.getContract('FareKeyNFT')) as FareKeyNFT

  const toMintNFTInfo = JSON.parse(JSON.stringify(toMintNFTInfoJSON))
  const mintedNFTInfo = JSON.parse(JSON.stringify(mintedNFTInfoJSON))
  if (toMintNFTInfo.addresses.length !== toMintNFTInfo.tokenIds.length) {
    throw Error('Mismatch amount for address and tokenId for NFT minting')
  }
  const maxSupplyBN = await nft.MAX_SUPPLY()
  const maxSupply = maxSupplyBN.toNumber()
  if (toMintNFTInfo.tokenIds.some((tokenId: string) => parseInt(tokenId) > maxSupply)) {
    throw Error('Cannot mint for a tokenId that is more tha MAX_SUPPLY')
  }
  const filteredAddressesToMint = toMintNFTInfo.addresses.filter(
    (address: string) => !mintedNFTInfo.addresses.includes(address)
  )
  const filteredTokenIdsToMint = toMintNFTInfo.tokenIds.filter(
    (tokenId: string) => !mintedNFTInfo.tokenIds.includes(tokenId)
  )
  if (filteredAddressesToMint.length !== filteredTokenIdsToMint.length) {
    throw Error('Mismatch array length after filtering to mint address and tokenIds')
  }
  if (!filteredAddressesToMint.length || !filteredTokenIdsToMint.length) {
    throw Error('No unique address or tokenId to mints')
  }

  const batchMintTx = await nft.batchMint(filteredTokenIdsToMint, filteredAddressesToMint, {
    // gasLimit: (await ethers.provider.getBlock('latest')).gasLimit,
    gasLimit: '20000000',
  })
  await batchMintTx.wait()
  console.log('minted to addresses: ')
  console.log(filteredAddressesToMint)
  console.log('minted following tokenIds: ')
  console.log(filteredTokenIdsToMint)

  mintedNFTInfo.addresses.push(...filteredAddressesToMint)
  mintedNFTInfo.tokenIds.push(...filteredTokenIdsToMint)
  delete mintedNFTInfo.default
  fs.writeFileSync(
    `./scripts/keyNFT/mintedNFTInfo.json`,
    JSON.stringify(mintedNFTInfo, null, 4),
    'utf8'
  )
  console.log('Updated `mintedNFTInfo.json`')
}
main()
