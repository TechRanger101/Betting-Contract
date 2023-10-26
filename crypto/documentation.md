# Fare Protocol

Fare Protocol aims to create probability contracts.
These probability contracts will mint/burn FARE tokens.
Third party developers should be able to develop their own probability contracts by building up on provided base contracts.
Whenever a third party developer comes up with a probability contract. They have to make use of the FARE token and request permission to be able to mint/burn FARE token.
Each probability contract will mint some FARE to host (third party developer's address) and to protocol on each interaction.
Fare Protocol will inspect the deployed and verified contract to grant the permission to mint/burn FARE token. When inspecting, following things should be considered: the contract should burn more than mint (allowing FARE to be deflationary), should mint adequate rewards to host, should mint adequate rewards to protocol, contract should not be able to change these factors after being deployed even by the owner of the contract and contract should not be exploitable. Since we are allowing the contract to mint/burn FARE, any contract can have a huge impact on the supply if something goes wrong.

## Requesters

### Base Requester

Base Requester is the abstract contract that allows probability contracts to request and receive random numbers.

Probability contracts will extend this contract to be able to request and receive random numbers and will not bother how they are doing so.

Specific requesters will implement how to request and receive random numbers, like using a VRF, QRNG, Keccak or a different random number request and receive mechanism.

It also includes a function to expand a random number. Considering the initial number is truly random, this function should create more random numbers from it.

#### VRF Requester

Should implement the process for requesting and resolving random numbers using Chainlink's VRF.

#### QRNG Requester

Should implement the process for requesting and resolving random numbers using API3's QRNG.

#### Keccak Requester

Should implement the process for requesting and resolving random numbers using keccak. It uses the function inside Randomness Library to get a keccak based random number. There is this `resolver` address who is the only one allowed to resolve a random number request. Different from other requesters, this one allows batch resolvement.

NOTE: We believe with our current implementation, this address could simulate the transaction result and choose not to resolve the request inside that block if it causes a loss for the user and wait to resolve till a block where they see that user wins. Just to make sure, are we right with the judgment that third party developers could manipulate the system if they were in control of the `resolver` address? Assuming so, as Fare Protocol we can not allow third party developers to have control over this address. As a result, we are assuming this address is controlled by the Fare Protocol for now. Suggestions on how to achieve an implementation where Fare Protocol could allow this address to be in control of third party developers is highly appreciated. Maybe using some type of max block count to resolve or maybe even allowing anyone to resolve? Any new ideas are highly appreciated.

NOTE: Since we want to be able to allow the `resolver` address to be out of our control. We added a future where if the entry submission and entry resolvement happens inside the same block, resolvement would fail. Right now, since we are assuming the `resolver` address is in control of the Fare Protocol this might not be very effective but it is a step forward.

#### Dynamic Requester

Allows changing between different requesters. Currently, supports all previously mentioned requesters. At any time, the owner of the contract can change which requester is being used.

NOTE: Assuming random number is requested by requester type A, requester type B should not be able to resolve it. We should also remember that in between request and resolvement, the active requester type might change. For example, if the random number requested while active requester type was A and before resolving it, active requester type changed to B, still the old request should be resolved according to request type A.

## Libraries

### Randomness

Have a function to get a random number using keccak. This library will be used by multiple probability contracts therefore, we have to make sure that users cannot create an advantage because of this fact. For example, it should return different random numbers when it is called by different contracts, even inside the same block. If it returned the same random number for different contracts in the same block, users might come up with a strategy to have some advantage. This idea also applies to the below function.

Have another function where it takes some nonce as an argument to include inside the random number generation process. Allowing contracts to call this function with different nonces to create multiple random numbers inside the same block.

## Base Contract

It is the base contract for any probability contract. Inside the contract, there are some immutable variables, the main reason they are immutable is the fact that we are always assuming that the probability contract's owner will be a third party developer and protocol does not have to trust the third party developer. Therefore, even `onlyOwner` functions will be callable by the third party developer and we should assume that the third party developer could be malicious. It includes a term called "Protocol Probability Value" or PPV. For example, in a Coin Flip if both sides, heads and tails, have 50% chance of occurence and when the user guesses it wrong loses all the FARE and when guesses it right gets 1.98 times their FARE, we will have 1% PPV. Without more info we would expect the FARE supply to decrease by 1% in the long run for this probability contract. On the other hand, there are some extra features like minting rewards for the host and the protocol. Currently we have fixed values for how much we want the contract to mint for the host and protocol. For the host, it should mint 15% of the PPV. For the protocol, it should mint 5% of the PPV. Therefore, in general we are expecting a deflation of 80% of the PPV. For the Coin Flip example, PPV will ve 1%, 15% of the 1% (0.15%) will be minted to the host, 5% of the 1% (0.05%) will be minted to the protocol. As a result, we would expect 0.80% deflation.

## Single User Contracts

### BaseSUContract (Base Single User Contract)

Extends Base Contract and Base Requester. Adds functionality for single user interaction based contracts. Allows users to submit an entry and withdraw an entry.

Submitting an Entry: While submitting an entry user could choose to have count (represent how many times the entry should be used. For example, if count is 2 for Coin Flip, the coin will be flipped twice), they could also choose to have stop loss and stop gain limits that would allow them to break out of running counts if a limit has been reached. When a user submits an entry, their FARE should be burned and a random number should be requested.

Withdrawing an Entry: User should be able to withdraw an entry if the random number fails to be resolved. There is this possibility that VRF or any other mechanism fails to resolve with a random number. We have this withdrawal mechanism for this case. To make sure that they are not withdrawing immediately after submitting an entry. We are requiring 200 blocks to pass.
NOTE: We are not sure about this block amount. We are planning on deploying to Arbitrum, in this case, we would like to have a suggestion on how many blocks we should wait to consider a random number resolvement failure.

Resolving an Entry: Specific Requester implementation contract will call the `resolveRandomNumber` function to resolve the entry. When a random number is being resolved, it could mint rewards for the user or if the user loses all, it will not mint any FARE to the user. But, no matter the outcome, it will mint FARE to host and protocol, based on the entry amount and entry's actual count. Entry's count could differ from entry's actual count if a stop gain or a stop loss limit has been triggered.

There are different ways a developer can create PPV for the contract. Let's consider a Coin Flip contract. Assuming both sides of the coin have a 50% chance of occurence. If there was no PPV, when the user guesses correctly the user rewards should be 2 times the entry amount and when the user guesses wrong the user rewards should be 0. In order to create some PPV, developers could do a lot of things, probably more than we could imagine and they can always come up with new techniques. But we will try to explain a few ways we have come up with. First of all, they always have to set PPV when deploying a contract to make sure that we are minting adequately for the host and the protocol. By using this PPV value, they can update the user rewards. For the Coin Flip example, they can initialize the contract with 1% PPV and they would update user rewards accordingly, in this case, the user rewards for correctly guessing would be 1.98 and losing will again be 0. Another way could be breaking our assumption that they both have 50% change of occurence. They could assume that with 1% (current PPV) users will always lose and will give the remaining 99% to heads and tails, resulting in 49.5% for each. Since the developer has control over the code they can come up with anything they want. It does not make sense for Coin Flip but when you consider Roulette, the user rewards multipliers already have common values such as blacks or reds provide x2 and green provides x36. In this case, the developer does not have to additionally include a PPV. All they have to do is, calculate the PPV of Roulette and set it correctly when initializing the contract.

### NFTBPPVSUContract (NFT Based PPV Single User Contract)

It extends the BaseSUContract. It extends the second idea mentioned just above, where there is 1% chance of the user losing no matter what. This contract allows the same idea but when that 1% occurs, this contract mints an NFT to the user to represent the entry. It will include the data of the entry, things like entry amount, entry's actual count and similar things. For the implementation of this, it will use the initial random number provided by the base requester to decide if it was a NFT mint. If so, it will just mint and it ends there. Else, the contract will expand the initial random number and use the newly created random number to decide on the protocol side.

### NFTorURBPPVSUContract (NFT or User Rewards Based PPV Single User Contract)

It extends the NFTBPPVSUContract. At any time, the owner of the contract can change whether they are achieving PPV by using the NFT logic or by updating the user rewards.

## Single User Probability Contracts

Contracts that extend NFTorURBPPVSUContract and DynamicRequester: `FareCoinFlip`, `FareRPS`, `FareRollOver`, `FareBomb`
For these contracts, we are calculating probabilities and setting multipliers accordingly. Afterwards, we are achieving PPV by either using the NFT minting logic or updating the user rewards with PPV value.

Contracts that extend BaseSUContract and DynamicRequester:
`FarePlinko`, `FareRoulette`
For these contracts, we are setting the multipliers according to common values and we are not calculating probabilities for these outcomes. Because of the multiplier values, there is PPV and we are not minting an NFT or updating the user rewards with PPV value.

### How to Create a new Single User Probability Contract as a Third Party Developer

1. Extend the adequate base single user contract based on the logic of their contract. These contracts could be: `BaseSUContract`, `NFTBPPVSUContract`, `NFTorURBPPVSUContract`. For example, it does not make sense to use `NFTBPPVSUContract` for Roulette because it already has PPV baked in by having multipliers not directly correlated with probabilities. In general, we are using `NFTBPPVSUContract` or `NFTorURBPPVSUContract` when we are calculating multipliers from probability and adding PPV with additional features. Whereas if developers want to set the multipliers and don't want to calculate probabilities it makes more sense to use `BaseSUContract`.

2. Extend the specific requester type you want to use. For example: `KeccakRequester`, `VRFRequester`, `QRNGRequester` or `DynamicRequester`.

3. Implement contract specific functions.

   3.1 `contractSpecificGetProtocolSide(uint randomNumber, uint entrySide)`: Should return protocol's side based on random number and entry side. For Coin Flip, the entry side is not helpful, developers can just come up with a protocol side based on random numbers. Which is not the case for Plinko. Users could choose to have 8 rows or 16 rows therefore protocol side could be restricted to 8 or 16 based on the entry's side.

   3.2 `contractSpecificGetMultiplier(uint protocolSide, uint entrySide)`: Should return multiplier for user reward based on protocol side and entry side. For Coin Flip, if the entry side is the same as a protocol side it would mean user guessed it right and this function should return 2.

NOTE: Since we are handling decimal numbers like 1.98, `contractSpecificGetMultiplier` function should not directly return 2 to represent that the user should get 2 times their entry amount. It should return `2 * PRECISION` to represent that case.`PRECISION` variable is defined inside the `BaseContract` to improve precision for calculation in general and it is set to `1 ether`.

3.3 `contractSpecificCalculateUserRewards(uint entryAmount, uint multiplier)`: Should return user reward amount to mint to the user. We have a helper function inside `BaseContract`called`calculateUserRewardsWithoutPPV`and`calculateUserRewardsWithPPV` for developers to use inside this function. Note, if you have extended `NFTBPPVSUContract`or`NFTorURBPPVSUContract` you dont have to implement this function because it is already implemented inside those.

### FareCoinFlip

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Multipliers are set to 2 or 0 for guessing it right or wrong. When NFT logic is in use, user rewards would be 2 and 0. When user reward logic is in use, user rewards would be 1.98 and 0.

### FareRPS

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Multipliers are set to 0, 1 or 2 for guessing if it loses, draws and wins. When NFT logic is in use, user rewards would be 0, 1, 2. When user reward logic is in use, user rewards would be 0, 0.99, 1.98.

### FareRollOver

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Multipliers are calculated based on the probability for the entry side. If NFT logic is in use, there is this 1% chance of losing no matter what. At the remaining 99%, user rewards will be calculated by updating the multiplier with PPV.

### FareBomb

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Multipliers are calculated based on the probability for given bombCount and revealCount. If NFT logic is in use, there is this 1% chance of losing no matter what. At the remaining 99%, user rewards will be calculated by updating the multiplier with PPV.

### FareRoulette

PPV is set to 0.027 ether to represent 2.7% at deployment. Expected to cause 2.16% deflation in the long run.
Multipliers are already set as well known values. PPV is not used for minting a NFT or updating the user rewards. Because of the well known multipliers that are not directly correlated with probabilities PPV already exists. As a result, PPV value of 0.027 ether value is only used when minting for the host or the protocol.

### FarePlinko

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Multipliers are already set as well known values. PPV is not used for minting a NFT or updating the user rewards. Because of the well known multipliers that are not directly correlated with probabilities PPV already exists. As a result, PPV value of 0.01 ether value is only used when minting for the host or the protocol.

## Multi User Contract

### BaseMUContract (Base Multi User Contract)

Extends Base Contract, Base Requester and Manageable. Adds functionality for multi user interaction based contracts. It is round based and multiple users would enter the same round. Round would be paused causing no new entries to be submitted and random numbers would be requested. When a random number gets resolved it would resolve the round therefore, unpause the round and immediately start the next round by incrementing the roundId. Users are able to claim rewards for resolved rounds.

Submitting an Entry: Users can submit an entry for the current round. No entry could be submitted after the round has been paused and requested a random number. Different from the Single User Contracts, this contract mints for the host and the protocol while submitting an entry. Because, if we were minting for the host and the protocol while users are claiming. They might not claim when they lost because they would have no incentive to do so. Causing loss of minting for host and protocol.

Withdrawing an Entry: User should be able to withdraw an entry if the random number fails to be resolved. There is this possibility that VRF or any other mechanism fails to resolve with a random number. We have this withdrawal mechanism for this case. We are requiring 200 blocks to pass after the round gets paused (because this is the block we are requesting a random number). In addition, we are burning host and protocol rewards that are minted when submitting the entry.
NOTE: We are not sure about this block amount. We are planning on deploying to Arbitrum, in this case, we would like to have a suggestion on how many blocks we should wait to consider a random number resolvement failure.

Pausing a round and requesting a random number: This function can only be called by the `owner` or the `manager`. It pauses the round so causes no more entries to be submitted and it requests a random number.

Resolving random number and unpausing a round: This function can only be called by the specific requester's resolver address. It stores the protocol side for the round and starts the next round.

Random number failure: This function can be called by anyone. It can be called if 200 blocks have been passed after a random number has been requested. It marks the round to be failed and starts the next round.

Claiming for an Entry: Anyone can call this function to claim their entry. In addition, someone else can call this function to execute the process for users to claim their entry. Based on the entry's side and round's result it calculates the user rewards and mints the rewards for the entry.

Batch Claiming for multiple rounds: Anyone can call this function. It claims user rewards for a specific address for multiple rounds.

### How to Create a new Multi User Probability Contract as a Third Party Developer

1. Extend `BaseMUContract`

2. Extend the specific requester type you want to use. For example: `KeccakRequester`, `VRFRequester`, `QRNGRequester` or `DynamicRequester`.

3. Implement contract specific functions.

   3.1 `contractSpecificGetRoundResult(uint randomNumber)`: Should return protocol's side based on random number. For Spin, this would represent which slot it has been landed.

   3.2 `contractSpecificGetMultiplier(uint side, uint roundResult)`: Should return multiplier for user reward based on round result and side. For Spin, if the side is submitted for 10x and round, the result is so that the user has guessed it correct. This function should return 10.

NOTE: Since we are handling decimal numbers like 1.98, `contractSpecificGetMultiplier` function should not directly return 10 to represent that the user should get 10 times their entry amount. It should return `10 * PRECISION` to represent that case.`PRECISION` variable is defined inside the `BaseContract` to improve precision for calculation in general and it is set to `1 ether`.

3.3 `contractSpecificCalculateUserRewards(uint entryAmount, uint multiplier)`: Should return user reward amount to mint to the user. We have a helper function inside `BaseContract`called`calculateUserRewardsWithoutPPV`and`calculateUserRewardsWithPPV` for developers to use inside this function. Note, if you have extended `NFTBPPVSUContract`or`NFTorURBPPVSUContract` you dont have to implement this function because it is already implemented inside those.

### FareCrash

Main logic is that the user's entry side should be below or equal to the crash point for the user to be able to claim. In addition, user rewards are based on how high the user's entry's side is.

PPV is set to 0.03 ether to represent 3% at deployment. Expected to cause 2.40% deflation in the long run.
PPV is created by the process that maps a random number to a crash multiplier. If the random number is divisible by 33, the round result becomes 100. Since, users can submit an entry above 100 and they have to have a lower entry side than round result for them to be able to claim. It causes every user for that round to lose. For the remaining rounds, it is expected to have no PPV.

FareCrash's crash multiplier generation algorithm does not have uniform distribution. It has this specific distribution logic where
Probability of a number coming below x should be around 1 - 1/x
P(X <= x) ~ 1 - 1/x
Another way to calculate it is: 1/33 + 32/33(0.01 + 0.99(1 - 1/x))
as explained inside `/calc/crash.ts`. To understand it better you can take a look at that file.

### FareSpinV2

PPV is set to 0.01 ether to represent 1% at deployment. Expected to cause 0.80% deflation in the long run.
Main logic is that the user can choose whether to submit for x2, x10 or x100. There is one shared round result. Which will be from 0 to 99 (inclusive). When a user tries to claim, user rewards will be updated with PPV value to create PPV explicitly.
