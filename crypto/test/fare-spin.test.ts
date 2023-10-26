// import * as hre from 'hardhat'
// import { expect, assert } from 'chai'

// import type { FareSpin, FareToken } from '../typechain-types'
// import {
//   seedContractModes,
//   createContractModeParams,
//   createBatchEntry,
//   objectify,
//   arrayify,
// } from './utils/test-helpers'
// import { INITIAL_SUPPLY, ContractModes } from './utils/test-constants'
// // @NOTE
// // import { keccak256 } from 'ethers/lib/utils'

// const { ethers, deployments, getNamedAccounts, getUnnamedAccounts } = hre

// const {
//   BigNumber: BN,
//   utils: { Logger, parseEther: toEth, parseUnits },
// } = ethers

// const { utils } = ethers

// const decimalBase18 = toEth('1')

// // @NOTE
// // const abiCoder = new ethers.utils.AbiCoder()

// Logger.setLogLevel(Logger.levels.ERROR)

// describe('Deployment', async () => {
//   const zeroAddress = ethers.constants.AddressZero
//   let spin: FareSpin
//   let fare: FareToken
//   let owner: string
//   let rewards: string

//   beforeEach(async () => {
//     const accounts = await getNamedAccounts()
//     owner = accounts.owner
//     rewards = accounts.rewards

//     await deployments.fixture(['fare', 'spin-testnet'])
//     fare = (await ethers.getContract('FareToken')) as FareToken
//     spin = (await ethers.getContract('FareSpin')) as FareSpin
//     await fare.setWhitelistAddress(spin.address, true)
//   })

//   it('Successful FareSpin Deployment', async () => {
//     const FareSpinFactory = await ethers.getContractFactory('FareSpin')
//     const fareSpinDeployed = await FareSpinFactory.deploy(fare.address, rewards)

//     expect(await fareSpinDeployed.owner()).to.be.equal(owner)
//   })

//   it('Invalid _fareTokenAddress should fail deployment', async () => {
//     const FareSpinFactory = await ethers.getContractFactory('FareSpin')
//     await expect(FareSpinFactory.deploy(zeroAddress, rewards)).to.be.revertedWith(
//       '_fareToken is invalid'
//     )
//   })

//   it('Invalid _rewardsAddress should fail deployment', async () => {
//     const FareSpinFactory = await ethers.getContractFactory('FareSpin')
//     await expect(FareSpinFactory.deploy(fare.address, zeroAddress)).to.be.revertedWith(
//       '_rewardsAddress is invalid'
//     )
//   })
// })

// describe('FareSpin', () => {
//   const [twoX, tenX, hundoX] = ContractModes
//   const [twoXParams, tenXParams, hundoXParams] = createContractModeParams()
//   let spin: FareSpin
//   let fare: FareToken
//   let owner: string
//   let dev: string
//   let rewards: string
//   let users: string[]

//   beforeEach(async () => {
//     const accounts = await getNamedAccounts()
//     users = await getUnnamedAccounts()
//     owner = accounts.owner
//     rewards = accounts.rewards
//     dev = accounts.dev

//     await deployments.fixture(['fare', 'spin-testnet'])
//     fare = (await ethers.getContract('FareToken')) as FareToken
//     spin = (await ethers.getContract('FareSpin')) as FareSpin
//     await fare.setWhitelistAddress(spin.address, true)
//   })

//   describe('Constructor', () => {
//     it('Fare totalSupply should be 50 billion', async () => {
//       const balance = await fare.totalSupply()
//       expect(balance).to.equal(INITIAL_SUPPLY)
//     })

//     it('FareSpin has the correct FareToken address', async () => {
//       const spinFareToken = await spin.getFareTokenAddress()
//       expect(spinFareToken).to.equal(fare.address)
//     })

//     it('FareToken and FareSpin owner address is the same', async () => {
//       const fareSignerAddress = await fare.owner()
//       const spinSignerAddress = await spin.owner()
//       expect(fareSignerAddress).to.equal(spinSignerAddress)
//     })

//     it('FareSpin rewards address is correct', async () => {
//       const actual = await spin.rewardsAddress()
//       expect(actual).to.equal(rewards)
//     })

//     it('FareSpin rewards balance is 0 FARE', async () => {
//       const amount = await fare.balanceOf(rewards)
//       expect(amount).to.equal(BN.from(0))
//     })

//     it('FareSpin rewards mint percentage is 1% (default)', async () => {
//       const rewardsMintPercentage = await spin.rewardsMint()
//       const expectRewardsMintPercentage = parseUnits('1', 16)
//       expect(rewardsMintPercentage).to.equal(expectRewardsMintPercentage)
//     })
//   })

//   describe('Ownership tests', () => {
//     it('Check if current owner is correct', async () => {
//       const ownedBy = await spin.owner()
//       expect(owner).to.equal(ownedBy)
//     })
//   })

//   describe('Transfer token', () => {
//     it('Transfer FARE to dev address', async () => {
//       const amount = toEth('100000')
//       await fare.transfer(dev, amount)
//       expect(await fare.balanceOf(dev)).to.equal(amount)
//       expect(await fare.balanceOf(owner)).to.equal(INITIAL_SUPPLY.sub(amount))
//     })
//   })

//   describe('Setup FareSpin', () => {
//     it('Check if spin contract is a whitelist address', async () => {
//       expect(await fare.contractWhitelist(spin.address)).to.equal(true)
//     })

//     it('Add a user address to the whitelist', async () => {
//       await fare.setWhitelistAddress(users[0], true)
//       expect(await fare.contractWhitelist(users[0])).to.equal(true)
//     })

//     it('Ensure rewards wallet address can accept FARE', async () => {
//       const transferAmount = toEth('10000')
//       await fare.transfer(rewards, transferAmount)
//       const balance = await fare.balanceOf(rewards)
//       expect(balance).to.equal(transferAmount)
//     })

//     it('Check non-existant contract modes', async () => {
//       const expectedReturn = [...Array(7).fill(BN.from(0)), false]
//       const actualReturn = []

//       // @NOTE previously called contractModes(0) which caused test to fail,
//       // so contractModes(ContractModes.length) calls a ContractModes index outside of default
//       const modes = await spin.contractModes(ContractModes.length)

//       for (let el of modes) {
//         actualReturn.push(el)
//       }

//       assert.deepEqual(
//         actualReturn,
//         expectedReturn,
//         'Error: spin contract setContractMode() not functioning correctly'
//       )
//     })
//   })

//   describe('Basic Setters', () => {
//     it('set FareToken address', async () => {
//       await spin.setFareToken(users[0])
//       const newFareToken = await spin.getFareTokenAddress()
//       expect(newFareToken).to.equal(users[0])
//     })

//     it('Ensure non-owner address calling onlyOwner function is reverted', async () => {
//       const [userSigner] = await ethers.getUnnamedSigners()
//       const spinUser = spin.connect(userSigner)
//       await expect(spinUser.setFareToken(users[0])).to.be.revertedWith('Caller is not the owner')
//     })

//     it('set FareToken address to 0x0 should fail', async () => {
//       await expect(spin.setFareToken(ethers.constants.AddressZero)).to.be.revertedWith(
//         '_fareTokenAddress is invalid'
//       )
//     })

//     it('Set rewards address', async () => {
//       await spin.setRewardsAddress(rewards)
//       const newRewardsAddress = await spin.rewardsAddress()
//       expect(newRewardsAddress).to.equal(rewards)
//     })

