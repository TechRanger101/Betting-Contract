import * as hre from 'hardhat'
import { expect } from 'chai'

import {
  AirnodeRrpMock,
  CustomVRFCoordinatorV2Mock,
  FareCrashMock,
  FareCrashMock__factory,
  FareToken,
  LinkToken,
} from '../typechain-types'
import { multiplyBigNumberWithFixedPointNumber } from './utils/test-helpers'
import { SignerWithAddress } from 'hardhat-deploy-ethers/signers'
import { BigNumber } from 'ethers'
import { mine } from '@nomicfoundation/hardhat-network-helpers'
import {
  VRF_CALLBACK_GAS_LIMIT,
  VRF_KEYHASH,
  VRF_REQUEST_CONFIRMATIONS,
} from './utils/test-constants'

const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = hre

const {
  BigNumber: BN,
  utils: { Logger, parseEther: toEth },
} = ethers

Logger.setLogLevel(Logger.levels.ERROR)
const oneEther = toEth('1')
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.03')

describe('Deployment', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let owner: string
  let rewards: string
  let resolver: string
  let protocol: string
  let host: string
  let user: string
  let subscriptionId = BN.from('1')

  let crash: FareCrashMock

  let link: LinkToken
  let userSigners: SignerWithAddress[]
  let signers
  let users: string[]

  beforeEach(async () => {
    const accounts = await getNamedAccounts()
    signers = await ethers.getNamedSigners()
    userSigners = await ethers.getUnnamedSigners()
    users = await getUnnamedAccounts()
    owner = accounts.owner
    rewards = accounts.rewards
    resolver = accounts.resolver
    protocol = accounts.protocol
    host = accounts.host
    user = accounts.user

    await deployments.fixture(['mocks', 'fare', 'crash'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    fare = (await ethers.getContract('FareToken')) as FareToken
    crash = (await ethers.getContract('FareCrashMock')) as FareCrashMock
  })

  it('Successful FareCrashMock Deployment', async () => {
    const FareCrashMockFactory = await ethers.getContractFactory('FareCrashMock')
    const FareCrashMockDeployed = await FareCrashMockFactory.deploy(
      {
        fareTokenAddress: fare.address,
        protocolAddress: protocol,
        hostAddress: host,
        protocolProbabilityValue: ppv,
      },
      {
        keccakParams: { keccakResolver: resolver },
        vrfParams: {
          subscriptionId: subscriptionId,
          vrfCoordinator: vrfCoordinator.address,
          keyHash: VRF_KEYHASH,
          callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
          requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
        },
        qrngParams: { airnodeRrp: airnodeRrpMock.address },
      }
    )
    expect(await FareCrashMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid _fareTokenAddress should fail deployment', async () => {
    const FareCrashMockFactory = await ethers.getContractFactory('FareCrashMock')
    await expect(
      FareCrashMockFactory.deploy(
        {
          fareTokenAddress: zeroAddress,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: {
            subscriptionId: subscriptionId,
            vrfCoordinator: vrfCoordinator.address,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        }
      )
    ).to.be.revertedWithCustomError(crash, 'InvalidFareTokenAddress')
  })

  it('Invalid _protocolAddress should fail deployment', async () => {
    const FareCrashMockFactory = await ethers.getContractFactory('FareCrashMock')
    await expect(
      FareCrashMockFactory.deploy(
        {
          fareTokenAddress: fare.address,
          protocolAddress: zeroAddress,
          hostAddress: host,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: {
            subscriptionId: subscriptionId,
            vrfCoordinator: vrfCoordinator.address,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        }
      )
    ).to.be.revertedWithCustomError(crash, 'InvalidProtocolAddress')
  })
  it('Invalid _hostAddress should fail deployment', async () => {
    const FareCrashMockFactory = await ethers.getContractFactory('FareCrashMock')
    await expect(
      FareCrashMockFactory.deploy(
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: zeroAddress,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: {
            subscriptionId: subscriptionId,
            vrfCoordinator: vrfCoordinator.address,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        }
      )
    ).to.be.revertedWithCustomError(crash, 'InvalidHostAddress')
  })
  it('Invalid _protocolProbabilityValue should fail deployment', async () => {
    const FareCrashMockFactory = await ethers.getContractFactory('FareCrashMock')
    await expect(
      FareCrashMockFactory.deploy(
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.001'),
        },
        {
          keccakParams: { keccakResolver: resolver },
          vrfParams: {
            subscriptionId: subscriptionId,
            vrfCoordinator: vrfCoordinator.address,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        }
      )
    ).to.be.revertedWithCustomError(crash, 'InvalidPPV')
  })
})

describe('FareCrashMock', () => {
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let owner: string
  let rewards: string
  let resolver: string
  let protocol: string
  let host: string
  let user: string

  // @NOTE unresolved warning
  let crash: FareCrashMock
  let userSigners: SignerWithAddress[]
  let signers: any
  let users: string[]

  beforeEach(async () => {
    const accounts = await getNamedAccounts()
    signers = await ethers.getNamedSigners()
    userSigners = await ethers.getUnnamedSigners()
    users = await getUnnamedAccounts()
    owner = accounts.owner
    rewards = accounts.rewards
    resolver = accounts.resolver
    protocol = accounts.protocol
    host = accounts.host
    user = accounts.user

    await deployments.fixture(['mocks', 'fare', 'crash'])
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    crash = (await ethers.getContract('FareCrashMock')) as FareCrashMock
  })

  describe('Constructor', () => {
    it('FareCrashMock has the correct FareToken address', async () => {
      const crashFareToken = await crash.fareToken()
      expect(crashFareToken).to.equal(fare.address)
    })

    it('FareCrashMock and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const crashSignerAddress = await crash.owner()
      expect(fareSignerAddress).to.equal(crashSignerAddress)
    })

    it('FareCrashMock protocol address is correct', async () => {
      const actual = await crash.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareCrashMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareCrashMock host address is correct', async () => {
      const actual = await crash.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareCrashMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareCrashMock precision is 1 ether', async () => {
      const actualPrecision = await crash.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareCrashMock ppv value is 0.03 ether which represents 3.00%', async () => {
      const ppv = await crash.protocolProbabilityValue()
      expect(ppv).to.equal(oneEther.div('100').mul('3'))
    })

    it('FareCrashMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await crash.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareCrashMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await crash.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareCrashMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await crash.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareCrashMock round is paused by default', async () => {
      const isRoundPaused = await crash.isRoundPaused()
      expect(isRoundPaused).to.be.false
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(crash.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await crash.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await crash.setHostAddress(protocol)
      const newHostAddress = await crash.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(crash.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        crash,
        'InvalidHostAddress'
      )
    })

    it('Ensure user can submit entry when round is not paused', async () => {
      const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
      await sendFareToUserAddressTx.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [toEth('1000')])
      await submitEntryTx.wait()
    })

    it('Ensure an address could be set as a manager', async () => {
      await expect(
        crash.connect(userSigners[4]).pauseRoundAndRequestRandomNumber()
      ).to.be.revertedWithCustomError(crash, 'NotManagerOrOwner')

      const setManagerTx = await crash.setManagerStatus(userSigners[4].address, true)
      await setManagerTx.wait()

      await expect(crash.connect(userSigners[4]).pauseRoundAndRequestRandomNumber()).to.emit(
        crash,
        'IsRoundPausedUpdate'
      )
    })
  })

  describe('SubmitEntry', () => {
    const amount = toEth('1000')

    beforeEach(async () => {
      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
    })

    it('Invalid side should revert', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([99], [amount])
      ).to.be.revertedWithCustomError(crash, 'SideShouldBeMoreThan100')
    })

    it('Should revert if sides are not in ascending order', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([300, 200], [amount, amount])
      ).to.be.revertedWithCustomError(crash, 'EntrySidesShouldBeInAscendingOrder')
    })

    it('Should revert if sides are not unique', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([300, 300], [amount, amount])
      ).to.be.revertedWithCustomError(crash, 'EntrySidesShouldBeInAscendingOrder')
    })

    it('Empty entry should revert', async () => {
      await expect(crash.connect(signers.user).submitEntry([], [])).to.be.revertedWithCustomError(
        crash,
        'EntryIsEmpty'
      )
    })

    it('Should revert if sides and amounts length differ', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([200], [])
      ).to.be.revertedWithCustomError(crash, 'EntrySideAndAmountLengthMismatch')
    })

    it('Invalid amount should revert', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([200], [0])
      ).to.be.revertedWithCustomError(crash, 'EntryWithZeroTokens')
    })

    it('Invalid amount should revert for multiple amounts', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([200, 300], [toEth('10'), 0])
      ).to.be.revertedWithCustomError(crash, 'EntryWithZeroTokens')
    })

    it('Submits an entry and stores the related data', async () => {
      const side = 200
      const submitEntryTx = await crash.connect(signers.user).submitEntry([side], [amount])
      await submitEntryTx.wait()

      const roundId = await crash.roundIdCounter()
      const userEntry = await crash.getEntryOfUserForRound(user, roundId)

      expect(side).to.be.equal(userEntry.sides[0])
      expect(amount).to.be.equal(userEntry.amounts[0])
    })

    it('Should not be able to submit multiple entries for the same round', async () => {
      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      await expect(
        crash.connect(signers.user).submitEntry([201], [amount.mul(2)])
      ).to.be.revertedWithCustomError(crash, 'EntryAlreadySubmittedForTheRound')
    })

    it('Should burn tokens from user', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(user)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(user)

      expect(userBalanceBeforeEntry).to.be.greaterThan(userBalanceAfterEntry)
    })

    it('Should burn `amount` tokens from user', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(user)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(user)

      expect(userBalanceBeforeEntry).to.be.equal(userBalanceAfterEntry.add(amount))
    })

    it('Should mint tokens for host', async () => {
      const hostBalanceBeforeEntry = await fare.balanceOf(host)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const hostBalanceAfterEntry = await fare.balanceOf(host)

      expect(hostBalanceAfterEntry).to.be.greaterThan(hostBalanceBeforeEntry)
    })

    it('Should mint correct amount of tokens to host according to ppv', async () => {
      const hostRewardsPercentage = await crash.HOST_REWARDS_PERCENTAGE()

      const hostBalanceBeforeEntry = await fare.balanceOf(host)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const hostBalanceAfterEntry = await fare.balanceOf(host)

      expect(
        hostBalanceBeforeEntry.add(amount.mul(hostRewardsPercentage).div(oneEther))
      ).to.be.equal(hostBalanceAfterEntry)
    })

    it('Should mint tokens for protocol', async () => {
      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)

      expect(protocolBalanceAfterEntry).to.be.greaterThan(protocolBalanceBeforeEntry)
    })

    it('Should mint correct amount of tokens to protocol according to ppv', async () => {
      const protocolRewardsPercentage = await crash.PROTOCOL_REWARDS_PERCENTAGE()

      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()

      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)

      expect(
        protocolBalanceBeforeEntry.add(amount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.be.equal(protocolBalanceAfterEntry)
    })

    it('Should mint correct amount of tokens to protocol and host with multiple sides and amounts', async () => {
      const side0 = 200
      const side1 = 300
      const amount0 = toEth('1000')
      const amount1 = toEth('2000')
      const protocolRewardsPercentage = await crash.PROTOCOL_REWARDS_PERCENTAGE()
      const hostRewardsPercentage = await crash.HOST_REWARDS_PERCENTAGE()

      const hostBalanceBeforeEntry = await fare.balanceOf(host)
      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await crash
        .connect(signers.user)
        .submitEntry([side0, side1], [amount0, amount1])
      await submitEntryTx.wait()

      const hostBalanceAfterEntry = await fare.balanceOf(host)
      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)

      expect(
        protocolBalanceBeforeEntry
          .add(amount0.mul(protocolRewardsPercentage).div(oneEther))
          .add(amount1.mul(protocolRewardsPercentage).div(oneEther))
      ).to.be.equal(protocolBalanceAfterEntry)
      expect(
        hostBalanceBeforeEntry
          .add(amount0.mul(hostRewardsPercentage).div(oneEther))
          .add(amount1.mul(hostRewardsPercentage).div(oneEther))
      ).to.be.equal(hostBalanceAfterEntry)
    })

    it('Should emit `EntrySubmitted` event', async () => {
      await expect(crash.connect(signers.user).submitEntry([200], [amount])).to.emit(
        crash,
        'EntrySubmitted'
      )
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(userSigners[0]).submitEntry([150], [1])
      await submitEntryTx.wait()

      const setMinEntryAmount = await crash.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(crash.submitEntry([200], [1])).to.be.revertedWithCustomError(
        crash,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(
        crash.submitEntry([101, 150, 200, 300, 500], [1, 1, 1, 1, 1])
      ).to.be.revertedWithCustomError(crash, 'EntryAmountLowerThanMinEntryAmount')
      expect(crash.submitEntry([600], [toEth('1').sub(1)])).to.be.revertedWithCustomError(
        crash,
        'EntryAmountLowerThanMinEntryAmount'
      )
      const submitEntryTx1 = await crash.submitEntry([1000], [toEth('1')])
      await submitEntryTx1.wait()
      const submitEntryTx2 = await crash
        .connect(userSigners[1])
        .submitEntry([250, 500], [toEth('1').div(2), toEth('1').div(2)])
      await submitEntryTx2.wait()
    })
  })

  describe('PauseRoundAndRequestRandomNumber', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash.connect(userSigners[0]).submitEntry([300], [amount])
      await submitEntryTx1.wait()
    })

    it('Should not be callable if round is paused', async () => {
      const pauseTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      expect(crash.pauseRoundAndRequestRandomNumber()).to.be.revertedWithCustomError(
        crash,
        'RoundPaused'
      )
    })

    it('Should not be callable by normal users', async () => {
      await expect(
        crash.connect(userSigners[0]).pauseRoundAndRequestRandomNumber()
      ).to.be.revertedWithCustomError(crash, 'NotManagerOrOwner')
    })

    it('Should be callable by manager', async () => {
      const setManager = await crash.setManagerStatus(userSigners[0].address, true)
      await setManager.wait()

      const isRoundPausedBefore = await crash.isRoundPaused()
      expect(isRoundPausedBefore).to.be.false

      const pauseTx = await crash.connect(userSigners[0]).pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      const isRoundPausedAfter = await crash.isRoundPaused()
      expect(isRoundPausedAfter).to.be.true
    })

    it('Should pause the round', async () => {
      const isPausedBefore = await crash.isRoundPaused()
      expect(isPausedBefore).to.be.false

      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseRoundAndRequestRandomNumberTx.wait()

      const isPausedAfter = await crash.isRoundPaused()
      expect(isPausedAfter).to.be.true
    })

    it('Should not increment roundId', async () => {
      const roundIdBefore = await crash.roundIdCounter()

      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseRoundAndRequestRandomNumberTx.wait()

      const roundIdAfter = await crash.roundIdCounter()
      expect(roundIdAfter).to.be.equal(roundIdBefore)
    })

    it('Should store blockNumber', async () => {
      const roundId = await crash.roundIdCounter()
      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      const receipt = await pauseRoundAndRequestRandomNumberTx.wait()
      expect(receipt.blockNumber).to.be.equal(await crash.roundIdToBlockNumber(roundId))
    })

    it('Emits isRoundPaused', async () => {
      expect(crash.pauseRoundAndRequestRandomNumber()).to.emit(crash, 'IsRoundPausedUpdate')
    })

    it('Emits RequestedRandomNumberForRound', async () => {
      expect(crash.pauseRoundAndRequestRandomNumber()).to.emit(
        crash,
        'RequestedRandomNumberForRound'
      )
    })

    it('Should store requestId for the round', async () => {
      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      const receipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = receipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
      const requestId = requestEvent.requestId
      const roundId = await crash.roundIdCounter()
      expect(roundId).to.be.equal(await crash.requestIdToRoundId(requestId))
    })
  })

  describe('ResolveAndUnpauseRound', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash.connect(userSigners[0]).submitEntry([300], [amount])
      await submitEntryTx1.wait()

      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = pauseReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
    })

    it('Should not be able to resolve if randomNumber is not requested', async () => {
      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      await expect(
        crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      ).to.be.revertedWithCustomError(crash, 'RoundNotPaused')
    })

    it("Should not be able to resolve current round with old failed round's requestId", async () => {
      // request, wait 200 blocks, fails, request new, try to resolve with old should fail
      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      const requestNewTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestNewTx.wait()

      await expect(
        crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      ).to.be.revertedWithCustomError(crash, 'RequestIdIsNotForCurrentRound')
    })

    it('Should increment roundIdCounter by 1', async () => {
      const roundIdBefore = await crash.roundIdCounter()

      const resolveTx = await crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const roundIdAfter = await crash.roundIdCounter()

      expect(roundIdAfter).to.be.equal(roundIdBefore.add(1))
    })

    it('Should store round result', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveTx = await crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const roundResult = await crash.roundIdToRoundResult(roundId)

      expect(roundResult.toNumber()).to.not.be.equal(0)
    })

    it('Should set isRoundPaused to false', async () => {
      const resolveTx = await crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      expect(await crash.isRoundPaused()).to.be.false
    })

    it('Should emit IsRoundPausedUpdate', async () => {
      await expect(crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
        crash,
        'IsRoundPausedUpdate'
      )
    })

    it('Should emit RoundResolved', async () => {
      await expect(crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
        crash,
        'RoundResolved'
      )
    })

    it('Should not be able to submit a new entry after round is paused', async () => {
      await expect(
        crash.connect(userSigners[1]).submitEntry([400], [amount])
      ).to.be.revertedWithCustomError(crash, 'RoundPaused')
    })

    it('Should not be able to withdraw an entry from the current round after round is paused', async () => {
      await expect(
        crash
          .connect(userSigners[1])
          .withdrawEntry(await crash.roundIdCounter(), userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'RoundNotResolvedYet')
    })

    it('Should not be able to submit a new entry after round is paused, does not matter if they have already submitted an entry', async () => {
      await expect(
        crash.connect(signers.user).submitEntry([300], [amount])
      ).to.be.revertedWithCustomError(crash, 'RoundPaused')
    })

    it('Should emit correct `roundId` and `roundResult`', async () => {
      const roundIdBefore = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(350)
      const resolveRoundReceipt = await resolveRoundTx.wait()

      const roundIdAfter = await crash.roundIdCounter()

      const resolveEvent = resolveRoundReceipt.events?.filter(
        (event) => event.event === 'RoundResolved'
      )[0].args

      expect(resolveEvent!.roundId).to.be.equal(roundIdBefore)
      expect(resolveEvent!.roundId.add(1)).to.be.equal(roundIdAfter)
      expect(resolveEvent!.roundResult.toNumber()).to.be.equal(350)
    })

    it('Should not resolve if requested randomNumber inside the same block as resolvement', async () => {
      const resolveRound = await crash
        .connect(signers.resolver)
        .resolveKeccak(requestEvent.requestId)
      await resolveRound.wait()

      await hre.network.provider.send('evm_setAutomine', [false])
      await hre.network.provider.send('evm_setIntervalMining', [0])

      const ownerRequestCount = await crash.addressToRequestCount(owner)
      const expectedRequestId = await crash.simulateRequestId(ownerRequestCount)
      // const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      // const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      // requestEvent = pauseReceipt.events?.filter(
      //   (event) => event.event === 'RequestedRandomNumberForRound'
      // )[0].args
      // expect(expectedRequestId.toString()).to.be.equal(requestEvent.requestId)
      const roundIdBefore = await crash.roundIdCounter()

      await crash.pauseRoundAndRequestRandomNumber()
      await crash.connect(signers.resolver).resolveKeccak(expectedRequestId)

      await hre.network.provider.send('evm_mine')
      const roundIdAfter = await crash.roundIdCounter()
      expect(roundIdBefore).to.be.equal(roundIdAfter)
      await hre.network.provider.send('evm_setAutomine', [true])
    })
  })

  describe('RandomNumberFailure', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash.connect(userSigners[0]).submitEntry([300], [amount])
      await submitEntryTx1.wait()

      const pauseRoundAndRequestRandomNumberTx = await crash.pauseRoundAndRequestRandomNumber()
      const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = pauseReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
    })

    it('Should not be callable before 200 blocks', async () => {
      await expect(crash.randomNumberFailure()).to.be.revertedWithCustomError(
        crash,
        'TooEarlyToFail'
      )
    })

    it('Should mark roundId as failed', async () => {
      await mine(200)

      const roundId = await crash.roundIdCounter()
      const failureTx = await crash.randomNumberFailure()
      await failureTx.wait()

      const isFailed = await crash.roundIdToIsFailed(roundId)
      expect(isFailed).to.be.true
    })

    it('Should unpause round', async () => {
      await mine(200)

      const failureTx = await crash.randomNumberFailure()
      await failureTx.wait()

      const isPaused = await crash.isRoundPaused()
      expect(isPaused).to.be.false
    })

    it('Should emit `IsRoundPausedUpdate`', async () => {
      await mine(200)

      await expect(crash.randomNumberFailure()).to.emit(crash, 'IsRoundPausedUpdate')
    })

    it('Should emit `RoundFailed`', async () => {
      await mine(200)

      await expect(crash.randomNumberFailure()).to.emit(crash, 'RoundFailed')
    })
  })

  describe('Claim', () => {
    const amount = toEth('1000')
    const user0Side = 300
    const complexEntrySide0 = 200
    const complexEntrySide1 = 300
    const complexEntrySide2 = 500
    const complexEntryAmount0 = toEth('1000')
    const complexEntryAmount1 = toEth('2000')
    const complexEntryAmount2 = toEth('10000')

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()
      const sendFareTx3 = await fare.transfer(userSigners[2].address, toEth('20000'))
      await sendFareTx3.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash.connect(userSigners[0]).submitEntry([user0Side], [amount])
      await submitEntryTx1.wait()
      const submitComplexEntryTx = await crash
        .connect(userSigners[2])
        .submitEntry(
          [complexEntrySide0, complexEntrySide1, complexEntrySide2],
          [complexEntryAmount0, complexEntryAmount1, complexEntryAmount2]
        )
      await submitComplexEntryTx.wait()

      const pauseTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()
    })

    it('Should not be able to claim for the current round', async () => {
      await expect(
        crash.connect(userSigners[0]).claim(await crash.roundIdCounter(), userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'RoundNotResolvedYet')
    })

    it('Should not be able to claim for future rounds', async () => {
      await expect(
        crash
          .connect(userSigners[0])
          .claim((await crash.roundIdCounter()).add(10), userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'RoundNotResolvedYet')
    })

    it('Someone else can claim for someone', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(500)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)

      const claimTx = await crash.connect(userSigners[1]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)

      expect(user0BalanceAfterClaim.gt(user0BalanceBeforeClaim)).to.be.true
    })

    it('Reward calculations are correct', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(500)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(user0BalanceBeforeClaim.add(amount.mul(user0Side).div(100))).to.be.equal(
        user0BalanceAfterClaim
      )
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Reward calculations are correct for multiple sides and amounts for single entry, when user wins in total', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(600)
      await resolveRoundTx.wait()

      const user2BalanceBeforeClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[2].address)
      await claimTx.wait()

      const user2BalanceAfterClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(
        user2BalanceBeforeClaim
          .add(complexEntryAmount0.mul(complexEntrySide0).div(100))
          .add(complexEntryAmount1.mul(complexEntrySide1).div(100))
          .add(complexEntryAmount2.mul(complexEntrySide2).div(100))
      ).to.be.equal(user2BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Reward calculations are correct for multiple sides and amounts for single entry, when user loses in total', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(400)
      await resolveRoundTx.wait()

      const user2BalanceBeforeClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[2].address)
      await claimTx.wait()

      const user2BalanceAfterClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(
        user2BalanceBeforeClaim
          .add(complexEntryAmount0.mul(complexEntrySide0).div(100))
          .add(complexEntryAmount1.mul(complexEntrySide1).div(100))
      ).to.be.equal(user2BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Claims an entry that did not win', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(100)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(user0BalanceBeforeClaim).to.be.equal(user0BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Cannot claim twice for the same entry', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(500)
      await resolveRoundTx.wait()

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      await expect(
        crash.connect(userSigners[3]).claim(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'EntryDoesNotExistForTheRound')
    })

    it('Entry data should be deleted after claimed', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(500)
      await resolveRoundTx.wait()

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const entryData = await crash.getEntryOfUserForRound(userSigners[0].address, roundId)
      expect(entryData.amounts.length).to.be.equal(0)
      expect(entryData.sides.length).to.be.equal(0)
    })

    it('Should emit `EntriesClaimed` event', async () => {
      const roundId = await crash.roundIdCounter()

      const resolveRoundTx = await crash.mockResolveRound(500)
      await resolveRoundTx.wait()

      const claimTx = await crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      const claimReceipt = await claimTx.wait()

      // Get hash of the event signature (will be the first topic of the emitted event)
      const hashOfEntriesClaimedEventSignature = ethers.utils.id(
        'EntriesClaimed(address,uint256[],uint256[])'
      )
      // Get our specific event out of all the events emitted
      const emittedEntriesClaimedEvent = claimReceipt.logs.filter(
        (log) => log.topics[0] === hashOfEntriesClaimedEventSignature
      )[0]
      const iface = new ethers.utils.Interface(FareCrashMock__factory.abi)
      const entriesClaimedData = iface.parseLog(emittedEntriesClaimedEvent)
      expect(entriesClaimedData.args.roundIds[0].toString()).to.be.equal('0')
      expect(entriesClaimedData.args.userRewards[0]._isBigNumber).to.be.true
    })

    it('Should not be able to claim for a failed round', async () => {
      const roundId = await crash.roundIdCounter()
      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      await expect(
        crash.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'CannotClaimFromAFailedRound')
    })
  })

  describe('BatchClaim', () => {
    const amount = toEth('1000')
    const amount0 = amount
    const amount1 = amount.mul(2)
    const amount2 = amount.mul(3)

    let roundId0: number
    let roundId1: number
    let roundId2: number

    const user0Side0 = 300
    const user0Side1 = 600
    const user0Side2 = 450

    const roundResult0 = user0Side0 + 10
    const roundResult1 = user0Side1 - 10
    const roundResult2 = user0Side2 + 10

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side0], [amount0])
      await submitEntryTx1.wait()

      const pauseTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      roundId0 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx = await crash.mockResolveRound(roundResult0)
      await resolveRoundTx.wait()

      const submitEntryTx3 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side1], [amount1])
      await submitEntryTx3.wait()

      const pauseTx1 = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx1.wait()

      roundId1 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx1 = await crash.mockResolveRound(roundResult1)
      await resolveRoundTx1.wait()

      const submitEntryTx4 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side2], [amount2])
      await submitEntryTx4.wait()

      const pauseTx2 = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx2.wait()

      roundId2 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx2 = await crash.mockResolveRound(roundResult2)
      await resolveRoundTx2.wait()
    })

    it('Should not work with empty array of roundIds', async () => {
      await expect(
        crash.connect(userSigners[2]).batchClaim([], userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'CannotClaimForZeroRounds')
    })

    it('Reward calculations are correct', async () => {
      const user0BalanceBefore = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx = await crash
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2, roundId2 + 1000], userSigners[0].address)
      await batchClaimTx.wait()

      const user0BalanceAfter = await fare.balanceOf(userSigners[0].address)

      expect(
        user0BalanceBefore.add(
          amount0.mul(user0Side0).div(100).add(amount2.mul(user0Side2).div(100))
        )
      ).to.be.equal(user0BalanceAfter)
    })

    it('Nothing happens if you try to claim already claimed ones', async () => {
      const user0BalanceBefore = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx = await crash
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2], userSigners[0].address)
      await batchClaimTx.wait()

      const user0BalanceAfter = await fare.balanceOf(userSigners[0].address)

      expect(
        user0BalanceBefore.add(
          amount0.mul(user0Side0).div(100).add(amount2.mul(user0Side2).div(100))
        )
      ).to.be.equal(user0BalanceAfter)

      const user0BalanceAfterExtraClaim = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx1 = await crash
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2], userSigners[0].address)
      await batchClaimTx1.wait()

      expect(user0BalanceAfter).to.be.equal(user0BalanceAfterExtraClaim)
    })

    it('Should emit `EntriesClaimed` event', async () => {
      const batchClaimTx = await crash
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2], userSigners[0].address)
      const batchClaimReceipt = await batchClaimTx.wait()

      // Get hash of the event signature (will be the first topic of the emitted event)
      const hashOfEntriesClaimedEventSignature = ethers.utils.id(
        'EntriesClaimed(address,uint256[],uint256[])'
      )
      // Get our specific event out of all the events emitted
      const emittedEntriesClaimedEvent = batchClaimReceipt.logs.filter(
        (log) => log.topics[0] === hashOfEntriesClaimedEventSignature
      )[0]
      const iface = new ethers.utils.Interface(FareCrashMock__factory.abi)
      const entriesClaimedData = iface.parseLog(emittedEntriesClaimedEvent)
      expect(
        entriesClaimedData.args.roundIds.map((roundId: { toNumber: () => number }) =>
          roundId.toNumber()
        )
      ).to.be.eql([roundId0, roundId1, roundId2])
      expect(
        entriesClaimedData.args.userRewards.reduce(
          (grossUserReward: BigNumber, userReward: BigNumber) => grossUserReward.add(userReward)
        )
      ).to.be.equal(amount0.mul(user0Side0).div(100).add(amount2.mul(user0Side2).div(100)))
    })

    it('Each entry data is deleted', async () => {
      const batchClaimTx = await crash
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2], userSigners[0].address)
      await batchClaimTx.wait()

      const entry0 = await crash.getEntryOfUserForRound(userSigners[0].address, roundId0)
      const entry1 = await crash.getEntryOfUserForRound(userSigners[0].address, roundId1)
      const entry2 = await crash.getEntryOfUserForRound(userSigners[0].address, roundId2)

      expect(entry0.amounts.length === 0 && entry0.sides.length === 0).to.be.true
      expect(entry1.amounts.length === 0 && entry1.sides.length === 0).to.be.true
      expect(entry2.amounts.length === 0 && entry2.sides.length === 0).to.be.true
    })
  })

  describe('WithdrawEntry', () => {
    const amount = toEth('1000')

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx1 = await crash.connect(userSigners[0]).submitEntry([225], [amount])
      await submitEntryTx1.wait()
      const submitEntryTx2 = await crash
        .connect(userSigners[1])
        .submitEntry([225, 375], [amount, amount])
      await submitEntryTx2.wait()
    })

    it('Cannot withdraw from current round', async () => {
      const roundId = await crash.roundIdCounter()
      await expect(
        crash.withdrawEntry(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'RoundNotResolvedYet')
    })

    it('Cannot withdraw from a future round', async () => {
      const roundId = await crash.roundIdCounter()
      await expect(
        crash.withdrawEntry(roundId.add(1), userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'RoundNotResolvedYet')
    })

    it('Cannot withdraw from a successfully resolved round', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      const requestReceipt = await requestTx.wait()
      const requestEvent = requestReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args as any

      const resolveTx = await crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      expect(crash.withdrawEntry(roundId, userSigners[0].address)).to.be.revertedWithCustomError(
        crash,
        'CannotWithdrawFromASuccessfulRound'
      )
    })

    it('Cannot withdraw if already claimed', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      const requestReceipt = await requestTx.wait()
      const requestEvent = requestReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args as any

      const resolveTx = await crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const claimTx = await crash.claim(roundId, userSigners[0].address)
      await claimTx.wait()

      expect(crash.withdrawEntry(roundId, userSigners[0].address)).to.be.revertedWithCustomError(
        crash,
        'CannotWithdrawFromASuccessfulRound'
      )
    })

    it('Cannot withdraw the same entry twice', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      const withdrawTx = await crash.withdrawEntry(roundId, userSigners[0].address)
      await withdrawTx.wait()

      await expect(
        crash.withdrawEntry(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(crash, 'EntryDoesNotExistForTheRound')
    })

    it('Correctly mints and burns fare for user, host and protocol', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      const hostRewardsPercentage = await crash.HOST_REWARDS_PERCENTAGE()
      const protocolRewardsPercentage = await crash.PROTOCOL_REWARDS_PERCENTAGE()

      const userBalanceBefore = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBefore = await fare.balanceOf(host)
      const protocolBalanceBefore = await fare.balanceOf(protocol)

      const withdrawTx = await crash.withdrawEntry(roundId, userSigners[0].address)
      await withdrawTx.wait()

      const userBalanceAfter = await fare.balanceOf(userSigners[0].address)
      const hostBalanceAfter = await fare.balanceOf(host)
      const protocolBalanceAfter = await fare.balanceOf(protocol)

      expect(userBalanceBefore.add(amount)).to.be.equal(userBalanceAfter)
      expect(hostBalanceBefore.sub(amount.mul(hostRewardsPercentage).div(oneEther))).to.be.equal(
        hostBalanceAfter
      )
      expect(
        protocolBalanceBefore.sub(amount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.be.equal(protocolBalanceAfter)
    })

    it('Correctly mints and burns fare for user, host and protocol when entry has multiple amounts', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      const hostRewardsPercentage = await crash.HOST_REWARDS_PERCENTAGE()
      const protocolRewardsPercentage = await crash.PROTOCOL_REWARDS_PERCENTAGE()

      const userBalanceBefore = await fare.balanceOf(userSigners[1].address)
      const hostBalanceBefore = await fare.balanceOf(host)
      const protocolBalanceBefore = await fare.balanceOf(protocol)

      const withdrawTx = await crash.withdrawEntry(roundId, userSigners[1].address)
      await withdrawTx.wait()

      const userBalanceAfter = await fare.balanceOf(userSigners[1].address)
      const hostBalanceAfter = await fare.balanceOf(host)
      const protocolBalanceAfter = await fare.balanceOf(protocol)

      expect(userBalanceBefore.add(amount.mul(2))).to.be.equal(userBalanceAfter)
      expect(
        hostBalanceBefore.sub(amount.mul(2).mul(hostRewardsPercentage).div(oneEther))
      ).to.be.equal(hostBalanceAfter)
      expect(
        protocolBalanceBefore.sub(amount.mul(2).mul(protocolRewardsPercentage).div(oneEther))
      ).to.be.equal(protocolBalanceAfter)
    })

    it('Should delete entry data after withdrawal', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      const withdrawTx = await crash.withdrawEntry(roundId, userSigners[0].address)
      await withdrawTx.wait()

      const entry = await crash.getEntryOfUserForRound(userSigners[0].address, roundId)
      expect(entry.amounts.length).to.be.equal(0)
      expect(entry.sides.length).to.be.equal(0)
    })
    // Should emit EntryWithdrew
    it('Should emit EntryWithdrew', async () => {
      const roundId = await crash.roundIdCounter()
      const requestTx = await crash.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await crash.randomNumberFailure()
      await failTx.wait()

      await expect(crash.withdrawEntry(roundId, userSigners[0].address)).to.emit(
        crash,
        'EntryWithdrew'
      )
    })
  })

  describe('FilterWinningRounds', () => {
    const amount = toEth('1000')
    const amount0 = amount
    const amount1 = amount.mul(2)
    const amount2 = amount.mul(3)

    let roundId0: number
    let roundId1: number
    let roundId2: number
    let roundId3: number

    const user0Side0 = 300
    const user0Side1 = 600
    const user0Side2 = 450
    const user0ComplexSide0 = 200
    const user0ComplexSide1 = user0ComplexSide0 + 20

    const roundResult0 = user0Side0 + 10
    const roundResult1 = user0Side1 - 10
    const roundResult2 = user0Side2 + 10
    const roundResult3 = user0ComplexSide1 - 10

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(crash.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(crash.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await crash.connect(signers.user).submitEntry([200], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side0], [amount0])
      await submitEntryTx1.wait()

      const pauseTx = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      roundId0 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx = await crash.mockResolveRound(roundResult0)
      await resolveRoundTx.wait()

      const submitEntryTx3 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side1], [amount1])
      await submitEntryTx3.wait()

      const pauseTx1 = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx1.wait()

      roundId1 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx1 = await crash.mockResolveRound(roundResult1)
      await resolveRoundTx1.wait()

      const submitEntryTx4 = await crash
        .connect(userSigners[0])
        .submitEntry([user0Side2], [amount2])
      await submitEntryTx4.wait()

      const pauseTx2 = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx2.wait()

      roundId2 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx2 = await crash.mockResolveRound(roundResult2)
      await resolveRoundTx2.wait()

      const submitEntryTx5 = await crash
        .connect(userSigners[0])
        .submitEntry([user0ComplexSide0, user0ComplexSide1], [amount, amount])
      await submitEntryTx5.wait()

      const pauseTx3 = await crash.pauseRoundAndRequestRandomNumber()
      await pauseTx3.wait()

      roundId3 = (await crash.roundIdCounter()).toNumber()
      const resolveRoundTx3 = await crash.mockResolveRound(roundResult3)
      await resolveRoundTx3.wait()
    })

    it('Should only return winning rounds', async () => {
      const winningRoundIds = await crash.filterWinningRounds(
        [roundId0, roundId1, roundId2, roundId2 + 1000, roundId3],
        userSigners[0].address
      )
      expect(winningRoundIds.map((roundId) => roundId.toNumber())).to.be.eql([
        roundId0,
        roundId2,
        roundId3,
        0,
        0,
      ])
    })
  })

  describe('Requesters', () => {
    const amount = toEth('1000')
    describe('Keccak', () => {
      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
          crash,
          'RoundResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(crash.resolveKeccak(requestEvent.requestId)).to.be.revertedWithCustomError(
          crash,
          'NotKeccakResolver'
        )
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          crash.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(crash, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccak` and resolveRandomNumbers', async () => {
        await expect(crash.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          crash,
          'NotKeccakResolver'
        )
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await crash.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(
          crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
        ).to.be.revertedWithCustomError(crash, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await crash.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        const setKeccakRequester = await crash.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          crash.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
        ).to.be.revertedWithCustomError(crash, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(crash.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          crash,
          'InternalFunction'
        )

        await expect(
          crash.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(crash, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await crash.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          crash.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(crash, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await crash.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await crash.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })
    })

    describe('VRF', () => {
      beforeEach(async () => {
        const setVRFRequester = await crash.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        await expect(crash.pauseRoundAndRequestRandomNumber()).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestEvent.requestId, crash.address, [1])
        ).to.emit(crash, 'RoundResolved')
      })
    })

    describe('QRNG', () => {
      beforeEach(async () => {
        const setQRNGRequester = await crash.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await crash.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await crash.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        await expect(crash.pauseRoundAndRequestRandomNumber()).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await crash.submitEntry([250], [amount])
        await submitEntryTx.wait()

        const requestTx = await crash.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestEvent.requestId,
            crash.address,
            crash.address,
            // Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(crash, 'RoundResolved')
      })
    })
  })
})
