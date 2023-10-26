import * as hre from 'hardhat'
import { expect, assert } from 'chai'

import type {
  AirnodeRrpMock,
  LinkToken,
  FareToken,
  FarePPVNFT,
  FareBombMock,
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

Logger.setLogLevel(Logger.levels.ERROR)

const oneEther = toEth('1')
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')
// @NOTE Using first randomNumber with 5 bomb
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

const calculateMultiplier = (
  bombCount: number,
  revealCount: number,
  baseMultiplier: BigNumber = oneEther
) => {
  let aggMultiplier = baseMultiplier
  for (let i = 0; i < revealCount; i++) {
    aggMultiplier = aggMultiplier
      .mul(
        oneEther
          .mul(25 - i)
          .mul(oneEther)
          .div(oneEther.mul(25 - i - bombCount))
      )
      .div(oneEther)
    // @NOTE FROM SMART CONTRACT
    // aggregateMultiplier = mulDiv(
    //   aggregateMultiplier,
    //   mulDiv(
    //     (25 - i) * 10 ** 18,
    //     1 ether,
    //     (25 - i - bombCount) * 10 ** 18
    //   ),
    //   1 ether
    // );
  }
  return aggMultiplier
}

const calculateReward = (
  entryAmount: BigNumber,
  entryCount: number,
  bombCount: number,
  revealCount: number,
  multiplier: BigNumber,
  ppv: BigNumber
) => {
  return calculateMultiplier(bombCount, revealCount, multiplier)
    .mul(oneEther.sub(ppv))
    .div(oneEther)
    .mul(entryAmount)
    .div(oneEther)
    .mul(entryCount)
}

// @NOTE for requestId => 1, they change with requestId
// const first20RandomNumbers = [
//   '78541660797044910968829902406342334108369226379826116161446442989268089806461',
//   '92458281274488595289803937127152923398167637295201432141969818930235769911599',
//   '105409183525425523237923285454331214386340807945685310246717412709691342439136',
//   '72984518589826227531578991903372844090998219903258077796093728159832249402700',
//   '77725202164364049732730867459915098663759625749236281158857587643401898360325',
//   '9247535584797915451057180664748820695544591120644449140157971996739901653371',
//   '28212876883947467128917703474378516019173305230661588919942657668795042982449',
//   '81222191986226809103279119994707868322855741819905904417953092666699096963112',
//   '78433594294121473380335049450505973962381404738846570838001569875460533962079',
//   '66448226337682112469901396875338497574368918010328814248214166510316316219958',
//   '84934199764823764932614580024544130756785257017024643872272759911324597459911',
//   '51914823640605595201349532922629958394051406478327354737522196600828559087055',
//   '95949769290960679919915568476335582553435826563121580797397853711946803546972',
//   '114585326621582131594227061312413046545694058379708735113635225133433280369605',
//   '75885601358636693696949802906298188001431145678381949700310637158053438652935',
//   '10232859502370774325584414461715588285503867213897530911692062066092626540687',
//   '63494115790245236833190262165204403781416728104395367008488472023786642762591',
//   '10735524448188297088180400188362831734192075462446168930367499660610597598546',
//   '51405484595649549995570754522109131044110769769465629924526080237349824370083',
//   '29551862758206774800663949531140833257297060090686477542636248382367273448269',
// ]

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
  let bomb: FareBombMock
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'bomb'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    bomb = (await ethers.getContract('FareBombMock')) as FareBombMock
  })

  it('Successful FareBombMock Deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    const FareBombMockDeployed = await FareBombMockFactory.deploy(
      {
        nftbppvsuContractParams: {
          baseContractParams: {
            fareTokenAddress: fare.address,
            protocolAddress: protocol,
            hostAddress: host,
            protocolProbabilityValue: ppv,
          },
          farePPVNFTAddress: ppvNFT.address,
          contractName: 'FareBombMock',
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
    expect(await FareBombMockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid fareTokenAddress should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: zeroAddress,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidFareTokenAddress')
  })

  it('Invalid protocolProbabilityValue should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: multiplyBigNumberWithFixedPointNumber(oneEther, '0.001'),
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidPPV')
  })

  it('Invalid hostAddress should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: zeroAddress,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidHostAddress')
  })

  it('Invalid farePPVNFTAddress should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: zeroAddress,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidFarePPVNFTAddress')
  })

  it('Invalid contractName should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
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
    ).to.be.revertedWithCustomError(bomb, 'EmptyContractName')
  })

  it('Invalid keccakResolver should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidKeccakResolverAddress')
  })

  it('Invalid vrfCoordinator should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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
    ).to.be.revertedWithCustomError(bomb, 'InvalidVRFCoordinatorAddress')
  })

  it('Invalid airnodeRrp should fail deployment', async () => {
    const FareBombMockFactory = await ethers.getContractFactory('FareBombMock')
    await expect(
      FareBombMockFactory.deploy(
        {
          nftbppvsuContractParams: {
            baseContractParams: {
              fareTokenAddress: fare.address,
              protocolAddress: protocol,
              hostAddress: host,
              protocolProbabilityValue: ppv,
            },
            farePPVNFTAddress: ppvNFT.address,
            contractName: 'FareBombMock',
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

describe('FareBombMock', () => {
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
  let bomb: FareBombMock
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

    await deployments.fixture(['mocks', 'fare', 'ppv_nft', 'bomb'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    ppvNFT = (await ethers.getContract('FarePPVNFT')) as FarePPVNFT
    bomb = (await ethers.getContract('FareBombMock')) as FareBombMock
  })

  describe('Constructor', () => {
    it('FareBombMock has the correct FareToken address', async () => {
      const bombFareToken = await bomb.fareToken()
      expect(bombFareToken).to.equal(fare.address)
    })

    it('FareToken and FareBombMock owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const bombSignerAddress = await bomb.owner()
      expect(fareSignerAddress).to.equal(bombSignerAddress)
    })

    it('FareBombMock protocol address is correct', async () => {
      const actual = await bomb.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareBombMock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareBombMock host address is correct', async () => {
      const actual = await bomb.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareBombMock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareBombMock precision is 1 ether', async () => {
      const actualPrecision = await bomb.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    // @NOTE what is the equivalent of this test after refactor?
    // it('FareBombMock multiplier value is 1 ether which represents x1 (default)', async () => {
    //   const multiplier = await bomb.multiplier()
    //   expect(multiplier).to.equal(oneEther)
    // })

    // @NOTE review test: double check the default values for the remaining Constructor tests
    it('FareBombMock ppv value is 0.01 ether which represents 1.00% (default)', async () => {
      const ppvFromContract = await bomb.protocolProbabilityValue()
      expect(ppvFromContract).to.equal(oneEther.div('100'))
    })

    it('FareBombMock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await bomb.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareBombMock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareBombMock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareBombMock MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE is 200 (default)', async () => {
      const blockNumberCountForWithdraw = await bomb.MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE()
      expect(blockNumberCountForWithdraw).to.equal(defaultBlockNumberCountForWithdraw)
    })

    it('FareBombMock maxEntryCount is 20 (default)', async () => {
      const maxEntryCount = await bomb.maxEntryCount()
      expect(maxEntryCount).to.equal(defaultMaxEntryCount)
    })

    it('FareBombMock has the correct FarePPVNFT address', async () => {
      const bombFarePPVNFT = await bomb.farePPVNFT()
      expect(bombFarePPVNFT).to.equal(ppvNFT.address)
    })

    it('FareBombMock contractName is `FareBombMock`', async () => {
      const contractName = await bomb.contractName()
      expect(contractName).to.equal('FareBombMock')
    })

    it('FareBombMock ppvType is 0 as default. Therefore, uses NFT', async () => {
      const ppvType = await bomb.ppvType()
      expect(ppvType).to.equal(0)
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(bomb.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await bomb.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await bomb.setHostAddress(protocol)
      const newHostAddress = await bomb.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(bomb.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        bomb,
        'InvalidHostAddress'
      )
    })

    it('Set VRF related params', async () => {
      const newSubscriptionId = 10
      const newVRFCoordinator = users[2]
      const newRequestConFirmationCount = 5
      const newCallbackGasLimit = 1000000
      const newKeyHash = '0x5b09e658ed251bcafeebbc69400383d49f344ace09b9576fe248bb02c003fe9f'
      const reqTx = await bomb.setVRFRequestParameters(
        newVRFCoordinator,
        newSubscriptionId,
        newRequestConFirmationCount,
        newCallbackGasLimit,
        newKeyHash
      )
      await reqTx.wait()
      expect(await bomb.subscriptionId()).to.equal(newSubscriptionId)
      expect(await bomb.getVRFCoordinatorAddress()).to.equal(newVRFCoordinator)
      expect(await bomb.requestConfirmations()).to.equal(newRequestConFirmationCount)
      expect(await bomb.callbackGasLimit()).to.equal(newCallbackGasLimit)
      expect(await bomb.keyHash()).to.equal(newKeyHash)
    })

    it('Set maxEntryCount', async () => {
      const setTx = await bomb.setMaxEntryCount(200)
      await setTx.wait()
      const newMaxGameCount = await bomb.maxEntryCount()
      expect(newMaxGameCount).to.equal(200)
    })

    it('Set maxEntryCount to 0 should fail', async () => {
      await expect(bomb.setMaxEntryCount(0)).to.be.revertedWithCustomError(
        bomb,
        'InvalidMaxEntryCount'
      )
    })

    it('Set ppvType', async () => {
      const setTx = await bomb.setPPVType(1)
      await setTx.wait()
      const newPPVType = await bomb.ppvType()
      expect(newPPVType).to.equal(1)
    })
  })

  describe('SubmitEntry', () => {
    it('Invalid side should revert', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray([2, 24])
      await expect(
        bomb.encodeSideAndSubmitEntry(25, encodedRevealArray, 0, 0, 0, 0)
      ).to.revertedWithCustomError(bomb, 'BombCountIs0OrOver24')

      await expect(
        bomb.encodeSideAndSubmitEntry(0, encodedRevealArray, 0, 0, 0, 0)
      ).to.revertedWithCustomError(bomb, 'BombCountIs0OrOver24')

      const invalidEncodedRevealArray = await bomb.encodeRevealArray([2, 24, 25])
      await expect(
        bomb.encodeSideAndSubmitEntry(3, invalidEncodedRevealArray, 0, 0, 0, 0)
      ).to.revertedWithCustomError(bomb, 'InvalidEncodeRevealArray')
      await expect(
        bomb.encodeSideAndSubmitEntry(24, encodedRevealArray, 0, 0, 0, 0)
      ).to.revertedWithCustomError(bomb, 'SumOfBombCountAndRevealCountExceeds25')
    })

    it('Invalid amount should revert', async () => {
      await expect(bomb.encodeSideAndSubmitEntry(1, 1, 0, 0, 0, 0)).to.revertedWithCustomError(
        bomb,
        'EntryWithZeroTokens'
      )
    })

    it('Invalid count should revert', async () => {
      await expect(bomb.encodeSideAndSubmitEntry(1, 1, 0, 0, 0, 0)).to.revertedWithCustomError(
        bomb,
        'EntryWithZeroTokens'
      )

      await expect(
        bomb.encodeSideAndSubmitEntry(1, 2, toEth('1000'), 0, 0, 101)
      ).to.revertedWithCustomError(bomb, 'CountExceedsMaxEntryCount')
    })

    it('Should burn (entry.amount * entry.count) amount of tokens', async () => {
      const entryAmount = toEth('1000')
      const entryCount = 20
      const initialFareBalance = await fare.balanceOf(owner)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        1,
        23,
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
      await expect(bomb.encodeSideAndSubmitEntry(1, 3, 1, 0, 0, 1)).to.emit(
        bomb,
        'KeccakRandomNumberRequested'
      )
    })

    it('Should emit EntrySubmitted event', async () => {
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(1, 4, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      assert.isDefined(entrySubmittedEvent, 'EntrySubmitted event is not emmited')
    })

    it('Should request a random number and receive a result', async () => {
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(1, 5, toEth('1000'), 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await bomb.setMockRandomNumbers([
        '78541660797044910968829902406342334108369226379826116161446442989268089806461',
      ])
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint([false])
      await setIsNFTMintsTx.wait()

      await expect(bomb.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        bomb,
        'EntryResolved'
      )
    })

    it('Should not allow to submit a new entry if previous entry is not resolved', async () => {
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(1, 7, toEth('1000'), 0, 0, 20)
      await submitEntryTx.wait()
      await expect(
        bomb.encodeSideAndSubmitEntry(1, 8, toEth('2000'), 0, 0, 10)
      ).to.revertedWithCustomError(bomb, 'EntryInProgress')
    })

    it('Should allow to submit a new entry if previous entry is resolved', async () => {
      const entryCount = 20
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
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

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(bomb.encodeSideAndSubmitEntry(1, 10, toEth('2000'), 0, 0, 20)).to.emit(
        bomb,
        'EntrySubmitted'
      )
    })

    it('Should store entry correctly to `userToEntry` and `requestIdToUser` mappings', async () => {
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(1, 11, toEth('1000'), 0, 0, 1)
      await submitEntryTx.wait()

      const submittedEntry = await bomb.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.not.eq(0)

      const storedUserForEntry = await bomb.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(owner)
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(3, 3, 1, 0, 0, 1)
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId = entrySubmittedEvent?.requestId
      const setRandomNumbersTx = await bomb.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx.wait()
      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx.wait()
      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const setMinEntryAmount = await bomb.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(bomb.encodeSideAndSubmitEntry(3, 3, 1, 0, 0, 1)).to.be.revertedWithCustomError(
        bomb,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(bomb.encodeSideAndSubmitEntry(3, 3, 1, 0, 0, 20)).to.be.revertedWithCustomError(
        bomb,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(
        bomb.encodeSideAndSubmitEntry(3, 3, toEth('1').sub(1), 0, 0, 1)
      ).to.be.revertedWithCustomError(bomb, 'EntryAmountLowerThanMinEntryAmount')
      const submitEntryTx1 = await bomb.encodeSideAndSubmitEntry(3, 3, toEth('1'), 0, 0, 1)
      const submitEntryReceipt1 = await submitEntryTx1.wait()
      const entrySubmittedEvent1 = submitEntryReceipt1.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId1 = entrySubmittedEvent1?.requestId
      const setRandomNumbersTx1 = await bomb.setMockRandomNumbers(Array(1).fill(1))
      await setRandomNumbersTx1.wait()
      const setIsNFTMintsTx1 = await bomb.setMockIsNFTMint(Array(1).fill(false))
      await setIsNFTMintsTx1.wait()
      const resolveTx1 = await bomb.connect(signers.resolver).resolveKeccak(requestId1)
      await resolveTx1.wait()

      const submitEntryTx2 = await bomb.encodeSideAndSubmitEntry(3, 3, toEth('1').div(10), 0, 0, 10)
      const submitEntryReceipt2 = await submitEntryTx2.wait()
      const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
        (event) => event.event === 'EntrySubmitted'
      )[0].args
      const requestId2 = entrySubmittedEvent2?.requestId
      const setRandomNumbersTx2 = await bomb.setMockRandomNumbers(Array(10).fill(1))
      await setRandomNumbersTx2.wait()
      const setIsNFTMintsTx2 = await bomb.setMockIsNFTMint(Array(10).fill(false))
      await setIsNFTMintsTx2.wait()
      const resolveTx2 = await bomb.connect(signers.resolver).resolveKeccak(requestId2)
      await resolveTx2.wait()
    })
  })

  describe('ResolveEntry', () => {
    let requestId: string
    let submitEntryTx
    let submitEntryReceipt
    let entrySubmittedEvent
    let entryAmount = toEth('1000')
    let entryCount = 20
    let users

    it('Invalid requestId should revert', async () => {
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(1, 12, entryAmount, 0, 0, entryCount)
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      await expect(
        bomb.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(bomb, 'RequestIdNotInProgress')
    })

    it('When user loses, nothing is minted to user', async () => {
      const entryCount = 1
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.equal(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to user', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const fareBalanceAfterEntrySubmitted = await fare.balanceOf(owner)

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const fareBalanceAfterEntryResolved = await fare.balanceOf(owner)

      expect(fareBalanceAfterEntryResolved).to.be.gt(fareBalanceAfterEntrySubmitted)
    })

    it('When user wins, something is minted to protocol address', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('When user loses, something is minted to rewards address', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const hostFareBalanceAfterEntrySubmitted = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntrySubmitted = await fare.balanceOf(protocol)

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const hostFareBalanceAfterEntryResolved = await fare.balanceOf(host)
      const protocolFareBalanceAfterEntryResolved = await fare.balanceOf(protocol)

      expect(hostFareBalanceAfterEntryResolved).to.be.gt(hostFareBalanceAfterEntrySubmitted)
      expect(protocolFareBalanceAfterEntryResolved).to.be.gt(protocolFareBalanceAfterEntrySubmitted)
    })

    it('Should emit EntryResolved event', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      await expect(bomb.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
        bomb,
        'EntryResolved'
      )
    })

    it('Can not be resolved after it has been withdrawn', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray([2, 6, 8])
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      await mine(defaultBlockNumberCountForWithdraw)

      const withdrawTx = await bomb.withdrawEntry()
      await withdrawTx.wait()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      await expect(
        bomb.connect(signers.resolver).resolveKeccak(requestId)
      ).to.be.revertedWithCustomError(bomb, 'RequestIdNotResolvable')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const encodedRevealArray = bomb.encodeRevealArray([2, 6, 8])
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        5,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
      await setIsNFTMintsTx.wait()

      const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await resolveTx.wait()

      const submittedEntry = await bomb.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await bomb.requestIdToUser(submittedEntry.requestId)
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

    let winMultiplier
    let loseMultiplier
    // @NOTE ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01') declared globally
    let hostRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.15')
    let protocolRewardsPercentage = multiplyBigNumberWithFixedPointNumber(ppv, '0.05')
    let submitEntryTx
    let submitEntryReceipt
    let entrySubmittedEvent

    beforeEach(async () => {
      const setPPVTx = await bomb.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Wins a single entry (bombCount = 5, revealCount = 3)', async () => {
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
          calculateReward(entryAmount, entryCount, bombCount, revealCount, winMultiplier, ppv)
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
          .add(calculateReward(entryAmount, entryCount, bombCount, revealCount, winMultiplier, ppv))
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
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
      entryCount = 2
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(
        userBalanceAfterEntry.add(
          calculateReward(entryAmount, entryCount, bombCount, revealCount, winMultiplier, ppv)
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
          .add(calculateReward(entryAmount, entryCount, bombCount, revealCount, winMultiplier, ppv))
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      const entryCount = 2
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
        fareSupplyAfterEntry
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
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

    let winMultiplier
    let loseMultiplier
    let ppvFromContract
    let hostRewardsPercentage
    let protocolRewardsPercentage
    let submitEntryTx
    let submitEntryReceipt
    let entrySubmittedEvent

    beforeEach(async () => {
      const setPPVTx = await bomb.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Wins a single entry (bombCount = 5, revealCount = 3)', async () => {
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
          calculateReward(
            entryAmount,
            entryCount,
            bombCount,
            revealCount,
            winMultiplier,
            ppvFromContract
          )
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
            calculateReward(
              entryAmount,
              entryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses a single entry', async () => {
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

      userBalanceAfterResolve = await fare.balanceOf(owner)
      hostBalanceAfterResolve = await fare.balanceOf(host)
      protocolBalanceAfterResolve = await fare.balanceOf(protocol)
      fareSupplyAfterResolve = await fare.totalSupply()

      // @NOTE Test fare balance transition from BeforeEntry to AfterEntry
      expect(userBalanceBeforeEntry.sub(entryAmount)).to.equal(userBalanceAfterEntry)
      expect(hostBalanceBeforeEntry).to.equal(hostBalanceAfterEntry)
      expect(protocolBalanceBeforeEntry).to.equal(protocolBalanceAfterEntry)
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
      entryCount = 2
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()
      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN
      expect(
        userBalanceAfterEntry.add(
          calculateReward(
            entryAmount,
            entryCount,
            bombCount,
            revealCount,
            winMultiplier,
            ppvFromContract
          )
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
            calculateReward(
              entryAmount,
              entryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('Loses 2 entries', async () => {
      const entryCount = 2
      winMultiplier = oneEther.mul('1')
      loseMultiplier = oneEther.mul('0')
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()
      submitEntryReceipt = await submitEntryTx.wait()
      entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
        fareSupplyAfterEntry
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
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
    let stopLoss
    let stopGain
    let winMultiplier = oneEther.mul('1')
    let loseMultiplier = oneEther.mul('0')
    let ppvFromContract
    let hostRewardsPercentage
    let protocolRewardsPercentage
    let playedEntryCount
    let remainingEntryCount

    beforeEach(async () => {
      const setPPVTx = await bomb.setPPVType(1)
      await setPPVTx.wait()
    })

    it('stopLoss amount is less than entryAmount and loses first entry', async () => {
      entryCount = 2
      playedEntryCount = 1
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')

      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const encodedRevealArray = await bomb.encodeRevealArray(lose1win1RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      await submitEntryTx.wait()
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '0.001')

      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3

      const encodedRevealArray = await bomb.encodeRevealArray(win1lose1RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
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

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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

      // @NOTE Test fare balance transition from AfterEntry to EntryResolved with WIN 2 entries
      expect(
        userBalanceAfterEntry
          .add(
            calculateReward(
              entryAmount,
              playedEntryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
          )
          .add(entryAmount.mul(remainingEntryCount))
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
        fareSupplyAfterEntry
          .add(
            calculateReward(
              entryAmount,
              playedEntryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
          )
          .add(entryAmount.mul(remainingEntryCount))
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(playedEntryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(playedEntryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopLoss amount is just more than entryAmount and loses 2 entries', async () => {
      entryCount = 2
      playedEntryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.5')

      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      // const revealCount = 3

      const encodedRevealArray = await bomb.encodeRevealArray(lose2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      await submitEntryTx.wait()
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
      // Should be same as losing 2 entries
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
        fareSupplyAfterEntry
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })

    it('stopGain amount is just more than entryAmount and wins 2 entries', async () => {
      entryCount = 2
      playedEntryCount = 2
      stopLoss = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.01')
      stopGain = multiplyBigNumberWithFixedPointNumber(entryAmount, '1.01')

      ppvFromContract = await bomb.protocolProbabilityValue()
      hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
      protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

      userBalanceBeforeEntry = await fare.balanceOf(owner)
      hostBalanceBeforeEntry = await fare.balanceOf(host)
      protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
      fareSupplyBeforeEntry = await fare.totalSupply()

      const bombCount = 5
      const revealCount = 3
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        stopLoss,
        stopGain,
        entryCount
      )
      await submitEntryTx.wait()
      const submitEntryReceipt = await submitEntryTx.wait()
      const entrySubmittedEvent = submitEntryReceipt.events?.filter(
        (event: Event) => event.event === 'EntrySubmitted'
      )[0].args
      requestId = entrySubmittedEvent?.requestId

      userBalanceAfterEntry = await fare.balanceOf(owner)
      hostBalanceAfterEntry = await fare.balanceOf(host)
      protocolBalanceAfterEntry = await fare.balanceOf(protocol)
      fareSupplyAfterEntry = await fare.totalSupply()

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

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
      // Should be same as winning 2 entries
      expect(
        userBalanceAfterEntry.add(
          calculateReward(
            entryAmount,
            entryCount,
            bombCount,
            revealCount,
            winMultiplier,
            ppvFromContract
          )
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
            calculateReward(
              entryAmount,
              entryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
          )
          .add(entryAmount.mul(hostRewardsPercentage).div(oneEther).mul(entryCount))
          .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther).mul(entryCount))
      ).to.equal(fareSupplyAfterResolve)
    })
  })

  describe('WithdrawEntry', () => {
    const bombCount = 5
    const revealCount = 3
    let entryCount = 1
    let entryAmount = toEth('1000')

    beforeEach(async () => {
      const setPPVTx = await bomb.setPPVType(1)
      await setPPVTx.wait()
    })

    it('Can withdraw if 200 blocks passed and it has not been resolved or already withdrawn. (Which represents a VRF failure)', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await bomb.withdrawEntry()
      await withdrawTx.wait()
    })

    it('After withdrawal, fare balance is equal to before entry fare balance', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(owner)
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await bomb.withdrawEntry()
      await withdrawTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(owner)

      expect(userBalanceAfterEntry).to.eq(userBalanceBeforeEntry)
    })

    it('Can not withdraw if 200 blocks have not passed', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await expect(bomb.withdrawEntry()).to.be.revertedWithCustomError(bomb, 'TooEarlyToWithdraw')
    })

    it('Can not withdraw if entry has already been withdrawn', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await bomb.withdrawEntry()
      await withdrawTx.wait()

      await expect(bomb.withdrawEntry()).to.be.revertedWithCustomError(bomb, 'EntryNotInProgress')
    })

    it('Can not withdraw if entry has never been submitted', async () => {
      await expect(bomb.withdrawEntry()).to.be.revertedWithCustomError(bomb, 'EntryNotInProgress')
    })

    it('Can not withdraw an entry after it has been resolved and 200 blocks have passed', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
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

      const setRandomNumbersTx = await bomb.setMockRandomNumbers(
        Array(entryCount).fill(
          '78541660797044910968829902406342334108369226379826116161446442989268089806461'
        )
      )
      await setRandomNumbersTx.wait()

      const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
      await fulfillTx.wait()

      await mine(200)

      await expect(bomb.withdrawEntry()).to.revertedWithCustomError(bomb, 'EntryNotInProgress')
    })

    it('Should remove entry correctly from `userToEntry` and `requestIdToUser` mappings', async () => {
      const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
      const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
        bombCount,
        encodedRevealArray,
        entryAmount,
        0,
        0,
        entryCount
      )
      await submitEntryTx.wait()

      await mine(200)

      const withdrawTx = await bomb.withdrawEntry()
      await withdrawTx.wait()

      const submittedEntry = await bomb.userToEntry(owner)
      expect(submittedEntry.blockNumber).to.eq(0)

      const storedUserForEntry = await bomb.requestIdToUser(submittedEntry.requestId)
      expect(storedUserForEntry).to.eq(zeroAddress)
    })
  })

  describe('Requesters', () => {
    describe('Keccak', () => {
      const bombCount = 5
      const revealCount = 3
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setPPVTx = await bomb.setPPVType(1)
        await setPPVTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        // @NOTE By default it uses KeccakRequester
        await expect(
          bomb.encodeSideAndSubmitEntry(
            bombCount,
            encodedRevealArray,
            entryAmount,
            0,
            0,
            entryCount
          )
        ).to.emit(bomb, 'KeccakRandomNumberRequested')
      })

      it('Should request a random number and receive a result', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(bomb.connect(signers.resolver).resolveKeccak(requestId)).to.emit(
          bomb,
          'EntryResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()
        await expect(bomb.resolveKeccak(requestId)).to.be.revertedWithCustomError(
          bomb,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx2.wait()

        const setIsNFTMintsTx2 = await bomb.setMockIsNFTMint([false])
        await setIsNFTMintsTx2.wait()

        const batchResolveTx = await bomb
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        const batchResolveTx2 = await bomb
          .connect(signers.resolver)
          .batchResolveKeccak([requestId2])
        await batchResolveTx2.wait()

        const submitEntryTx3 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId
        const setRandomNumbersTx3 = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx3.wait()

        const setIsNFTMintsTx3 = await bomb.setMockIsNFTMint([false])
        await setIsNFTMintsTx3.wait()
        await mine(210)

        const withdrawTx = await bomb.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await bomb
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          bomb.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(bomb, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccakRandomNumber` and resolveRandomNumbers', async () => {
        await expect(bomb.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          bomb,
          'NotKeccakResolver'
        )
      })

      it('Should be able to resolve batch requests, but not previously resolved batch request', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const setRandomNumbersTx2 = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx2.wait()

        const setIsNFTMintsTx2 = await bomb.setMockIsNFTMint([false])
        await setIsNFTMintsTx2.wait()

        const batchResolveTx = await bomb
          .connect(signers.resolver)
          .batchResolveKeccak([requestId, requestId2])
        await batchResolveTx.wait()

        await expect(bomb.connect(signers.resolver).batchResolveKeccak([requestId2])).to.emit(
          bomb,
          'FailedRequestIds'
        )

        const submitEntryTx3 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId
        const setRandomNumbersTx3 = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx3.wait()

        const setIsNFTMintsTx3 = await bomb.setMockIsNFTMint([false])
        await setIsNFTMintsTx3.wait()
        await mine(210)

        const withdrawTx = await bomb.connect(signers.user).withdrawEntry()
        await withdrawTx.wait()

        const batchResolveTx3 = await bomb
          .connect(signers.resolver)
          .batchResolveKeccak([requestId3])
        await batchResolveTx3.wait()
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await bomb.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(
          bomb.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(bomb, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await bomb.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const setKeccakRequester = await bomb.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          bomb.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(bomb, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(bomb.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          bomb,
          'InternalFunction'
        )

        await expect(
          bomb.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(bomb, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await bomb.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          bomb.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(bomb, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await bomb.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await bomb.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })

      it('Should resolve multiple requests at once', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
        await sendFareToUserAddressTx.wait()

        const submitEntryTx2 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt2 = await submitEntryTx2.wait()
        const entrySubmittedEvent2 = submitEntryReceipt2.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId2 = entrySubmittedEvent2?.requestId

        const allowMintBurnTx = await fare
          .connect(signers.resolver)
          .setAllowContractMintBurn(bomb.address, true)
        await allowMintBurnTx.wait()

        const sendFareToResolverAddressTx = await fare.transfer(resolver, toEth('2000'))
        await sendFareToResolverAddressTx.wait()

        const submitEntryTx3 = await bomb
          .connect(signers.resolver)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt3 = await submitEntryTx3.wait()
        const entrySubmittedEvent3 = submitEntryReceipt3.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId3 = entrySubmittedEvent3?.requestId

        await expect(
          bomb.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.not.emit(bomb, 'FailedRequestIds')

        await expect(
          bomb.connect(signers.resolver).batchResolveKeccak([requestId, requestId2, requestId3])
        ).to.emit(bomb, 'FailedRequestIds')

        const submitEntryTx4 = await bomb
          .connect(signers.user)
          .encodeSideAndSubmitEntry(bombCount, encodedRevealArray, entryAmount, 0, 0, entryCount)
        const submitEntryReceipt4 = await submitEntryTx4.wait()
        const entrySubmittedEvent4 = submitEntryReceipt4.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId4 = entrySubmittedEvent4?.requestId

        const batchResolveTx = await bomb
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
      const bombCount = 5
      const revealCount = 3
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setVRFRequester = await bomb.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        await expect(
          bomb.encodeSideAndSubmitEntry(
            bombCount,
            encodedRevealArray,
            entryAmount,
            0,
            0,
            entryCount
          )
        ).to.emit(vrfCoordinator, 'RandomWordsRequested')
      })

      it('Should request a random number and receive a result', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        await expect(vrfCoordinator.customFulfillRandomWords(requestId, bomb.address, [1])).to.emit(
          bomb,
          'EntryResolved'
        )
      })
    })

    describe('QRNG', () => {
      const bombCount = 5
      const revealCount = 3
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setQRNGRequester = await bomb.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await bomb.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await bomb.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        await expect(
          bomb.encodeSideAndSubmitEntry(
            bombCount,
            encodedRevealArray,
            entryAmount,
            0,
            0,
            entryCount
          )
        ).to.emit(airnodeRrpMock, 'MadeFullRequest')
      })

      it('Should request a random number and receive a result', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const params = ethers.utils.defaultAbiCoder.encode(
          ['uint256'], // @NOTE encode as address array
          [1]
        )

        await expect(
          airnodeRrpMock.fulfill(
            requestId,
            bomb.address,
            bomb.address,
            // @NOTE Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(bomb, 'EntryResolved')
      })
    })
  })

  describe('NFT or User Rewards based protocol probability value', () => {
    describe('NFT based protocol probability value', async () => {
      const bombCount = 5
      const revealCount = 3
      let entryCount = 1
      let entryAmount = toEth('1000')

      it('Should be the default version, check by nft balance', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      it('Should not mint an NFT if `checkIfNFTMint()` returns false', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(false))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore)
      })

      it('Should mint an NFT if `checkIfNFTMint()` returns true', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const NFTBalanceBefore = await ppvNFT.balanceOf(owner)

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const NFTBalanceAfter = await ppvNFT.balanceOf(owner)
        // @NOTE Check that it is the default version by making sure that it mints an NFT
        expect(NFTBalanceAfter).to.equal(NFTBalanceBefore.add(1))
      })

      // @NOTE review test: this test seems redundant, double check if setup correctly
      it('User rewards should not be adjusted. They should be based on probability', async () => {
        const setPPVTx = await bomb.setPPVType(1)
        await setPPVTx.wait()

        const winMultiplier = oneEther.mul('1')
        const loseMultiplier = oneEther.mul('0')
        const ppvFromContract = await bomb.protocolProbabilityValue()
        const hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
          entryAmount,
          0,
          0,
          entryCount
        )
        await submitEntryTx.wait()
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const fulfillTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await fulfillTx.wait()

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
        expect(
          userBalanceAfterEntry.add(
            calculateReward(
              entryAmount,
              entryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
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
              calculateReward(
                entryAmount,
                entryCount,
                bombCount,
                revealCount,
                winMultiplier,
                ppvFromContract
              )
            )
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(fareSupplyAfterResolve)
      })

      it('Minted NFT metadata should encode json/application base64', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftTokenId = await ppvNFT.tokenByIndex(0)
        const nftURI = await ppvNFT.tokenURI(nftTokenId)
        // console.log(nftURI)
        // TODO: Right now, I dont thing I should spend time to generalize this but rather than chceking if the URI looks good
        // TODO: By rendering it using a browser, we should render the base64 encoded thing and check if entries metadata is encoded correctly
        // TODO: Again I am not implementing this just in the sake of time management
        expect(nftURI.startsWith('data:application/json;base64')).to.be.true
      })

      it('Should revert if tokenId does not exist', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
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
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setWhitelistStatus = await fare.setWhitelistAddress(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        await expect(
          bomb.connect(signers.resolver).resolveKeccak(requestId)
        ).to.be.revertedWithCustomError(ppvNFT, 'FareTokenContractNotWhitelisted')
      })

      it('Should revert if we are trying to mint a NFT from a contract that is not whitelisted by user on FareToken', async () => {
        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
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

        const setWhitelistStatus = await fare.setAllowContractMintBurn(ppvNFT.address, false)
        await setWhitelistStatus.wait()

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        await expect(
          bomb.connect(signers.resolver).resolveKeccak(requestId)
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
      const bombCount = 5
      const revealCount = 3
      let entryCount = 1
      let entryAmount = toEth('1000')

      beforeEach(async () => {
        const setPPVTypeTx = await bomb.setPPVType(1)
        await setPPVTypeTx.wait()
      })

      it('What `checkIfNFTMint()` returns should not be important', async () => {
        const winMultiplier = oneEther.mul('1')
        const loseMultiplier = oneEther.mul('0')
        const ppvFromContract = await bomb.protocolProbabilityValue()
        const hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
          entryAmount,
          0,
          0,
          entryCount
        )
        await submitEntryTx.wait()
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const nftBalanceBefore = await ppvNFT.balanceOf(owner)

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
        await resolveTx.wait()

        const nftBalanceAfter = await ppvNFT.balanceOf(owner)

        // @NOTE checkNFTMint is returning true because we have set it that way
        // If it is in User Rewards based ppv mode it should not mint an NFT, therefore NFT balance should not change
        expect(nftBalanceAfter).to.be.equal(nftBalanceBefore)
      })

      // @NOTE review test: this test seems redundant, double check if setup correctly
      it('User Rewards should be adjusted to create protocolProbabilityValue', async () => {
        const winMultiplier = oneEther.mul('1')
        const loseMultiplier = oneEther.mul('0')
        const ppvFromContract = await bomb.protocolProbabilityValue()
        const hostRewardsPercentage = await bomb.HOST_REWARDS_PERCENTAGE()
        const protocolRewardsPercentage = await bomb.PROTOCOL_REWARDS_PERCENTAGE()

        const userBalanceBeforeEntry = await fare.balanceOf(owner)
        const hostBalanceBeforeEntry = await fare.balanceOf(host)
        const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)
        const fareSupplyBeforeEntry = await fare.totalSupply()

        const encodedRevealArray = await bomb.encodeRevealArray(win2RevealArray)
        const submitEntryTx = await bomb.encodeSideAndSubmitEntry(
          bombCount,
          encodedRevealArray,
          entryAmount,
          0,
          0,
          entryCount
        )
        await submitEntryTx.wait()
        const submitEntryReceipt = await submitEntryTx.wait()
        const entrySubmittedEvent = submitEntryReceipt.events?.filter(
          (event: Event) => event.event === 'EntrySubmitted'
        )[0].args
        const requestId = entrySubmittedEvent?.requestId

        const userBalanceAfterEntry = await fare.balanceOf(owner)
        const hostBalanceAfterEntry = await fare.balanceOf(host)
        const protocolBalanceAfterEntry = await fare.balanceOf(protocol)
        const fareSupplyAfterEntry = await fare.totalSupply()

        const setRandomNumbersTx = await bomb.setMockRandomNumbers(
          Array(entryCount).fill(
            '78541660797044910968829902406342334108369226379826116161446442989268089806461'
          )
        )
        await setRandomNumbersTx.wait()

        const setIsNFTMintsTx = await bomb.setMockIsNFTMint(Array(entryCount).fill(true))
        await setIsNFTMintsTx.wait()

        const resolveTx = await bomb.connect(signers.resolver).resolveKeccak(requestId)
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
        expect(
          userBalanceAfterEntry.add(
            calculateReward(
              entryAmount,
              entryCount,
              bombCount,
              revealCount,
              winMultiplier,
              ppvFromContract
            )
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
              calculateReward(
                entryAmount,
                entryCount,
                bombCount,
                revealCount,
                winMultiplier,
                ppvFromContract
              )
            )
            .add(entryAmount.mul(hostRewardsPercentage).div(oneEther))
            .add(entryAmount.mul(protocolRewardsPercentage).div(oneEther))
        ).to.equal(fareSupplyAfterResolve)
      })
    })
  })
})