//     it('Set rewards address to 0x0 should failt', async () => {
//       await expect(spin.setRewardsAddress(ethers.constants.AddressZero)).to.be.revertedWith(
//         '_rewardsAddress is invalid'
//       )
//     })

//     it('Set rewards mint percentage to 8%', async () => {
//       const newRewardsMint = parseUnits('8', 16)
//       await spin.setRewardsMint(newRewardsMint)

//       const actualAmount = await spin.rewardsMint()
//       expect(actualAmount).to.equal(newRewardsMint)
//     })

//     it('Set rewards mint percentage to 15% should fail', async () => {
//       const newRewardsMint = parseUnits('15', 16)
//       await expect(spin.setRewardsMint(newRewardsMint)).to.be.revertedWith(
//         'Rewards mint % must be <= 10%'
//       )
//     })
//   })

//   describe('ContractMode Setters', () => {
//     it('Set 2x contract mode', async () => {
//       await spin.setContractMode(...twoXParams)
//       const twoXGM = objectify(await spin.contractModes(twoX.id))

//       assert.deepEqual(
//         twoXGM,
//         twoX,
//         'Error: spin contract setContractMode() not functioning correctly'
//       )
//     })

//     it('Set 2x and 10x contract mode', async () => {
//       await spin.setContractMode(...twoXParams)
//       await spin.setContractMode(...tenXParams)
//       const twoXGM = objectify(await spin.contractModes(twoX.id))
//       const tenXGM = objectify(await spin.contractModes(tenX.id))

//       assert.deepEqual(
//         [twoXGM, tenXGM],
//         [twoX, tenXGM],
//         'Error: spin contract setContractMode() not functioning correctly'
//       )
//     })

//     it('Set 2x, 10x, and 100x contract mode', async () => {
//       await spin.setContractMode(...twoXParams)
//       await spin.setContractMode(...tenXParams)
//       await spin.setContractMode(...hundoXParams)
//       const twoXGM = objectify(await spin.contractModes(twoX.id))
//       const tenXGM = objectify(await spin.contractModes(tenX.id))
//       const hundoXGM = objectify(await spin.contractModes(hundoX.id))

//       assert.deepEqual(
//         [twoXGM, tenXGM, hundoXGM],
//         [twoX, tenX, hundoX],
//         'Error: spin contract setContractMode() not functioning correctly'
//       )
//     })

//     it('Set contract mode with invalid min and max amount', async () => {
//       const [incorrectContractMode] = createContractModeParams([
//         { minAmount: toEth('9000'), maxAmount: toEth('1000') },
//       ])

//       await expect(spin.setContractMode(...incorrectContractMode)).to.be.revertedWith(
//         'minAmount greater than maxAmount'
//       )
//     })

//     it('Set contract mode with invalid entryLimit', async () => {
//       const [incorrectContractMode] = createContractModeParams([
//         { entryLimit: twoX.cardinality.add(1) },
//       ])

//       await expect(spin.setContractMode(...incorrectContractMode)).to.be.revertedWith(
//         'Limit greater than cardinality'
//       )
//     })

//     it('Set min and max amount on existing contract mode', async () => {
//       const minAmount = toEth('1000')
//       const maxAmount = toEth('25000')

//       await spin.setContractMode(...twoXParams)
//       let twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.minAmount).to.be.equal(BN.from('0'))
//       expect(twoXGM.maxAmount).to.be.equal(BN.from('0'))

//       await spin.setContractModeMinMax(twoX.id, minAmount, maxAmount)
//       twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.minAmount).to.be.equal(minAmount)
//       expect(twoXGM.maxAmount).to.be.equal(maxAmount)
//     })

//     it('Set min and max amount on invalid contract mode', async () => {
//       const minAmount = toEth('1000')
//       const maxAmount = toEth('25000')

//       await spin.setContractMode(...twoXParams)
//       let twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.minAmount).to.be.equal(BN.from('0'))
//       expect(twoXGM.maxAmount).to.be.equal(BN.from('0'))

//       await expect(spin.setContractModeMinMax(10, minAmount, maxAmount)).to.be.revertedWith(
//         'Invalid contract mode'
//       )
//     })

//     it('Set invalid min and max amount on existing contract mode', async () => {
//       const minAmount = toEth('25000')
//       const maxAmount = toEth('1000')

//       await spin.setContractMode(...twoXParams)
//       let twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.minAmount).to.be.equal(BN.from('0'))
//       expect(twoXGM.maxAmount).to.be.equal(BN.from('0'))

//       await expect(spin.setContractModeMinMax(twoX.id, minAmount, maxAmount)).to.be.revertedWith(
//         'minAmount greater than maxAmount'
//       )
//     })

//     it('Set active contract mode to inactive', async () => {
//       await spin.setContractMode(...twoXParams)

//       await spin.setContractModeIsActive(twoX.id, false)
//       const twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.isActive).to.be.equal(false)
//     })

//     it('Set active contract mode to inactive on invalid contract mode', async () => {
//       await expect(spin.setContractModeIsActive(10, false)).to.be.revertedWith(
//         'Invalid contract mode'
//       )
//     })

//     it('Set contract expected value floor on existing contract mode', async () => {
//       await spin.setContractMode(...twoXParams)

//       const newContractModeFloor = twoX.contractExpectedValueFloor.sub(1000)
//       await spin.setContractExpectedValueFloor(twoX.id, newContractModeFloor)
//       const twoXGM = objectify(await spin.contractModes(twoX.id))
//       expect(twoXGM.contractExpectedValueFloor).to.be.equal(newContractModeFloor)
//     })

//     it('Set invalid contract expected value floor on existing contract mode', async () => {
//       await spin.setContractMode(...twoXParams)

//       const contractExpectedValueCeiling = await spin.CONTRACT_EXPECTED_VALUE_CEILING()
//       await expect(
//         spin.setContractExpectedValueFloor(twoX.id, contractExpectedValueCeiling)
//       ).to.be.revertedWith('Floor must be less than ceiling')
//     })

//     it('Set contract expected value floor on invalid contract mode', async () => {
//       const contractExpectedValueCeiling = await spin.CONTRACT_EXPECTED_VALUE_CEILING()
//       await expect(
//         spin.setContractExpectedValueFloor(10, contractExpectedValueCeiling.sub(10))
//       ).to.be.revertedWith('Invalid contract mode')
//     })

//     it('Set contract entry limit on existing contract mode', async () => {
//       await spin.setContractMode(...twoXParams)

//       await spin.setContractModeEntryLimit(twoX.id, BN.from(2))
//       const mode = await spin.contractModes(twoX.id)
//       expect(mode.entryLimit).to.be.equal(BN.from(2))
//     })

//     it('Set invalid contract entry limit on existing contract mode', async () => {
//       await spin.setContractMode(...twoXParams)

//       await expect(
//         spin.setContractModeEntryLimit(twoX.id, twoX.cardinality.add(1))
//       ).to.be.revertedWith('entryLimit > cardinality')
//     })

//     it('Set invalid contract entry limit on existing contract mode', async () => {
//       await expect(spin.setContractModeEntryLimit(10, twoX.cardinality.add(1))).to.be.revertedWith(
//         'Invalid contract mode'
//       )
//     })
//   })

