import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  CustomVRFCoordinatorV2Mock,
  FareCoinFlipBaseSUContract,
} from '../typechain-types'
import { multiplyBigNumberWithFixedPointNumber } from './utils/test-helpers'
import { BigNumber, Event } from 'ethers'
import { SignerWithAddress } from 'hardhat-deploy-ethers/signers'
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
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')
const defaultBlockNumberCountForWithdraw = 200
const defaultMaxEntryCount = 20

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

  // @NOTE unresolved warning
  let coinFlip: FareCoinFlipBaseSUContract
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'cf_baseSU'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    coinFlip = (await ethers.getContract(
      'FareCoinFlipBaseSUContract'
    )) as FareCoinFlipBaseSUContract
  })

  it('Successful FareCoinFlipBaseSUContract Deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    const FareCoinFlipBaseSUContractDeployed = await FareCoinFlipBaseSUContractFactory.deploy(
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
    expect(await FareCoinFlipBaseSUContractDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolAddress should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidProtocolAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidHostAddress')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
        {
          fareTokenAddress: fare.address,
          protocolAddress: protocol,
          hostAddress: host,
          protocolProbabilityValue: ppv,
        },
        {
          keccakParams: { keccakResolver: zeroAddress },
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
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
            vrfCoordinator: zeroAddress,
            keyHash: VRF_KEYHASH,
            callbackGasLimit: VRF_CALLBACK_GAS_LIMIT,
            requestConfirmations: VRF_REQUEST_CONFIRMATIONS,
          },
          qrngParams: { airnodeRrp: airnodeRrpMock.address },
        }
      )
    ).to.be.revertedWithCustomError(coinFlip, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FareCoinFlipBaseSUContractFactory = await ethers.getContractFactory(
      'FareCoinFlipBaseSUContract'
    )
    await expect(
      FareCoinFlipBaseSUContractFactory.deploy(
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
          qrngParams: { airnodeRrp: zeroAddress },
        }
      )
    ).to.be.reverted
  })
})

