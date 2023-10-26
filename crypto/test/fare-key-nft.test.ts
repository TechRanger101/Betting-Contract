import * as hre from 'hardhat'
import { expect } from 'chai'

import type { FareKeyNFT } from '../typechain-types'
import { FareKeyNFTMetadata } from '../scripts/keyNFT/collectionMetadatas'
import { Signer } from 'ethers'

const { ethers, deployments, getNamedAccounts } = hre

const {
  utils: { Logger },
} = ethers

Logger.setLogLevel(Logger.levels.ERROR)

describe('Deployment', () => {
  let nft: FareKeyNFT
  let accounts: { [key: string]: string }
  let signers: { [key: string]: Signer }

  beforeEach(async () => {
    await deployments.fixture(['key_nft'])
    accounts = await getNamedAccounts()
    signers = await ethers.getNamedSigners()
    nft = await ethers.getContract('FareKeyNFT')
  })

  describe('Initialization', () => {
    it('Initialized name correctly', async () => {
      const name = await nft.name()
      expect(name).to.be.eq(FareKeyNFTMetadata.name)
    })

    it('Initialized symbol correctly', async () => {
      const symbol = await nft.symbol()
      expect(symbol).to.be.eq(FareKeyNFTMetadata.symbol)
    })

    it('Initially baseURI is empty', async () => {
      const baseURI = await nft.baseTokenURI()
      expect(baseURI).to.be.eq('')
    })
  })

  describe('baseUri', () => {
    it('Set baseURI', async () => {
      const newBaseUriToSet = 'someUri'
      const setBaseURITx = await nft.setBaseTokenURI(newBaseUriToSet)
      await setBaseURITx.wait()
      const updatedBaseUri = await nft.baseTokenURI()
      expect(updatedBaseUri).to.be.eq(newBaseUriToSet)
    })

    it('Only owner should be able to set baseUri', async () => {
      const newBaseUriToSet = 'someUri'
      await expect(
        nft.connect(signers.rewards).setBaseTokenURI(newBaseUriToSet)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should emit BatchMetadataUpdate event while setting baseUri', async () => {
      const newBaseUriToSet = 'someUri'
      await expect(nft.setBaseTokenURI(newBaseUriToSet)).to.emit(nft, 'BatchMetadataUpdate')
    })
  })

  // describe('tokenIds', () => {
  //   it('Should be as follows: 1 <= tokenId <= MAX_SUPPLY', async () => {
  //     const newBaseUriToSet = 'someUri/'
  //     const setBaseTokenURITx = await nft.setBaseTokenURI(newBaseUriToSet)
  //     await setBaseTokenURITx.wait()

  //     // @NOTE: Technically we could create same address inside the array twice which would cause us to not mint out the NFT
  //     // @NOTE: Therefore, test might fail if that occurs. However it has a pretty low probability. Just wanted to take note about this
  //     const randomAddressArray = new Array(parseInt(FareKeyNFTMetadata.maxSupply))
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = await nft.totalSupply()
  //     expect(totalSupply).to.eq(FareKeyNFTMetadata.maxSupply)

  //     await expect(nft.tokenURI(0)).to.be.revertedWith('ERC721: invalid token ID')
  //     await expect(nft.tokenURI(parseInt(FareKeyNFTMetadata.maxSupply) + 1)).to.be.revertedWith(
  //       'ERC721: invalid token ID'
  //     )
  //     const tokenUriFor1 = await nft.tokenURI(1)
  //     const tokenUriForMaxSupply = await nft.tokenURI(FareKeyNFTMetadata.maxSupply)
  //     expect(tokenUriFor1).to.be.eq(newBaseUriToSet + '1')
  //     expect(tokenUriForMaxSupply).to.be.eq(newBaseUriToSet + FareKeyNFTMetadata.maxSupply)
  //   })
  // })

  // describe('batch mint', () => {
  //   it('Only owner should be able to mint', async () => {
  //     await expect(nft.connect(signers.rewards).batchMint([accounts.owner])).to.be.revertedWith(
  //       'Ownable: caller is not the owner'
  //     )
  //   })

  //   it('Should randomize tokenIds while minting', async () => {
  //     const newBaseUriToSet = 'someUri/'
  //     const setBaseTokenURITx = await nft.setBaseTokenURI(newBaseUriToSet)
  //     await setBaseTokenURITx.wait()

  //     const randomAddressArray = new Array(10)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const indexes = new Array(10).fill(0).map((item, index) => index)
  //     const tokenIdsPerIndex = await Promise.all(
  //       indexes.map(async (index) => {
  //         return (await nft.tokenByIndex(index)).toNumber()
  //       })
  //     )

  //     // Check if consecutively minted token ids have difference of 1
  //     // If true out the all ids, there is one that is not off by 1 then it is randomized
  //     // @NOTE: Since it is randomized, technically all of these tokenIds could be consecutive, therefore this test might fail form time to time
  //     // @NOTE: But that has a very low probability, just wanted to take note to remember that it is possbile
  //     let isConsecutive = true
  //     for (let i = 0; i < tokenIdsPerIndex.length - 1; i++) {
  //       if (Math.abs(tokenIdsPerIndex[i] - tokenIdsPerIndex[i + 1]) !== 1) {
  //         isConsecutive = false
  //       }
  //     }
  //     expect(!isConsecutive)
  //   })

  //   it('Would only mint once if we provide an address twice inside the same batchMint', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     // So, we will try to mint again to the randomAddressArray[0]
  //     // Therefore, we should skip it and should mint 1 less than inputLength
  //     randomAddressArray[1] = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = (await nft.totalSupply()).toNumber()
  //     expect(totalSupply).to.be.eq(inputLength - 1)
  //   })

  //   it('Would not mint on the second one if we provide same address on different batchMints', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     const sameAddress = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([sameAddress])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })

  //   it('Would not mint again for the address even if they Transfer the NFT to someone else', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     randomAddressArray[0] = accounts.owner

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const tokenIdOfOwnersToken = await nft.tokenOfOwnerByIndex(accounts.owner, 0)

  //     const transferTx = await nft.transferFrom(
  //       accounts.owner,
  //       accounts.rewards,
  //       tokenIdOfOwnersToken
  //     )
  //     await transferTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([accounts.owner])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })
  // })

  //   it('Would only mint once if we provide an address twice inside the same batchMint', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     // So, we will try to mint again to the randomAddressArray[0]
  //     // Therefore, we should skip it and should mint 1 less than inputLength
  //     randomAddressArray[1] = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = (await nft.totalSupply()).toNumber()
  //     expect(totalSupply).to.be.eq(inputLength - 1)
  //   })

  //   it('Would not mint on the second one if we provide same address on different batchMints', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     const sameAddress = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([sameAddress])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })

  //   it('Would not mint again for the address even if they Transfer the NFT to someone else', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     randomAddressArray[0] = accounts.owner

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const tokenIdOfOwnersToken = await nft.tokenOfOwnerByIndex(accounts.owner, 0)

  //     const transferTx = await nft.transferFrom(
  //       accounts.owner,
  //       accounts.rewards,
  //       tokenIdOfOwnersToken
  //     )
  //     await transferTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([accounts.owner])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })
  // })

  //   it('Would only mint once if we provide an address twice inside the same batchMint', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     // So, we will try to mint again to the randomAddressArray[0]
  //     // Therefore, we should skip it and should mint 1 less than inputLength
  //     randomAddressArray[1] = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = (await nft.totalSupply()).toNumber()
  //     expect(totalSupply).to.be.eq(inputLength - 1)
  //   })

  //   it('Would not mint on the second one if we provide same address on different batchMints', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     const sameAddress = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([sameAddress])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })

  //   it('Would not mint again for the address even if they Transfer the NFT to someone else', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     randomAddressArray[0] = accounts.owner

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const tokenIdOfOwnersToken = await nft.tokenOfOwnerByIndex(accounts.owner, 0)

  //     const transferTx = await nft.transferFrom(
  //       accounts.owner,
  //       accounts.rewards,
  //       tokenIdOfOwnersToken
  //     )
  //     await transferTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([accounts.owner])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })
  // })

  //   it('Would only mint once if we provide an address twice inside the same batchMint', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     // So, we will try to mint again to the randomAddressArray[0]
  //     // Therefore, we should skip it and should mint 1 less than inputLength
  //     randomAddressArray[1] = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = (await nft.totalSupply()).toNumber()
  //     expect(totalSupply).to.be.eq(inputLength - 1)
  //   })

  //   it('Would not mint on the second one if we provide same address on different batchMints', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     const sameAddress = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([sameAddress])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })

  //   it('Would not mint again for the address even if they Transfer the NFT to someone else', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     randomAddressArray[0] = accounts.owner

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const tokenIdOfOwnersToken = await nft.tokenOfOwnerByIndex(accounts.owner, 0)

  //     const transferTx = await nft.transferFrom(
  //       accounts.owner,
  //       accounts.rewards,
  //       tokenIdOfOwnersToken
  //     )
  //     await transferTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([accounts.owner])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })
  // })

  //   it('Would only mint once if we provide an address twice inside the same batchMint', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     // So, we will try to mint again to the randomAddressArray[0]
  //     // Therefore, we should skip it and should mint 1 less than inputLength
  //     randomAddressArray[1] = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupply = (await nft.totalSupply()).toNumber()
  //     expect(totalSupply).to.be.eq(inputLength - 1)
  //   })

  //   it('Would not mint on the second one if we provide same address on different batchMints', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     const sameAddress = randomAddressArray[0]

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([sameAddress])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })

  //   it('Would not mint again for the address even if they Transfer the NFT to someone else', async () => {
  //     const inputLength = 10
  //     const randomAddressArray = new Array(inputLength)
  //       .fill(1)
  //       .map((item, index) => ethers.Wallet.createRandom(index).address)
  //     randomAddressArray[0] = accounts.owner

  //     const batchMintTx = await nft.batchMint(randomAddressArray)
  //     await batchMintTx.wait()

  //     const tokenIdOfOwnersToken = await nft.tokenOfOwnerByIndex(accounts.owner, 0)

  //     const transferTx = await nft.transferFrom(
  //       accounts.owner,
  //       accounts.rewards,
  //       tokenIdOfOwnersToken
  //     )
  //     await transferTx.wait()

  //     const totalSupplyAfterFirstBatchMint = (await nft.totalSupply()).toNumber()

  //     const batchMintTx2 = await nft.batchMint([accounts.owner])
  //     await batchMintTx2.wait()

  //     const totalSupplyAfterSecondBatchMint = (await nft.totalSupply()).toNumber()

  //     expect(totalSupplyAfterFirstBatchMint).to.be.eq(totalSupplyAfterSecondBatchMint)
  //   })
  // })
})
