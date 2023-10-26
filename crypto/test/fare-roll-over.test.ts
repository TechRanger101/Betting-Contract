import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  FarePPVNFT,
  FareRollOverMock,
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
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')
const defaultBlockNumberCountForWithdraw = 200
const defaultMaxEntryCount = 20

Logger.setLogLevel(Logger.levels.ERROR)

// For requestId => 1
// They change with requestId
const first20RandomNumbers = [
  '78541660797044910968829902406342334108369226379826116161446442989268089806461', // protocolSide => 6461 => 64.61
  '92458281274488595289803937127152923398167637295201432141969818930235769911599', // 1599 => 15.99
  '105409183525425523237923285454331214386340807945685310246717412709691342439136', // 9136 => 91.36
  '72984518589826227531578991903372844090998219903258077796093728159832249402700', // 2700 => 27.00
  '77725202164364049732730867459915098663759625749236281158857587643401898360325',
  '9247535584797915451057180664748820695544591120644449140157971996739901653371',
  '28212876883947467128917703474378516019173305230661588919942657668795042982449',
  '81222191986226809103279119994707868322855741819905904417953092666699096963112',
  '78433594294121473380335049450505973962381404738846570838001569875460533962079',
  '66448226337682112469901396875338497574368918010328814248214166510316316219958', // 9958 => 99.58
  '84934199764823764932614580024544130756785257017024643872272759911324597459911', // 9911 => 99.11
  '51914823640605595201349532922629958394051406478327354737522196600828559087055',
  '95949769290960679919915568476335582553435826563121580797397853711946803546972',
  '114585326621582131594227061312413046545694058379708735113635225133433280369605', // 9605 => 96.05
  '75885601358636693696949802906298188001431145678381949700310637158053438652935',
  '10232859502370774325584414461715588285503867213897530911692062066092626540687',
  '63494115790245236833190262165204403781416728104395367008488472023786642762591',
  '10735524448188297088180400188362831734192075462446168930367499660610597598546',
  '51405484595649549995570754522109131044110769769465629924526080237349824370083',
  '29551862758206774800663949531140833257297060090686477542636248382367273448269',
]

const first20ProtocolSides = [] as string[]
first20RandomNumbers.forEach((randomNumber) =>
  first20ProtocolSides.push(BN.from(randomNumber).mod(10000).toString())
)
console.log('RollOver protocolSides: ', first20ProtocolSides)

