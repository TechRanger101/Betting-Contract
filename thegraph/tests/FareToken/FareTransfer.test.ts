import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { handleTransfer } from "../../src/fareToken"
import { createTransferEvent } from "./utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

const from = Address.fromString("0x0000000000000000000000000000000000000000")
const to = Address.fromString("0x0000000000000000000000000000000000000001")
const amount = BigInt.fromString("50000000000000000000000000000")
const type = "Mint"
let id = ""

describe("Describe entity assertions", () => {
  beforeAll(() => {
    const newTransferEvent = createTransferEvent(from, to, amount)
    id = newTransferEvent.transaction.hash.toHex().concat('-').concat(newTransferEvent.logIndex.toHex())
    handleTransfer(newTransferEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("FareTransfer created and stored", () => {
    assert.entityCount("FareTransfer", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "FareTransfer",
      id,
      "from",
      from.toHex()
    )
    assert.fieldEquals(
      "FareTransfer",
      id,
      "to",
      to.toHex()
    )
    assert.fieldEquals(
      "FareTransfer",
      id,
      "amount",
      amount.toString()
    )
    assert.fieldEquals(
      "FareTransfer",
      id,
      "type",
      type
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