//   describe('Basic Getters', () => {
//     beforeEach(async () => {
//       await seedContractModes(spin)
//       // @NOTE if setContractMode() called here, getCurrentContractModeId() returns '7'
//     })

//     // @NOTE previously checked for '3', now check for '6'
//     it('getCurrentContractModeId()', async () => {
//       expect(await spin.getCurrentContractModeId()).to.equal(BN.from('6'))
//     })

//     it('getCurrentRoundId()', async () => {
//       expect(await spin.getCurrentRoundId()).to.equal(BN.from('0'))
//     })
//   })

//   describe('PlaceBatchEntry', () => {
//     const transferAmount = toEth('5000000')
//     const currentRoundId = BN.from(0)
//     let spinSigners: FareSpin[] = []
//     let fareSigners: FareToken[] = []
//     const randomHash = '0x85de14a1021a81cfaeb4a1e0284c967cb7df86f9df13dcc99783b3ab7a87b5b4'

//     beforeEach(async () => {
//       const rewardsSigner = await ethers.getNamedSigner('rewards')
//       const userSigners = await ethers.getUnnamedSigners()

//       fareSigners.push(
//         fare.connect(userSigners[0]),
//         fare.connect(userSigners[1]),
//         fare.connect(userSigners[2])
//       )

//       // @NOTE Allow mint/burn permission (FareToken -> FareSpinToken)
//       await fare.setAllowContractMintBurn(spin.address, true)
//       await fareSigners[0].setAllowContractMintBurn(spin.address, true)
//       await fareSigners[1].setAllowContractMintBurn(spin.address, true)
//       await fareSigners[2].setAllowContractMintBurn(spin.address, true)
//       await fare.connect(rewardsSigner).setAllowContractMintBurn(spin.address, true)

//       await fare.transfer(users[0], transferAmount)
//       await fare.transfer(users[1], transferAmount)
//       await fare.transfer(users[2], transferAmount)

//       spinSigners.push(
//         spin.connect(userSigners[0]),
//         spin.connect(userSigners[1]),
//         spin.connect(userSigners[2])
//       )

//       await seedContractModes(spin)
//     })

//     it('Ensure users and owner FARE balances are correct', async () => {
//       expect(await fare.balanceOf(users[0])).to.equal(transferAmount)
//       expect(await fare.balanceOf(users[1])).to.equal(transferAmount)
//       expect(await fare.balanceOf(users[2])).to.equal(transferAmount)
//       expect(await fare.balanceOf(owner)).to.equal(INITIAL_SUPPLY.sub(transferAmount.mul(3)))
//     })

//     it('Ensure contract modes were created', async () => {
//       expect((await spin.contractModes(twoX.id)).isActive).to.equal(true)
//       expect((await spin.contractModes(tenX.id)).isActive).to.equal(true)
//       expect((await spin.contractModes(hundoX.id)).isActive).to.equal(true)
//     })

//     describe('Start Spin Round', () => {
//       it("Ensure a batch entry cannot be placed when round isn't started", async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Round has not started yet.'
//         )
//       })

//       it('Start a new round should revert without a randomHash', async () => {
//         const invalidHash = utils.hexZeroPad(utils.hexlify(0), 32)

//         await expect(spin.startNewRound(invalidHash)).to.be.revertedWith('randomHash is required.')
//       })

//       it('Start a valid new round', async () => {
//         await spin.startNewRound(randomHash)
//         const setRandomHash = await spin.randomHashMap(0)
//         const round = await spin.rounds(0)
//         expect(setRandomHash).to.be.equal(randomHash)
//         expect(round.startedAt.gt(0))
//         expect(round.endedAt.eq(0))
//       })

//       it('Starting a new round when a round is already started should be reverted', async () => {
//         await spin.startNewRound(randomHash)
//         await expect(spin.startNewRound(randomHash)).to.be.revertedWith('Round already started.')
//       })
//     })

//     describe('2X ContractMode', () => {
//       beforeEach(async () => {
//         await spin.startNewRound(randomHash)
//       })

//       it('Place batch entry with single 2x entry', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         expect(batchEntry.totalEntryAmount).to.equal(toEth('1000'))
//       })

//       it('Place batch entry and ensure FARE is burned', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         expect(await fare.balanceOf(users[0])).to.equal(transferAmount.sub(toEth('1000')))
//         const rewardsBalance = await fare.balanceOf(rewards)
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(toEth('1000'))
//         )
//       })

//       it('Place batch entry with single 2x entry and ensure entryMap is valid', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         const entry = await spin.getEntryByIndex(currentRoundId, batchEntry.user, 0)

//         assert.deepEqual(
//           objectify(entry),
//           batchEntryParams[0],
//           'Error: spin contract entryMap is incorrect'
//         )
//       })

