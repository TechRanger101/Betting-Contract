import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  FarePPVNFT,
  FareRPSMock,
  CustomVRFCoordinatorV2Mock,
} from '../typechain-types'
import { multiplyBigNumberWithFixedPointNumber } from './utils/test-helpers'
import { BigNumber, BigNumberish, Event } from 'ethers'
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
  '78541660797044910968829902406342334108369226379826116161446442989268089806461', // protocolSide (%3) => 2
  '92458281274488595289803937127152923398167637295201432141969818930235769911599', // 2
  '105409183525425523237923285454331214386340807945685310246717412709691342439136', // 1
  '72984518589826227531578991903372844090998219903258077796093728159832249402700', // 2
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
  first20ProtocolSides.push(BN.from(randomNumber).mod(3).toString())
)
console.log('RPS protocolSides: ', first20ProtocolSides)

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
  let rps: FareRPSMock
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'rps'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    rps = (await ethers.getContract('FareRPSMock')) as FareRPSMock
  })

  it('Successful FareRPSMock Deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    const FareRPSMockDeployed = await FareRPSMockFactory.deploy(
      {
        nftbppvsuContractParams: {
          baseContractParams: {
            fareTokenAddress: fare.address,
            protocolAddress: protocol,
            hostAddress: host,
            protocolProbabilityValue: ppv,
          },
          farePPVNFTAddress: ppvNFT.address,
          contractName: 'FareRPSMock',
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
    expect(await FareRPSMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: zeroAddress,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolAddress should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: zeroAddress,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidProtocolAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.001'),
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: zeroAddress,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidHostAddress')
  })

  it('Invalid farePPVNFTAddress should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: zeroAddress,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidFarePPVNFTAddress')
  })

  it('Invalid contractName should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
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
    ).to.be.revertedWithCustomError(rps, 'EmptyContractName')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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
    ).to.be.revertedWithCustomError(rps, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FareRPSMockFactory = await ethers.getContractFactory('FareRPSMock')
    await expect(
      FareRPSMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareRPSMock',
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

describe('FareRPSMock', () => {
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
  let rps: FareRPSMock
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'rps'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    rps = (await ethers.getContract('FareRPSMock')) as FareRPSMock
  })

  describe('Constructor', () => {
    it('FareRPSMock has the correct FareToken address', async () => {
      const rpsFareToken = await rps.fareToken()
      expect(rpsFareToken).to.equal(fare.address)
    })

    it('FareToken and FareRPSMock owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const rpsSignerAddress = await rps.owner()
      expect(fareSignerAddress).to.equal(rpsSignerAddress)
    })

    it('FareRPSMock protocol address is correct', async () => {
      const actual = await rps.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareRPSMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRPSMock host address is correct', async () => {
      const actual = await rps.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareRPSMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareRPSMock precision is 1 ether', async () => {
      const actualPrecision = await rps.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareRPSMock ppv value is 0.01 ether which represents 1.00% (default)', async () => {
      const ppv = await rps.protocolProbabilityValue()
      expect(ppv).to.equal(oneEther.div('100'))
    })

    it('FareRPSMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await rps.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareRPSMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareRPSMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareRPSMock MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw = await rps.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FareRPSMock maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await rps.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })

    it('FareRPSMock has the correct FarePPVNFT address', async () => {
      const rpsFarePPVNFT = await rps.farePPVNFT()
      expect(rpsFarePPVNFT).to.equal(ppvNFT.address)
    })

    it('FareRPSMock contractName is `FareRPSMock`', async () => {
      const contractName = await rps.contractName()
      expect(contractName).to.equal('FareRPSMock')
    })

    it('FareRPSMock ppvType is 0 as default. Therefore, uses NFT', async () => {
      const ppvType = await rps.ppvType()
      expect(ppvType).to.equal(0)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(rps.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await rps.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await rps.setHostAddress(protocol)
      const newHostAddress = await rps.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(rps.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        rps,
        'InvalidHostAddress'
      )
    })

    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await rps.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await rps.subscriptionId()).to.equal(newSubscriptionId)
      expect(await rps.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await rps.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await rps.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await rps.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxEntryCount', async () => {
      const setTx = await rps.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxEntryCount = await rps.maxEntryCount()
      expect(newMaxEntryCount).to.equal(200)
    })

    it('Set maxEntryCount to 0 should fail', async () => {
      await expect(rps.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        rps,
        'InvalidMaxEntryCount'
      )
    })

    it('Set ppvType', async () => {
      const setTx = await rps.setPPVType(1)
      await setTx.wait()
      const newPPVType = await rps.ppvType()
      expect(newPPVType).to.equal(1)
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      await expect(rps.submitEntry(499, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        rps,
        'SideIsOver2'
      )

      await expect(rps.submitEntry(9991, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        rps,
        'SideIsOver2'
      )
    })

    it('Invalid amount should revert', async () => {
      await expect(rps.submitEntry(0, 0, 0, 0, 0)).to.be.revertedWithCustomError(
        rps,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(rps.submitEntry(1, 1, 0, 0, 0)).to.be.revertedWithCustomError(
        rps,
        'EntryWithZeroTokens'
      )

      await expect(rps.submitEntry(2, toEth('1000'), 0, 0, 101)).to.be.revertedWithCustomError(
        rps,
        'CountExceedsMaxEntryCount'
      )
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20

      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const afterFareBalance = await fare.balanceOf(owner)
      expect(initialFareBalance).to.equal(afterFareBalance.add(entryAmount.mul(entryCount)))
    })

    it('Should request a random number', async () => {
      await expect(rps.submitEntry(1, 1, 0, 0, 1)).to.emit(rps, 'KeccakRandomNumberRequested')
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await rps.submitEntry(2, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    // @NOTE KeccalResolver: resolveKeccak
    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await rps.submitEntry(0, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers([1])
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      await expect(rps.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        rps,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await rps.submitEntry(2, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()

      await expect(rps.submitEntry(0, toEth('2000'), 0, 0, 10)).to.be.revertedWithCustomError(
        rps,
        'EntryInProgress'
      )
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const entryCount = 1
      const submitEntryTx = await rps.submitEntry(0, toEth('1000'), 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(rps.submitEntry(1, toEth('2000'), 0, 0, 20)).to.emit(rps, 'EntrySubmitted')
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await rps.submitEntry(2, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await rps.userToEntry(owner)
      expect(submitEntryTx.blockNumber).to.not.eq(0)

      const storedUserForEntry = await rps.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await rps.submitEntry(0, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await rps.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx.wait()
      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await rps.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(rps.submitEntry(0, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        rps,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(rps.submitEntry(0, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        rps,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(rps.submitEntry(0, toEth('1').sub(1), 0, 0, 1)).to.be.revertedWithCustomError(
        rps,
        'EntryAmountLowerThanMinEntryAmount'
      )
      const submitEntryTx1 = await rps.submitEntry(0, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await rps.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const setIsNFTMintsTx1 = await rps.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx1.wait()
      const resolveTx1 = await rps.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()

      const submitEntryTx2 = await rps.submitEntry(0, toEth('1').div(10), 0, 0, 10)
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await rps.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const setIsNFTMintsTx2 = await rps.setMockIsNFTMint(Array(10).fill(false))
      await setIsNFTMintsTx2.wait()
      const resolveTx2 = await rps.connect(signers.resolver).resolveKeccak(requestId2)
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
      submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        rps.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(rps, 'RequestIdNotInProgress')
    })

    it('When user wins, something is minted to user', async () => {
      entryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is lower than protocol side, which means user beats protocol.
      const userSide = BN.from('0')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user loses, nothing is minted to user', async () => {
      entryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is higher than protocol side, which means user failed to rps protocol, therefore loses.
      const userSide = BN.from('1')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.equal(fareBalanceAfterEntrySubmitted)
    })

    it('When user draws, something is minted to user', async () => {
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      const userSide = BN.from('2')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to host and protocol addresses', async () => {
      entryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      const userSide = BN.from('0')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()
      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user loses, something is minted to host and protocol addresses', async () => {
      entryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      const userSide = BN.from('1')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user draws, something is minted to host and protocol addresses', async () => {
      entryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      const userSide = BN.from('2')
      submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      entryCount = 1
      const submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      await expect(rps.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        rps,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      entryCount = 1
      const submitEntryTx = await rps.submitEntry(1, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await rps.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      await expect(
        rps.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(rps, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      entryCount = 1
      const submitEntryTx = await rps.submitEntry(2, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await rps.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await rps.requestIdToUser(submittedEntry.requestId)
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

    // @NOTE default ppv declared globally
    let hostRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.15')
    let protocolRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.05')
    let winMultiplier
    let loseMultiplier
    let drawMultiplier

    beforeEach(async () => {
      const setPPVTx = await rps.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Wins a single entry', async () => {
      winMultiplier = oneEther.mul('2')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is 50.00, protocol side is 64.61. User will win and multiplier will be 1.98
      const userSide = BN.from('0')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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
      expect(
        userBalanceAfterEntry.add(
          winMultiplier.mul(oneEther.sub(ppv)).div(oneEther).mul(entryAmount).div(oneEther)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryAmount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      loseMultiplier = oneEther.mul('0')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side and protocol side is same. Therefore, user will lose
      const userSide = BN.from('1')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to entry resolved with LOSE
      expect(userBalanceAfterEntry.add(entryAmount.mul(loseMultiplier))).to.equal(
        userBalanceAfterResolve
      )
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

    it('Draws a single entry', async () => {
      drawMultiplier = oneEther.mul('1')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is 50.00, protocol side is 64.61. User will win and multiplier will be 1.98
      const userSide = BN.from('2')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(
          drawMultiplier.mul(oneEther.sub(ppv)).div(oneEther).mul(entryAmount).div(oneEther)
        )
      ).to.equal(userBalanceAfterResolve)
      expect(
        hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
      ).to.equal(hostBalanceAfterResolve)
      expect(
        protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(protocolBalanceAfterResolve)
      expect(
        fareSupplyAfterEntry.add(
          drawMultiplier
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryAmount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries', async () => {
      entryCount = 2
      winMultiplier = oneEther.mul('2')
      drawMultiplier = oneEther.mul('1')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE Since protocol side is "2" (Scissors) for first 2 games. Playing "0" (Rock) will win both games
      const userSide = BN.from('0')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE test fare balance transition from after entry to entry resolved with WIN 2 games
      expect(
        userBalanceAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryAmount)
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
        fareSupplyAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryAmount)
            .mul(entryCount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      entryCount = 2
      winMultiplier = oneEther.mul('2')
      loseMultiplier = oneEther.mul('0')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3) // 6461 => 64.61
      // @NOTE Since protocol side is "2" (Scissors) for first 2 games. Playing "1" (Paper) will lose both games
      const userSide = BN.from('1')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to entry resolved with LOSES 2 games
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
          loseMultiplier
            .mul(oneEther.sub(ppv))
            .div(oneEther)
            .mul(entryAmount)
            .mul(entryCount)
            .div(oneEther)
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

    let hostRewardsPercentage: BigNumberish
    let protocolRewardsPercentage: BigNumberish
    let winMultiplier
    let loseMultiplier
    let drawMultiplier

    beforeEach(async () => {
      const setPPVTx = await rps.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Wins a single entries', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      winMultiplier = oneEther.mul('2')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is 50.00, protocol side is 64.61. User will win and multiplier will be 1.98
      const userSide = BN.from('0')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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
      expect(
        userBalanceAfterEntry.add(
          winMultiplier
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
        fareSupplyAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entries', async () => {
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      loseMultiplier = oneEther.mul('0')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side and protocol side is same. Therefore, user will lose
      const userSide = BN.from('1')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to entry resolved with LOSE
      expect(userBalanceAfterEntry.add(entryAmount.mul(loseMultiplier))).to.equal(
        userBalanceAfterResolve
      )
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

    it('Draws a single entries', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      drawMultiplier = oneEther.mul('1')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE user side is 50.00, protocol side is 64.61. User will win and multiplier will be 1.98
      const userSide = BN.from('2')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      expect(
        userBalanceAfterEntry.add(
          drawMultiplier
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
        fareSupplyAfterEntry.add(
          drawMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Wins 2 entries', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      entryCount = 2
      winMultiplier = oneEther.mul('2')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE Since protocol is "2" (Scissors) for first 2 games. Playing "0" (Rock) will win both games
      const userSide = BN.from('0')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE test fare balance transition from after entry to entry resolved with WIN 2 games
      expect(
        userBalanceAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
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
        fareSupplyAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .mul(entryCount)
            .div(oneEther)
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      entryCount = 2
      loseMultiplier = oneEther.mul('0')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3) // 6461 => 64.61
      // @NOTE Since protocol side is "2" (Scissors) for first 2 games. Playing "1" (Paper) will lose both games
      const userSide = BN.from('1')
      const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to entry resolved with LOSES 2 games
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
          loseMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .mul(entryCount)
            .div(oneEther)
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

    let hostRewardsPercentage: BigNumberish
    let protocolRewardsPercentage: BigNumberish
    let winMultiplier
    let loseMultiplier
    let stopLoss
    let stopGain
    let playedEntryCount
    let remainingEntryCount

    beforeEach(async () => {
      const setPPVTx = await rps.setPPVType(1)
      await setPPVTx.wait()
    })

    it('stopLoss amount is less than entryAmount and loses first entry', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      loseMultiplier = oneEther.mul('0')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      playedEntryCount = 1
      remainingEntryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      const userSide = BN.from('1')
      const submitEntryTx = await rps.submitEntry(
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

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

      // @NOTE Test fare balance transition from after entry to entry resolved with LOSE
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
        fareSupplyAfterEntry.add(
          loseMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .mul(playedEntryCount)
            .div(oneEther)
            .add(entryAmount.mul(remainingEntryCount))
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is less than entryAmount and wins first entry', async () => {
      const ppvFromContract = await rps.protocolProbabilityValue()
      hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      winMultiplier = oneEther.mul('2')

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      entryCount = 2
      playedEntryCount = 1
      remainingEntryCount = 1
      const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
      // @NOTE Since protocol side is "2" (Scissors) for first 2 games. Playing "0" (Rock) will win both games
      const userSide = BN.from('0')
      const submitEntryTx = await rps.submitEntry(
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

      const setRandomNumbersTx = await rps.setMockRandomNumbers(
        Array(entryCount).fill(protocolSide)
      )
      await setRandomNumbersTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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
        userBalanceAfterEntry
          .add(
            winMultiplier
              .mul(oneEther.sub(ppvFromContract))
              .div(oneEther)
              .mul(entryAmount)
              .div(oneEther)
              .mul(playedEntryCount)
          )
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
        fareSupplyAfterEntry.add(
          winMultiplier
            .mul(oneEther.sub(ppvFromContract))
            .div(oneEther)
            .mul(entryAmount)
            .mul(playedEntryCount)
            .div(oneEther)
            .add(entryAmount.mul(remainingEntryCount))
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
        )
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    let entryAmount = toEth('1000')
    let entryCount = 1
    let requestId

    let hostRewardsPercentage: BigNumberish
    let protocolRewardsPercentage: BigNumberish

    beforeEach(async () => {
      const setPPVTx = await rps.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Can withdraw if 200 blocks passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rps.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdrawal fare balance is equal to before entry fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const submitEntryTx = await rps.submitEntry(1, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rps.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if entry has already been resolved', async () => {
      const submitEntryTx = await rps.submitEntry(2, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await rps.setMockRandomNumbers(Array(entryCount).fill(2))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(rps.withdrawEntry()).to.be.revertedWithCustomError(rps, 'EntryNotInProgress')
    })

    it('Can not withdraw if 200 blocks have not been passed', async () => {
      const submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await expect(rps.withdrawEntry()).to.be.revertedWithCustomError(rps, 'TooEarlyToWithdraw')
    })

    it('Can not withdraw if it has already been withdrawn', async () => {
      const submitEntryTx = await rps.submitEntry(1, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rps.withdrawEntry()
      await withdrawTx.wait()

      await expect(rps.withdrawEntry()).to.be.revertedWithCustomError(rps, 'EntryNotInProgress')
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(rps.withdrawEntry()).to.be.revertedWithCustomError(rps, 'EntryNotInProgress')
    })

    it('Can not withdraw an entry after entry has been resolved and 200 blocks have passed', async () => {
      const submitEntryTx = await rps.submitEntry(2, entryAmount, 0, 0, entryCount)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await rps.setMockRandomNumbers(Array(entryCount).fill(2))
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await mine(200)

      await expect(rps.withdrawEntry()).to.be.revertedWithCustomError(rps, 'EntryNotInProgress')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await rps.submitEntry(0, entryAmount, 0, 0, entryCount)
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await rps.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await rps.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await rps.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    let entryAmount = toEth('1000')
    let entryCount = 1
    let requestId

    describe('Keccak', () => {
      it('Should be able to request a random number', async () => {
        const userSide = BN.from('0')
        // @NOTE By default it uses KeccakRequester
        await expect(rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          rps,
          'KeccakRandomNumberRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        await expect(rps.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          rps,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        // @NOTE user side is 50.00, protocol side is 64.61. User will win and multiplier will be 1.98
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        await expect(rps.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          rps,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const protocolSide2 = BN.from(first20RandomNumbers[0]).mod(3)
        // @NOTE user side and protocol side is same. Therefore, user will lose
        const userSide2 = BN.from('1')
        const submitEntryTx2 = await rps
          .connect(signers.user)
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId
        const setRandomNumbersTx2 = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide2)
        )
        await setRandomNumbersTx2.wait()

        const setIsNFTMintsTx2 = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx2.wait()

        const batchResolveTx = await rps
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await rps.connect(signers.resolver).batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        const protocolSide3 = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide3 = BN.from('2')
        const submitEntryTx3 = await rps
          .connect(signers.user)
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId
        const setRandomNumbersTx3 = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide3)
        )
        await setRandomNumbersTx3.wait()
        const setIsNFTMintsTx3 = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx3.wait()

        await mine(210)

        const withdrawTx = await rps.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await rps.connect(signers.resolver).batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          rps.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(rps, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(rps.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          rps,
          'NotKeccakResolver'
        )
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await rps.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        await expect(
          rps.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(rps, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await rps.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        const setKeccakRequester = await rps.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          rps.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(rps, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(rps.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          rps,
          'InternalFunction'
        )

        await expect(
          rps.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(rps, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await rps.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          rps.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(rps, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await rps.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await rps.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()
        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        const sendFareToUser0AddressTx = await fare.transfer(userSigners[0].address, toEth('20000'))
        await sendFareToUser0AddressTx.wait()
        const sendFareToUser1AddressTx = await fare.transfer(userSigners[1].address, toEth('20000'))
        await sendFareToUser1AddressTx.wait()
        const sendFareToUser2AddressTx = await fare.transfer(userSigners[2].address, toEth('20000'))
        await sendFareToUser2AddressTx.wait()

        const allowMintBurnTx = await fare
          .connect(signers.resolver)
          .setAllowContractMintBurn(rps.address, true)
        await allowMintBurnTx.wait()
        const allowMintBurnTx0 = await fare
          .connect(userSigners[0])
          .setAllowContractMintBurn(rps.address, true)
        await allowMintBurnTx0.wait()
        const allowMintBurnTx1 = await fare
          .connect(userSigners[1])
          .setAllowContractMintBurn(rps.address, true)
        await allowMintBurnTx1.wait()
        const allowMintBurnTx2 = await fare
          .connect(userSigners[2])
          .setAllowContractMintBurn(rps.address, true)
        await allowMintBurnTx2.wait()

        const protocolSide2 = BN.from(first20RandomNumbers[0]).mod(3)
        // @NOTE user side and protocol side is same. Therefore, user will lose
        const userSide2 = BN.from('1')
        const submitEntryTx2 = await rps
          .connect(userSigners[0])
          .submitEntry(userSide2, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        const protocolSide3 = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide3 = BN.from('2')
        const submitEntryTx3 = await rps
          .connect(userSigners[1])
          .submitEntry(userSide3, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          rps.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(rps, 'FailedRequestIds')

        await expect(
          rps.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(rps, 'FailedRequestIds')

        const protocolSide4 = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide4 = BN.from('0')
        const submitEntryTx4 = await rps.submitEntry(userSide4, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await rps
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
        const setVRFRequester = await rps.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const userSide = BN.from('0')
        await expect(rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        await expect(vrfCoordinator.customFulfillRandomWords(requestId, rps.address, [1])).to.emit(
          rps,
          'EntryResolved'
        )
      })
    })

    describe('QRNG', () => {
      beforeEach(async () => {
        const setQRNGRequester = await rps.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await rps.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await rps.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const userSide = BN.from('0')
        await expect(rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            rps.address,
            rps.address,
            // Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(rps, 'EntryResolved')
      })
    })
  })

  describe('NFT or User Rewards based protocol probability value', () => {
    let entryAmount = toEth('1000')
    let entryCount = 1

    describe('NFT based protocol probability value', async () => {
      it('Should be the default version, check by nft balance', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)

        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      it('Should not mint an NFT if `checkIfNFTMint()` returns false', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([false])
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore)
      })

      it('Should mint an NFT if `checkIfNFTMint()` returns true', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)

        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      it('User rewards should not be adjusted. They should be based on probability', async () => {
        // @NOTE Do not forget it will return 10000 to represent x1.0000
        const precision = oneEther
        const winMultiplier = precision.mul('2')
        // const ppvFromContract = await rps.protocolProbabilityValue()
        const hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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

        // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
        expect(userBalanceAfterEntry.add(entryAmount.mul(winMultiplier).div(oneEther))).to.equal(
          userBalanceAfterResolve
        )
        expect(
          hostBalanceAfterEntry.add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
        ).to.equal(hostBalanceAfterResolve)
        expect(
          protocolBalanceAfterEntry.add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(protocolBalanceAfterResolve)
        expect(
          fareSupplyAfterEntry
            .add(entryAmount.mul(winMultiplier).div(oneEther))
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(fareSupplyAfterResolve)
      })

      it('Minted NFT metadata should encode json/application base64', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftTokenId = await ppvNFT.tokenByIndex(0)
        const nftURI = await ppvNFT.tokenURI(nftTokenId)

        expect(nftURI.startsWith('data:application/json;base64')).to.be.true
      })

      it('Should revert if tokenId does not exist', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftTokenId = await ppvNFT.tokenByIndex(0)

        // @NOTE: Because of the way we have implemented NFT contract, tokenIds would start from 1 therefore, tokenId = 0 does not exist
        await expect(ppvNFT.tokenURI(0)).to.be.revertedWithCustomError(ppvNFT, 'NonExistingTokenId')
        await expect(ppvNFT.tokenURI(100)).to.be.revertedWithCustomError(
          ppvNFT,
          'NonExistingTokenId'
        )
      })

      it('Should revert if we are trying to mint a NFT from a contract that is not whitelisted on FareToken', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setWhitelistStatus = await fare.setWhitelistAddress(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        await expect(
          rps.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(ppvNFT, 'FareTokenContractNotWhitelisted')
      })

      it('Should revert if we are trying to mint a NFT from a contract that is not whitelisted by user on FareToken', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const setWhitelistStatus = await fare.setAllowContractMintBurn(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        await expect(
          rps.connect(signers.resolver).resolveKeccak(requestId)
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
        const setPPVTypeTx = await rps.setPPVType(1)
        await setPPVTypeTx.wait()
      })

      it('What `checkIfNFTMint()` returns should not be important', async () => {
        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const nftBalanceBefore = await ppvNFT.balanceOf(owner)

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftBalanceAfter = await ppvNFT.balanceOf(owner)

        // @NOTE checkNFTMint is returning true because we have set it that way
        // If it is in User Rewards based ppv mode, it should not mint an NFT, therefore NFT balance should not change
        expect(nftBalanceAfter).to.be.equal(nftBalanceBefore)
      })

      it('User rewards should be adjusted to create protocolProbabilityValue', async () => {
        const entryAmount = toEth('1000')
        const entryCount = 1

        const multiplier = oneEther
        const winMultiplier = multiplier.mul('2')
        // const loseMultiplier = multiplier.mul('0')

        const ppv = await rps.protocolProbabilityValue()
        const hostRewardsPercentage = await rps.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await rps.PROTOCOL_REWARDS_PERCENTAGE()

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const protocolSide = BN.from(first20RandomNumbers[0]).mod(3)
        const userSide = BN.from('0')
        const submitEntryTx = await rps.submitEntry(userSide, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await rps.setMockRandomNumbers(
          Array(entryCount).fill(protocolSide)
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await rps.setMockIsNFTMint([true])
        await setIsNFTMintsTx.wait()

        const resolveTx = await rps.connect(signers.resolver).resolveKeccak(requestId)
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
})
