import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  FarePlinkoMock,
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
import { deployablePlinkoMultipliers } from '../calc/plinko'

const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = hre

const {
  BigNumber: BN,
  utils: { Logger, parseEther: toEth },
} = ethers

const oneEther = toEth('1')
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')
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

const randomNumberToPlinkoPosition = (randomNumber: BigNumber, rowCount: number) => {
  if (randomNumber.isZero()) {
    return '0'
  }

  let binaryString = ''
  let tempNumber = randomNumber

  while (!tempNumber.isZero()) {
    const remainder = tempNumber.mod(2)
    binaryString = remainder.toString() + binaryString
    tempNumber = tempNumber.div(2)
  }

  const plinkoPosition = binaryString
    .substring(binaryString.length - rowCount)
    .match(/1/g || [])?.length

  return plinkoPosition
}

const calculateUserRewards = (
  entryAmount: BigNumber,
  riskLevel: number,
  rowCount: number,
  positions: number[]
) => {
  return positions
    .map((position) =>
      entryAmount.mul(deployablePlinkoMultipliers[riskLevel][rowCount - 8][position]).div(oneEther)
    )
    .reduce((a, b) => a.add(b))
}

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
  let plinko: FarePlinkoMock
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

    await deployments.fixture(['mocks', 'fare', 'plinko'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    plinko = (await ethers.getContract('FarePlinkoMock')) as FarePlinkoMock
  })

  it('Successful FarePlinkoMock Deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    const FarePlinkoMockDeployed = await FarePlinkoFactoryMock.deploy(
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
      },
      deployablePlinkoMultipliers
    )
    expect(await FarePlinkoMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolAddress should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidProtocolAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidHostAddress')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithCustomError(plinko, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FarePlinkoFactoryMock = await ethers.getContractFactory('FarePlinkoMock')
    await expect(
      FarePlinkoFactoryMock.deploy(
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
        },
        deployablePlinkoMultipliers
      )
    ).to.be.revertedWithoutReason
  })
})