//       it('User placing more than one batch entry per round should be reverted', async () => {
//         const batchEntryParams1 = createBatchEntry([[1000, twoX.id, 0]])
//         const batchEntryParams2 = createBatchEntry([[5000, tenX.id, 3]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams1)
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams2)).to.be.revertedWith(
//           'Already entered in current round'
//         )
//       })

//       it('Place batch entry with invalid 2x pickedNumber', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 2]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Invalid picked number'
//         )
//       })

//       it('Place batch entry with 0 amount', async () => {
//         const batchEntryParams = createBatchEntry([[0, twoX.id, 0]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Amount cannot be zero'
//         )
//       })

//       it('Place batch entry on inactive 2x contract mode', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await spin.setContractModeIsActive(twoX.id, false)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode is not active'
//         )
//       })

//       it('Place batch entry with multiple of the same picked number', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, twoX.id, 0],
//           [1000, twoX.id, 0],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Duplicate pickedNumber by contract'
//         )
//       })

//       it('Place batch entry which is less than minAmount', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])

//         await spin.setContractModeMinMax(twoX.id, toEth('25000'), 0)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode min amount not met'
//         )
//       })

//       it('Place batch entry which exceeds maxAmount', async () => {
//         const batchEntryParams = createBatchEntry([[25000, twoX.id, 0]])

//         await spin.setContractModeMinMax(twoX.id, 0, toEth('1000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode max amount exceeded'
//         )
//       })
//     })

//     describe('10X ContractMode', () => {
//       beforeEach(async () => {
//         await spin.startNewRound(randomHash)
//       })

//       it('Place batch entry with single 10x entry', async () => {
//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 7]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         expect(batchEntry.totalEntryAmount).to.equal(toEth('1000'))
//         expect(batchEntry.user).to.equal(users[0])
//       })

//       it('Place batch entry and ensure FARE is burned', async () => {
//         const batchEntryParams = createBatchEntry([[250, tenX.id, 9]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         expect(await fare.balanceOf(users[0])).to.equal(transferAmount.sub(toEth('250')))
//         const rewardsBalance = await fare.balanceOf(rewards)
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(toEth('250'))
//         )
//       })

//       it('Place batch entry with single 10x entry and ensure entryMap is valid', async () => {
//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 0]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spinSigners[0].batchEntryMap(currentRoundId, users[0])
//         const entry = await spin.getEntryByIndex(currentRoundId, batchEntry.user, 0)
//         assert.deepEqual(
//           objectify(entry),
//           batchEntryParams[0],
//           'Error: BatchEntry -> Entries on spin contract are incorrect'
//         )
//       })

//       it('Place batch entry with multiple 10x entries and amounts', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, tenX.id, 7],
//           [7000, tenX.id, 2],
//           [2000, tenX.id, 4],
//         ])
//         const expectedTotalAmount = batchEntryParams.reduce((prev, curr) => {
//           return prev.add(curr.amount)
//         }, BN.from(0))

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spinSigners[0].batchEntryMap(currentRoundId, users[0])
//         const entries = await spin.getEntriesByRoundUser(currentRoundId, batchEntry.user)

//         expect(batchEntry.totalEntryAmount).to.equal(expectedTotalAmount)
//         expect(batchEntry.user).to.equal(users[0])
//         assert.deepEqual(
//           arrayify(entries),
//           batchEntryParams,
//           'Error: BatchEntry -> Entries on spin contract are incorrect'
//         )
//       })

//       it('Place batch entry with invalid 10x pickedNumber', async () => {
//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 10]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Invalid picked number'
//         )
//       })

//       it('Place batch entry with 0 amount', async () => {
//         const batchEntryParams = createBatchEntry([[0, tenX.id, 0]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Amount cannot be zero'
//         )
//       })

//       it('User placing more than one batch entry per round should be reverted', async () => {
//         const batchEntryParams1 = createBatchEntry([
//           [2500, tenX.id, 0],
//           [1500, tenX.id, 1],
//         ])
//         const batchEntryParams2 = createBatchEntry([[5000, tenX.id, 3]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams1)
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams2)).to.be.revertedWith(
//           'Already entered in current round'
//         )
//       })

//       it('Place batch entry on inactive 10x contract mode', async () => {
//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 0]])

//         await spin.setContractModeIsActive(tenX.id, false)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode is not active'
//         )
//       })

//       it('Place 10X batch entry with multiple of the same picked number', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, tenX.id, 2],
//           [1000, tenX.id, 2],
//           [2000, tenX.id, 2],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Duplicate pickedNumber by contract'
//         )
//       })

//       it('Place batch entry with that exceeds 10x entryLimit', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, tenX.id, 0],
//           [1000, tenX.id, 1],
//           [1000, tenX.id, 2],
//           [1000, tenX.id, 3],
//           [1000, tenX.id, 4],
//           [1000, tenX.id, 5],
//           [1000, tenX.id, 6],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode entry limit exceeded'
//         )
//       })

//       it('Place batch entry which is less than minAmount', async () => {
//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 0]])

//         await spin.setContractModeMinMax(tenX.id, toEth('25000'), 0)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode min amount not met'
//         )
//       })

//       it('Place batch entry which exceeds maxAmount', async () => {
//         const batchEntryParams = createBatchEntry([[25000, tenX.id, 0]])

//         await spin.setContractModeMinMax(tenX.id, 0, toEth('1000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode max amount exceeded'
//         )
//       })
//     })

//     describe('100X ContractMode', () => {
//       beforeEach(async () => {
//         await spin.startNewRound(randomHash)
//       })

//       it('Place batch entry with single 100x entry', async () => {
//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 77]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         expect(batchEntry.totalEntryAmount).to.equal(toEth('1000'))
//         expect(batchEntry.user).to.equal(users[0])
//       })

//       it('Place batch entry and ensure FARE is burned', async () => {
//         const batchEntryParams = createBatchEntry([[500, hundoX.id, 77]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         expect(await fare.balanceOf(users[0])).to.equal(transferAmount.sub(toEth('500')))
//         const rewardsBalance = await fare.balanceOf(rewards)
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(toEth('500'))
//         )
//       })

//       it('Place batch entry with single 100x entry and ensure entryMap is valid', async () => {
//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 0]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         const entry = await spin.getEntryByIndex(currentRoundId, batchEntry.user, 0)
//         assert.deepEqual(
//           objectify(entry),
//           batchEntryParams[0],
//           'Error: spin contract entryMap is incorrect'
//         )
//       })

//       it('Place batch entry with multiple 100x entries and amounts', async () => {
//         const batchEntryParams = createBatchEntry([
//           [100, hundoX.id, 99],
//           [999, hundoX.id, 25],
//           [4356, hundoX.id, 54],
//         ])
//         const expectedTotalAmount = batchEntryParams.reduce((prev, curr) => {
//           return prev.add(curr.amount)
//         }, BN.from(0))

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spin.batchEntryMap(currentRoundId, users[0])
//         expect(batchEntry.totalEntryAmount).to.equal(expectedTotalAmount)
//         expect(batchEntry.user).to.equal(users[0])
//       })

//       it('Place batch entry with invalid 100x pickedNumber', async () => {
//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 100]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Invalid picked number'
//         )
//       })

//       it('Place batch entry with 0 amount', async () => {
//         const batchEntryParams = createBatchEntry([[0, hundoX.id, 0]])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Amount cannot be zero'
//         )
//       })

//       it('Place batch entry on inactive 100x contract mode', async () => {
//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 0]])

//         await spin.setContractModeIsActive(hundoX.id, false)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode is not active'
//         )
//       })

//       it('Place batch entry with that exceeds 100x entryLimit', async () => {
//         const invalidEntryAmount = hundoX.entryLimit.toNumber() + 1
//         const entryParams: any[] = []

//         for (let idx = 0; idx < invalidEntryAmount; idx++) {
//           entryParams.push([200, hundoX.id, idx])
//         }

//         const batchEntryParams = createBatchEntry(entryParams)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode entry limit exceeded'
//         )
//       })

//       it('User placing more than one 100X batch entry per round should be reverted', async () => {
//         const batchEntryParams1 = createBatchEntry([
//           [2500, hundoX.id, 24],
//           [1500, hundoX.id, 49],
//         ])
//         const batchEntryParams2 = createBatchEntry([[5000, hundoX.id, 3]])

//         await spinSigners[0].placeBatchEntry(batchEntryParams1)
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams2)).to.be.revertedWith(
//           'Already entered in current round'
//         )
//       })

//       it('Place 100X batch entry with multiple of the same picked number', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, hundoX.id, 42],
//           [1000, hundoX.id, 42],
//           [1000, hundoX.id, 42],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Duplicate pickedNumber by contract'
//         )
//       })

//       it('Place batch entry which is less than minAmount', async () => {
//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 0]])

//         await spin.setContractModeMinMax(hundoX.id, toEth('25000'), 0)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode min amount not met'
//         )
//       })

//       it('Place batch entry which exceeds maxAmount', async () => {
//         const batchEntryParams = createBatchEntry([[25000, hundoX.id, 0]])

//         await spin.setContractModeMinMax(hundoX.id, 0, toEth('1000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode max amount exceeded'
//         )
//       })
//     })

//     describe('All ContractModes', () => {
//       beforeEach(async () => {
//         await spin.startNewRound(randomHash)
//       })

//       it('Place batch entry with multiple 2x, 10x, 100x entries and amounts', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, twoX.id, 1],
//           [999, tenX.id, 0],
//           [500, tenX.id, 2],
//           [200, tenX.id, 5],
//           [100, hundoX.id, 99],
//           [100, hundoX.id, 48],
//           [100, hundoX.id, 2],
//         ])
//         const expectedTotalAmount = batchEntryParams.reduce((prev, curr) => {
//           return prev.add(curr.amount)
//         }, BN.from(0))

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const batchEntry = await spinSigners[0].batchEntryMap(currentRoundId, users[0])
//         expect(batchEntry.totalEntryAmount).to.equal(expectedTotalAmount)
//         expect(batchEntry.user).to.equal(users[0])
//         expect(await spin.getEntryCount(currentRoundId, batchEntry.user)).to.equal(
//           BN.from(batchEntryParams.length)
//         )
//       })

//       it('Place batch entry with invalid contract mode', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, twoX.id, 1],
//           [999, tenX.id, 0],
//           [200, BN.from(11), 5],
//           [100, hundoX.id, 99],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Invalid contract mode'
//         )
//       })

//       it('Place batch entry which exceeds contract mode minAmount', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, tenX.id, 3],
//           [10000, tenX.id, 7],
//           [3000, tenX.id, 9],
//         ])
//         await spin.setContractModeMinMax(BN.from(tenX.id), toEth('20000'), toEth('1000000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode min amount not met'
//         )
//       })

//       it('Place batch entry which exceeds contract mode maxAmount', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, tenX.id, 3],
//           [10000, tenX.id, 7],
//           [3000, tenX.id, 9],
//         ])
//         await spin.setContractModeMinMax(BN.from(tenX.id), toEth('0'), toEth('10000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode max amount exceeded'
//         )
//       })

//       it('Place batch entry with multiple 2x, 10x, 100x entries and ensure FARE is burned', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, twoX.id, 1],
//           [999, tenX.id, 0],
//           [500, tenX.id, 2],
//           [200, tenX.id, 5],
//           [100, hundoX.id, 99],
//           [100, hundoX.id, 48],
//           [100, hundoX.id, 2],
//         ])
//         const expectedTotalAmount = batchEntryParams.reduce((prev, curr) => {
//           return prev.add(curr.amount)
//         }, BN.from(0))

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const rewardsBalance = await fare.balanceOf(rewards)
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(expectedTotalAmount)
//         )
//       })

//       it('Place batch entry with entries that exceeds entryLimit', async () => {
//         const batchEntryParams = createBatchEntry([
//           [2000, twoX.id, 0],
//           [2000, twoX.id, 1],
//           [100, tenX.id, 4],
//           [999, hundoX.id, 99],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode entry limit exceeded'
//         )
//       })

//       it('Place batch entry with entries that have invalid pickedNumber', async () => {
//         const batchEntryParams = createBatchEntry([
//           [1000, twoX.id, 1],
//           [1000, tenX.id, 2],
//           [1000, hundoX.id, 100],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Invalid picked number'
//         )
//       })

//       it('Place batch entry with entries that have 0 amount', async () => {
//         const batchEntryParams = createBatchEntry([
//           [10, twoX.id, 0],
//           [200, tenX.id, 4],
//           [0, hundoX.id, 0],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Amount cannot be zero'
//         )
//       })

//       it('Place batch entry with entries that have inActive contract mode', async () => {
//         const batchEntryParams = createBatchEntry([
//           [3000, twoX.id, 0],
//           [2000, tenX.id, 4],
//           [1000, hundoX.id, 0],
//         ])

//         await spin.setContractModeIsActive(hundoX.id, false)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode is not active'
//         )
//       })

//       it('Place batch entry which is less than minAmount', async () => {
//         const batchEntryParams = createBatchEntry([
//           [3000, twoX.id, 0],
//           [2000, tenX.id, 4],
//           [1000, hundoX.id, 0],
//         ])

//         await spin.setContractModeMinMax(hundoX.id, toEth('25000'), 0)

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode min amount not met'
//         )
//       })

//       it('Place batch entry which exceeds maxAmount', async () => {
//         const batchEntryParams = createBatchEntry([
//           [5000, twoX.id, 0],
//           [3000, tenX.id, 4],
//           [2000, hundoX.id, 0],
//         ])

//         await spin.setContractModeMinMax(hundoX.id, 0, toEth('1000'))

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Contract mode max amount exceeded'
//         )
//       })

//       it('Place 3 batch entry which entries from multiple users', async () => {
//         const batchEntryParams1 = createBatchEntry([
//           [5000, twoX.id, 1],
//           [100, tenX.id, 5],
//           [900, hundoX.id, 50],
//         ])
//         const batchEntryParams2 = createBatchEntry([
//           [5000, twoX.id, 0],
//           [3000, tenX.id, 2],
//           [2000, hundoX.id, 25],
//         ])
//         const batchEntryParams3 = createBatchEntry([
//           [5000, twoX.id, 1],
//           [1000, tenX.id, 9],
//           [1500, hundoX.id, 99],
//         ])

//         await spinSigners[0].placeBatchEntry(batchEntryParams1)
//         await spinSigners[1].placeBatchEntry(batchEntryParams2)
//         await spinSigners[2].placeBatchEntry(batchEntryParams3)

//         expect((await spin.batchEntryMap(currentRoundId, users[0])).totalEntryAmount).to.equal(
//           toEth('6000')
//         )
//         expect((await spin.batchEntryMap(currentRoundId, users[1])).totalEntryAmount).to.equal(
//           toEth('10000')
//         )
//         expect((await spin.batchEntryMap(currentRoundId, users[2])).totalEntryAmount).to.equal(
//           toEth('7500')
//         )

//         expect(await fare.balanceOf(users[0])).to.equal(transferAmount.sub(toEth('6000')))
//         expect(await fare.balanceOf(users[1])).to.equal(transferAmount.sub(toEth('10000')))
//         expect(await fare.balanceOf(users[2])).to.equal(transferAmount.sub(toEth('7500')))
//       })

//       it('Ensure batch entry count is correct', async () => {
//         const batchEntryParams = createBatchEntry([
//           [5000, twoX.id, 1],
//           [3000, tenX.id, 5],
//           [2000, hundoX.id, 50],
//         ])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await spinSigners[1].placeBatchEntry(batchEntryParams)
//         await spinSigners[2].placeBatchEntry(batchEntryParams)
//         const currentRoundId = await spin.getCurrentRoundId()
//         expect(await spin.getBatchEntryCount(currentRoundId)).to.equal(BN.from('3'))
//       })
//     })
//   })

//   describe('Full Spin Round', () => {
//     const transferAmount = toEth('5000000')
//     const currentRoundId = BN.from(0)
//     let spinSigners: FareSpin[] = []
//     let fareSigners: FareToken[] = []
//     const randomHash = '0x9560ec81e29479198947b0a684f6420b91f6e49283c61173dc4c20e8affb3b5b'
//     const randomSalt = '0x9a88bc6f1f32390f30de005b2dbb375881ba174a1f5bb0d456c18d6822623578'
//     const fullRandomNumber = BN.from(
//       '45772611071653491524083115873098373488161980308842407011935669553367101812786'
//     )
//     // @NOTE
//     // console.log(keccak256(abiCoder.encode(['bytes32', 'uint256'], [randomSalt, fullRandomNumber])))

//     const expectedRandomEliminator = BN.from('112234873571296932')
//     async function requestRandomNumber() {
//       await spin.setRoundPaused(true)
//       await spin.concludeRound(randomSalt, fullRandomNumber)
//     }

//     beforeEach(async () => {
//       const rewardsSigner = await ethers.getNamedSigner('rewards')
//       const userSigners = await ethers.getUnnamedSigners()

//       fareSigners.push(
//         fare.connect(userSigners[0]),
//         fare.connect(userSigners[1]),
//         fare.connect(userSigners[2])
//       )

//       // @NOTE Allow mint/burn permission (FareToken -> FareSpinToken)
//       await fare.setAllowContractMintBurn(spin.address, true)
//       await fareSigners[0].setAllowContractMintBurn(spin.address, true)
//       await fareSigners[1].setAllowContractMintBurn(spin.address, true)
//       await fareSigners[2].setAllowContractMintBurn(spin.address, true)
//       await fare.connect(rewardsSigner).setAllowContractMintBurn(spin.address, true)

//       await fare.transfer(users[0], transferAmount)
//       await fare.transfer(users[1], transferAmount)
//       await fare.transfer(users[2], transferAmount)

//       spinSigners.push(
//         spin.connect(userSigners[0]),
//         spin.connect(userSigners[1]),
//         spin.connect(userSigners[2])
//       )

//       await spin.startNewRound(randomHash)

//       await seedContractModes(spin)
//     })

//     describe('Reverts', () => {
//       it('No users in round', async () => {
//         await spin.setRoundPaused(true)
//         await expect(spin.concludeRound(randomSalt, fullRandomNumber)).to.be.revertedWith(
//           'No users in round.'
//         )
//         // @NOTE
//         // await expect(spin.requestRandomNumber()).to.be.revertedWith('No users in round')
//       })

//       it('Entry not found', async () => {
//         await expect(spin.settleBatchEntry(currentRoundId, users[0])).to.be.revertedWith(
//           'Batch entry does not exist'
//         )
//       })

//       it('Entry already settled', async () => {
//         await spinSigners[0].placeBatchEntry(createBatchEntry([[1000, twoX.id, 0]]))

//         await requestRandomNumber()
//         await spinSigners[0].settleBatchEntry(0, users[0])
//         await expect(spinSigners[0].settleBatchEntry(0, users[0])).to.be.revertedWith(
//           'Entry already settled'
//         )
//       })

//       it('Entry not found after round concluded', async () => {
//         await spinSigners[0].placeBatchEntry(createBatchEntry([[1000, twoX.id, 0]]))

//         await requestRandomNumber()
//         await spinSigners[0].settleBatchEntry(0, users[0])
//         await expect(spinSigners[0].settleBatchEntry(0, users[1])).to.be.revertedWith(
//           'Batch entry does not exist'
//         )
//       })

//       it('Round not yet resolved', async () => {
//         await spinSigners[0].placeBatchEntry(createBatchEntry([[1000, twoX.id, 0]]))

//         await expect(spinSigners[0].settleBatchEntry(0, users[0])).to.be.revertedWith(
//           'Round not yet resolved'
//         )
//       })

//       it('Ensure settling entry is working', async () => {
//         await spinSigners[0].placeBatchEntry(createBatchEntry([[1000, twoX.id, 0]]))
//         await requestRandomNumber()
//         await spinSigners[0].settleBatchEntry(0, users[0])
//         const pastEntry = await spin.batchEntryMap(0, users[0])
//         expect(pastEntry.totalMintAmount).to.be.eq(pastEntry.totalEntryAmount.mul(2))

//         // @NOTE unused code block
//         /*
//         await expect(spinSigners[0].settleBatchEntry(0, users[0])).to.be.revertedWith(
//           'Round not yet resolved'
//         )
//         */
//       })
//     })

//     describe('Events', () => {
//       it('EntrySubmitted', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams))
//           .to.emit(spin, 'EntrySubmitted')
//           .withArgs(0, 0, users[0])
//       })

//       it('EntrySettled', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await expect(spinSigners[0].settleBatchEntry(0, users[0])).to.emit(spin, 'EntrySettled')
//       })
//     })

//     describe('VRF', async () => {
//       it('Ensure randomHash, revealKey, randomEliminator are correct', async () => {
//         await spinSigners[0].placeBatchEntry(createBatchEntry([[1000, twoX.id, 0]]))
//         await requestRandomNumber()
//         const roundInfo = await spin.rounds(0)
//         expect(roundInfo.randomHash).to.be.equal(randomHash)
//         expect(roundInfo.revealKey).to.be.equal(randomSalt)
//         expect(roundInfo.fullRandomNum).to.be.equal(fullRandomNumber)

//         // @NOTE unused code block
//         /*
//         const CONTRACT_EXPECTED_VALUE_CEILING = await spin.CONTRACT_EXPECTED_VALUE_CEILING()
//         const roundInfo = await spin.rounds(0)

//         Verify random number and random eliminator
//         const vrfMapNum = (await spin.rounds(0)).vrfNum
//         const abiCoder = new ethers.utils.AbiCoder()

//         const encodedRandomNum = abiCoder.encode(['uint256', 'uint256'], [vrfNum, 1])
//         const keccakRandomNum = ethers.utils.keccak256(encodedRandomNum)
//         const expectedRandomNum = abiCoder.decode(['uint256'], keccakRandomNum)[0].mod(100)

//         const encodededRandomEliminator = abiCoder.encode(['uint256', 'uint256'], [vrfNum, 2])
//         const keccakRandomEliminator = ethers.utils.keccak256(encodededRandomEliminator)
//         const expectedRandomEliminator = abiCoder
//           .decode(['uint256'], keccakRandomEliminator)[0]
//           .mod(CONTRACT_EXPECTED_VALUE_CEILING)
//         expect(vrfMapNum).to.be.equal(vrfNum)
//         expect(roundInfo.randomNum).to.equal(expectedRandomNum)
//         expect(roundInfo.randomEliminator).to.equal(expectedRandomEliminator)
//         */
//       })
//     })

//     describe('Settle BatchEntry', () => {
//       it('Settle batchEntry with single entry mint', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         const rewardsBalance = await fare.balanceOf(rewards)
//         const userBalance = await fare.balanceOf(batchEntry.user)
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(
//           batchEntry.totalEntryAmount.mul(twoX.mintMultiplier)
//         )
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).add(batchEntry.totalEntryAmount)
//         )
//         expect(userBalance).to.equal(transferAmount.add(batchEntry.totalEntryAmount))
//       })

//       it('Change rewardMint to 8% and ensure correct amount was minted to rewardsAddress', async () => {
//         // @NOTE 1000 FARE token
//         const entryAmount = 1000
//         // @NOTE Mint 8% of entry to rewardsAddress
//         const newRewardsMintPercentage = parseUnits('8', 16)
//         const batchEntryParams = createBatchEntry([[entryAmount, twoX.id, 1]])

//         await spin.setRewardsMint(newRewardsMintPercentage)
//         const contractRewardMintPercentage = await spin.rewardsMint()
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const rewardsBalance = await fare.balanceOf(rewards)

//         expect(rewardsBalance).to.be.equal(
//           toEth(entryAmount.toString()).mul(contractRewardMintPercentage).div(decimalBase18)
//         )
//       })

//       it('Change rewardMint to 2.75% and ensure correct amount was minted to rewardsAddress', async () => {
//         // @NOTE 1000 FARE token
//         const entryAmount = 1000
//         // @NOTE Mint 2.75% of entry to rewardsAddress
//         const newRewardsMintPercentage = parseUnits('2.75', 16)
//         const batchEntryParams = createBatchEntry([[entryAmount, twoX.id, 1]])

//         await spin.setRewardsMint(newRewardsMintPercentage)
//         const contractRewardMintPercentage = await spin.rewardsMint()
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const rewardsBalance = await fare.balanceOf(rewards)

//         expect(rewardsBalance).to.be.equal(
//           toEth(entryAmount.toString()).mul(contractRewardMintPercentage).div(decimalBase18)
//         )
//       })

//       it('Settle batchEntry with single entry mint', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         const rewardsBalance = await fare.balanceOf(rewards)
//         const userBalance = await fare.balanceOf(batchEntry.user)
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(
//           batchEntry.totalEntryAmount.mul(twoX.mintMultiplier)
//         )
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).add(batchEntry.totalEntryAmount)
//         )
//         expect(userBalance).to.equal(transferAmount.add(batchEntry.totalEntryAmount))
//       })

//       it('Settle batchEntry for 10x which mints', async () => {
//         const batchEntryParams = createBatchEntry([[25000, tenX.id, 6]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(toEth('25000').mul(tenX.mintMultiplier))
//       })

//       it('getAllUsersByRoundId', async () => {
//         const batchEntryParams1 = createBatchEntry([[12000, tenX.id, 2]])
//         const batchEntryParams2 = createBatchEntry([[15000, tenX.id, 3]])
//         const batchEntryParams3 = createBatchEntry([[2000, tenX.id, 4]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams1)
//         await spinSigners[1].placeBatchEntry(batchEntryParams2)
//         await spinSigners[2].placeBatchEntry(batchEntryParams3)

//         await requestRandomNumber()

//         const roundUsers = await spin.getAllUsersByRoundId(0)

//         expect(roundUsers.length).to.be.equal(3)
//         expect(await spinSigners[0].signer.getAddress()).to.be.equal(roundUsers[0])
//         expect(await spinSigners[1].signer.getAddress()).to.be.equal(roundUsers[1])
//         expect(await spinSigners[2].signer.getAddress()).to.be.equal(roundUsers[2])
//       })

//       it('Settle batchEntry with single entry burn', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         const rewardsBalance = await fare.balanceOf(rewards)
//         const userBalance = await fare.balanceOf(batchEntry.user)
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(toEth('0'))
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(batchEntry.totalEntryAmount)
//         )
//         expect(userBalance).to.equal(transferAmount.sub(batchEntry.totalEntryAmount))
//       })

//       it('Change rewardsMint (8%) amount and ensure correct', async () => {
//         const newRewardsMintPercentage = parseUnits('8', 16)
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await spin.setRewardsMint(newRewardsMintPercentage)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         expect(await fare.balanceOf(rewards)).to.equal(
//           toEth('1000').mul(newRewardsMintPercentage).div(decimalBase18)
//         )
//       })
//     })

//     // @NOTE: When we finish NFTLootBox contract ensure user is minted a lootbox
//     describe('Eliminator Round', () => {
//       it('getEliminatorsByRoundId', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         const eliminatorsForRoundOne = await spin.getEliminatorsByRoundId(0)
//         // @NOTE option to make this test more dynamic
//         // const currContracts = await spin.getCurrentContractModeId()

//         // @NOTE previously tested against ContractModes.length
//         expect(eliminatorsForRoundOne.length).to.be.equal(6)
//         expect(eliminatorsForRoundOne[0].isEliminator).to.eq(false)
//         expect(eliminatorsForRoundOne[1].isEliminator).to.eq(false)
//         expect(eliminatorsForRoundOne[2].isEliminator).to.eq(false)
//         expect(eliminatorsForRoundOne[3].isEliminator).to.eq(false)
//         expect(eliminatorsForRoundOne[4].isEliminator).to.eq(false)
//         expect(eliminatorsForRoundOne[5].isEliminator).to.eq(false)
//       })

//       it('Batch Entry mint but eliminator hits', async () => {
//         await spin.setContractExpectedValueFloor(twoX.id, expectedRandomEliminator.sub(1))
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 1]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         const rewardsBalance = await fare.balanceOf(rewards)
//         const userBalance = await fare.balanceOf(batchEntry.user)

//         expect(await spin.getIsEliminator(0, twoX.id)).to.equal(true)
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(toEth('0'))
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).sub(batchEntry.totalEntryAmount)
//         )
//         expect(userBalance).to.equal(transferAmount.sub(batchEntry.totalEntryAmount))
//       })