describe('Deployment', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let ppvNFT: FarePPVNFT
  let owner: string
  let rewards: string
  let resolver: string
  let user: string
  let subscriptionId = BN.from('1')
  let rollOver: FareRollOverMock
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'roll_over'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    rollOver = (await ethers.getContract('FareRollOverMock')) as FareRollOverMock
  })

  it('Successful FareRollOverMock Deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    const FareRollOverMockDeployed = await FareRollOverMockFactory.deploy(
      {
        nftbppvsuContractParams: {
          baseContractParams: {
            fareTokenAddress: fare.address,
            protocolAddress: protocol,
            hostAddress: host,
            protocolProbabilityValue: ppv,
          },
          farePPVNFTAddress: ppvNFT.address,
          contractName: 'FareRollOverMock',
        },
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
    expect(await FareRollOverMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: zeroAddress,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolAddress should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: zeroAddress,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidProtocolAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.001'),
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: zeroAddress,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidHostAddress')
  })

  it('Invalid farePPVNFTAddress should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: zeroAddress,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidFarePPVNFTAddress')
  })

  it('Invalid contractName should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: '',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'EmptyContractName')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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
    ).to.be.revertedWithCustomError(rollOver, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FareRollOverMockFactory = await ethers.getContractFactory('FareRollOverMock')
    await expect(
      FareRollOverMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRollOverMock',
          },
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

describe('FareRollOverMock', () => {
  const zeroAddress = ethers.constants.AddressZero
  let fare: FareToken
  let vrfCoordinator: CustomVRFCoordinatorV2Mock
  let airnodeRrpMock: AirnodeRrpMock
  let ppvNFT: FarePPVNFT
  let owner: string
  let rewards: string
  let resolver: string
  let protocol: string
  let host: string
  let user: string
  let subscriptionId = BN.from('2')
  let rollOver: FareRollOverMock
  let link: LinkToken
  let userSigners: SignerWithAddress[]
  let signers: Record<string, SignerWithAddress>
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'roll_over'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    rollOver = (await ethers.getContract('FareRollOverMock')) as FareRollOverMock
  })

  describe('Constructor', () => {
    it('FareRollOverMock has the correct FareToken address', async () => {
      const rollOverFareToken = await rollOver.fareToken()
      expect(rollOverFareToken).to.equal(fare.address)
    })

    it('FareRollOverMock and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const rollOverSignerAddress = await rollOver.owner()
      expect(fareSignerAddress).to.equal(rollOverSignerAddress)
    })

    it('FareRollOverMock protocol address is correct', async () => {
      const actual = await rollOver.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareRollOverMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRollOverMock host address is correct', async () => {
      const actual = await rollOver.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareRollOverMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRollOverMock precision is 1 ether', async () => {
      const actualPrecision = await rollOver.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareRollOverMock ppv value is 0.01 ether which represents 1.00% (default)', async () => {
      const ppv = await rollOver.protocolProbabilityValue()
      expect(ppv).to.equal(oneEther.div('100'))
    })

    it('FareRollOverMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await rollOver.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareRollOverMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareRollOverMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareRollOverMock MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw =
        await rollOver.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FareRollOverMock maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await rollOver.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })

    it('FareRollOverMock has the correct FarePPVNFT address', async () => {
      const rollOverFarePPVNFT = await rollOver.farePPVNFT()
      expect(rollOverFarePPVNFT).to.equal(ppvNFT.address)
    })

    it('FareRollOverMock contractName is `FareRollOverMock`', async () => {
      const contractName = await rollOver.contractName()
      expect(contractName).to.equal('FareRollOverMock')
    })

    it('FareRollOverMock ppvType is 0 as default. Therefore, uses NFT', async () => {
      const ppvType = await rollOver.ppvType()
      expect(ppvType).to.equal(0)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(rollOver.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await rollOver.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await rollOver.setHostAddress(protocol)
      const newHostAddress = await rollOver.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(rollOver.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        rollOver,
        'InvalidHostAddress'
      )
    })

    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await rollOver.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await rollOver.subscriptionId()).to.equal(newSubscriptionId)
      expect(await rollOver.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await rollOver.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await rollOver.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await rollOver.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxEntryCount', async () => {
      const setTx = await rollOver.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxEntryCount = await rollOver.maxEntryCount()
      expect(newMaxEntryCount).to.equal(200)
    })

    it('Set maxEntryCount to 0 should fail', async () => {
      await expect(rollOver.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        rollOver,
        'InvalidMaxEntryCount'
      )
    })

    it('Set ppvType', async () => {
      const setTx = await rollOver.setPPVType(1)
      await setTx.wait()
      const newPPVType = await rollOver.ppvType()
      expect(newPPVType).to.equal(1)
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      await expect(rollOver.submitEntry(499, 0, 0, 0, 0)).to.revertedWithCustomError(
        rollOver,
        'SideIsLessThan500OrOver9900'
      )

      await expect(rollOver.submitEntry(9991, 0, 0, 0, 0)).to.revertedWithCustomError(
        rollOver,
        'SideIsLessThan500OrOver9900'
      )
    })

    it('Invalid amount should revert', async () => {
      await expect(rollOver.submitEntry(501, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        rollOver,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(rollOver.submitEntry(501, 1, 0, 0, 0)).to.be.revertedWithCustomError(
        rollOver,
        'EntryWithZeroTokens'
      )

      await expect(
        rollOver.submitEntry(501, toEth('1000'), 0, 0, 101)
      ).to.be.revertedWithCustomError(rollOver, 'CountExceedsMaxEntryCount')
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20

      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await rollOver.submitEntry(501, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const afterFareBalance = await fare.balanceOf(owner)
      expect(initialFareBalance).to.equal(afterFareBalance.add(entryAmount.mul(entryCount)))
    })

    it('Should request a random number', async () => {
      await expect(rollOver.submitEntry(501, 1, 0, 0, 1)).to.emit(
        rollOver,
        'KeccakRandomNumberRequested'
      )
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await rollOver.submitEntry(501, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await rollOver.submitEntry(501, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers([
        '78541660797044910968829902406342334108369226379826116161446442989268089806461',
      ])
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      await expect(rollOver.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        rollOver,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await rollOver.submitEntry(1234, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()

      await expect(rollOver.submitEntry(500, toEth('2000'), 0, 0, 10)).to.revertedWithCustomError(
        rollOver,
        'EntryInProgress'
      )
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const submitEntryTx = await rollOver.submitEntry(2345, toEth('1000'), 0, 0, 20)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(20).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(rollOver.submitEntry(9900, toEth('2000'), 0, 0, 20)).to.emit(
        rollOver,
        'EntrySubmitted'
      )
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await rollOver.submitEntry(5000, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await rollOver.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.not.eq(0)

      const storedUserForEntry = await rollOver.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await rollOver.submitEntry(1000, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx.wait()
      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await rollOver.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(rollOver.submitEntry(1000, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        rollOver,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(rollOver.submitEntry(1000, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        rollOver,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(rollOver.submitEntry(1000, toEth('1').sub(1), 0, 0, 1)).to.be.revertedWithCustomError(
        rollOver,
        'EntryAmountLowerThanMinEntryAmount'
      )
      const submitEntryTx1 = await rollOver.submitEntry(1000, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await rollOver.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const setIsNFTMintsTx1 = await rollOver.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx1.wait()
      const resolveTx1 = await rollOver.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()

      const submitEntryTx2 = await rollOver.submitEntry(1000, toEth('1').div(10), 0, 0, 10)
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await rollOver.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const setIsNFTMintsTx2 = await rollOver.setMockIsNFTMint(Array(10).fill(false))
      await setIsNFTMintsTx2.wait()
      const resolveTx2 = await rollOver.connect(signers.resolver).resolveKeccak(requestId2)
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
      submitEntryTx = await rollOver.submitEntry(501, entryAmount, 0, 0, entryCount)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        rollOver.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(rollOver, 'RequestIdNotInProgress')
    })

    it('When user loses, nothing is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE user side is higher than protocolSide, which means user failed to rollOver protocol, therefore loses.
      const userSide = protocolSide.add('1')
      submitEntryTx = await rollOver.submitEntry(userSide, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(1).fill(protocolSide))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)
      expect(fareBalanceAfterEntryResolved).to.equal(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE user side is lower than protocol side, which means user successfully rolled over protocol, therefore wins.
      const userSide = protocolSide.sub('1')
      submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, 1)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(1).fill(protocolSide))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to host and protocol addresses', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = protocolSide.sub('1')
      submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, 1)
      await submitEntryTx.wait()
      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(1).fill(protocolSide))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user loses, something is minted to host and protocol addresses', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = protocolSide.add('1')
      submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, 1)
      await submitEntryTx.wait()

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(1).fill(protocolSide))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      submitEntryTx = await rollOver.submitEntry(501, entryAmount, 0, 0, 1)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(1).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      await expect(rollOver.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        rollOver,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      submitEntryTx = await rollOver.submitEntry(3456, entryAmount, 0, 0, 1)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await rollOver.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(1).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      await expect(
        rollOver.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(rollOver, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      submitEntryTx = await rollOver.submitEntry(4567, entryAmount, 0, 0, 1)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(1).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await rollOver.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await rollOver.requestIdToUser(submittedEntry.requestId)
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
    let multiplier = oneEther

    let ppvFromContract
    let hostRewardsPercentage
    let protocolRewardsPercentage

    beforeEach(async () => {
      const setPPVTx = await rollOver.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Wins a single entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE user side and protocol side are the same. Therefore, user will win
      const userSide = BN.from('1553')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry.add(
          multiplier
            .mul(10000)
            .div(BN.from(10000).sub(userSide))
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .div(oneEther)
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
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount)
              .div(oneEther)
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('9000')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
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
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('567')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry.add(
          multiplier
            .mul(10000)
            .div(BN.from(10000).sub(userSide))
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount.mul(entryCount))
            .div(oneEther)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount.mul(entryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('9500')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('Calculations with NFT based protocol probability value and default host and protocol rewards percentage', () => {
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
    let multiplier = oneEther

    // @NOTE ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01') declared globally
    let hostRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.15')
    let protocolRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.05')

    it('Mints an NFT', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('5000')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          entryAmount
            .mul(hostRewardsPercentage)
            .div(oneEther)
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Skips NFT mint, wins an entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE user side is 50.00, protocol side is 64.61. user will win and multiplier will be 1.98
      const userSide = BN.from('5000')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry.add(
          multiplier.mul(10000).div(BN.from(10000).sub(userSide)).mul(entryAmount).div(oneEther)
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
          .add(
            multiplier.mul(10000).div(BN.from(10000).sub(userSide)).mul(entryAmount).div(oneEther)
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Skips NFT mint, loses an entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE user side is one less than protocol side, therefore, user will win
      const userSide = protocolSide.sub('1')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()
      const ppvNFTBalanceAfterEntry = await ppvNFT.balanceOf(owner)

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()
      const ppvNFTBalanceAfterResolve = await ppvNFT.balanceOf(owner)

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
      expect(fareSupplyBeforeEntry.sub(entryAmount)).to.equal(fareSupplyAfterEntry)

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
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
      expect(ppvNFTBalanceAfterEntry.add(1)).to.be.equal(ppvNFTBalanceAfterResolve)
    })

    it('Skips NFT mint, and wins 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      // @NOTE protocol side for 0th and 1st entry are higher than 15% therefore, user will win both
      const userSide = BN.from('1500')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry.add(
          multiplier
            .mul(10000)
            .div(BN.from(10000).sub(userSide))
            .mul(entryAmount.mul(entryCount))
            .div(oneEther)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(entryAmount.mul(entryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Skips NFT mint, and loses 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000) // 6461 => 64.61
      // @NOTE user side is higher than protocol side therefore, user will lose
      const userSide = BN.from('6500')
      const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(userBalanceAfterEntry).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther)
        )
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(
          entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther)
        )
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry
          .add(entryAmount.mul(entryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(entryCount).mul(protocolRewardsPercentage).div(oneEther))
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
    let multiplier = oneEther
    let stopLoss
    let stopGain
    let playedEntryCount
    let remainingEntryCount

    let ppvFromContract
    let hostRewardsPercentage
    let protocolRewardsPercentage

    beforeEach(async () => {
      const setPPVTx = await rollOver.setPPVType(1)
      await setPPVTx.wait()
    })

    it('stopLoss amount is less than entryAmount and loses first entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      playedEntryCount = 1
      remainingEntryCount = 1

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('9345')
      const submitEntryTx = await rollOver.submitEntry(
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

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceAfterEntry.add(entryAmount.mul(remainingEntryCount))).to.equal(
        userBalanceAfterResolve
      )
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
          .add(entryAmount)
          .mul(playedEntryCount)
          .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is less than entryAmount and wins first entry', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2
      playedEntryCount = 1
      remainingEntryCount = 1
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('2345')
      const submitEntryTx = await rollOver.submitEntry(
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

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount.mul(playedEntryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(remainingEntryCount))
      ).to.equal(userBalanceAfterResolve)
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
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount.mul(playedEntryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(remainingEntryCount))
          .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopLoss amount is just more than entryAmount and loses 2 entries', async () => {
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      playedEntryCount = 2
      remainingEntryCount = 0

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('7000')
      const submitEntryTx = await rollOver.submitEntry(
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

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceAfterEntry.add(entryAmount.mul(remainingEntryCount))).to.equal(
        userBalanceAfterResolve
      )
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
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      ppvFromContract = await rollOver.protocolProbabilityValue()
      hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

      entryCount = 2
      playedEntryCount = 2
      remainingEntryCount = 0

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
      const userSide = BN.from('1500')
      const expectedMultiplier = multiplier
        .mul(10000)
        .div(BN.from(10000).sub(userSide))
        .mul(oneEther.sub(ppvFromContract))
        .div(oneEther)
        .mul(entryAmount)
        .div(oneEther)
      stopLoss = multiplyBigNumberWithFixedPointNumber(expectedMultiplier, '1.01')
      stopGain = multiplyBigNumberWithFixedPointNumber(expectedMultiplier, '1.01')

      const submitEntryTx = await rollOver.submitEntry(
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

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to after resolve with WIN
      expect(
        userBalanceAfterEntry
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount.mul(playedEntryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(remainingEntryCount))
      ).to.equal(userBalanceAfterResolve)
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
          .add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount.mul(playedEntryCount))
              .div(oneEther)
          )
          .add(entryAmount.mul(remainingEntryCount))
          .add(entryAmount.mul(playedEntryCount).mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(playedEntryCount).mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    it('Can withdraw if 200 blocks have passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const submitEntryTx = await rollOver.submitEntry(5678, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rollOver.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdraw fare balance is equal to before entry submit fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const submitEntryTx = await rollOver.submitEntry(6789, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rollOver.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if an entry has already been resolved', async () => {
      const submitEntryTx = await rollOver.submitEntry(7890, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(1).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(rollOver.withdrawEntry()).to.be.revertedWithCustomError(
        rollOver,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw if 200 blocks have not passed', async () => {
      const submitEntryTx = await rollOver.submitEntry(9876, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await expect(rollOver.withdrawEntry()).to.be.revertedWithCustomError(
        rollOver,
        'TooEarlyToWithdraw'
      )
    })

    it('Can not withdraw if it has already been withdrawn', async () => {
      const submitEntryTx = await rollOver.submitEntry(8765, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rollOver.withdrawEntry()
      await withdrawTx.wait()

      await expect(rollOver.withdrawEntry()).to.be.revertedWithCustomError(
        rollOver,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(rollOver.withdrawEntry()).to.be.revertedWithCustomError(
        rollOver,
        'EntryNotInProgress'
      )
    })

    it('Can not withdraw an entry after entry has been resolved and 200 blocks have passed', async () => {
      const submitEntryTx = await rollOver.submitEntry(7654, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
        Array(1).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await mine(200)

      await expect(rollOver.withdrawEntry()).to.be.revertedWithCustomError(
        rollOver,
        'EntryNotInProgress'
      )
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await rollOver.submitEntry(6543, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rollOver.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await rollOver.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await rollOver.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    let entryAmount = toEth('1000')
    let entryCount = 1

    describe('Keccak', () => {
      it('Should be able to request a random number', async () => {
        // @NOTE By default it uses KeccakRequester
        await expect(rollOver.submitEntry(6543, toEth('1000'), 0, 0, 1)).to.emit(
          rollOver,
          'KeccakRandomNumberRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(rollOver.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          rollOver,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('567')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(rollOver.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          rollOver,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()
        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const protocolSide2 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide2 = BN.from('1553')
        const submitEntryTx2 = await rollOver
          .connect(signers.user)
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide2)
        )
        await setRandomNumbersTx2.wait()
        const setIsNFTMintsTx2 = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx2.wait()

        const batchResolveTx = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        const protocolSide3 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide3 = BN.from('567')
        const submitEntryTx3 = await rollOver
          .connect(signers.user)
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide3)
        )
        await setRandomNumbersTx3.wait()
        const setIsNFTMintsTx3 = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx3.wait()

        await mine(210)

        const withdrawTx = await rollOver.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          rollOver.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(rollOver, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(rollOver.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          rollOver,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()
        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const protocolSide2 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide2 = BN.from('1553')
        const submitEntryTx2 = await rollOver
          .connect(signers.user)
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide2)
        )
        await setRandomNumbersTx2.wait()
        const setIsNFTMintsTx2 = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx2.wait()

        const batchResolveTx = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        await expect(rollOver.connect(signers.resolver).batchResolveKeccak([requestId2])).to.emit(
          rollOver,
          'FailedRequestIds'
        )

        const protocolSide3 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide3 = BN.from('567')
        const submitEntryTx3 = await rollOver
          .connect(signers.user)
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        const setRandomNumbersTx3 = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide3)
        )
        await setRandomNumbersTx3.wait()
        const setIsNFTMintsTx3 = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx3.wait()

        await mine(210)

        const withdrawTx = await rollOver.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await rollOver.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(
          rollOver.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(rollOver, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await rollOver.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const setKeccakRequester = await rollOver.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          rollOver.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(rollOver, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(rollOver.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          rollOver,
          'InternalFunction'
        )

        await expect(
          rollOver.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(rollOver, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await rollOver.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          rollOver.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(rollOver, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await rollOver.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await rollOver.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, 20)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(Array(20).fill(protocolSide))
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const sendFareToUser0AddressTx = await fare.transfer(userSigners[0].address, toEth('20000'))
        await sendFareToUser0AddressTx.wait()
        const sendFareToUser1AddressTx = await fare.transfer(userSigners[1].address, toEth('20000'))
        await sendFareToUser1AddressTx.wait()
        const sendFareToUser2AddressTx = await fare.transfer(userSigners[2].address, toEth('20000'))
        await sendFareToUser2AddressTx.wait()

        const allowMintBurnTx = await fare
          .connect(signers.resolver)
          .setAllowContractMintBurn(rollOver.address, true)
        await allowMintBurnTx.wait()
        const allowMintBurnTx0 = await fare
          .connect(userSigners[0])
          .setAllowContractMintBurn(rollOver.address, true)
        await allowMintBurnTx0.wait()
        const allowMintBurnTx1 = await fare
          .connect(userSigners[1])
          .setAllowContractMintBurn(rollOver.address, true)
        await allowMintBurnTx1.wait()
        const allowMintBurnTx2 = await fare
          .connect(userSigners[2])
          .setAllowContractMintBurn(rollOver.address, true)
        await allowMintBurnTx2.wait()

        const protocolSide2 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide2 = BN.from('1553')
        const submitEntryTx2 = await rollOver
          .connect(userSigners[0])
          .submitEntry(userSide2, entryAmount, 0, 0, 20)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        const protocolSide3 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide3 = BN.from('567')
        const submitEntryTx3 = await rollOver
          .connect(userSigners[1])
          .submitEntry(userSide3, entryAmount, 0, 0, 20)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          rollOver.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(rollOver, 'FailedRequestIds')

        await expect(
          rollOver.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(rollOver, 'FailedRequestIds')

        const protocolSide4 = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide4 = BN.from('9000')
        const submitEntryTx4 = await rollOver.submitEntry(userSide4, entryAmount, 0, 0, 20)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await rollOver
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2, requestId3, requestId4])
        const batchResolveReceipt = await batchResolveTx.wait()
        const batchResolveEvent = batchResolveReceipt.events?.filter(
          (event) => event.event === 'FailedRequestIds'
        )[0] as Event

        const failedRequestIds = batchResolveEvent.args!.failedRequestIds.map((bignum: BigNumber) =>
          bignum.toString()
        )

        expect(3).to.be.eq(failedRequestIds.indexOf('0'))
      })
    })

    describe('VRF', () => {
      beforeEach(async () => {
        const setVRFRequester = await rollOver.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const userSide = BN.from('1500')
        await expect(rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestId, rollOver.address, [1])
        ).to.emit(rollOver, 'EntryResolved')
      })
    })

    describe('QRNG', () => {
      beforeEach(async () => {
        const setQRNGRequester = await rollOver.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await rollOver.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await rollOver.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const userSide = BN.from('1500')
        await expect(rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('1500')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            rollOver.address,
            rollOver.address,
            // Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(rollOver, 'EntryResolved')
      })
    })
  })

  describe('NFT or User Rewards based protocol probability value', () => {
    describe('NFT based protocol probability value', async () => {
      it('Should be the default version, check by nft balance', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('5000')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      it('Should not mint an NFT if `checkIfNFTMint()` returns false', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        // @NOTE user side and protocol side are the same. Therefore, user will win
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore)
      })

      it('Should mint an NFT if `checkIfNFTMint()` returns true', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('5000')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      it('User rewards should not be adjusted. They should be based on probability', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1
        let multiplier = oneEther

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        // @NOTE user side and protocol side are the same. Therefore, user will win
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

        // @NOTE Test fare balance transition from after entry to after resolve with WIN
        expect(
          userBalanceAfterEntry.add(
            multiplier.mul(10000).div(BN.from(10000).sub(userSide)).mul(entryAmount).div(oneEther)
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
            .add(
              multiplier.mul(10000).div(BN.from(10000).sub(userSide)).mul(entryAmount).div(oneEther)
            )
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(fareSupplyAfterResolve)
      })

      it('Minted NFT metadata should encode json/application base64', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        // @NOTE user side and protocol side are the same. Therefore, user will win
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftTokenId = await ppvNFT.tokenByIndex(0)
        const nftURI = await ppvNFT.tokenURI(nftTokenId)

        expect(nftURI.startsWith('data:application/json;base64')).to.be.true
      })

      it('Should revert if tokenId does not exist', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        // @NOTE user side and protocol side are the same. Therefore, user will win
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        await ppvNFT.tokenByIndex(0)

        // @NOTE: Because of the way we have implemented NFT contract, tokenIds would start from 1 therefore, tokenId = 0 does not exist
        await expect(ppvNFT.tokenURI(0)).to.be.revertedWithCustomError(ppvNFT, 'NonExistingTokenId')
        await expect(ppvNFT.tokenURI(100)).to.be.revertedWithCustomError(
          ppvNFT,
          'NonExistingTokenId'
        )
      })

      it('Should revert if we are trying to mint a NFT from a contract that is not whitelisted on FareToken', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('5000')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setWhitelistStatus = await fare.setWhitelistAddress(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        await expect(
          rollOver.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(ppvNFT, 'FareTokenContractNotWhitelisted')
      })

      it('Should revert if we are trying to mint a NFT from a contract that is not whitelisted by user on FareToken', async () => {
        let entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('5000')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setWhitelistStatus = await fare.setAllowContractMintBurn(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        await expect(
          rollOver.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(ppvNFT, 'FareTokenContractNotAllowedByUser')
      })

      it('Should revert if we are trying to set FareToken of the FarePPVNFT to 0x0 address', async () => {
        await expect(ppvNFT.setFareToken(zeroAddress)).to.be.revertedWithCustomError(
          ppvNFT,
          'InvalidFareTokenAddress'
        )
      })

      it('FarePPVNFT has correct FareToken addres', async () => {
        expect(await ppvNFT.fareToken()).to.be.equal(fare.address)
      })
    })

    describe('User Rewards based protocol probability value', async () => {
      beforeEach(async () => {
        const setPPVTypeTx = await rollOver.setPPVType(1)
        await setPPVTypeTx.wait()
      })

      it('What `checkIfNFTMint()` returns should not be important', async () => {
        const entryAmount = toEth('1000')
        const entryCount = 1

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        const userSide = BN.from('5000')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const nftBalanceBefore = await ppvNFT.balanceOf(owner)

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftBalanceAfter = await ppvNFT.balanceOf(owner)

        // @NOTE If it is in User Rewards based ppv mode, it should not mint an NFT, therefore NFT balance should not change
        expect(nftBalanceAfter).to.be.equal(nftBalanceBefore)
      })

      it('User Rewards should be adjusted to create protocolProbabilityValue', async () => {
        const entryAmount = toEth('1000')
        const entryCount = 1
        const multiplier = oneEther

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const ppvFromContract = await rollOver.protocolProbabilityValue()
        const hostRewardsPercentage = await rollOver.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await rollOver.PROTOCOL_REWARDS_PERCENTAGE()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(10000)
        // @NOTE user side and protocol side are the same. Therefore, user will win
        const userSide = BN.from('1553')
        const submitEntryTx = await rollOver.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await rollOver.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rollOver.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rollOver.connect(signers.resolver).resolveKeccak(requestId)
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

        // @NOTE Test fare balance transition from after entry to after resolve with WIN
        expect(
          userBalanceAfterEntry.add(
            multiplier
              .mul(10000)
              .div(BN.from(10000).sub(userSide))
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount)
              .div(oneEther)
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
            .add(
              multiplier
                .mul(10000)
                .div(BN.from(10000).sub(userSide))
                .mul(oneEther.sub(ppvFromContract))
                .div(oneEther)
                .mul(entryAmount)
                .div(oneEther)
            )
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(fareSupplyAfterResolve)
      })
    })
  })
})