describe('FarePlinkoMock', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let owner: string
  let rewards: string
  let resolver: string
  let user: string
  let subscriptionId = BN.from('1')
  let plinko: FarePlinkoMock
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

    await deployments.fixture(['mocks', 'fare', 'plinko'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    plinko = (await ethers.getContract('FarePlinkoMock')) as FarePlinkoMock
  })

  describe('Constructor', () => {
    it('FarePlinkoMock has the correct FareToken address', async () => {
      const plinkoFareToken = await plinko.fareToken()
      expect(plinkoFareToken).to.equal(fare.address)
    })

    it('FarePlinkoMock and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const plinkoSignerAddress = await plinko.owner()
      expect(fareSignerAddress).to.equal(plinkoSignerAddress)
    })

    it('FarePlinkoMock protocol address is correct', async () => {
      const actual = await plinko.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FarePlinkoMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FarePlinkoMock host address is correct', async () => {
      const actual = await plinko.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FarePlinkoMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FarePlinkoMock precision is 1 ether', async () => {
      const actualPrecision = await plinko.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FarePlinkoMock ppv value is 0.01 ether which represents the default (1.0%)', async () => {
      const ppvTest = await plinko.protocolProbabilityValue()
      expect(ppvTest).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FarePlinkoMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await plinko.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FarePlinkoMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15%', async () => {
      const hostRewardsPercentage = await plinko.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FarePlinkoMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05%', async () => {
      const protocolRewardsPercentage = await plinko.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FarePlinkoMock MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw = await plinko.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FarePlinkoMock maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await plinko.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(plinko.connect(signers.user).setHostAddress(protocol)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await plinko.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await plinko.setHostAddress(protocol)
      const newHostAddress = await plinko.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(plinko.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        plinko,
        'InvalidHostAddress'
      )
    })

    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await plinko.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await plinko.subscriptionId()).to.equal(newSubscriptionId)
      expect(await plinko.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await plinko.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await plinko.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await plinko.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxEntryCount', async () => {
      const setTx = await plinko.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxEntryCount = await plinko.maxEntryCount()
      expect(newMaxEntryCount).to.equal(200)
    })

    it('Set macEntryCount to 0 should fail', async () => {
      await expect(plinko.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        plinko,
        'InvalidMaxEntryCount'
      )
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      await expect(plinko.encodeSideAndSubmitEntry(4, 0, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        plinko,
        'RiskLevelIsOver2'
      )
      await expect(plinko.encodeSideAndSubmitEntry(1, 5, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        plinko,
        'RowCountIsLessThan8OrOver16'
      )
      await expect(
        plinko.encodeSideAndSubmitEntry(1, 17, 0, 0, 0, 0)
      ).to.be.revertedWithCustomError(plinko, 'RowCountIsLessThan8OrOver16')
    })

    it('Invalid amount should revert', async () => {
      await expect(plinko.encodeSideAndSubmitEntry(1, 8, 0, 0, 0, 0)).to.revertedWithCustomError(
        plinko,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(plinko.encodeSideAndSubmitEntry(2, 10, 0, 0, 0, 0)).to.revertedWithCustomError(
        plinko,
        'EntryWithZeroTokens'
      )

      await expect(
        plinko.encodeSideAndSubmitEntry(0, 16, toEth('1000'), 0, 0, 101)
      ).to.revertedWithCustomError(plinko, 'CountExceedsMaxEntryCount')
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20

      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        1,
        13,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      const afterFareBalance = await fare.balanceOf(owner)
      expect(initialFareBalance).to.equal(afterFareBalance.add(entryAmount.mul(entryCount)))
    })

    it('Should request a random number', async () => {
      await expect(plinko.encodeSideAndSubmitEntry(1, 12, 1, 0, 0, 1)).to.emit(
        plinko,
        'KeccakRandomNumberRequested'
      )
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(0, 14, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await plinko.setMockRandomNumbers([1])
      await setRandomNumbersTx.wait()

      await expect(plinko.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        plinko,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()

      await expect(
        plinko.encodeSideAndSubmitEntry(1, 8, toEth('2000'), 0, 0, 10)
      ).to.revertedWithCustomError(plinko, 'EntryInProgress')
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const entryCount = 20
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        1,
        9,
        toEth('1000'),
        0,
        0,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(plinko.encodeSideAndSubmitEntry(1, 13, toEth('2000'), 0, 0, 20)).to.emit(
        plinko,
        'EntrySubmitted'
      )
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 14, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await plinko.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.not.eq(0)

      const storedAddressForEntry = await plinko.requestIdToUser(submittedEntry.requestId)
      expect(storedAddressForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 8, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await plinko.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(plinko.encodeSideAndSubmitEntry(1, 9, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        plinko,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(plinko.encodeSideAndSubmitEntry(1, 10, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        plinko,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(
        plinko.encodeSideAndSubmitEntry(1, 11, toEth('1').sub(1), 0, 0, 1)
      ).to.be.revertedWithCustomError(plinko, 'EntryAmountLowerThanMinEntryAmount')
      const submitEntryTx1 = await plinko.encodeSideAndSubmitEntry(1, 12, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await plinko.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const resolveTx1 = await plinko.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()

      const submitEntryTx2 = await plinko.encodeSideAndSubmitEntry(
        1,
        13,
        toEth('1').div(10),
        0,
        0,
        10
      )
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await plinko.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const resolveTx2 = await plinko.connect(signers.resolver).resolveKeccak(requestId2)
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
      submitEntryTx = await plinko.encodeSideAndSubmitEntry(2, 12, toEth('1000'), 0, 0, 20)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        plinko.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(plinko, 'RequestIdNotInProgress')
    })

    it('When user wins, something is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0])
      submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to host and protocol addresses', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0])
      submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(plinko.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        plinko,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await plinko.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(entryCount).fill(1))
      await setRandomNumbersTx.wait()

      await expect(
        plinko.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(plinko, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(1, 10, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await plinko.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await plinko.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await plinko.requestIdToUser(submittedEntry.requestId)
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

    let hostRewardsPercentageFromContract: BigNumber
    let protocolRewardsPercentageFromContract: BigNumber

    beforeEach(async () => {
      hostRewardsPercentageFromContract = await plinko.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentageFromContract = await plinko.PROTOCOL_REWARDS_PERCENTAGE()
    })

    it('Wins a single entry (riskLevel=0, rowCount=8, plinkoPosition=6)', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const randomNumber = first20RandomNumbers[0]
      const riskLevel = 0
      const rowCount = 8
      const plinkoPosition = randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      const expectedUserReward = calculateUserRewards(entryAmount, riskLevel, rowCount, [
        plinkoPosition,
      ])

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
        entryAmount,
        0,
        0,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(randomNumber)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(expectedUserReward)
          .add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins a single entry (riskLevel=1, rowCount=10, plinkoPosition=4)', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const randomNumber = first20RandomNumbers[2]
      const riskLevel = 1
      const rowCount = 10
      const plinkoPosition = randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      const expectedUserReward = calculateUserRewards(entryAmount, riskLevel, rowCount, [
        plinkoPosition,
      ])

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
        entryAmount,
        0,
        0,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(randomNumber)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(expectedUserReward)
          .add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins a single entry (riskLevel=2, rowCount=16, plinkoPosition=5)', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const randomNumber = first20RandomNumbers[3]
      const riskLevel = 2
      const rowCount = 16
      const plinkoPosition = randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      const expectedUserReward = calculateUserRewards(entryAmount, riskLevel, rowCount, [
        plinkoPosition,
      ])

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
        entryAmount,
        0,
        0,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(randomNumber)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(expectedUserReward)
          .add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries (riskLevel=2, rowCount=14, plinkoPositions=[5,7])', async () => {
      entryCount = 2

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const randomNumbers = [first20RandomNumbers[3], first20RandomNumbers[12]]
      const riskLevel = 2
      const rowCount = 14
      const plinkoPositions = randomNumbers.map(
        (randomNumber) => randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      )
      const expectedUserReward = calculateUserRewards(
        entryAmount,
        riskLevel,
        rowCount,
        plinkoPositions
      )
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
        entryAmount,
        0,
        0,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(randomNumbers)
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther).mul(entryCount)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther).mul(entryCount)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(expectedUserReward)
          .add(entryAmount.mul(hostRewardsPercentageFromContract).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentageFromContract).div(oneEther).mul(entryCount))
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
    let hostRewardsPercentage: BigNumber
    let protocolRewardsPercentage: BigNumber
    let stopLoss
    let stopGain
    let playedEntryCount
    let remainingEntryCount

    beforeEach(async () => {
      hostRewardsPercentage = await plinko.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await plinko.PROTOCOL_REWARDS_PERCENTAGE()
    })

    it('stopLoss amount is less than entryAmount and loses first entry (riskLevel=1, rowCount=13, plinkoPositions=[7,5])', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.5')
      playedEntryCount = 1
      remainingEntryCount = 1

      const randomNumbers = [first20RandomNumbers[5], first20RandomNumbers[6]]
      const riskLevel = 1
      const rowCount = 13
      const plinkoPositions = randomNumbers.map(
        (randomNumber) => randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      )

      const expectedUserRewardForOnlyFirstEntry = calculateUserRewards(
        entryAmount,
        riskLevel,
        rowCount,
        [plinkoPositions[0]]
      )

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(randomNumbers)
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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
      expect(
        userBalanceAfterEntry
          .add(expectedUserRewardForOnlyFirstEntry)
          .add(entryAmount.mul(remainingEntryCount))
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
        fareSupplyAfterEntry
          .add(expectedUserRewardForOnlyFirstEntry)
          .add(entryAmount.mul(remainingEntryCount))
          .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is less than entryAmount and wins first entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.4')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.4')
      playedEntryCount = 1
      remainingEntryCount = 1

      const randomNumbers = [first20RandomNumbers[14], first20RandomNumbers[15]]
      const riskLevel = 0
      const rowCount = 15
      const plinkoPositions = randomNumbers.map(
        (randomNumber) => randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      )

      const expectedUserRewardForOnlyFirstEntry = calculateUserRewards(
        entryAmount,
        riskLevel,
        rowCount,
        [plinkoPositions[0]]
      )

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(randomNumbers)
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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
          .add(expectedUserRewardForOnlyFirstEntry)
          .add(entryAmount.mul(remainingEntryCount))
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
        fareSupplyAfterEntry
          .add(expectedUserRewardForOnlyFirstEntry)
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(remainingEntryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopLoss amount is more than entryAmount and loses 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.5')
      playedEntryCount = 2
      remainingEntryCount = 0

      const randomNumbers = [first20RandomNumbers[17], first20RandomNumbers[15]]
      const riskLevel = 0
      const rowCount = 9
      const plinkoPositions = randomNumbers.map(
        (randomNumber) => randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      )

      const expectedUserReward = calculateUserRewards(
        entryAmount,
        riskLevel,
        rowCount,
        plinkoPositions
      )

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(randomNumbers)
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
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
          .add(expectedUserReward)
          .add(entryAmount.mul(remainingEntryCount))
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is more than entryAmount and wins 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.6')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.6')
      playedEntryCount = 2
      remainingEntryCount = 0

      const randomNumbers = [first20RandomNumbers[3], first20RandomNumbers[11]]
      const riskLevel = 1
      const rowCount = 16
      const plinkoPositions = randomNumbers.map(
        (randomNumber) => randomNumberToPlinkoPosition(BN.from(randomNumber), rowCount) as number
      )

      const expectedUserReward = calculateUserRewards(
        entryAmount,
        riskLevel,
        rowCount,
        plinkoPositions
      )

      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        riskLevel,
        rowCount,
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

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(randomNumbers)
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(userBalanceAfterEntry.add(expectedUserReward)).to.equal(userBalanceAfterResolve)
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
          .add(expectedUserReward)
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
          .add(entryAmount.mul(remainingEntryCount))
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    it('Can withdraw if 200 blocks have passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const submitEntry = await plinko.encodeSideAndSubmitEntry(1, 15, toEth('1000'), 0, 0, 1)
      await submitEntry.wait()

      await mine(200)

      const withdrawTx = await plinko.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdrawal fare balance is equal to before entry fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(0, 9, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await plinko.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if 200 blocks have not passed', async () => {
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(2, 11, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await expect(plinko.withdrawEntry()).to.be.revertedWithCustomError(
        plinko,
        'TooEarlyToWithdraw'
      )
    })

    it('Can not withdraw if entry has already been resolved', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        0,
        8,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await plinko.withdrawEntry()
      await withdrawTx.wait()

      await expect(plinko.withdrawEntry()).to.be.revertedWithCustomError(
        plinko,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(plinko.withdrawEntry()).to.be.revertedWithCustomError(
        plinko,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw an entry after it has been resolved and 200 blocks have passed', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const protocolSide = BN.from('12')
      const userSide = BN.from('42')
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        2,
        13,
        entryAmount,
        0,
        0,
        entryCount
      )
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await plinko.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await plinko.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await mine(200)

      await expect(plinko.withdrawEntry()).to.revertedWithCustomError(plinko, 'EntryNotInProgress')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 1
      const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
        2,
        15,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await plinko.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await plinko.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await plinko.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    describe('Keccak', () => {
      let entryCount = 1
      let entryAmount = toEth('1000')

      it('Should be able to request a random number', async () => {
        // @NOTE By default it uses KeccakRequester
        await expect(plinko.encodeSideAndSubmitEntry(2, 12, entryAmount, 0, 0, entryCount)).to.emit(
          plinko,
          'KeccakRandomNumberRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          12,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[19])
        )
        await setRandomNumbersTx.wait()

        await expect(plinko.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          plinko,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          8,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[7])
        )
        await setRandomNumbersTx.wait()

        await expect(plinko.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          plinko,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          11,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[13])
        )
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await plinko
          .connect(signers.user)
          .encodeSideAndSubmitEntry(1, 15, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[15])
        )
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await plinko
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await plinko
          .connect(signers.resolver)
          .batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        // @NOTE const expectedMultiplier = 2
        const submitEntryTx3 = await plinko
          .connect(signers.user)
          .encodeSideAndSubmitEntry(2, 13, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[18])
        )
        await setRandomNumbersTx3.wait()
        await mine(210)

        const withdrawTx = await plinko.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await plinko
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          plinko.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(plinko, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(plinko.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          plinko,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests, but not previously resolved batch request', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          1,
          16,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[3])
        )
        await setRandomNumbersTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await plinko
          .connect(signers.user)
          .encodeSideAndSubmitEntry(2, 14, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[12])
        )
        await setRandomNumbersTx2.wait()

        const batchResolveTx = await plinko
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        await expect(plinko.connect(signers.resolver).batchResolveKeccak([requestId2])).to.emit(
          plinko,
          'FailedRequestIds'
        )

        const submitEntryTx3 = await plinko
          .connect(signers.user)
          .encodeSideAndSubmitEntry(1, 10, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[5])
        )
        await setRandomNumbersTx3.wait()
        await mine(210)

        const withdrawTx = await plinko.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await plinko
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await plinko.setActiveRequesterType(1)
        await setVRFRequester.wait()

        // @NOTE const expectedMultiplier = 2
        const protocolSide = BN.from('12')
        const userSide = BN.from('42')
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          8,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        await expect(
          plinko.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(plinko, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await plinko.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          9,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[4])
        )
        await setRandomNumbersTx.wait()

        const setKeccakRequester = await plinko.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          plinko.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(plinko, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(plinko.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          plinko,
          'InternalFunction'
        )

        await expect(
          plinko.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(plinko, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await plinko.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          plinko.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(plinko, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await plinko.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await plinko.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          10,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[17])
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
          .setAllowContractMintBurn(plinko.address, true)
        await allowMintBurnTx.wait()
        const allowMintBurnTx0 = await fare
          .connect(userSigners[0])
          .setAllowContractMintBurn(plinko.address, true)
        await allowMintBurnTx0.wait()
        const allowMintBurnTx1 = await fare
          .connect(userSigners[1])
          .setAllowContractMintBurn(plinko.address, true)
        await allowMintBurnTx1.wait()
        const allowMintBurnTx2 = await fare
          .connect(userSigners[2])
          .setAllowContractMintBurn(plinko.address, true)
        await allowMintBurnTx2.wait()

        const submitEntryTx2 = await plinko
          .connect(userSigners[0])
          .encodeSideAndSubmitEntry(0, 11, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        const submitEntryTx3 = await plinko
          .connect(userSigners[2])
          .encodeSideAndSubmitEntry(0, 12, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          plinko.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(plinko, 'FailedRequestIds')

        await expect(
          plinko.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(plinko, 'FailedRequestIds')

        const submitEntryTx4 = await plinko
          .connect(userSigners[1])
          .encodeSideAndSubmitEntry(0, 13, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args

        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await plinko
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
        const setVRFRequester = await plinko.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        await expect(plinko.encodeSideAndSubmitEntry(0, 14, entryAmount, 0, 0, entryCount)).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          0,
          15,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[7])
        )
        await setRandomNumbersTx.wait()

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestId, plinko.address, [1])
        ).to.emit(plinko, 'EntryResolved')
      })
    })

    describe('QRNG', () => {
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setQRNGRequester = await plinko.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await plinko.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await plinko.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        await expect(plinko.encodeSideAndSubmitEntry(0, 16, entryAmount, 0, 0, entryCount)).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await plinko.encodeSideAndSubmitEntry(
          1,
          8,
          entryAmount,
          0,
          0,
          entryCount
        )
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await plinko.setMockRandomNumbers(
          Array(entryCount).fill(first20RandomNumbers[16])
        )
        await setRandomNumbersTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // @NOTE encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            plinko.address,
            plinko.address,
            // @NOTE Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(plinko, 'EntryResolved')
      })
    })
  })
})