describe('FareCoinFlipBaseSUContract', () => {
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

  // @NOTE unresolved warning
  let coinFlip: FareCoinFlipBaseSUContract
  let link: LinkToken
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'cf_baseSU'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    coinFlip = (await ethers.getContract(
      'FareCoinFlipBaseSUContract'
    )) as FareCoinFlipBaseSUContract
  })

  describe('Constructor', () => {
    it('FareCoinFlipBaseSUContract has the correct FareToken address', async () => {
      const coinFlipFareToken = await coinFlip.fareToken()
      expect(coinFlipFareToken).to.equal(fare.address)
    })

    it('FareCoinFlipBaseSUContract and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const coinFlipSignerAddress = await coinFlip.owner()
      expect(fareSignerAddress).to.equal(coinFlipSignerAddress)
    })

    it('FareCoinFlipBaseSUContract protocol address is correct', async () => {
      const actual = await coinFlip.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareCoinFlipBaseSUContract protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareCoinFlipBaseSUContract host address is correct', async () => {
      const actual = await coinFlip.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareCoinFlipBaseSUContract host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareCoinFlipBaseSUContract precision is 1 ether', async () => {
      const actualPrecision = await coinFlip.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareCoinFlipBaseSUContract ppv value is 0.01 ether which represents 1.00% (default)', async () => {
      const ppv = await coinFlip.protocolProbabilityValue()
      expect(ppv).to.equal(oneEther.div('100'))
    })

    it('FareCoinFlipBaseSUContract MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await coinFlip.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareCoinFlipBaseSUContract HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareCoinFlipBaseSUContract PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareCoinFlipBaseSUContract MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw =
        await coinFlip.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FareCoinFlipBaseSUContract maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await coinFlip.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(coinFlip.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await coinFlip.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await coinFlip.setHostAddress(protocol)
      const newHostAddress = await coinFlip.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(coinFlip.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        coinFlip,
        'InvalidHostAddress'
      )
    })

    // @NOTE VRFRequester: setRequestParameters(), getVRFCoordinatorAddress(), subscriptionId()
    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await coinFlip.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await coinFlip.subscriptionId()).to.equal(newSubscriptionId)
      expect(await coinFlip.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await coinFlip.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await coinFlip.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await coinFlip.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxGameCount', async () => {
      const setTx = await coinFlip.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxEntryCount = await coinFlip.maxEntryCount()
      expect(newMaxEntryCount).to.equal(200)
    })

    it('Set maxGameCount to 0 should fail', async () => {
      await expect(coinFlip.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        coinFlip,
        'InvalidMaxEntryCount'
      )
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      await expect(coinFlip.submitEntry(2, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        coinFlip,
        'SideIsOver1'
      )
    })

    it('Invalid amount should revert', async () => {
      await expect(coinFlip.submitEntry(0, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(coinFlip.submitEntry(0, 1, 0, 0, 0)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryWithZeroTokens'
      )

      await expect(coinFlip.submitEntry(0, toEth('1000'), 0, 0, 101)).to.be.revertedWithCustomError(
        coinFlip,
        'CountExceedsMaxEntryCount'
      )
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20

      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await coinFlip.submitEntry(0, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const afterFareBalance = await fare.balanceOf(owner)
      expect(initialFareBalance).to.equal(afterFareBalance.add(entryAmount.mul(entryCount)))
    })

    it('Should request a random number', async () => {
      await expect(coinFlip.submitEntry(0, 1, 0, 0, 1)).to.emit(
        coinFlip,
        'KeccakRandomNumberRequested'
      )
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    // @NOTE KeccalResolver: resolveKeccak
    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
      await setRandomNumbersTx.wait()

      await expect(coinFlip.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        coinFlip,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()

      await expect(coinFlip.submitEntry(1, toEth('2000'), 0, 0, 10)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryInProgress'
      )
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const entryCount = 20
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(coinFlip.submitEntry(1, toEth('2000'), 0, 0, 20)).to.emit(
        coinFlip,
        'EntrySubmitted'
      )
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await coinFlip.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.not.eq(0)

      const storedUserForEntry = await coinFlip.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await coinFlip.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(coinFlip.submitEntry(0, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(coinFlip.submitEntry(0, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(coinFlip.submitEntry(0, toEth('1').sub(1), 0, 0, 1)).to.be.revertedWithCustomError(
        coinFlip,
        'EntryAmountLowerThanMinEntryAmount'
      )
      const submitEntryTx1 = await coinFlip.submitEntry(0, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await coinFlip.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const resolveTx1 = await coinFlip.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()

      const submitEntryTx2 = await coinFlip.submitEntry(0, toEth('1').div(10), 0, 0, 10)
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await coinFlip.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const resolveTx2 = await coinFlip.connect(signers.resolver).resolveKeccak(requestId2)
      await resolveTx2.wait()
    })
  })

  describe('ResolveEntry', () => {
    let requestId: string
    let submitEntryTx
    let submitEntryReceipt
    let entrySubmittedEvent

    // @NOTE unresolved warning
    let side = 0
    let entryAmount = toEth('1000')
    let entryCount = 20
    let users

    it('Invalid requestId should revert', async () => {
      const entryCount = 20
      submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(coinFlip, 'RequestIdNotInProgress')
    })

    it('When user loses, nothing is minted to user', async () => {
      const entryCount = 1
      const protocolSide = 1
      const userSide = 1 - protocolSide
      submitEntryTx = await coinFlip.submitEntry(userSide, toEth('1000'), 0, 0, entryCount)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.equal(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to user', async () => {
      const entryCount = 1
      const protocolSide = 1
      const userSide = protocolSide
      submitEntryTx = await coinFlip.submitEntry(userSide, toEth('1000'), 0, 0, entryCount)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to host and protocol addresses', async () => {
      const entryCount = 1
      const protocolSide = 1
      const userSide = protocolSide
      submitEntryTx = await coinFlip.submitEntry(userSide, toEth('1000'), 0, 0, entryCount)
      await submitEntryTx.wait()
      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user loses, something is minted to host and protocol addresses', async () => {
      const entryCount = 1
      const protocolSide = 1
      const userSide = 1 - protocolSide
      submitEntryTx = await coinFlip.submitEntry(userSide, toEth('1000'), 0, 0, entryCount)
      await submitEntryTx.wait()
      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      const entryCount = 1
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(coinFlip.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        coinFlip,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      const entryCount = 1
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await coinFlip.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(
        coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(coinFlip, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const entryCount = 1
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await coinFlip.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await coinFlip.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Calculations with User Rewards Based Protocol Probability Value', () => {
    let userBalanceBeforeEntry: BigNumber
    let userBalanceAfterEntry: BigNumber
    let userBalanceAfterResolve: BigNumber

    let hostBalanceBeforeEntry: BigNumber
    let hostBalanceAfterEntry: BigNumber
    let hostBalanceAfterResolve: BigNumber

    let protocolBalanceBeforeEntry: BigNumber
    let protocolBalanceAfterEntry: BigNumber
    let protocolBalanceAfterResolve: BigNumber

    let fareSupplyBeforeEntry: BigNumber
    let fareSupplyAfterEntry: BigNumber
    let fareSupplyAfterResolve: BigNumber

    let entryAmount = toEth('1000')
    let entryCount = 1
    let requestId

    let winMultiplier
    let loseMultiplier
    let ppv
    let hostRewardsPercentage
    let protocolRewardsPercentage

    it('Wins a single entry', async () => {
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 1
      const userSide = protocolSide
      const submitEntryTx = await coinFlip.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceAfterEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(
        userBalanceAfterEntry.add(
          entryAmount.mul(winMultiplier).div(oneEther).mul(oneEther.sub(ppv)).div(oneEther)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount.mul(winMultiplier).div(oneEther).mul(oneEther.sub(ppv)).div(oneEther))
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 1
      const userSide = 1 - protocolSide
      const submitEntryTx = await coinFlip.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceAfterEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with LOSE
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries', async () => {
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 0
      const userSide = protocolSide
      const submitEntryTx = await coinFlip.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      //   @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(
        userBalanceAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryCount)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(
            entryAmount
              .mul(winMultiplier)
              .div(oneEther)
              .mul(oneEther.sub(ppv))
              .div(oneEther)
              .mul(entryCount)
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      // @NOTE Do not forget it will return 100 to represent %1.00
      ppv = await coinFlip.protocolProbabilityValue()
      // @NOTE Do not forget it will return 50 to represent %0.50
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 0
      const userSide = 1 - protocolSide
      const submitEntryTx = await coinFlip.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with LOSE
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          hostBalanceAfterEntry
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(
              protocolBalanceAfterEntry.add(
                entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount)
              )
            )
        )
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('Check stopLoss and stopGain controls', () => {
    let userBalanceBeforeEntry: BigNumber
    let userBalanceAfterEntry: BigNumber
    let userBalanceAfterResolve: BigNumber

    let hostBalanceBeforeEntry: BigNumber
    let hostBalanceAfterEntry: BigNumber
    let hostBalanceAfterResolve: BigNumber

    let protocolBalanceBeforeEntry: BigNumber
    let protocolBalanceAfterEntry: BigNumber
    let protocolBalanceAfterResolve: BigNumber

    let fareSupplyBeforeEntry: BigNumber
    let fareSupplyAfterEntry: BigNumber
    let fareSupplyAfterResolve: BigNumber

    let entryAmount = toEth('1000')
    let entryCount = 1
    let precision
    let requestId
    let stopLoss
    let stopGain

    // @NOTE unresolved warning
    let winMultiplier
    let loseMultiplier
    let ppv
    let hostRewardsPercentage
    let protocolRewardsPercentage
    let playedEntryCount
    let remainingEntryCount

    it('stopLoss amount is less than entryAmount and loses first entry', async () => {
      entryCount = 2
      playedEntryCount = 1
      remainingEntryCount = 1
      stopLoss = entryAmount.div('2')
      stopGain = entryAmount.div('2')
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 1
      // @NOTE userSide and protocolSide are different. Therefore, user will lose
      const userSide = 1 - protocolSide
      const submitEntryTx = await coinFlip.submitEntry(
        userSide,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with LOSE
      expect(userBalanceAfterEntry.add(entryAmount)).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount)
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is less than entryAmount and wins first entry', async () => {
      entryCount = 2
      playedEntryCount = 1
      remainingEntryCount = 1
      stopLoss = entryAmount.div('2')
      stopGain = entryAmount.div('2')
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 1
      // @NOTE userSide and protocolSide are different. Therefore, user will lose
      const userSide = protocolSide
      const submitEntryTx = await coinFlip.submitEntry(
        userSide,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with LOSE
      expect(
        userBalanceAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(playedEntryCount)
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(playedEntryCount)
            .add(entryAmount.mul(remainingEntryCount))
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopLoss amount is just more than entryAmount and loses 2 entries', async () => {
      entryCount = 2
      playedEntryCount = 2
      remainingEntryCount = 0
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()
      const protocolSide = 0
      // @NOTE userSide and protocolSide are different. Therefore, user will lose
      const userSide = 1 - protocolSide
      const submitEntryTx = await coinFlip.submitEntry(
        userSide,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with LOSE
      // @NOTE Should be same as losing 2 entries
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is just more than entryAmount and wins 2 entries', async () => {
      entryCount = 2
      playedEntryCount = 2
      remainingEntryCount = 0
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')
      ppv = await coinFlip.protocolProbabilityValue()
      hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()
      const protocolSide = 0
      // @NOTE userSide and protocolSide are same. Therefore, user will win
      const userSide = protocolSide
      const submitEntryTx = await coinFlip.submitEntry(
        userSide,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE Should be same as winning 2 entries
      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(
        userBalanceAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(playedEntryCount)
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(playedEntryCount)
            .add(entryAmount.mul(remainingEntryCount))
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    it('Can withdraw if 200 blocks passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await coinFlip.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdraw fare balance is equal to before entry submit fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await coinFlip.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if entry has already been resolved', async () => {
      const entryCount = 1
      const protocolSide = 1
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(coinFlip.withdrawEntry()).to.be.revertedWithCustomError(
        coinFlip,
        'EntryNotInProgress'
      )
    })
    it('Can not withdraw if 200 blocks has not been passed', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await expect(coinFlip.withdrawEntry()).to.be.revertedWithCustomError(
        coinFlip,
        'TooEarlyToWithdraw'
      )
    })

    it('Can not withdraw if it has already been withdrawn', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await coinFlip.withdrawEntry()
      await withdrawTx.wait()

      await expect(coinFlip.withdrawEntry()).to.be.revertedWithCustomError(
        coinFlip,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(coinFlip.withdrawEntry()).to.be.revertedWithCustomError(
        coinFlip,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw an entry after entry has been resolved and 200 blocks has been passed', async () => {
      const entryCount = 1
      const protocolSide = 0
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await mine(200)

      await expect(coinFlip.withdrawEntry()).to.be.revertedWithCustomError(
        coinFlip,
        'EntryNotInProgress'
      )
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await coinFlip.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await coinFlip.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await coinFlip.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    describe('Keccak', () => {
      it('Should be able to request a random number', async () => {
        // By default it uses KeccakRequester
        await expect(coinFlip.submitEntry(0, 1, 0, 0, 1)).to.emit(
          coinFlip,
          'KeccakRandomNumberRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()
        await expect(coinFlip.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          coinFlip,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()
        await expect(coinFlip.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          coinFlip,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await coinFlip
          .connect(signers.user)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId
        const setRandomNumbersTx2 = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        const submitEntryTx3 = await coinFlip
          .connect(signers.user)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId
        const setRandomNumbersTx3 = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx3.wait()

        await mine(210)

        const withdrawTx = await coinFlip.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          coinFlip.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(coinFlip, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(coinFlip.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          coinFlip,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('20000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await coinFlip
          .connect(signers.user)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId
        const setRandomNumbersTx2 = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        await expect(coinFlip.connect(signers.resolver).batchResolveKeccak([requestId2])).to.emit(
          coinFlip,
          'FailedRequestIds'
        )

        // const resolveTx3 = await coinFlip
        //   .connect(signers.resolver)
        //   .batchResolveKeccak([requestId2])

        const submitEntryTx3 = await coinFlip
          .connect(signers.user)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId
        const setRandomNumbersTx3 = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx3.wait()

        await mine(210)

        const withdrawTx = await coinFlip.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await coinFlip.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        await expect(
          coinFlip.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(coinFlip, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await coinFlip.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        const setKeccakRequester = await coinFlip.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          coinFlip.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(coinFlip, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(coinFlip.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          coinFlip,
          'InternalFunction'
        )

        await expect(
          coinFlip.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(coinFlip, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await coinFlip.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          coinFlip.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(coinFlip, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await coinFlip.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await coinFlip.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await coinFlip
          .connect(signers.user)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const allowMintBurnTx = await fare
          .connect(signers.resolver)
          .setAllowContractMintBurn(coinFlip.address, true)
        await allowMintBurnTx.wait()

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        const submitEntryTx3 = await coinFlip
          .connect(signers.resolver)
          .submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          coinFlip.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(coinFlip, 'FailedRequestIds')

        await expect(
          coinFlip.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(coinFlip, 'FailedRequestIds')

        const submitEntryTx4 = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await coinFlip
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2, requestId3, requestId4])
        const batchResolveReceipt = await batchResolveTx.wait()
        const batchResolveEvent = batchResolveReceipt.events?.filter(
          (event) => event.event === 'FailedRequestIds'
        )[0] as Event

        const failedRequestIds = batchResolveEvent.args!.failedRequestIds.map((bignum: BigNumber) =>
          bignum.toString()
        )
        // failedRequestIds.indexOf('0') gives us the count of failed requestIds
        expect(3).to.be.eq(failedRequestIds.indexOf('0'))
      })
    })

    describe('VRF', () => {
      beforeEach(async () => {
        const setVRFRequester = await coinFlip.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        await expect(coinFlip.submitEntry(0, 1, 0, 0, 1)).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestId, coinFlip.address, [1])
        ).to.emit(coinFlip, 'EntryResolved')
      })
    })

    describe('QRNG', () => {
      beforeEach(async () => {
        const setQRNGRequester = await coinFlip.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await coinFlip.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await coinFlip.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        await expect(coinFlip.submitEntry(0, 1, 0, 0, 1)).to.emit(airnodeRrpMock, 'MadeFullRequest')
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await coinFlip.submitEntry(0, toEth('1000'), 0, 0, 1)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId
        const setRandomNumbersTx = await coinFlip.setMockRandomNumbers([1])
        await setRandomNumbersTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            coinFlip.address,
            coinFlip.address,
            // Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(coinFlip, 'EntryResolved')
      })
    })
  })

  describe('User Rewards based protocol probability value', async () => {
    it('User Rewards should be adjusted to create protocolProbabilityValue', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1

      const multiplier = oneEther
      const winMultiplier = multiplier.mul('2')
      const loseMultiplier = multiplier.mul('0')

      const ppv = await coinFlip.protocolProbabilityValue()
      const hostRewardsPercentage = await coinFlip.HOST_REWARDS_PERCENTAGE()
      const protocolRewardsPercentage = await coinFlip.PROTOCOL_REWARDS_PERCENTAGE()

      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const hostBalanceBeforeEntry = await fare.balanceOf(host)
      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      const fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = 1
      const userSide = protocolSide
      const submitEntryTx = await coinFlip.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const userBalanceAfterEntry = await fare.balanceOf(owner)
      const hostBalanceAfterEntry = await fare.balanceOf(host)
      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      const fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await coinFlip.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await coinFlip.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const userBalanceAfterResolve = await fare.balanceOf(owner)
      const hostBalanceAfterResolve = await fare.balanceOf(host)
      const protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      const fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(
        userBalanceAfterEntry.add(
          entryAmount
            .mul(winMultiplier)
            .div(oneEther)
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryCount)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(
            entryAmount
              .mul(winMultiplier)
              .div(oneEther)
              .mul(oneEther.sub(ppv))
              .div(oneEther)
              .mul(entryCount)
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })
  })
})