//       it('Ensure hasMintedNFT condition is hit only once', async () => {
//         await spin.setContractExpectedValueFloor(twoX.id, expectedRandomEliminator.sub(1))
//         const batchEntryParams = createBatchEntry([
//           [1000, twoX.id, 1],
//           [1000, tenX.id, 2],
//           [100, hundoX.id, 42],
//         ])

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await expect(spin.settleBatchEntry(0, users[0]))
//           .to.emit(spin, 'NFTMint')
//           .withArgs(0, users[0])
//       })

//       it('Batch Entry with multiple entries but eliminator hit for 10x', async () => {
//         await spin.setContractExpectedValueFloor(tenX.id, expectedRandomEliminator.sub(1))
//         // @NOTE argument: [ [ Mint ], [ Mint but eliminator was hit (so tokens are burnt) ], [ Mint ] ]
//         const batchEntryParams = createBatchEntry([
//           [1000, twoX.id, 0],
//           [1000, tenX.id, 6],
//           [1000, hundoX.id, 86],
//         ])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spin.settleBatchEntry(0, users[0])
//         const batchEntry = await spin.batchEntryMap(0, users[0])
//         const rewardsBalance = await fare.balanceOf(rewards)
//         const userBalance = await fare.balanceOf(batchEntry.user)

