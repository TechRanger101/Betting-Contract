import * as hre from 'hardhat'
import { expect } from 'chai'

import {
  AirnodeRrpMock,
  CustomVRFCoordinatorV2Mock,
  FareSpinV2Mock,
  FareSpinV2Mock__factory,
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
const ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')

const calculateUserRewardsWithPPV = (
  entryAmount: BigNumber,
  multiplier: BigNumber,
  ppv = multiplyBigNumberWithFixedPointNumber(oneEther, '0.01')
): BigNumber => {
  return entryAmount.mul(multiplier.mul(oneEther.sub(ppv)).div(oneEther)).div(oneEther)
}

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

  let spin: FareSpinV2Mock

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

    await deployments.fixture(['mocks', 'fare', 'spinV2'])
    link = (await ethers.getContract('LinkToken')) as LinkToken
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    fare = (await ethers.getContract('FareToken')) as FareToken
    spin = (await ethers.getContract('FareSpinV2Mock')) as FareSpinV2Mock
  })

  it('Successful FareSpinV2Mock Deployment', async () => {
    const FareSpinV2MockFactory = await ethers.getContractFactory('FareSpinV2Mock')
    const FareSpinV2MockDeployed = await FareSpinV2MockFactory.deploy(
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
    expect(await FareSpinV2MockDeployed.owner()).to.be.equal(owner)
  })

  it('Invalid _fareTokenAddress should fail deployment', async () => {
    const FareSpinV2MockFactory = await ethers.getContractFactory('FareSpinV2Mock')
    await expect(
      FareSpinV2MockFactory.deploy(
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
    ).to.be.revertedWithCustomError(spin, 'InvalidFareTokenAddress')
  })

  it('Invalid _protocolAddress should fail deployment', async () => {
    const FareSpinV2MockFactory = await ethers.getContractFactory('FareSpinV2Mock')
    await expect(
      FareSpinV2MockFactory.deploy(
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
    ).to.be.revertedWithCustomError(spin, 'InvalidProtocolAddress')
  })
  it('Invalid _hostAddress should fail deployment', async () => {
    const FareSpinV2MockFactory = await ethers.getContractFactory('FareSpinV2Mock')
    await expect(
      FareSpinV2MockFactory.deploy(
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
    ).to.be.revertedWithCustomError(spin, 'InvalidHostAddress')
  })
  it('Invalid _protocolProbabilityValue should fail deployment', async () => {
    const FareSpinV2MockFactory = await ethers.getContractFactory('FareSpinV2Mock')
    await expect(
      FareSpinV2MockFactory.deploy(
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
    ).to.be.revertedWithCustomError(spin, 'InvalidPPV')
  })
})

describe('FareSpinV2Mock', () => {
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
  let spin: FareSpinV2Mock
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

    await deployments.fixture(['mocks', 'fare', 'spinV2'])
    fare = (await ethers.getContract('FareToken')) as FareToken
    vrfCoordinator = (await ethers.getContract(
      'CustomVRFCoordinatorV2Mock'
    )) as CustomVRFCoordinatorV2Mock
    airnodeRrpMock = (await ethers.getContract('AirnodeRrpMock')) as AirnodeRrpMock
    spin = (await ethers.getContract('FareSpinV2Mock')) as FareSpinV2Mock
  })

  describe('Constructor', () => {
    it('FareSpinV2Mock has the correct FareToken address', async () => {
      const spinFareToken = await spin.fareToken()
      expect(spinFareToken).to.equal(fare.address)
    })

    it('FareSpinV2Mock and FareToken owner address is the same', async () => {
      const fareSignerAddress = await fare.owner()
      const spinSignerAddress = await spin.owner()
      expect(fareSignerAddress).to.equal(spinSignerAddress)
    })

    it('FareSpinV2Mock protocol address is correct', async () => {
      const actual = await spin.protocolAddress()
      expect(actual).to.equal(protocol)
    })

    it('FareSpinV2Mock protocol balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(protocol)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareSpinV2Mock host address is correct', async () => {
      const actual = await spin.hostAddress()
      expect(actual).to.equal(host)
    })

    it('FareSpinV2Mock host balance is 0 FARE', async () => {
      const actual = await fare.balanceOf(host)
      expect(actual).to.equal(BN.from(0))
    })

    it('FareSpinV2Mock precision is 1 ether', async () => {
      const actualPrecision = await spin.PRECISION()
      expect(actualPrecision).to.eq(oneEther)
    })

    it('FareSpinV2Mock ppv value is 0.01 ether which represents 3.00%', async () => {
      const ppv = await spin.protocolProbabilityValue()
      expect(ppv).to.equal(oneEther.div('100'))
    })

    it('FareSpinV2Mock MIN_PROTOCOL_PROBABILITY_VALUE is 0.01 ether which represents 0.1% (default)', async () => {
      const minPPV = await spin.MIN_PROTOCOL_PROBABILITY_VALUE()
      expect(minPPV).to.equal(multiplyBigNumberWithFixedPointNumber(oneEther, '0.01'))
    })

    it('FareSpinV2Mock HOST_REWARDS_PERCENTAGE value is 15% of the PPV which represents 0.15% (if ppv is 1%)', async () => {
      const hostRewardsPercentage = await spin.HOST_REWARDS_PERCENTAGE()
      expect(hostRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.15'))
    })

    it('FareSpinV2Mock PROTOCOL_REWARDS_PERCENTAGE value is 5% of the PPV which represents 0.05% (if ppv is 1%)', async () => {
      const protocolRewardsPercentage = await spin.PROTOCOL_REWARDS_PERCENTAGE()
      expect(protocolRewardsPercentage).to.equal(multiplyBigNumberWithFixedPointNumber(ppv, '0.05'))
    })

    it('FareSpinV2Mock round is paused by default', async () => {
      const isRoundPaused = await spin.isRoundPaused()
      expect(isRoundPaused).to.be.false
    })
  })

  describe('Basic Setters', () => {
    it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
      await expect(spin.connect(signers.user).setHostAddress(protocol)).to.revertedWith(
        'Ownable: caller is not the owner'
      )
    })

    it('Ensure owner address calling onlyOwner function works', async () => {
      expect(await spin.setHostAddress(protocol))
    })

    it('Set host address', async () => {
      await spin.setHostAddress(protocol)
      const newHostAddress = await spin.hostAddress()
      expect(newHostAddress).to.equal(protocol)
    })

    it('Set host address to 0x0 should fail', async () => {
      await expect(spin.setHostAddress(zeroAddress)).to.be.revertedWithCustomError(
        spin,
        'InvalidHostAddress'
      )
    })

    it('Ensure user can submit entry when round is not paused', async () => {
      const sendFareToUserAddressTx = await fare.transfer(user, toEth('2000'))
      await sendFareToUserAddressTx.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [toEth('1000')])
      await submitEntryTx.wait()
    })

    it('Ensure an address could be set as a manager', async () => {
      await expect(
        spin.connect(userSigners[4]).pauseRoundAndRequestRandomNumber()
      ).to.be.revertedWithCustomError(spin, 'NotManagerOrOwner')

      const setManagerTx = await spin.setManagerStatus(userSigners[4].address, true)
      await setManagerTx.wait()

      await expect(spin.connect(userSigners[4]).pauseRoundAndRequestRandomNumber()).to.emit(
        spin,
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
        spin.connect(signers.user).submitEntry([await spin.encodeSide(3, 2)], [amount])
      ).to.be.revertedWithCustomError(spin, 'ModeCannotBeMoreThanTwo')
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(0, 2)], [amount])
      ).to.be.revertedWithCustomError(spin, 'IndexesRangeFromZeroToOneForModeZero')
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(1, 11)], [amount])
      ).to.be.revertedWithCustomError(spin, 'IndexesRangeFromZeroToNineForModeOne')
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(2, 100)], [amount])
      ).to.be.revertedWithCustomError(spin, 'IndexesRangeFromZeroToNinetyNineForModeTwo')
    })

    it('Should revert if sides are not in ascending order', async () => {
      await expect(
        spin
          .connect(signers.user)
          .submitEntry([await spin.encodeSide(2, 2), await spin.encodeSide(1, 2)], [amount, amount])
      ).to.be.revertedWithCustomError(spin, 'EntrySidesShouldBeInAscendingOrder')
    })

    it('Should revert if sides are not unique', async () => {
      await expect(
        spin
          .connect(signers.user)
          .submitEntry([await spin.encodeSide(2, 2), await spin.encodeSide(2, 2)], [amount, amount])
      ).to.be.revertedWithCustomError(spin, 'EntrySidesShouldBeInAscendingOrder')
    })

    it('Empty entry should revert', async () => {
      await expect(spin.connect(signers.user).submitEntry([], [])).to.be.revertedWithCustomError(
        spin,
        'EntryIsEmpty'
      )
    })

    it('Should revert if sides and amounts length differ', async () => {
      await expect(
        spin.connect(signers.user).submitEntry([], [toEth('1000')])
      ).to.be.revertedWithCustomError(spin, 'EntrySideAndAmountLengthMismatch')
    })

    it('Invalid amount should revert', async () => {
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(0, 0)], [0])
      ).to.be.revertedWithCustomError(spin, 'EntryWithZeroTokens')
    })

    it('Invalid amount should revert for multiple amounts', async () => {
      await expect(
        spin
          .connect(signers.user)
          .submitEntry([await spin.encodeSide(0, 0), await spin.encodeSide(1, 1)], [toEth('10'), 0])
      ).to.be.revertedWithCustomError(spin, 'EntryWithZeroTokens')
    })

    it('Submits an entry and stores the related data', async () => {
      const side = await spin.encodeSide(2, 73)
      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(2, 73)], [amount])
      await submitEntryTx.wait()

      const roundId = await spin.roundIdCounter()
      const userEntry = await spin.getEntryOfUserForRound(user, roundId)

      expect(side).to.be.equal(userEntry.sides[0])
      expect(amount).to.be.equal(userEntry.amounts[0])
    })

    it('Should not be able to submit multiple entries for the same round', async () => {
      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(2, 23)], [amount])
      await submitEntryTx.wait()

      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(0, 0)], [amount.mul(2)])
      ).to.be.revertedWithCustomError(spin, 'EntryAlreadySubmittedForTheRound')
    })

    it('Should burn tokens from user', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(user)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(1, 7)], [amount])
      await submitEntryTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(user)

      expect(userBalanceBeforeEntry).to.be.greaterThan(userBalanceAfterEntry)
    })

    it('Should burn `amount` tokens from user', async () => {
      const userBalanceBeforeEntry = await fare.balanceOf(user)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()

      const userBalanceAfterEntry = await fare.balanceOf(user)

      expect(userBalanceBeforeEntry).to.be.equal(userBalanceAfterEntry.add(amount))
    })

    it('Should mint tokens for host', async () => {
      const hostBalanceBeforeEntry = await fare.balanceOf(host)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(1, 3)], [amount])
      await submitEntryTx.wait()

      const hostBalanceAfterEntry = await fare.balanceOf(host)

      expect(hostBalanceAfterEntry).to.be.greaterThan(hostBalanceBeforeEntry)
    })

    it('Should mint correct amount of tokens to host according to ppv', async () => {
      const hostRewardsPercentage = await spin.HOST_REWARDS_PERCENTAGE()

      const hostBalanceBeforeEntry = await fare.balanceOf(host)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(2, 98)], [amount])
      await submitEntryTx.wait()

      const hostBalanceAfterEntry = await fare.balanceOf(host)

      expect(
        hostBalanceBeforeEntry.add(amount.mul(hostRewardsPercentage).div(oneEther))
      ).to.be.equal(hostBalanceAfterEntry)
    })

    it('Should mint tokens for protocol', async () => {
      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(2, 67)], [amount])
      await submitEntryTx.wait()

      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)

      expect(protocolBalanceAfterEntry).to.be.greaterThan(protocolBalanceBeforeEntry)
    })

    it('Should mint correct amount of tokens to protocol according to ppv', async () => {
      const protocolRewardsPercentage = await spin.PROTOCOL_REWARDS_PERCENTAGE()

      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(2, 87)], [amount])
      await submitEntryTx.wait()

      const protocolBalanceAfterEntry = await fare.balanceOf(protocol)

      expect(
        protocolBalanceBeforeEntry.add(amount.mul(protocolRewardsPercentage).div(oneEther))
      ).to.be.equal(protocolBalanceAfterEntry)
    })

    it('Should mint correct amount of tokens to protocol and host with multiple sides and amounts', async () => {
      const side0 = await spin.encodeSide(1, 7)
      const side1 = await spin.encodeSide(2, 99)
      const amount0 = toEth('1000')
      const amount1 = toEth('2000')
      const protocolRewardsPercentage = await spin.PROTOCOL_REWARDS_PERCENTAGE()
      const hostRewardsPercentage = await spin.HOST_REWARDS_PERCENTAGE()

      const hostBalanceBeforeEntry = await fare.balanceOf(host)
      const protocolBalanceBeforeEntry = await fare.balanceOf(protocol)

      const submitEntryTx = await spin
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
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(2, 14)], [amount])
      ).to.emit(spin, 'EntrySubmitted')
    })

    it('Should revert if user tries to submit two values for mode zero', async () => {
      await expect(
        spin.submitEntry(
          [await spin.encodeSide(0, 0), await spin.encodeSide(0, 1)],
          [toEth('1000'), toEth('1000')]
        )
      ).to.be.revertedWithCustomError(spin, 'CanHaveOneEntryAtMostForModeZero')
    })

    it('Should revert if user tries to submit five values for mode one', async () => {
      await expect(
        spin.submitEntry(
          [
            await spin.encodeSide(1, 0),
            await spin.encodeSide(1, 1),
            await spin.encodeSide(1, 2),
            await spin.encodeSide(1, 3),
            await spin.encodeSide(1, 4),
          ],
          [toEth('1000'), toEth('1000'), toEth('1000'), toEth('1000'), toEth('1000')]
        )
      ).to.be.revertedWithCustomError(spin, 'CanHaveFourEntryAtMostForModeOne')
    })

    it('Should revert if user tries to submit ten values for mode two', async () => {
      await expect(
        spin.submitEntry(
          [
            await spin.encodeSide(2, 0),
            await spin.encodeSide(2, 1),
            await spin.encodeSide(2, 2),
            await spin.encodeSide(2, 3),
            await spin.encodeSide(2, 4),
            await spin.encodeSide(2, 5),
            await spin.encodeSide(2, 6),
            await spin.encodeSide(2, 7),
            await spin.encodeSide(2, 8),
            await spin.encodeSide(2, 9),
          ],
          [
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
            toEth('1000'),
          ]
        )
      ).to.be.revertedWithCustomError(spin, 'CanHaveNineEntryAtMostForModeTwo')
    })

    it('Mode based total amount limit should work', async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)
      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()
      const mode0NewLimit = toEth('1000')
      const mode1NewLimit = toEth('2000')
      const mode2NewLimit = toEth('3000')

      // Default limits are "0" indicating no limit
      await expect(
        spin.submitEntry([await spin.encodeSide(0, 0)], [await fare.burnLimit()])
      ).to.emit(spin, 'EntrySubmitted')

      // Set the for mode zero to 1000 FARE and try to submit
      const setLimitsTx0 = await spin.setModeTotalAmountLimits(
        mode0NewLimit,
        await spin.mode1TotalAmountLimit(),
        await spin.mode2TotalAmountLimit()
      )
      await setLimitsTx0.wait()
      await expect(
        spin
          .connect(userSigners[0])
          .submitEntry([await spin.encodeSide(0, 0)], [mode0NewLimit.add(1)])
      ).to.be.revertedWithCustomError(spin, 'ExceedsAmountLimitForModeZero')
      // Set the for mode one to 2000 FARE and try to submit
      const setLimitsTx1 = await spin.setModeTotalAmountLimits(
        await spin.mode0TotalAmountLimit(),
        mode1NewLimit,
        await spin.mode2TotalAmountLimit()
      )
      await setLimitsTx1.wait()
      await expect(
        spin
          .connect(userSigners[1])
          .submitEntry([await spin.encodeSide(1, 0)], [mode1NewLimit.add(1)])
      ).to.be.revertedWithCustomError(spin, 'ExceedsAmountLimitForModeOne')

      // Set the for mode two to 3000 FARE and try to submit
      const setLimitsTx2 = await spin.setModeTotalAmountLimits(
        await spin.mode0TotalAmountLimit(),
        await spin.mode1TotalAmountLimit(),
        mode2NewLimit
      )
      await setLimitsTx2.wait()
      await expect(
        spin
          .connect(userSigners[2])
          .submitEntry([await spin.encodeSide(2, 0)], [mode2NewLimit.add(1)])
      ).to.be.revertedWithCustomError(spin, 'ExceedsAmountLimitForModeTwo')
    })

    it('`minEntryAmount` feature should work as expected', async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 1)], [1])
      await submitEntryTx.wait()

      const setMinEntryAmount = await spin.setMinEntryAmount(toEth('1'))
      await setMinEntryAmount.wait()
      expect(spin.submitEntry([await spin.encodeSide(0, 1)], [1])).to.be.revertedWithCustomError(
        spin,
        'EntryAmountLowerThanMinEntryAmount'
      )
      expect(
        spin.submitEntry(
          [
            await spin.encodeSide(2, 0),
            await spin.encodeSide(2, 1),
            await spin.encodeSide(2, 2),
            await spin.encodeSide(2, 3),
            await spin.encodeSide(2, 4),
          ],
          [1, 1, 1, 1, 1]
        )
      ).to.be.revertedWithCustomError(spin, 'EntryAmountLowerThanMinEntryAmount')
      expect(
        spin.submitEntry([await spin.encodeSide(0, 1)], [toEth('1').sub(1)])
      ).to.be.revertedWithCustomError(spin, 'EntryAmountLowerThanMinEntryAmount')
      const submitEntryTx1 = await spin.submitEntry([await spin.encodeSide(0, 1)], [toEth('1')])
      await submitEntryTx1.wait()
      const submitEntryTx2 = await spin
        .connect(userSigners[1])
        .submitEntry(
          [await spin.encodeSide(0, 1), await spin.encodeSide(1, 2)],
          [toEth('1').div(2), toEth('1').div(2)]
        )
      await submitEntryTx2.wait()
    })
  })

  describe('PauseRoundAndRequestRandomNumber', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 0)], [amount])
      await submitEntryTx1.wait()
    })

    it('Should not be callable if round is paused', async () => {
      const pauseTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      expect(spin.pauseRoundAndRequestRandomNumber()).to.be.revertedWithCustomError(
        spin,
        'RoundPaused'
      )
    })

    it('Should not be callable by normal users', async () => {
      await expect(
        spin.connect(userSigners[0]).pauseRoundAndRequestRandomNumber()
      ).to.be.revertedWithCustomError(spin, 'NotManagerOrOwner')
    })

    it('Should be callable by manager', async () => {
      const setManager = await spin.setManagerStatus(userSigners[0].address, true)
      await setManager.wait()

      const isRoundPausedBefore = await spin.isRoundPaused()
      expect(isRoundPausedBefore).to.be.false

      const pauseTx = await spin.connect(userSigners[0]).pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      const isRoundPausedAfter = await spin.isRoundPaused()
      expect(isRoundPausedAfter).to.be.true
    })

    it('Should pause the round', async () => {
      const isPausedBefore = await spin.isRoundPaused()
      expect(isPausedBefore).to.be.false

      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseRoundAndRequestRandomNumberTx.wait()

      const isPausedAfter = await spin.isRoundPaused()
      expect(isPausedAfter).to.be.true
    })

    it('Should not increment roundId', async () => {
      const roundIdBefore = await spin.roundIdCounter()

      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseRoundAndRequestRandomNumberTx.wait()

      const roundIdAfter = await spin.roundIdCounter()
      expect(roundIdAfter).to.be.equal(roundIdBefore)
    })

    it('Should store blockNumber', async () => {
      const roundId = await spin.roundIdCounter()
      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      const receipt = await pauseRoundAndRequestRandomNumberTx.wait()
      expect(receipt.blockNumber).to.be.equal(await spin.roundIdToBlockNumber(roundId))
    })

    it('Emits isRoundPaused', async () => {
      expect(spin.pauseRoundAndRequestRandomNumber()).to.emit(spin, 'IsRoundPausedUpdate')
    })

    it('Emits RequestedRandomNumberForRound', async () => {
      expect(spin.pauseRoundAndRequestRandomNumber()).to.emit(spin, 'RequestedRandomNumberForRound')
    })

    it('Should store requestId for the round', async () => {
      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      const receipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = receipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
      const requestId = requestEvent.requestId
      const roundId = await spin.roundIdCounter()
      expect(roundId).to.be.equal(await spin.requestIdToRoundId(requestId))
    })
  })

  describe('ResolveAndUnpauseRound', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 6)], [amount])
      await submitEntryTx1.wait()

      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = pauseReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
    })

    it('Should not be able to resolve if randomNumber is not requested', async () => {
      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      await expect(
        spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      ).to.be.revertedWithCustomError(spin, 'RoundNotPaused')
    })

    it("Should not be able to resolve current round with old failed round's requestId", async () => {
      // request, wait 200 blocks, fails, request new, try to resolve with old should fail
      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      const requestNewTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestNewTx.wait()

      await expect(
        spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      ).to.be.revertedWithCustomError(spin, 'RequestIdIsNotForCurrentRound')
    })

    it('Should increment roundIdCounter by 1', async () => {
      const roundIdBefore = await spin.roundIdCounter()

      const resolveTx = await spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const roundIdAfter = await spin.roundIdCounter()

      expect(roundIdAfter).to.be.equal(roundIdBefore.add(1))
    })

    it('Should store round result', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveTx = await spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const roundResult = await spin.roundIdToRoundResult(roundId)

      expect(roundResult.toNumber()).to.not.be.equal(0)
    })

    it('Should set isRoundPaused to false', async () => {
      const resolveTx = await spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      expect(await spin.isRoundPaused()).to.be.false
    })

    it('Should emit IsRoundPausedUpdate', async () => {
      await expect(spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
        spin,
        'IsRoundPausedUpdate'
      )
    })

    it('Should emit RoundResolved', async () => {
      await expect(spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
        spin,
        'RoundResolved'
      )
    })

    it('Should not be able to submit a new entry after round is paused', async () => {
      await expect(
        spin.connect(userSigners[1]).submitEntry([await spin.encodeSide(2, 53)], [amount])
      ).to.be.revertedWithCustomError(spin, 'RoundPaused')
    })

    it('Should not be able to withdraw an entry from the current round after round is paused', async () => {
      await expect(
        spin
          .connect(userSigners[1])
          .withdrawEntry(await spin.roundIdCounter(), userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'RoundNotResolvedYet')
    })

    it('Should not be able to submit a new entry after round is paused, does not matter if they have already submitted an entry', async () => {
      await expect(
        spin.connect(signers.user).submitEntry([await spin.encodeSide(0, 0)], [amount])
      ).to.be.revertedWithCustomError(spin, 'RoundPaused')
    })

    it('Should emit correct `roundId` and `roundResult`', async () => {
      const roundIdBefore = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(350)
      const resolveRoundReceipt = await resolveRoundTx.wait()

      const roundIdAfter = await spin.roundIdCounter()

      const resolveEvent = resolveRoundReceipt.events?.filter(
        (event) => event.event === 'RoundResolved'
      )[0].args

      expect(resolveEvent!.roundId).to.be.equal(roundIdBefore)
      expect(resolveEvent!.roundId.add(1)).to.be.equal(roundIdAfter)
      expect(resolveEvent!.roundResult.toNumber()).to.be.equal(350)
    })

    it('Should not resolve if requested randomNumber inside the same block as resolvement', async () => {
      const resolveRound = await spin
        .connect(signers.resolver)
        .resolveKeccak(requestEvent.requestId)
      await resolveRound.wait()

      await hre.network.provider.send('evm_setAutomine', [false])
      await hre.network.provider.send('evm_setIntervalMining', [0])

      const ownerRequestCount = await spin.addressToRequestCount(owner)
      const expectedRequestId = await spin.simulateRequestId(ownerRequestCount)
      // const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      // const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      // requestEvent = pauseReceipt.events?.filter(
      //   (event) => event.event === 'RequestedRandomNumberForRound'
      // )[0].args
      // expect(expectedRequestId.toString()).to.be.equal(requestEvent.requestId)
      const roundIdBefore = await spin.roundIdCounter()

      await spin.pauseRoundAndRequestRandomNumber()
      await spin.connect(signers.resolver).resolveKeccak(expectedRequestId)

      await hre.network.provider.send('evm_mine')
      const roundIdAfter = await spin.roundIdCounter()
      expect(roundIdBefore).to.be.equal(roundIdAfter)
      await hre.network.provider.send('evm_setAutomine', [true])
    })
  })

  describe('RandomNumberFailure', () => {
    const amount = toEth('1000')
    let requestEvent: any

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 5)], [amount])
      await submitEntryTx1.wait()

      const pauseRoundAndRequestRandomNumberTx = await spin.pauseRoundAndRequestRandomNumber()
      const pauseReceipt = await pauseRoundAndRequestRandomNumberTx.wait()
      requestEvent = pauseReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args
    })

    it('Should not be callable before 200 blocks', async () => {
      await expect(spin.randomNumberFailure()).to.be.revertedWithCustomError(spin, 'TooEarlyToFail')
    })

    it('Should mark roundId as failed', async () => {
      await mine(200)

      const roundId = await spin.roundIdCounter()
      const failureTx = await spin.randomNumberFailure()
      await failureTx.wait()

      const isFailed = await spin.roundIdToIsFailed(roundId)
      expect(isFailed).to.be.true
    })

    it('Should unpause round', async () => {
      await mine(200)

      const failureTx = await spin.randomNumberFailure()
      await failureTx.wait()

      const isPaused = await spin.isRoundPaused()
      expect(isPaused).to.be.false
    })

    it('Should emit `IsRoundPausedUpdate`', async () => {
      await mine(200)

      await expect(spin.randomNumberFailure()).to.emit(spin, 'IsRoundPausedUpdate')
    })

    it('Should emit `RoundFailed`', async () => {
      await mine(200)

      await expect(spin.randomNumberFailure()).to.emit(spin, 'RoundFailed')
    })
  })

  describe('Claim', async () => {
    const amount = toEth('1000')
    const complexEntrySide0 = await spin.encodeSide(0, 1)
    const complexEntrySide1 = await spin.encodeSide(1, 7)
    const complexEntrySide2 = await spin.encodeSide(2, 25)
    const complexEntryAmount0 = toEth('1000')
    const complexEntryAmount1 = toEth('2000')
    const complexEntryAmount2 = toEth('10000')

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()
      const sendFareTx3 = await fare.transfer(userSigners[2].address, toEth('20000'))
      await sendFareTx3.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx1.wait()
      const submitComplexEntryTx = await spin
        .connect(userSigners[2])
        .submitEntry(
          [complexEntrySide0, complexEntrySide1, complexEntrySide2],
          [complexEntryAmount0, complexEntryAmount1, complexEntryAmount2]
        )
      await submitComplexEntryTx.wait()

      const pauseTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()
    })

    it('Should not be able to claim for the current round', async () => {
      await expect(
        spin.connect(userSigners[0]).claim(await spin.roundIdCounter(), userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'RoundNotResolvedYet')
    })

    it('Should not be able to claim for future rounds', async () => {
      await expect(
        spin
          .connect(userSigners[0])
          .claim((await spin.roundIdCounter()).add(10), userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'RoundNotResolvedYet')
    })

    it('Someone else can claim for someone', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(103)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)

      const claimTx = await spin.connect(userSigners[1]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)

      expect(user0BalanceAfterClaim.gt(user0BalanceBeforeClaim)).to.be.true
    })

    it('Reward calculations are correct', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(101)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(
        user0BalanceBeforeClaim.add(calculateUserRewardsWithPPV(amount, oneEther.mul(2), ppv))
      ).to.be.equal(user0BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Reward calculations are correct for multiple sides and amounts for single entry, when user wins in total', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(325)
      await resolveRoundTx.wait()

      const user2BalanceBeforeClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[2].address)
      await claimTx.wait()

      const user2BalanceAfterClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(
        user2BalanceBeforeClaim.add(complexEntryAmount0.mul(2).add(complexEntryAmount2).mul(100))
      ).to.be.equal(user2BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Reward calculations are correct for multiple sides and amounts for single entry, when user loses in total', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(231)
      await resolveRoundTx.wait()

      const user2BalanceBeforeClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[2].address)
      await claimTx.wait()

      const user2BalanceAfterClaim = await fare.balanceOf(userSigners[2].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(user2BalanceBeforeClaim.add(complexEntryAmount0.mul(2))).to.be.equal(
        user2BalanceAfterClaim
      )
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Claims an entry that did not win', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(100)
      await resolveRoundTx.wait()

      const user0BalanceBeforeClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBeforeClaim = await await fare.balanceOf(host)
      const protocolBalanceBeforeClaim = await fare.balanceOf(protocol)

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const user0BalanceAfterClaim = await fare.balanceOf(userSigners[0].address)
      const hostBalanceAfterClaim = await fare.balanceOf(host)
      const protocolBalanceAfterClaim = await fare.balanceOf(protocol)

      expect(user0BalanceBeforeClaim).to.be.equal(user0BalanceAfterClaim)
      expect(hostBalanceBeforeClaim).to.be.equal(hostBalanceAfterClaim)
      expect(protocolBalanceBeforeClaim).to.be.equal(protocolBalanceAfterClaim)
    })

    it('Cannot claim twice for the same entry', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(103)
      await resolveRoundTx.wait()

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      await expect(
        spin.connect(userSigners[3]).claim(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'EntryDoesNotExistForTheRound')
    })

    it('Entry data should be deleted after claimed', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(103)
      await resolveRoundTx.wait()

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      await claimTx.wait()

      const entryData = await spin.getEntryOfUserForRound(userSigners[0].address, roundId)
      expect(entryData.amounts.length).to.be.equal(0)
      expect(entryData.sides.length).to.be.equal(0)
    })

    it('Should emit `EntriesClaimed` event', async () => {
      const roundId = await spin.roundIdCounter()

      const resolveRoundTx = await spin.mockResolveRound(103)
      await resolveRoundTx.wait()

      const claimTx = await spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      const claimReceipt = await claimTx.wait()

      // Get hash of the event signature (will be the first topic of the emitted event)
      const hashOfEntriesClaimedEventSignature = ethers.utils.id(
        'EntriesClaimed(address,uint256[],uint256[])'
      )
      // Get our specific event out of all the events emitted
      const emittedEntriesClaimedEvent = claimReceipt.logs.filter(
        (log) => log.topics[0] === hashOfEntriesClaimedEventSignature
      )[0]
      const iface = new ethers.utils.Interface(FareSpinV2Mock__factory.abi)
      const entriesClaimedData = iface.parseLog(emittedEntriesClaimedEvent)
      expect(entriesClaimedData.args.roundIds[0].toString()).to.be.equal('0')
      expect(entriesClaimedData.args.userRewards[0]._isBigNumber).to.be.true
    })

    it('Should not be able to claim for a failed round', async () => {
      const roundId = await spin.roundIdCounter()
      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      await expect(
        spin.connect(userSigners[4]).claim(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'CannotClaimFromAFailedRound')
    })
  })

  describe('BatchClaim', () => {
    // Will win 1st, 3rd, 5th round
    // Each round should be for different `mode`
    // Will lose 2nd, 4th round

    const amount = toEth('1000')
    const amount0 = amount
    const amount1 = amount.mul(2)
    const amount2 = amount.mul(3)
    const amount3 = amount.mul(4)
    const amount4 = amount.mul(2)

    let roundId0: number
    let roundId1: number
    let roundId2: number
    let roundId3: number
    let roundId4: number

    const user0Side0 = [0, 0]
    const user0Side1 = [0, 1]
    const user0Side2 = [1, 6]
    const user0Side3 = [1, 3]
    const user0Side4 = [2, 64]

    const roundResult0 = 10
    const roundResult1 = 20
    const roundResult2 = 16
    const roundResult3 = 12
    const roundResult4 = 64

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx0 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 0)], [amount0])
      await submitEntryTx0.wait()

      const pauseTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      roundId0 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx0 = await spin.mockResolveRound(roundResult0)
      await resolveRoundTx0.wait()

      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 1)], [amount1])
      await submitEntryTx1.wait()

      const pauseTx1 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx1.wait()

      roundId1 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx1 = await spin.mockResolveRound(roundResult1)
      await resolveRoundTx1.wait()

      const submitEntryTx2 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 6)], [amount2])
      await submitEntryTx2.wait()

      const pauseTx2 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx2.wait()

      roundId2 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx2 = await spin.mockResolveRound(roundResult2)
      await resolveRoundTx2.wait()

      const submitEntryTx3 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 3)], [amount3])
      await submitEntryTx3.wait()

      const pauseTx3 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx3.wait()

      roundId3 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx3 = await spin.mockResolveRound(roundResult3)
      await resolveRoundTx3.wait()

      const submitEntryTx4 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(2, 64)], [amount4])
      await submitEntryTx4.wait()

      const pauseTx4 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx4.wait()

      roundId4 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx4 = await spin.mockResolveRound(roundResult4)
      await resolveRoundTx4.wait()
    })

    it('Should not work with empty array of roundIds', async () => {
      await expect(
        spin.connect(userSigners[2]).batchClaim([], userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'CannotClaimForZeroRounds')
    })

    it('Reward calculations are correct', async () => {
      const user0BalanceBefore = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx = await spin
        .connect(userSigners[3])
        .batchClaim(
          [roundId0, roundId1, roundId2, roundId2 + 1000, roundId4, roundId3],
          userSigners[0].address
        )
      await batchClaimTx.wait()

      const user0BalanceAfter = await fare.balanceOf(userSigners[0].address)

      expect(
        user0BalanceBefore
          .add(calculateUserRewardsWithPPV(amount0, oneEther.mul(2), ppv))
          .add(calculateUserRewardsWithPPV(amount2, oneEther.mul(10), ppv))
          .add(calculateUserRewardsWithPPV(amount4, oneEther.mul(100), ppv))
      ).to.be.equal(user0BalanceAfter)
    })

    it('Nothing happens if you try to claim already claimed ones', async () => {
      const user0BalanceBefore = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx = await spin
        .connect(userSigners[3])
        .batchClaim([roundId0], userSigners[0].address)
      await batchClaimTx.wait()

      const user0BalanceAfter = await fare.balanceOf(userSigners[0].address)

      expect(
        user0BalanceBefore.add(calculateUserRewardsWithPPV(amount0, oneEther.mul(2), ppv))
      ).to.be.equal(user0BalanceAfter)

      const user0BalanceAfterExtraClaim = await fare.balanceOf(userSigners[0].address)

      const batchClaimTx1 = await spin
        .connect(userSigners[3])
        .batchClaim([roundId0], userSigners[0].address)

      await batchClaimTx1.wait()

      expect(user0BalanceAfter).to.be.equal(user0BalanceAfterExtraClaim)
    })

    it('Should emit `EntriesClaimed` event', async () => {
      const batchClaimTx = await spin
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
      const iface = new ethers.utils.Interface(FareSpinV2Mock__factory.abi)
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
      ).to.be.equal(
        calculateUserRewardsWithPPV(amount0, oneEther.mul(2), ppv).add(
          calculateUserRewardsWithPPV(amount2, oneEther.mul(10), ppv)
        )
      )
    })

    it('Each entry data is deleted', async () => {
      const batchClaimTx = await spin
        .connect(userSigners[3])
        .batchClaim([roundId0, roundId1, roundId2], userSigners[0].address)
      await batchClaimTx.wait()

      const entry0 = await spin.getEntryOfUserForRound(userSigners[0].address, roundId0)
      const entry1 = await spin.getEntryOfUserForRound(userSigners[0].address, roundId1)
      const entry2 = await spin.getEntryOfUserForRound(userSigners[0].address, roundId2)

      expect(entry0.amounts.length === 0 && entry0.sides.length === 0).to.be.true
      expect(entry1.amounts.length === 0 && entry1.sides.length === 0).to.be.true
      expect(entry2.amounts.length === 0 && entry2.sides.length === 0).to.be.true
    })
  })

  describe('WithdrawEntry', () => {
    const amount = toEth('1000')

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx1.wait()
      const submitEntryTx2 = await spin
        .connect(userSigners[1])
        .submitEntry([await spin.encodeSide(0, 1), await spin.encodeSide(1, 5)], [amount, amount])
      await submitEntryTx2.wait()
    })

    it('Cannot withdraw from current round', async () => {
      const roundId = await spin.roundIdCounter()
      await expect(
        spin.withdrawEntry(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'RoundNotResolvedYet')
    })

    it('Cannot withdraw from a future round', async () => {
      const roundId = await spin.roundIdCounter()
      await expect(
        spin.withdrawEntry(roundId.add(1), userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'RoundNotResolvedYet')
    })

    it('Cannot withdraw from a successfully resolved round', async () => {
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      const requestReceipt = await requestTx.wait()
      const requestEvent = requestReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args as any

      const resolveTx = await spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      expect(spin.withdrawEntry(roundId, userSigners[0].address)).to.be.revertedWithCustomError(
        spin,
        'CannotWithdrawFromASuccessfulRound'
      )
    })

    it('Cannot withdraw if already claimed', async () => {
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      const requestReceipt = await requestTx.wait()
      const requestEvent = requestReceipt.events?.filter(
        (event) => event.event === 'RequestedRandomNumberForRound'
      )[0].args as any

      const resolveTx = await spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
      await resolveTx.wait()

      const claimTx = await spin.claim(roundId, userSigners[0].address)
      await claimTx.wait()

      expect(spin.withdrawEntry(roundId, userSigners[0].address)).to.be.revertedWithCustomError(
        spin,
        'CannotWithdrawFromASuccessfulRound'
      )
    })

    it('Cannot withdraw the same entry twice', async () => {
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      const withdrawTx = await spin.withdrawEntry(roundId, userSigners[0].address)
      await withdrawTx.wait()

      await expect(
        spin.withdrawEntry(roundId, userSigners[0].address)
      ).to.be.revertedWithCustomError(spin, 'EntryDoesNotExistForTheRound')
    })

    it('Correctly mints and burns fare for user, host and protocol', async () => {
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      const hostRewardsPercentage = await spin.HOST_REWARDS_PERCENTAGE()
      const protocolRewardsPercentage = await spin.PROTOCOL_REWARDS_PERCENTAGE()

      const userBalanceBefore = await fare.balanceOf(userSigners[0].address)
      const hostBalanceBefore = await fare.balanceOf(host)
      const protocolBalanceBefore = await fare.balanceOf(protocol)

      const withdrawTx = await spin.withdrawEntry(roundId, userSigners[0].address)
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
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      const hostRewardsPercentage = await spin.HOST_REWARDS_PERCENTAGE()
      const protocolRewardsPercentage = await spin.PROTOCOL_REWARDS_PERCENTAGE()

      const userBalanceBefore = await fare.balanceOf(userSigners[1].address)
      const hostBalanceBefore = await fare.balanceOf(host)
      const protocolBalanceBefore = await fare.balanceOf(protocol)

      const withdrawTx = await spin.withdrawEntry(roundId, userSigners[1].address)
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
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      const withdrawTx = await spin.withdrawEntry(roundId, userSigners[0].address)
      await withdrawTx.wait()

      const entry = await spin.getEntryOfUserForRound(userSigners[0].address, roundId)
      expect(entry.amounts.length).to.be.equal(0)
      expect(entry.sides.length).to.be.equal(0)
    })
    // Should emit EntryWithdrew
    it('Should emit EntryWithdrew', async () => {
      const roundId = await spin.roundIdCounter()
      const requestTx = await spin.pauseRoundAndRequestRandomNumber()
      await requestTx.wait()

      await mine(200)

      const failTx = await spin.randomNumberFailure()
      await failTx.wait()

      await expect(spin.withdrawEntry(roundId, userSigners[0].address)).to.emit(
        spin,
        'EntryWithdrew'
      )
    })
  })

  describe('FilterWinningRounds', () => {
    // Will win 1st, 3rd, 5th round
    // Each round should be for different `mode`
    // Will lose 2nd, 4th round

    const amount = toEth('1000')
    const amount0 = amount
    const amount1 = amount.mul(2)
    const amount2 = amount.mul(3)
    const amount3 = amount.mul(4)
    const amount4 = amount.mul(2)

    let roundId0: number
    let roundId1: number
    let roundId2: number
    let roundId3: number
    let roundId4: number
    let roundId5: number

    const user0Side0 = [0, 0]
    const user0Side1 = [0, 1]
    const user0Side2 = [1, 6]
    const user0Side3 = [1, 3]
    const user0Side4 = [2, 64]
    const user0Side5 = [
      [0, 1],
      [1, 7],
      [2, 31],
    ]

    const roundResult0 = 10
    const roundResult1 = 20
    const roundResult2 = 16
    const roundResult3 = 12
    const roundResult4 = 64
    const roundResult5 = 109

    beforeEach(async () => {
      await fare.connect(userSigners[0]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[1]).setAllowContractMintBurn(spin.address, true)
      await fare.connect(userSigners[2]).setAllowContractMintBurn(spin.address, true)

      const sendFareTx = await fare.transfer(user, toEth('20000'))
      await sendFareTx.wait()
      const sendFareTx1 = await fare.transfer(userSigners[0].address, toEth('20000'))
      await sendFareTx1.wait()
      const sendFareTx2 = await fare.transfer(userSigners[1].address, toEth('20000'))
      await sendFareTx2.wait()

      const submitEntryTx = await spin
        .connect(signers.user)
        .submitEntry([await spin.encodeSide(0, 1)], [amount])
      await submitEntryTx.wait()
      const submitEntryTx0 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 0)], [amount0])
      await submitEntryTx0.wait()

      const pauseTx = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx.wait()

      roundId0 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx0 = await spin.mockResolveRound(roundResult0)
      await resolveRoundTx0.wait()

      const submitEntryTx1 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(0, 1)], [amount1])
      await submitEntryTx1.wait()

      const pauseTx1 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx1.wait()

      roundId1 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx1 = await spin.mockResolveRound(roundResult1)
      await resolveRoundTx1.wait()

      const submitEntryTx2 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 6)], [amount2])
      await submitEntryTx2.wait()

      const pauseTx2 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx2.wait()

      roundId2 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx2 = await spin.mockResolveRound(roundResult2)
      await resolveRoundTx2.wait()

      const submitEntryTx3 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(1, 3)], [amount3])
      await submitEntryTx3.wait()

      const pauseTx3 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx3.wait()

      roundId3 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx3 = await spin.mockResolveRound(roundResult3)
      await resolveRoundTx3.wait()

      const submitEntryTx4 = await spin
        .connect(userSigners[0])
        .submitEntry([await spin.encodeSide(2, 64)], [amount4])
      await submitEntryTx4.wait()

      const pauseTx4 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx4.wait()

      roundId4 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx4 = await spin.mockResolveRound(roundResult4)
      await resolveRoundTx4.wait()

      const submitEntryTx5 = await spin
        .connect(userSigners[0])
        .submitEntry(
          [await spin.encodeSide(0, 1), await spin.encodeSide(1, 7), await spin.encodeSide(2, 31)],
          [amount, amount, amount]
        )
      await submitEntryTx5.wait()

      const pauseTx5 = await spin.pauseRoundAndRequestRandomNumber()
      await pauseTx5.wait()

      roundId5 = (await spin.roundIdCounter()).toNumber()
      const resolveRoundTx5 = await spin.mockResolveRound(roundResult5)
      await resolveRoundTx5.wait()
    })

    it('Should only return winning rounds', async () => {
      const winningRoundIds = await spin.filterWinningRounds(
        [roundId0, roundId1, roundId2, roundId2 + 1000, roundId4, roundId3, roundId5],
        userSigners[0].address
      )
      expect(winningRoundIds.map((roundId) => roundId.toNumber())).to.be.eql([
        roundId0,
        roundId2,
        roundId4,
        roundId5,
        0,
        0,
        0,
      ])
    })
  })

  describe('Requesters', () => {
    const amount = toEth('1000')
    describe('Keccak', () => {
      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(1, 8)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)).to.emit(
          spin,
          'RoundResolved'
        )
      })

      it('Only keccakResolver should be ablo to resolve', async () => {
        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(2, 93)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(spin.resolveKeccak(requestEvent.requestId)).to.be.revertedWithCustomError(
          spin,
          'NotKeccakResolver'
        )
      })

      it('Cannot resolve batch requestIds for more than 20 requestIds', async () => {
        await expect(
          spin.connect(signers.resolver).batchResolveKeccak(Array(21).fill(1))
        ).to.be.revertedWithCustomError(spin, 'ExceedsBatchResolveLimit')
      })

      it('Only keccakResolver can call `resolveKeccak` and resolveRandomNumbers', async () => {
        await expect(spin.connect(signers.user).resolveKeccak(1)).to.be.revertedWithCustomError(
          spin,
          'NotKeccakResolver'
        )
      })

      it('Should not be able to resolve for a requestId that used VRF to request', async () => {
        const setVRFRequester = await spin.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(2, 76)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(
          spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
        ).to.be.revertedWithCustomError(spin, 'RequestIdNotInProgress')
      })

      it('Should not be able to resolve for a requestId that used VRF to request (even if currently we are using KeccakRequester)', async () => {
        const setVRFRequester = await spin.setActiveRequesterType(1)
        await setVRFRequester.wait()

        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(1, 6)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        const setKeccakRequester = await spin.setActiveRequesterType(0)
        await setKeccakRequester.wait()

        await expect(
          spin.connect(signers.resolver).resolveKeccak(requestEvent.requestId)
        ).to.be.revertedWithCustomError(spin, 'RequestIdNotInProgress')
      })

      it('Cannot call the `resolveRandomNumbersWrapper()` externally', async () => {
        await expect(spin.resolveRandomNumbersWrapper(1, [1])).to.be.revertedWithCustomError(
          spin,
          'InternalFunction'
        )

        await expect(
          spin.connect(signers.resolver).resolveRandomNumbersWrapper(1, [1])
        ).to.be.revertedWithCustomError(spin, 'InternalFunction')
      })

      it('Test `setBatchResolveLimit()`', async () => {
        const setBatchResolveLimitTx = await spin.setBatchResolveLimit(1)
        await setBatchResolveLimitTx.wait()

        await expect(
          spin.connect(signers.resolver).batchResolveKeccak([1, 2])
        ).to.be.revertedWithCustomError(spin, 'ExceedsBatchResolveLimit')

        const setBatchResolveLimitTx1 = await spin.setBatchResolveLimit(2)
        await setBatchResolveLimitTx1.wait()

        const resolveTx = await spin.connect(signers.resolver).batchResolveKeccak([1, 2])
        await resolveTx.wait()
      })
    })

    describe('VRF', () => {
      beforeEach(async () => {
        const setVRFRequester = await spin.setActiveRequesterType(1)
        await setVRFRequester.wait()
      })

      it('Should be able to request a random number', async () => {
        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(0, 0)], [amount])
        await submitEntryTx.wait()

        await expect(spin.pauseRoundAndRequestRandomNumber()).to.emit(
          vrfCoordinator,
          'RandomWordsRequested'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(0, 1)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
        const requestReceipt = await requestTx.wait()
        const requestEvent = requestReceipt.events?.filter(
          (event) => event.event === 'RequestedRandomNumberForRound'
        )[0].args as any

        await expect(
          vrfCoordinator.customFulfillRandomWords(requestEvent.requestId, spin.address, [1])
        ).to.emit(spin, 'RoundResolved')
      })
    })

    describe('QRNG', () => {
      beforeEach(async () => {
        const setQRNGRequester = await spin.setActiveRequesterType(2)
        await setQRNGRequester.wait()

        const setQRNGRequestParamsTx = await spin.setQRNGRequestParameters(
          resolver,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          resolver
        )
        await setQRNGRequestParamsTx.wait()
      })

      it('Should be able to request a random number', async () => {
        const setQRNGRequestParamsTx = await spin.setQRNGRequestParameters(
          rewards,
          ethers.utils.keccak256(ethers.utils.hashMessage('something')),
          owner
        )
        await setQRNGRequestParamsTx.wait()

        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(1, 3)], [amount])
        await submitEntryTx.wait()

        await expect(spin.pauseRoundAndRequestRandomNumber()).to.emit(
          airnodeRrpMock,
          'MadeFullRequest'
        )
      })

      it('Should request a random number and receive a result', async () => {
        const submitEntryTx = await spin.submitEntry([await spin.encodeSide(2, 3)], [amount])
        await submitEntryTx.wait()

        const requestTx = await spin.pauseRoundAndRequestRandomNumber()
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
            spin.address,
            spin.address,
            // Function selector of "resolveQRNG": 21d8b837  =>  resolveQRNG(bytes32,bytes)
            '0x21d8b837',
            params,
            '0x0000'
          )
        ).to.emit(spin, 'RoundResolved')
      })
    })
  })
})
