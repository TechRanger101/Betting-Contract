import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import { FareSpin, ContractModeUpdated, EntrySettled, EntrySubmitted, RandomNumberRequested, RoundConcluded } from "../generated/FareSpin/FareSpin"
import { getEventLog, getUser, getContratMode, getRound, getBatchEntry, getEntry, getEliminator, createRoundUser } from "./utils"
import { e18 } from "./constants"

export function handleContractModeUpdate(event: ContractModeUpdated): void {
  const eventLog = getEventLog(event, "ContractModeUpdated")

  const id = event.params.contractModeId
  const contractMode = getContratMode(eventLog, id)

  const fareSpin = FareSpin.bind(event.address)
  const contractModeData = fareSpin.contractModes(id)

  contractMode.cardinality = contractModeData.getCardinality()
  contractMode.contractExpectedValueFloor = contractModeData.getContractExpectedValueFloor()
  contractMode.mintMultiplier = contractModeData.getMintMultiplier()
  contractMode.minAmount = contractModeData.getMinAmount()
  contractMode.maxAmount = contractModeData.getMaxAmount()
  contractMode.entryLimit = contractModeData.getEntryLimit()
  contractMode.isActive = contractModeData.getIsActive()

  contractMode.save()
}

export function handleEntrySubmit(event: EntrySubmitted): void {
  const eventLog = getEventLog(event, "EntrySubmitted")

  const roundId =event.params.roundId
  const round = getRound(eventLog, roundId)
  const user = getUser(eventLog, event.params.user)
  const batchEntry = getBatchEntry(eventLog, round, user)

  const fareSpin = FareSpin.bind(event.address)
  const batchEntryData = fareSpin.batchEntryMap(roundId, event.params.user)

  batchEntry.batchEntryId = event.params.batchId
  batchEntry.totalEntryAmount = batchEntryData.getTotalEntryAmount()
  batchEntry.totalMintAmount = batchEntryData.getTotalMintAmount()

  const entriesByRoundUser = fareSpin.getEntriesByRoundUser(roundId, event.params.user)

  for (let i = 0; i < entriesByRoundUser.length; i++) {
    const entry = getEntry(eventLog, batchEntry, BigInt.fromI32(i))

    const entryData = entriesByRoundUser[i]
    entry.contractMode = entryData.contractModeId.toHex()
    entry.amount = entryData.amount
    entry.pickedNumber = entryData.pickedNumber
    entry.mintAmount = BigInt.fromI32(0)

    entry.save()
  }

  batchEntry.save()

  createRoundUser(eventLog, round, user)

  const rewardsMint = fareSpin.rewardsMint()
  const roundRewards = batchEntry.totalEntryAmount.times(rewardsMint).div(e18)
  user.rewardsWalletMint = user.rewardsWalletMint.plus(roundRewards)
  user.totalRounds = user.totalRounds.plus(BigInt.fromI32(1))
  user.totalEntries = user.totalEntries.plus(BigInt.fromI32(entriesByRoundUser.length))
  user.save()

  round.totalBurn = round.totalBurn.plus(batchEntry.totalEntryAmount)
  round.totalRewardsWalletMint = round.totalRewardsWalletMint.plus(roundRewards)
  round.save()
}

export function handleEntrySettle(event: EntrySettled): void {
  const eventLog = getEventLog(event, "EntrySettled")

  const roundId = event.params.roundId
  const round = getRound(eventLog, roundId)
  const user = getUser(eventLog, event.params.user)
  const batchEntry = getBatchEntry(eventLog, round, user)

  const fareSpin = FareSpin.bind(event.address)
  const batchEntryData = fareSpin.batchEntryMap(roundId, event.params.user)

  batchEntry.totalEntryAmount = batchEntryData.getTotalEntryAmount()
  batchEntry.totalMintAmount = batchEntryData.getTotalMintAmount()
  batchEntry.settled = batchEntryData.getSettled()
  batchEntry.settledOn = eventLog.timestamp

  const entriesByRoundUser = fareSpin.getEntriesByRoundUser(roundId, event.params.user)

  for (let i = 0; i < entriesByRoundUser.length; i++) {
    const entry = getEntry(eventLog, batchEntry, BigInt.fromI32(i))

    // entry.mintAmount = BigInt.fromI32(0)
    entry.save()
  }

  batchEntry.save()

  user.totalClaimed = user.totalClaimed.plus(batchEntry.totalMintAmount)
  user.save()

  round.totalClaimed = round.totalClaimed.plus(batchEntry.totalMintAmount)
  round.save()
}

export function handleRoundConclude(event: RoundConcluded): void {
  const eventLog = getEventLog(event, "RoundConcluded")

  const roundId = event.params.roundId
  const round = getRound(eventLog, roundId)

  const fareSpin = FareSpin.bind(event.address)
  const roundData = fareSpin.rounds(roundId)

  round.vrfRequestId = event.params.vrfRequestId
  const randomNum = roundData.getRandomNum()
  round.randomNum = randomNum
  round.randomEliminator = roundData.getRandomEliminator()
  round.vrfNum = roundData.getVrfNum()

  const eliminatorsByRoundId = fareSpin.getEliminatorsByRoundId(roundId)

  for (let i = 0; i < eliminatorsByRoundId.length; i++) {
    const eliminator = getEliminator(eventLog, round, BigInt.fromI32(i))

    const eliminatorData = eliminatorsByRoundId[i]
    eliminator.contractMode = eliminatorData.contractModeId.toHex()
    eliminator.recordedExpectedValueFloor = eliminatorData.recordedExpectedValueFloor
    eliminator.isEliminator = eliminatorData.isEliminator

    eliminator.save()
  }

  let roundTotalMint = BigInt.fromI32(0)

  const users = fareSpin.getAllUsersByRoundId(roundId)
  const eliminators = fareSpin.getEliminatorsByRoundId(roundId)
  for (let i = 0; i < users.length; i++) {
    const user = getUser(eventLog, users[i])

    let userTotalMint = BigInt.fromI32(0)
    const entries = fareSpin.getEntriesByRoundUser(roundId, users[i])
    for (let e = 0; e < entries.length; e++) {
      const entry = entries[e]
      const contractMode = getContratMode(eventLog, entry.contractModeId)

      if (eliminators[entry.contractModeId.toI32()].isEliminator) {
        // Eliminated
      } else {
        if (randomNum.mod(contractMode.cardinality).equals(entry.pickedNumber)) {
          // Win
          userTotalMint = userTotalMint.plus(entry.amount.times(contractMode.mintMultiplier))
        } else {
          // Lose
        }
      }
    }

    user.totalMint = user.totalMint.plus(userTotalMint)
    user.save()

    roundTotalMint = roundTotalMint.plus(userTotalMint)
  }

  round.totalMint = roundTotalMint
  round.save()
}

export function handleRandomNumberRequest(event: RandomNumberRequested): void {
  const eventLog = getEventLog(event, "RandomNumberRequested")

  const fareSpin = FareSpin.bind(event.address)
  const currentRoundId = fareSpin.getCurrentRoundId()

  const round = getRound(eventLog, currentRoundId)
  round.vrfRequestId = event.params.vrfRequestId

  round.save()
}