//         const twoXMintAmount = toEth('1000').mul(twoX.mintMultiplier)
//         const hundoXMintAmount = toEth('1000').mul(hundoX.mintMultiplier)
//         const expectedMintAmount = twoXMintAmount.add(hundoXMintAmount)
//         const expectedIncreaseAmount = expectedMintAmount.sub(toEth('3000'))

//         expect(await spin.getIsEliminator(0, twoX.id)).to.equal(false)
//         expect(await spin.getIsEliminator(0, tenX.id)).to.equal(true)
//         expect(await spin.getIsEliminator(0, hundoX.id)).to.equal(false)
//         expect(batchEntry.settled).to.equal(true)
//         expect(batchEntry.totalMintAmount).to.equal(expectedMintAmount)
//         expect(await fare.totalSupply()).to.equal(
//           INITIAL_SUPPLY.add(rewardsBalance).add(expectedIncreaseAmount)
//         )
//         expect(userBalance).to.equal(transferAmount.add(expectedIncreaseAmount))
//       })
//     })

//     describe('Batch Settle Entries', () => {
//       it('Attempt to settle with no batchEntries', async () => {
//         await expect(spinSigners[0].batchSettleEntries([], users[0])).to.be.revertedWith(
//           'BatchEntry list cannot be empty.'
//         )
//       })

