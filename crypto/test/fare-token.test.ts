import * as hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { expect } from 'chai'
import { BigNumber } from 'ethers'

import type { FareToken } from '../typechain-types'
import { getBalances } from './utils/test-helpers'
import { SignerWithAddress } from 'hardhat-deploy-ethers/signers'

const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = hre

describe('FareToken', () => {
  const initialSupply = ethers.utils.parseEther((50 * Math.pow(10, 9)).toString()) // 50 billion
  const newMintLimit = ethers.utils.parseEther((10 * Math.pow(10, 9)).toString()) // 10 billion
  const newBurnLimit = ethers.utils.parseEther((5 * Math.pow(10, 9)).toString()) // 5 billion
  const transferAmount = ethers.utils.parseEther('10000')
  const mintAmount = ethers.utils.parseEther('20000')
  const burnAmount = ethers.utils.parseEther('1000')

  let fare: FareToken
  let userFareToken: FareToken
  let owner: string
  let user: string
  let userSigner: SignerWithAddress

  before(async () => {
    const accounts = await getNamedAccounts()
    userSigner = (await ethers.getUnnamedSigners())[0]
    user = (await getUnnamedAccounts())[0]
    owner = accounts.owner
  })

  beforeEach(async () => {
    await deployments.fixture(['fare'])
    fare = (await ethers.getContract('FareToken')) as FareToken
    userFareToken = fare.connect(userSigner)
    await fare.setWhitelistAddress(owner, true)
  })

  it('Canary test', async () => {
    let files = fs.readdirSync(path.resolve('./artifacts/contracts/FareToken.sol/'))
    expect(files.includes('FareToken.json')).to.equal(true)
  })

  describe('Deployment', () => {
    it('Supply after deployment should be 50 billion', async () => {
      const balance = await fare.balanceOf(owner)

      expect(balance).to.equal(initialSupply)
    })

    it('Owner and deployer should be the same address', async () => {
      expect(await fare.owner()).to.equal(owner)
    })

    it('Should not be able to transfer more than 50 billion', async () => {
      await expect(fare.transfer(user, initialSupply.add(1))).to.be.reverted
    })
  })

  describe('Transfer', () => {
    it('Transfer 10,000 FARE to user wallet', async () => {
      await fare.transfer(user, transferAmount)
      const [deployerBalance, userBalance] = await getBalances(fare, [owner, user])

      expect(userBalance).to.equal(transferAmount)
      expect(deployerBalance).to.equal(initialSupply.sub(transferAmount))
    })

    it('Should not be able to transfer more than balance', async () => {
      await fare.transfer(user, transferAmount)

      await expect(userFareToken.transfer(owner, transferAmount.add(1))).to.be.revertedWith(
        'ERC20: transfer amount exceeds balance'
      )
    })

    it('Transfer 10,000 FARE from owner to user and check owner balance', async () => {
      await fare.transfer(user, transferAmount)
      const balance = await fare.balanceOf(owner)

      expect(balance).to.equal(initialSupply.sub(transferAmount))
    })
  })

  describe('Whitelist', () => {
    it('Add user address to whitelist', async () => {
      await fare.setWhitelistAddress(user, true)
      const isUserOnWhitelist = await fare.contractWhitelist(user)

      expect(isUserOnWhitelist).to.equal(true)
    })

    it('Ensure non-whitelist addresses do not exist on whitelist', async () => {
      let userAddresses = await getUnnamedAccounts()

      for (const userAddress of userAddresses) {
        expect(await fare.contractWhitelist(userAddress)).to.equal(false)
      }
    })

    // @NOTE: split into 2 tests
    it('Remove existing whitelist address', async () => {
      await fare.setWhitelistAddress(user, true)
      let isUserOnWhitelist = await fare.contractWhitelist(user)
      expect(isUserOnWhitelist).to.equal(true)

      await fare.setWhitelistAddress(user, false)
      isUserOnWhitelist = await fare.contractWhitelist(user)
      expect(isUserOnWhitelist).to.equal(false)
    })
  })

  describe('Allow/Disallow whitelisted contract to mint/burn', () => {
    it('User should be able to allow a whitelisted contract to mint token', async () => {
      const userMintAmount = ethers.utils.parseEther('100000')
      await fare.setWhitelistAddress(owner, true)
      await userFareToken.setAllowContractMintBurn(owner, true)

      await fare.mintFare(user, userMintAmount)
      const balance = await fare.balanceOf(user)
      const totalSupply = await fare.totalSupply()
      expect(balance).to.equal(userMintAmount)
      expect(totalSupply).to.equal(initialSupply.add(userMintAmount))
    })

    it('User should be able to allow a whitelisted contract to burn token', async () => {
      const userBurnAmount = ethers.utils.parseEther('100000')
      await fare.transfer(user, userBurnAmount)

      await fare.setWhitelistAddress(owner, true)
      await userFareToken.setAllowContractMintBurn(owner, true)

      await fare.burnFare(user, userBurnAmount)
      const balance = await fare.balanceOf(user)
      const totalSupply = await fare.totalSupply()
      expect(balance).to.equal(BigNumber.from('0'))
      expect(totalSupply).to.equal(initialSupply.sub(userBurnAmount))
    })

    it('Mint should be rejected when user has not allowed whitelisted contract permission', async () => {
      const userMintAmount = ethers.utils.parseEther('100000')
      await fare.setWhitelistAddress(owner, true)
      await fare.transfer(user, userMintAmount)
      await expect(fare.mintFare(user, userMintAmount)).to.be.revertedWith(
        'User did not allow contract to mint'
      )
    })

    it('Burn should be rejected when user has not allowed whitelisted contract permission', async () => {
      const userBurnAmount = ethers.utils.parseEther('100000')
      await fare.setWhitelistAddress(owner, true)
      await fare.transfer(user, userBurnAmount)
      await expect(fare.burnFare(user, userBurnAmount)).to.be.revertedWith(
        'User did not allow contract to burn'
      )
    })
  })

  describe('Pause/Unpause', () => {
    it('Minting or burning while contract is paused is rejected', async () => {
      await fare.setWhitelistAddress(user, true)
      await userFareToken.setAllowContractMintBurn(user, true)
      await fare.transfer(user, transferAmount)

      const pauseTx = await fare.setPauseContract(true)
      await pauseTx.wait()

      await expect(userFareToken.burnFare(user, burnAmount)).to.be.revertedWith('Pausable: paused')
      await expect(userFareToken.mintFare(user, burnAmount)).to.be.revertedWith('Pausable: paused')
    })

    it('Should be able to mint or burn after it is unpaused', async () => {
      await fare.setWhitelistAddress(user, true)
      await userFareToken.setAllowContractMintBurn(owner, true)
      await fare.transfer(user, transferAmount)

      const pauseTx = await fare.setPauseContract(true)
      await pauseTx.wait()

      await expect(userFareToken.burnFare(user, burnAmount)).to.be.revertedWith('Pausable: paused')
      await expect(userFareToken.mintFare(user, burnAmount)).to.be.revertedWith('Pausable: paused')

      const pauseTx1 = await fare.setPauseContract(false)
      await pauseTx1.wait()

      const userBalanceBeforeMint = await fare.balanceOf(user)
      await fare.mintFare(user, mintAmount)
      const userBalanceAfterMint = await fare.balanceOf(user)
      expect(userBalanceBeforeMint.add(mintAmount)).to.equal(userBalanceAfterMint)

      const userBalanceBeforeBurn = await fare.balanceOf(user)
      await fare.burnFare(user, burnAmount)
      const userBalanceAfterBurn = await fare.balanceOf(user)
      expect(userBalanceBeforeBurn.sub(burnAmount)).to.equal(userBalanceAfterBurn)
    })
  })

  describe('Mint/Burn', () => {
    it('Minting Fare from non whitelist wallet address is rejected', async () => {
      await expect(userFareToken.mintFare(user, mintAmount)).to.be.revertedWith('Not on whitelist')
    })

    it('Burning Fare from non whitelist wallet address is rejected', async () => {
      await expect(userFareToken.burnFare(user, burnAmount)).to.be.revertedWith('Not on whitelist')
    })

    it('Mint 100,000 Fare to user wallet from whitelist address', async () => {
      const userMintAmount = ethers.utils.parseEther('100000')
      await fare.setWhitelistAddress(owner, true)
      await userFareToken.setAllowContractMintBurn(owner, true)

      await fare.mintFare(user, userMintAmount)
      const balance = await fare.balanceOf(user)
      const totalSupply = await fare.totalSupply()
      expect(balance).to.equal(userMintAmount)
      expect(totalSupply).to.equal(initialSupply.add(userMintAmount))
    })

    it('Burn 1,000 Fare on owner wallet and ensure total supply is correct', async () => {
      await fare.setAllowContractMintBurn(owner, true)
      await fare.burnFare(owner, burnAmount)
      const totalSupply = await fare.totalSupply()

      expect(totalSupply).to.equal(initialSupply.sub(burnAmount))
    })

    it('Add user address to whitelist and mint FARE', async () => {
      await fare.setWhitelistAddress(user, true)
      await userFareToken.setAllowContractMintBurn(user, true)
      await fare.transfer(user, transferAmount)
      await userFareToken.mintFare(user, mintAmount)

      const newUserBalance = await userFareToken.balanceOf(user)
      expect(newUserBalance).to.equal(transferAmount.add(mintAmount))
    })

    it('Add user address to whitelist and burn FARE', async () => {
      await fare.setWhitelistAddress(user, true)
      await userFareToken.setAllowContractMintBurn(user, true)
      await fare.transfer(user, transferAmount)
      await userFareToken.burnFare(user, burnAmount)

      const newUserBalance = await userFareToken.balanceOf(user)
      expect(newUserBalance).to.equal(transferAmount.sub(burnAmount))
    })

    it('Burning more FARE than is available on user wallet should be reverted', async () => {
      await fare.setWhitelistAddress(user, true)
      await userFareToken.setAllowContractMintBurn(user, true)

      await expect(userFareToken.burnFare(user, burnAmount)).to.be.revertedWith(
        'ERC20: burn amount exceeds balance'
      )
    })

    it('Set mint limit', async () => {
      await fare.setMintLimit(newMintLimit)
      expect(await fare.mintLimit()).to.equal(newMintLimit)
    })

    it('Set burn limit', async () => {
      await fare.setBurnLimit(newMintLimit)
      expect(await fare.burnLimit()).to.equal(newMintLimit)
    })

    it('Ensure mint limit is enforced', async () => {
      await userFareToken.setAllowContractMintBurn(owner, true)
      await fare.setMintLimit(newMintLimit)

      await expect(fare.mintFare(user, newMintLimit.add(1))).to.be.revertedWith(
        'Amount exceeds mint limit'
      )
    })

    it('Ensure burn limit is enforced', async () => {
      await userFareToken.setAllowContractMintBurn(owner, true)
      await fare.setBurnLimit(newBurnLimit)

      await expect(fare.burnFare(user, newBurnLimit.add(1))).to.be.revertedWith(
        'Amount exceeds burn limit'
      )
    })
  })
})
