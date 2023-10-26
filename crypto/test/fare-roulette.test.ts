import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  FareRouletteMock,
  CustomVRFCoordinatorV2Mock,
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

const oneEther = toEth('1')
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.027')
// Using first randomNumber with 5 bomb
// const firstRandomNumber5BombIndexes = [1, 5, 7, 11, 23]
// const secondRandomNumber5BombIndexes = [5, 8, 14, 15, 24]
const win2RevealArray = [2, 16, 22]
const lose2RevealArray = [1, 14, 9]
// First wins then loses (IMPORTANT for stopLoss stopGain stuff)
const win1lose1RevealArray = [2, 15, 24]
// First loses then wins (IMPORTANT for stopLoss stopGain stuff)
const lose1win1RevealArray = [1, 12, 23]
const defaultBlockNumberCountForWithdraw = 200
const defaultMaxEntryCount = 20

Logger.setLogLevel(Logger.levels.ERROR)

// For requestId => 1
// They change with requestId
const first20RandomNumbers = [
  '78541660797044910968829902406342334108369226379826116161446442989268089806461',
  '92458281274488595289803937127152923398167637295201432141969818930235769911599',
  '105409183525425523237923285454331214386340807945685310246717412709691342439136',
  '72984518589826227531578991903372844090998219903258077796093728159832249402700',
  '77725202164364049732730867459915098663759625749236281158857587643401898360325',
  '9247535584797915451057180664748820695544591120644449140157971996739901653371',
  '28212876883947467128917703474378516019173305230661588919942657668795042982449',
  '81222191986226809103279119994707868322855741819905904417953092666699096963112',
  '78433594294121473380335049450505973962381404738846570838001569875460533962079',
  '66448226337682112469901396875338497574368918010328814248214166510316316219958',
  '84934199764823764932614580024544130756785257017024643872272759911324597459911',
  '51914823640605595201349532922629958394051406478327354737522196600828559087055',
  '95949769290960679919915568476335582553435826563121580797397853711946803546972',
  '114585326621582131594227061312413046545694058379708735113635225133433280369605',
  '75885601358636693696949802906298188001431145678381949700310637158053438652935',
  '10232859502370774325584414461715588285503867213897530911692062066092626540687',
  '63494115790245236833190262165204403781416728104395367008488472023786642762591',
  '10735524448188297088180400188362831734192075462446168930367499660610597598546',
  '51405484595649549995570754522109131044110769769465629924526080237349824370083',
  '29551862758206774800663949531140833257297060090686477542636248382367273448269',
]

const first20ProtocolSides = [] as string[]
first20RandomNumbers.forEach((randomNumber) =>
  first20ProtocolSides.push(BN.from(randomNumber).mod(37).toString())
)
console.log('Roulette protocol sides: ', first20ProtocolSides)

describe('Deployment', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let owner: string
  let rewards: string
  let resolver: string
  let user: string
  let subscriptionId = BN.from('1')
  let roulette: FareRouletteMock
  let link: LinkToken
  let userSigners: SignerWithAddress[]
  let signers
  let users: string[]
  let protocol: string
  let host: string

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

    await deployments.fixture(['mocks', 'fare', 'roulette'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    roulette = (await ethers.getContract('FareRouletteMock')) as FareRouletteMock
  })

  it('Successful FareRouletteMock Deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    const FareRouletteMockDeployed = await FareRouletteFactoryMock.deploy(
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
    expect(await FareRouletteMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolAddress should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidProtocolAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidHostAddress')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithCustomError(roulette, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FareRouletteFactoryMock = await ethers.getContractFactory('FareRouletteMock')
    await expect(
      FareRouletteFactoryMock.deploy(
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
    ).to.be.revertedWithoutReason
  })
})