//       it('Trying to settle more than 20 batch entries should revert', async () => {
//         await expect(
//           spinSigners[0].batchSettleEntries(Array(22).fill(1), users[0])
//         ).to.be.revertedWith('You can only settle 20 batch entries at a time.')
//       })

//       it('Settle single batch entry win', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const beforeBalance = await fare.balanceOf(users[0])
//         await requestRandomNumber()
//         await spinSigners[0].batchSettleEntries([0], users[0])
//         const expectedTotalMintAmount = toEth('1000').mul(twoX.mintMultiplier)
//         const postBalance = await fare.balanceOf(users[0])
//         expect(postBalance).to.be.equal(beforeBalance.add(expectedTotalMintAmount))
//       })

//       it('Batch entry already settled', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spinSigners[0].batchSettleEntries([0], users[0])
//         await expect(spinSigners[0].batchSettleEntries([0], users[0])).to.be.revertedWith(
//           'Entry already settled'
//         )
//       })

//       it('Batch entry does not exist', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spinSigners[0].batchSettleEntries([0], users[0])
//         await expect(spinSigners[0].batchSettleEntries([1], users[0])).to.be.revertedWith(
//           'Batch entry does not exist'
//         )
//       })

//       it('Settle multiple batch entry wins', async () => {
//         const userBalance = await fare.balanceOf(users[0])
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await spinSigners[0].batchSettleEntries([0, 1, 2], users[0])

