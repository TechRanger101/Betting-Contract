import { Address } from "@graphprotocol/graph-ts"
import { Transfer } from "../generated/FareToken/FareToken"
import { FareTransfer } from "../generated/schema"
import { getEventLog, getUser } from "./utils"

export function handleTransfer(event: Transfer): void {
  const eventLog = getEventLog(event, "Transfer")

  const fareTransfer = new FareTransfer(eventLog.id)

  fareTransfer.from = event.params.from
  fareTransfer.to = event.params.to
  fareTransfer.amount = event.params.value

  const from = getUser(eventLog, fareTransfer.from)
  const to = getUser(eventLog, fareTransfer.to)

  if (event.params.from == Address.zero()) {
    fareTransfer.type = "Mint"
    to.balance = to.balance.plus(fareTransfer.amount)
    to.totalClaimed = to.totalClaimed.plus(fareTransfer.amount)
  } else if (event.params.to == Address.zero()) {
    fareTransfer.type = "Burn"
    from.balance = from.balance.minus(fareTransfer.amount)
    from.totalBurn = from.totalBurn.plus(fareTransfer.amount)
  } else {
    fareTransfer.type = "Transfer"
    from.balance = from.balance.minus(fareTransfer.amount)
    from.transferOut = from.transferOut.plus(fareTransfer.amount)
    to.balance = to.balance.plus(fareTransfer.amount)
    to.transferIn = to.transferIn.plus(fareTransfer.amount)
  }

  from.save()
  to.save()

  fareTransfer.timestamp = eventLog.timestamp
  fareTransfer.eventLog = eventLog.id
  fareTransfer.save()
}