describe('FareRouletteMock', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let owner: string
  let rewards: string
  let resolver: string
  let user: string
  let subscriptionId = BN.from('1')
  let roulette: FareRouletteMock
  let link: LinkToken
  let userSigners: SignerWithAddress[]
  let signers: Record<string, SignerWithAddress>
  let users: string[]
  let protocol: string
  let host: string

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

    await deployments.fixture(['mocks', 'fare', 'roulette'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    roulette = (await ethers.getContract('FareRouletteMock')) as FareRouletteMock
  })

  describe('Constructor', () => {
    it('FareRouletteMock has the correct FareToken address', async () => {
      const rouletteFareToken = await roulette.fareToken()
      expect(rouletteFareToken).to.equal(fare.address)
    })

    it('FareRouletteMock and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const rouletteSignerAddress = await roulette.owner()
      expect(fareSignerAddress).to.equal(rouletteSignerAddress)
    })

    it('FareRouletteMock protocol address is correct', async () => {
      const actual = await roulette.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareRouletteMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRouletteMock host address is correct', async () => {
      const actual = await roulette.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareRouletteMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRouletteMock precision is 1 ether', async () => {
      const actualPrecision = await roulette.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareRouletteMock ppv value is 0.027 ether which represents the default (2.7%)', async () => {
      const ppvTest = await roulette.protocolProbabilityValue()
      expect(ppvTest).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.027'))
    })

    it('FareRouletteMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await roulette.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareRouletteMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.00405% (if ppv is 2.7%)', async () => {
      const hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareRouletteMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.00135% (if ppv is 2.7%)', async () => {
      const protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareRouletteMock MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw =
        await roulette.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FareRouletteMock maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await roulette.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(roulette.connect(signers.user).setHostAddress(protocol)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await roulette.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await roulette.setHostAddress(protocol)
      const newHostAddress = await roulette.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(roulette.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        roulette,
        'InvalidHostAddress'
      )
    })

    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await roulette.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await roulette.subscriptionId()).to.equal(newSubscriptionId)
      expect(await roulette.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await roulette.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await roulette.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await roulette.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxEntryCount', async () => {
      const setTx = await roulette.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxEntryCount = await roulette.maxEntryCount()
      expect(newMaxEntryCount).to.equal(200)
    })

    it('Set macEntryCount to 0 should fail', async () => {
      await expect(roulette.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        roulette,
        'InvalidMaxEntryCount'
      )
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      await expect(roulette.submitEntry(499, 0, 0, 0, 0)).to.revertedWithCustomError(
        roulette,
        'SideIsOver45'
      )

      await expect(roulette.submitEntry(9991, 0, 0, 0, 0)).to.revertedWithCustomError(
        roulette,
        'SideIsOver45'
      )
    })

    it('Invalid amount should revert', async () => {
      await expect(roulette.submitEntry(0, 0, 0, 0, 0)).to.revertedWithCustomError(
        roulette,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(roulette.submitEntry(1, 1, 0, 0, 0)).to.revertedWithCustomError(
        roulette,
        'EntryWithZeroTokens'
      )

      await expect(roulette.submitEntry(2, toEth('1000'), 0, 0, 101)).to.revertedWithCustomError(
        roulette,
        'CountExceedsMaxEntryCount'
      )
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20

      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await roulette.submitEntry(23, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const afterFareBalance = await fare.balanceOf(owner)
      expect(initialFareBalance).to.equal(afterFareBalance.add(entryAmount.mul(entryCount)))
    })

    it('Should request a random number', async () => {
      await expect(roulette.submitEntry(3, 1, 0, 0, 1)).to.emit(
        roulette,
        'KeccakRandomNumberRequested'
      )
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await roulette.submitEntry(4, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await roulette.submitEntry(5, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await roulette.setMockRandomNumbers([1])
      await setRandomNumbersTx.wait()

      await expect(roulette.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        roulette,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await roulette.submitEntry(7, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()

      await expect(roulette.submitEntry(8, toEth('2000'), 0, 0, 10)).to.revertedWithCustomError(
        roulette,
        'EntryInProgress'
      )
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const entryCount = 20
      const submitEntryTx = await roulette.submitEntry(9, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(roulette.submitEntry(10, toEth('2000'), 0, 0, 20)).to.emit(
        roulette,
        'EntrySubmitted'
      )
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await roulette.submitEntry(11, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await roulette.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.not.eq(0)

      const storedAddressForEntry = await roulette.requestIdToUser(submittedEntry.requestId)
      expect(storedAddressForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await roulette.submitEntry(0, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await roulette.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(roulette.submitEntry(0, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        roulette,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(roulette.submitEntry(0, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        roulette,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(roulette.submitEntry(0, toEth('1').sub(1), 0, 0, 1)).to.be.revertedWithCustomError(
        roulette,
        'EntryAmountLowerThanMinEntryAmount'
      )
      const submitEntryTx1 = await roulette.submitEntry(0, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await roulette.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const resolveTx1 = await roulette.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()
      const submitEntryTx2 = await roulette.submitEntry(0, toEth('1').div(10), 0, 0, 10)
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await roulette.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const resolveTx2 = await roulette.connect(signers.resolver).resolveKeccak(requestId2)
      await resolveTx2.wait()
    })
  })

  describe('ResolveEntry', () => {
    let requestId: string
    let submitEntryTx
    let submitEntryReceipt
    let entrySubmittedEvent
    let side = 0
    let entryAmount = toEth('1000')
    let entryCount = 20
    let users

    it('Invalid requestId should revert', async () => {
      submitEntryTx = await roulette.submitEntry(12, toEth('1000'), 0, 0, 20)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        roulette.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(roulette, 'RequestIdNotInProgress')
    })

    it('When user loses, nothing is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      submitEntryTx = await roulette.submitEntry(userSide, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.equal(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide
      submitEntryTx = await roulette.submitEntry(userSide, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to host and protocol addresses', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide
      submitEntryTx = await roulette.submitEntry(userSide, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user loses, something is minted to host and protocol address', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      submitEntryTx = await roulette.submitEntry(userSide, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()
      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      const submitEntryTx = await roulette.submitEntry(5, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(roulette.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        roulette,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      const submitEntryTx = await roulette.submitEntry(14, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await roulette.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(
        roulette.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(roulette, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await roulette.submitEntry(15, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await roulette.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await roulette.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Calculations with default protocol probability value, host rewards percentage, and protocol rewards percentage', () => {
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

    let hostRewardsPercentage = multiplyBigNumberWithFixedPointNumber(oneEther, '.00405')
    let protocolRewardsPercentage = multiplyBigNumberWithFixedPointNumber(oneEther, '.00135')

    it('Wins a single entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 3
      const protocolSide = BN.from('33')
      const userSide = BN.from('45')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()
      const expectedMultiplier = 0

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      entryCount = 2
      // @NOTE Both are red
      const protocolSide = [BN.from('7'), BN.from('32')]
      // @NOTE entry on red
      const userSide = BN.from('37')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(protocolSide)
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(entryAmount.mul(entryCount).mul(expectedMultiplier))
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()
      const expectedMultiplier = 0
      entryCount = 2
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('Calculations with protocol probability value, host rewards percentage, and protocol rewards percentage values from contract', () => {
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

    let hostRewardsPercentage
    let protocolRewardsPercentage

    it('Win entry for "0" (multiplier is x 36)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 36
      const protocolSide = BN.from('0')
      const userSide = protocolSide
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill('0'))
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for a single number (multiplier is x 36)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 36
      const protocolSide = BN.from('14')
      const userSide = protocolSide
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(Array(entryCount).fill('14'))
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for red (mutliplier is x 2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      // @NOTE Random number is 19 which is red
      const protocolSide = BN.from('19')
      // @NOTE entry on red with 37
      const userSide = BN.from('37')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for black (multiplier is x 2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      const protocolSide = BN.from('22')
      const userSide = BN.from('38')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for 1 to 18 (multiplier is x2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      const protocolSide = BN.from('13')
      const userSide = BN.from('39')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for 19 to 36 (multiplier is x2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      const protocolSide = BN.from('27')
      const userSide = BN.from('40')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for odd (multiplier is x2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      const protocolSide = BN.from('29')
      const userSide = BN.from('41')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for even (multiplier is x2)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      const protocolSide = BN.from('12')
      const userSide = BN.from('42')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('User enters on even and 0 comes (multiplier is x0)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 0
      const protocolSide = BN.from('0')
      const userSide = BN.from('42')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for 1 to 12 (multiplier is x3)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 3
      const protocolSide = BN.from('9')
      const userSide = BN.from('43')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for 13 to 24 (multiplier is x3)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 3
      const protocolSide = BN.from('21')
      const userSide = BN.from('44')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Win entry for 25 to 36 (multiplier is x3)', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 3
      const protocolSide = BN.from('33')
      const userSide = BN.from('45')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 0
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(await roulette.HOST_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE()).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const expectedMultiplier = 2
      entryCount = 2
      // @NOTE Both are red
      const protocolSide = [BN.from('7'), BN.from('32')]
      // @NOTE entry on red
      const userSide = BN.from('37')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(protocolSide)
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(entryAmount.mul(entryCount).mul(expectedMultiplier))
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()
      const expectedMultiplier = 0
      entryCount = 2
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(entryAmount.mul(expectedMultiplier))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(entryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
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
    let requestId
    let hostRewardsPercentage
    let protocolRewardsPercentage
    let stopLoss
    let stopGain
    let playedEntryCount
    let remainingEntryCount

    it('stopLoss amount is less than entryAmount and loses first entry', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      playedEntryCount = 1
      remainingEntryCount = 1

      const expectedMultiplier = 0
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')

      const submitEntryTx = await roulette.submitEntry(
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

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      expect(userBalanceBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(
        userBalanceAfterEntry
      )
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount.mul(entryCount))).to.equal(fareSupplyAfterEntry)

      // @NOTE stopLoss triggers after first entry, and prevents the second entry
      expect(userBalanceAfterEntry.add(entryAmount.mul(playedEntryCount))).to.equal(
        userBalanceAfterResolve
      )
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(playedEntryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is less than entryAmount and wins first entry', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')

      playedEntryCount = 1
      remainingEntryCount = 1
      const expectedMultiplier = 2
      // @NOTE Both are black
      const protocolSide = [BN.from('10'), BN.from('11')]
      // @NOTE entry on black
      const userSide = BN.from('38')

      const submitEntryTx = await roulette.submitEntry(
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

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(protocolSide)
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE stopGain triggers after first entry, and prevents the second entry
      expect(
        userBalanceAfterEntry
          .add(entryAmount.mul(playedEntryCount).mul(expectedMultiplier))
          .add(entryAmount.mul(remainingEntryCount))
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(playedEntryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopLoss amount is more than entryAmount and loses 2 entries', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')

      const expectedMultiplier = 0
      entryCount = 2
      playedEntryCount = 2
      remainingEntryCount = 0

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(37)
      const userSide = protocolSide.add('1')
      const submitEntryTx = await roulette.submitEntry(
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

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(entryAmount.mul(playedEntryCount).mul(expectedMultiplier))
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(playedEntryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is more than entryAmount and wins 2 entries', async () => {
      hostRewardsPercentage = await roulette.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await roulette.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.01')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.01')

      const expectedMultiplier = 2
      entryCount = 2
      playedEntryCount = 2
      remainingEntryCount = 0
      // @NOTE Both are inbetween 19 to 36
      const protocolSide = [BN.from('29'), BN.from('32')]
      // @NOTE entry on 19 to 36
      const userSide = BN.from('40')
      const submitEntryTx = await roulette.submitEntry(
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

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(protocolSide)
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(entryAmount.mul(playedEntryCount).mul(expectedMultiplier))
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.HOST_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount
            .mul(await roulette.PROTOCOL_REWARDS_PERCENTAGE())
            .div(oneEther)
            .mul(playedEntryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(playedEntryCount)
            .mul(expectedMultiplier)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(remainingEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    it('Can withdraw if 200 blocks have passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const submitEntry = await roulette.submitEntry(16, toEth('1000'), 0, 0, 1)
      await submitEntry.wait()

      await mine(200)

      const withdrawTx = await roulette.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdrawal fare balance is equal to before entry fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const submitEntryTx = await roulette.submitEntry(17, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await roulette.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if 200 blocks have not passed', async () => {
      const submitEntryTx = await roulette.submitEntry(17, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await expect(roulette.withdrawEntry()).to.be.revertedWithCustomError(
        roulette,
        'TooEarlyToWithdraw'
      )
    })

    it('Can not withdraw if entry has already been resolved', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const userSide = BN.from('42')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await roulette.withdrawEntry()
      await withdrawTx.wait()

      await expect(roulette.withdrawEntry()).to.be.revertedWithCustomError(
        roulette,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(roulette.withdrawEntry()).to.be.revertedWithCustomError(
        roulette,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw an entry after it has been resolved and 200 blocks have passed', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const protocolSide = BN.from('12')
      const userSide = BN.from('42')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await roulette.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await roulette.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await mine(200)

      await expect(roulette.withdrawEntry()).to.revertedWithCustomError(
        roulette,
        'EntryNotInProgress'
      )
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const userSide = BN.from('42')
      const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await roulette.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await roulette.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await roulette.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    describe('Keccak', () => {
      let entryCount = 1
      let entryAmount = toEth('1000')

      it('Should be able to request a random number', async () => {
        const userSide = BN.from('42')
        // @NOTE By default it uses KeccakRequester
        await expect(roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          roulette,
          'KeccakRandomNumberRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        await expect(roulette.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          roulette,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        await expect(roulette.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          roulette,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        // @NOTE const expectedMultiplier = 36
        const userSide2 = BN.from('14')
        const submitEntryTx2 = await roulette
          .connect(signers.user)
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await roulette.setMockRandomNumbers(
          Array(entryCount).fill('14')
        )
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        // @NOTE const expectedMultiplier = 2
        const protocolSide3 = BN.from('22')
        const userSide3 = BN.from('38')
        const submitEntryTx3 = await roulette
          .connect(signers.user)
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide3)
        )
        await setRandomNumbersTx3.wait()
        await mine(210)

        const withdrawTx = await roulette.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          roulette.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(roulette, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(roulette.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          roulette,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests, but not previously resolved batch request', async () => {
        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        // @NOTE const expectedMultiplier = 36
        const userSide2 = BN.from('14')
        const submitEntryTx2 = await roulette
          .connect(signers.user)
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await roulette.setMockRandomNumbers(
          Array(entryCount).fill('14')
        )
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        await expect(roulette.connect(signers.resolver).batchResolveKeccak([requestId2])).to.emit(
          roulette,
          'FailedRequestIds'
        )

        // @NOTE const expectedMultiplier = 2
        const protocolSide3 = BN.from('22')
        const userSide3 = BN.from('38')
        const submitEntryTx3 = await roulette
          .connect(signers.user)
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide3)
        )
        await setRandomNumbersTx3.wait()
        await mine(210)

        const withdrawTx = await roulette.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await roulette.setActiveRequesterType(1)
        await setVRFRequester.wait()

        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        await expect(
          roulette.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(roulette, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await roulette.setActiveRequesterType(1)
        await setVRFRequester.wait()

        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setKeccakRequester = await roulette.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          roulette.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(roulette, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(roulette.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          roulette,
          'InternalFunction'
        )

        await expect(
          roulette.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(roulette, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await roulette.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          roulette.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(roulette, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await roulette.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await roulette.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const sendFareToUser0AddressTx = await fare.transfer(userSigners[0].address, toEth('20000'))
        await sendFareToUser0AddressTx.wait()
        const sendFareToUser1AddressTx = await fare.transfer(userSigners[1].address, toEth('20000'))
        await sendFareToUser1AddressTx.wait()
        const sendFareToUser2AddressTx = await fare.transfer(userSigners[2].address, toEth('20000'))
        await sendFareToUser2AddressTx.wait()

        const allowMintBurnTx = await fare
          .connect(signers.resolver)
          .setAllowContractMintBurn(roulette.address, true)
        await allowMintBurnTx.wait()
        const allowMintBurnTx0 = await fare
          .connect(userSigners[0])
          .setAllowContractMintBurn(roulette.address, true)
        await allowMintBurnTx0.wait()
        const allowMintBurnTx1 = await fare
          .connect(userSigners[1])
          .setAllowContractMintBurn(roulette.address, true)
        await allowMintBurnTx1.wait()
        const allowMintBurnTx2 = await fare
          .connect(userSigners[2])
          .setAllowContractMintBurn(roulette.address, true)
        await allowMintBurnTx2.wait()

        // @NOTE const expectedMultiplier = 36
        const userSide2 = BN.from('14')
        const submitEntryTx2 = await roulette
          .connect(userSigners[0])
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        // @NOTE const expectedMultiplier = 2
        const protocolSide3 = BN.from('22')
        const userSide3 = BN.from('38')
        const submitEntryTx3 = await roulette
          .connect(userSigners[2])
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          roulette.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(roulette, 'FailedRequestIds')

        await expect(
          roulette.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(roulette, 'FailedRequestIds')

        // @NOTE const expectedMultiplier = 3
        const protocolSide4 = BN.from('21')
        const userSide4 = BN.from('44')
        const submitEntryTx4 = await roulette
          .connect(userSigners[1])
          .submitEntry(userSide4, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args

        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await roulette
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2, requestId3, requestId4])
        const batchResolveReceipt = await batchResolveTx.wait()
        const batchResolveEvent = batchResolveReceipt.events?.filter(
          (event) => event.event === 'FailedRequestIds'
        )[0] as Event

        const failedRequestIds = batchResolveEvent.args!.failedRequestIds.map((bignum: BigNumber) =>
          bignum.toString()
        )
        // @NOTE failedRequestIds.indexOf('0') gives us the count of failed requestIds
        expect(3).to.be.eq(failedRequestIds.indexOf('0'))
      })
    })

    describe('VRF', () => {
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setVRFRequester = await roulette.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const userSide = BN.from('42')
        await expect(roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestId, roulette.address, [1])
        ).to.emit(roulette, 'EntryResolved')
      })
    })

    describe('QRNG', () => {
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setQRNGRequester = await roulette.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await roulette.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await roulette.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const userSide = BN.from('42')
        await expect(roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await roulette.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await roulette.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // @NOTE encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            roulette.address,
            roulette.address,
            // @NOTE Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(roulette, 'EntryResolved')
      })
    })
  })
})