//         const postBalance = await fare.balanceOf(users[0])
//         expect(userBalance.add(toEth('3000'))).to.be.eq(postBalance)
//       })

//       it('Check that BatchEntriesSettled event was emitted', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         await expect(spinSigners[0].batchSettleEntries([0, 1, 2], users[0])).to.emit(
//           spin,
//           'BatchEntriesSettled'
//         )
//       })

//       it('Entry already settled with unsettled entries', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()
//         spinSigners[0].batchSettleEntries([0], users[0])

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await expect(spinSigners[0].batchSettleEntries([0, 1, 2], users[0])).to.be.revertedWith(
//           'Entry already settled'
//         )
//       })

//       it('Try to settle unsettled and a entry in an active round', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await requestRandomNumber()

//         await spin.startNewRound(randomHash)
//         await spinSigners[0].placeBatchEntry(batchEntryParams)

//         await expect(spinSigners[0].batchSettleEntries([0, 1, 2], users[0])).to.be.revertedWith(
//           'Round not yet resolved'
//         )
//       })
//     })

//     describe('Withdraw BatchEntry', () => {
//       it('Withdrawing before period is up should revert', async () => {
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         await expect(spinSigners[0].withdrawalBatchEntry()).to.be.revertedWith(
//           'Withdrawal not available yet'
//         )
//       })

//       // @NOTE failing tests
//       // a withdrawal takes longer than 9 mins for below tests --> why???
//       // Error: VM Exception while processing transaction: reverted with reason string 'Withdrawal not available yet'

//       // it('Successfully withdraw from spin round', async () => {
//       //   const userBalance = await fare.balanceOf(users[0])
//       //   const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//       //   await spinSigners[0].placeBatchEntry(batchEntryParams)
//       //   await sleep(540000)
//       //   await spinSigners[0].withdrawalBatchEntry()
//       //   const postBalance = await fare.balanceOf(users[0])
//       //   expect(userBalance).to.be.eq(postBalance)
//       // })

//       // it('Trying to withdraw more than once should fail', async () => {
//       //   const userBalance = await fare.balanceOf(users[0])
//       //   const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//       //   await spinSigners[0].placeBatchEntry(batchEntryParams)
//       //   await sleep(240000)
//       //   await spinSigners[0].withdrawalBatchEntry()
//       //   const postBalance = await fare.balanceOf(users[0])
//       //   expect(userBalance).to.be.eq(postBalance)
//       //   await expect(spinSigners[0].withdrawalBatchEntry()).to.be.revertedWith(
//       //     'Already withdrew entry'
//       //   )
//       // })

//       // it('Settling a batchEntry that has already been withdrawn should be reverted', async () => {
//       //   const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//       //   await spinSigners[0].placeBatchEntry(batchEntryParams)
//       //   await sleep(240000)
//       //   await spinSigners[0].withdrawalBatchEntry()
//       //   await requestRandomNumber()
//       //   await expect(spinSigners[0].batchSettleEntries([0], users[0])).to.be.revertedWith(
//       //     'You already withdrew from the round'
//       //   )
//       // })

//       // it('Expect withdraw event to be emitted', async () => {
//       //   const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//       //   await spinSigners[0].placeBatchEntry(batchEntryParams)
//       //   await sleep(240000)
//       //   await expect(spinSigners[0].withdrawalBatchEntry()).to.be.emit(spin, 'BatchEntryWithdraw')
//       // })
//     })

//     describe('Pause Contract', () => {
//       it('Ensure contract is paused', async () => {
//         await spin.setPauseContract(true)
//         expect(await spin.paused()).to.eq(true)
//       })

//       it('Ensure contract is unpaused', async () => {
//         await spin.setPauseContract(true)
//         expect(await spin.paused()).to.eq(true)

//         await spin.setPauseContract(false)
//         expect(await spin.paused()).to.eq(false)
//       })

//       it('Ensure whenNotPaused modifier is working as intended', async () => {
//         const initialTotalSupply = await fare.totalSupply()
//         await spin.setPauseContract(true)
//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Pausable: paused'
//         )
//         await spin.setPauseContract(false)

//         await spinSigners[0].placeBatchEntry(batchEntryParams)
//         const currentTotalSupply = await fare.totalSupply()

//         expect(currentTotalSupply).to.eq(initialTotalSupply.sub(toEth('990')))
//       })
//     })

//     describe('Round Pausing', () => {
//       it('Pause round and ensure it was paused', async () => {
//         await spin.setRoundPaused(true)

//         expect(await spin.isRoundPaused()).to.equal(true)
//       })

//       it('Ensure only owner can pause round', async () => {
//         const ownedBy = await spin.owner()
//         expect(owner).to.equal(ownedBy)
//         await spin.setRoundPaused(true)
//       })

//       it('Pause round and ensure RoundPausedChanged event emitted', async () => {
//         await expect(spin.setRoundPaused(true)).to.emit(spin, 'RoundPausedChanged')
//       })

//       it('Ensure an entry cannot be placed when round is paused for 2x', async () => {
//         await spin.setRoundPaused(true)

//         const batchEntryParams = createBatchEntry([[1000, twoX.id, 0]])
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Round is paused'
//         )
//       })

//       it('Ensure an entry cannot be placed when round is paused for 10x', async () => {
//         await spin.setRoundPaused(true)

//         const batchEntryParams = createBatchEntry([[1000, tenX.id, 7]])
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Round is paused'
//         )
//       })

//       it('Ensure an entry cannot be placed when round is paused for 100x', async () => {
//         await spin.setRoundPaused(true)

//         const batchEntryParams = createBatchEntry([[1000, hundoX.id, 77]])
//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams)).to.be.revertedWith(
//           'Round is paused'
//         )
//       })

//       it('Ensure batch entries from multiple users cannot be placed when round is paused', async () => {
//         await spin.setRoundPaused(true)

//         const batchEntryParams1 = createBatchEntry([
//           [5000, twoX.id, 1],
//           [100, tenX.id, 5],
//           [900, hundoX.id, 50],
//         ])
//         const batchEntryParams2 = createBatchEntry([
//           [5000, twoX.id, 0],
//           [3000, tenX.id, 2],
//           [2000, hundoX.id, 25],
//         ])
//         const batchEntryParams3 = createBatchEntry([
//           [5000, twoX.id, 1],
//           [1000, tenX.id, 9],
//           [1500, hundoX.id, 99],
//         ])

//         await expect(spinSigners[0].placeBatchEntry(batchEntryParams1)).to.be.revertedWith(
//           'Round is paused'
//         )
//         await expect(spinSigners[1].placeBatchEntry(batchEntryParams2)).to.be.revertedWith(
//           'Round is paused'
//         )
//         await expect(spinSigners[2].placeBatchEntry(batchEntryParams3)).to.be.revertedWith(
//           'Round is paused'
//         )
//       })
//     })
//   })
// })
