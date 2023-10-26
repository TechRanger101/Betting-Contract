# Table of Contents

- [Table of Contents](#table-of-contents)
- [Documentation](#documentation)
  - [FARE Token](#fare-token)
  - [FARESpin Contract](#farespin-contract)
  - [User Interface](#user-interface)
  - [Multiplier Modes](#multiplier-modes)
  - [Outcome](#outcome)
  - [VRF](#vrf)
  - [Deflation](#deflation)
  - [Core Functions](#core-functions)
- [Running the repo](#running-the-repo)
  - [Requirements](#requirements)
  - [Project Setup](#project-setup)
  - [Etherscan verification](#etherscan-verification)
  - [Performance optimizations](#performance-optimizations)
- [Change Log (Audit - Revisions #1)](#change-log-audit---revisions-1)
- [Change Log (Audit - Revisions #2)](#change-log-audit---revisions-2)

# Documentation

## FARE Token

- FARE is a variable supply token created by FAREToken.sol. Supply variance is effected through the `mintFare()` and `burnFare()` functions from `FareToken.sol`. The `mintFare()` and `burnFare()` functions are called by other contracts.

## FARESpin Contract

- One such contract, FARESpin, utilizes on-chain verifiable randomness to provide a probabilistic outcome from a dataset. VRFConsumerBase (a contract which requires LINK tokens to function) is used to achieve on-chain verifiable randomness for the FARESpin contract.

## User Interface

- A user calls FARESpin through an interface with a spinning wheel consisting of a number of colored ‘ticks’. These colored ‘ticks’ represent the dataset of the FARESpin contract. A user selects the colored ‘tick’ on which they guess wheel will stop, and submits their selection(s) (with a quantity of FARE allocated for that selection) through the UI. This prompts the user’s wallet software to display, from which the user can confirm their submission to the blockchain.

## Multiplier Modes

- The FARESpin contract has different multiplier modes, each of which have datasets of different length, and therefore a different probability of outcome.

- multiplier Mode (User Interface): The number of colored ‘ticks’ on the spinning wheel correspond to the dataset of the multiplier mode selected by the user.

## Outcome

- All FARE submitted for the round is burned upon submission to the blockchain.
- A small variable percentage of token is minted to the rewards DAO (1% initially)

## VRF

- At a predetermined interval the window for submissions for a given round is closed and VRFConsumerBase is called. The VRF is compared to the user selections for each round.

- A successful selection (the User’s color selection matches the outcome of VRF) allows the user to call the mintFARE() function through the UI and their wallet software. A quantity of FARE(some multiple of the FARE submitted by the user) will then be minted to the user’s address which made the submission.

## Deflation

- Because the outcomes of FARESpin (and other contracts which interact with FARE) are probabilistic, the supply may increase or decrease as a result of the outcome of any given round. Due to a higher probability of burn than mint in the FARESpin (and other contracts which interact with FARE). The overall trend is expected to be a decline in the FARE token supply over many rounds.

## Core Functions

- `createEntryHistory()`: inits the EntryHistory array
- `requestRandomNumber()`: checks whether users are active and enough LINK is available, then requests on chain verifiable random numbers and emits a RandomNumberRequested event
- `fulfillRandomness()`: checks whether users are active and calls concludeRound()
- `placeBatchEntry()`: checks whether entries can be placed, then records all entries made by users while checking for min amounts, max amounts, duplicates, correct numbers picked, and entry limits; if all the checks are met, then the users are entered into a round, all the entry amount is burned, and the correct amount is minted to the rewards, which is followed by emitting the EntrySubmitted event
- `settleBatchEntry()`: gets the batch entries placed by a user, determines whether an nft should be minted and the total mint amount for that user, then emits the EntrySettled event
- `concludeRound()`: updates round with all the Round properties by contractId, calls setEliminators() with updated values, emits the RoundConcluded event, and allows users to place entries for the next round by emitting the RoundPausedChanged event
- `mintEliminatorNFT()`: emits the NFTMint event
- Getters
- `getFareTokenAddress()`: returns the FareToken contract address
- `getEntryCount()`: returns the number of entries a user makes per round from batchEntryMap
- `getBatchEntryCount()`: returns the number or users participating per round from rounds
- `getEntriesByRounduser()`: returns an array of entries a user makes per round from batchEntryMap
- `getEntryByIndex()`: returns a single entry for a user by round id from batchEntryMap
- `getCurrentContractModeId()`: returns current contract mode id
- `getIsEliminator()`: returns a boolean if the current contractModeId is an eliminator based on the roundId from rounds
- `getEliminatorsByRoundId()`: returns an array of eliminators by roundId from rounds
- `getCurrentRoundId()`: returns current round id
- `getAllusersByRoundId()`: returns an array of user addresses by roundId from rounds
- Setters
- `setFareToken()`: sets the local fareToken address
- `setContractExpectedValueFloor()`: sets the contractExpectedValueFloor in contractModes and emits a ContractModeUpdated event
- `setRewardsAddress()`: sets the rewardsAddress
- `setRewardsMint()`: sets rewardsMint to the mint percent, rewardsMint is init to 100
- `setContractMode()`: sets all the ContractMode properties in contractModes by \_currentContractModeId and emits a ContractModeUpdated event
- `setContractModeMinMax()`: sets minAmount and maxAmount in contractModes by contractModeId and emits a ContractModeUpdated event
- `setContractModeIsActive()`: sets the isActive property in contractModes by contractModeId and emits a ContractModeUpdated event
- `setContractModeEntryLimit()`: sets entryLimit by contractModeId in contractModes and emits a ContractModeUpdated event
- `setEliminators()`: sets all the Eliminator properties in rounds by roundId
- `setRoundPaused()`: sets the value of isRoundPaused and emits a RoundPausedChanged event
- Events
- `event RandomNumberRequested()`: notifies changes to vrfRequestId
- `event EntrySubmitted()`: notifies changes to roundId, batchId, and user
- `event EntrySettled()`: notifies changes to roundId, user, and hasMinted
- `event ContractModeUpdated()`: notifies changes to contractModeId
- `event RoundConcluded()`: notifies changes to roundId, vrfRequestId, randomNum, and randomEliminator
- `event RoundPausedChanged()`: notifies changes to isPaused
- `event NFTMint()`: notifies changes to roundId and user
- Testing Helper Functions
- `testConcludeRound()`: this is a mock round concluded function for testing purposes
- `testFulfillRandomness()`: this is a mock function function to test concludeRound()
- `getRandomness()`: this is a mock function to simulate randomness for testing purposes

---

# Running the repo

## Requirements

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- [Node.js](https://nodejs.org/en/) - v16+ (recommended v16.3.2)
- [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable) v1.22+ (recommended v1.22.18)

## Project Setup

1. Clone this respository
2. Install the project dependencies - Run `yarn` in the root directory
3. Create a .env file in the root directory
4. Copy and paste the default variables below
   - Feel free to change any of the default variables
5. `npm run test` to run tests
6. `npm run coverage` to produce coverage report -> ./coverage/index.html
7. `npm run local:node` to run a local hardhat node
   - If running `npx hardhat run [script_path]` or `npx hardhat console` you'll need to add `--network localhost`

> **_`.env` default variables_**

```shell
DE_TRANSPILE_ONLY=1
DEFAULT_HARDHAT_NETWORK=hardhat
HARDHAT_LOGGING=false
REPORT_GAS=false
ABI_EXPORTER=false
CONTRACT_SIZER=false
SIMULATION_LOGGING=true
```

> Hardhat Commands

- `npx hardhat compile` - Compile smart contracts in `./contracts/**/*.sol`
- `npx hardhat clean` - Clean/remove all cache in the project
- `npx hardhat test` - Run all tests in `./test/**/*.ts`
- `npx hardhat node` - Run a local Hardhat Network
- `npx hardhat help` - Lists all hardhat tasks and options
- `npx hardhat help [task]` - Lists help info for a specific tasks
- `npx hardhat coverage` - Returns a coverage report for smart contracts

> Custom Tasks

- `npx hardhat accounts` - Lists all signers pubic addresses
- `npx hardhat balances` - Prints all primary currency balances for the signers
- `npx hardhat deploy [target]` - Deploy smart contract(s)
  - `[target] Options: (default: all), token, spin`
- `npx hardhat simulate [target]` - Simulates rounds of the contract contracts
  - `[target] Options: (default: all), spin, roll(coming soon), crash(coming soon)`
  - `./simulate.json` - Change properties to customize the simulation

## Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/sample-script.ts
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

## Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment. For more details see [the documentation](https://hardhat.org/guides/typescript.html#performance-optimizations).

# Change Log (Audit - Revisions #1)

- QSP-1 - Documentation for `FARESpin` has been added to the repo
- QSP-2 - A `pause` variable has been implemented to prevent users from submitting entries between rounds/fetching randomness
- QSP-3 - `FareSpin` now prevents an address from being set to `0x0...`
  - [x] `FareSpin.constructor()`
  - [x] `FareSpin.setRewardsAddress()`
  - [x] `FareSpin.setFareToken()`
- QSP-4 - Removed ability to renounceOwnership, removed OpenZeppelin's `Ownable` library, implemented setting `_owner` in constructor, added `owner()` that returns owner address, added `onlyOwner` modifier.
- QSP-5 - Added `REWARDS_MINT_CAP` constant that ensures the rewards mint is no higher than 10%
- QSP-6 - We are comfortable with this risk since we'll be manually added and adjusting eliminators / contract modes. If we run into issues during our testnet demo we'll hardcode contract modes / eliminators.
- QSP-7 - We are comfortable with this risk for the time being. We are internally working on a subnet/solution that will provide random numbers consistently.
- QSP-8 - Thanks for making us aware. A note has been made internally for our dev team.
- QSP-9 - A `batchEntryLimit` has been added to ensure someone cannot place an entry for all possible contract mode numbers
  - [x] 2x - limit 1 entry
  - [x] 10x - limit 5 entry
  - [x] 100x - limit 10 entry
- QSP-10 - Removed ability to renounceOwnership, removed OpenZeppelin's `Ownable` library, implemented setting `_owner` in constructor, added `owner()` that returns owner address, added `onlyOwner` modifier.
- QSP-11 - `SafeMath` has been removed.
- QSP-12 - We are internally working on a formula that will change the mint limit periodically. For now, we are fine with this risk since in the future we will have a historical map that shows the mint limit at any given time. That way we can allow users to settle/mint tokens without concern for the mint limit.
- QSP-13 - The caret for the pragma has been removed.
- QSP-14 - Refer to change log QSP-7 answer
- QSP-15 - Removed division for cardinality 10. (This was old code from a previous revision)
- QSP-16 -Added ability to change contract pause state (`Pauseable` / `pauseContract`)

# Change Log (Audit - Revisions #2)

- Renamed the term `treasury` to `rewards` throughout the codebase
  - Note: The variable `TESTNET_TREASURY_KEY` has changed to `TESTNET_REWARDS_KEY` in `.env`. You may need to change this manually before running `npm run test`
- QSP 2 - Added two require statements to `concludeRound` and `requestRandomNumber` which prevent requesting/receiving random numbers before the round is paused.
- QSP 5 - I derped up with the logic in the most recent commit (good catch), so the previous logic was not intended. I've made a couple changes to the calculation and I've written tests to ensure the cap is enforced and the correct FARE amount is being minted.
  - Changed `REWARDS_MINT_CAP` and `rewardsMint` to now be based off of 17 decimal places.
  - `REWARDS_MINT_CAP = 10 ** 17 // 10% Cap`
  - `rewardsMint = 10 ** 16 // Set at 1% initially`
  - Calculation to determine rewards mint amount: `rewardsMintAmount = totalEntryAmount * rewardsMint / 10 ** 18`
  - I'm really a big fan of Solidity not supporting supporting decimals /s
