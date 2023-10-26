import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { EventLog, User, ContractMode, Round, BatchEntry, Entry, Eliminator, RoundUser } from "../generated/schema"

export function getEventLog(event: ethereum.Event, type: string): EventLog {
  const id = event.transaction.hash.toHex().concat('-').concat(event.logIndex.toHex())
  const entity = new EventLog(id)

  entity.address = event.address
  entity.blockNumber = event.block.number.toI32()
  entity.logIndex = event.logIndex
  entity.logType = event.logType || type
  entity.from = event.transaction.from
  entity.txHash = event.transaction.hash
  entity.timestamp = event.block.timestamp.toI32()
  entity.save()

  return entity
}

export function getUser(eventLog: EventLog, address: Bytes): User {
  const id = Address.fromBytes(address).toHex()
  const entity = User.load(id)

  if (!entity) {
    const newEntity = new User(id)

    newEntity.balance = BigInt.fromI32(0)
    newEntity.totalRounds = BigInt.fromI32(0)
    newEntity.totalEntries = BigInt.fromI32(0)
    newEntity.totalMint = BigInt.fromI32(0)
    newEntity.totalClaimed = BigInt.fromI32(0)
    newEntity.totalBurn = BigInt.fromI32(0)
    newEntity.transferIn = BigInt.fromI32(0)
    newEntity.transferOut = BigInt.fromI32(0)
    newEntity.rewardsWalletMint = BigInt.fromI32(0)
    newEntity.timestamp = eventLog.timestamp
    newEntity.eventLog = eventLog.id

    return newEntity
  } else {
    if (entity.eventLog != eventLog.id) {
      entity.timestamp = eventLog.timestamp
      entity.eventLog = eventLog.id
    }

    return entity
  }
}

export function getContratMode(eventLog: EventLog, gmid: BigInt): ContractMode {
  const id = gmid.toHex()
  const entity = ContractMode.load(id)

  if (!entity) {
    const newEntity = new ContractMode(id)

    newEntity.timestamp = eventLog.timestamp
    newEntity.eventLog = eventLog.id

    return newEntity
  } else {
    if (entity.eventLog != eventLog.id) {
      entity.timestamp = eventLog.timestamp
      entity.eventLog = eventLog.id
    }

    return entity
  }
}

export function getRound(eventLog: EventLog, roundId: BigInt): Round {
  const id = roundId.toHex()
  const entity = Round.load(id)

  if (!entity) {
    const newEntity = new Round(id)

    newEntity.totalMint = BigInt.fromI32(0)
    newEntity.totalBurn = BigInt.fromI32(0)
    newEntity.totalRewardsWalletMint = BigInt.fromI32(0)
    newEntity.totalClaimed = BigInt.fromI32(0)
    newEntity.timestamp = eventLog.timestamp
    newEntity.eventLog = eventLog.id

    return newEntity
  } else {
    if (entity.eventLog != eventLog.id) {
      entity.timestamp = eventLog.timestamp
      entity.eventLog = eventLog.id
    }

    return entity
  }
}

export function getBatchEntry(eventLog: EventLog, round: Round, user: User): BatchEntry {
  const id = round.id.concat('-').concat(user.id)
  const entity = BatchEntry.load(id)

  if (!entity) {
    const newEntity = new BatchEntry(id)

    newEntity.round = round.id
    newEntity.player = user.id
    newEntity.timestamp = eventLog.timestamp
    newEntity.eventLog = eventLog.id

    return newEntity
  } else {
    entity.timestamp = eventLog.timestamp
    entity.eventLog = eventLog.id

    return entity
  }
}

export function getEntry(eventLog: EventLog, batchEntry: BatchEntry, idx: BigInt): Entry {
  const id = batchEntry.id.concat('-').concat(idx.toHex())
  const entity = Entry.load(id)

  if (!entity) {
    const newEntity = new Entry(id)

    newEntity.batchEntry = batchEntry.id
    newEntity.entryIdx = idx
    newEntity.timestamp = eventLog.timestamp
    newEntity.eventLog = eventLog.id

    return newEntity
  } else {
    entity.timestamp = eventLog.timestamp
    entity.eventLog = eventLog.id
  
    return entity
  }
}

export function getEliminator(eventLog: EventLog, round: Round, idx: BigInt): Eliminator {
  const id = round.id.concat('-').concat(idx.toHex())
  const entity = new Eliminator(id)

  entity.round = round.id
  entity.timestamp = eventLog.timestamp
  entity.eventLog = eventLog.id

  return entity
}

export function createRoundUser(eventLog: EventLog, round: Round, user: User): RoundUser {
  const id = round.id.concat('-').concat(user.id)
  const entity = new RoundUser(id)

  entity.round = round.id
  entity.user = user.id
  entity.timestamp = eventLog.timestamp
  entity.eventLog = eventLog.id
  entity.save()

  return entity
}
