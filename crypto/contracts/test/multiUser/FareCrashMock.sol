// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../multiUser/FareCrash.sol";

contract FareCrashMock is FareCrash {
  bool public mockIsNFTMint;
  uint[] public mockRandomNumbers;

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) FareCrash(baseContractParams, dynamicRequesterParams) {}

  function mockResolveRound(uint crashMultiplier) public whenRoundPaused {
    // // Store the multiplier for the round
    // roundIdToRoundResult[roundIdCounter] = crashMultiplier;
    // // Initiate the next round by incrementing the round counter and unpausing the round (because it is a new round). Also emit an event for backend
    // isRoundPaused = false;
    // emit RoundResolved(roundIdCounter++, crashMultiplier);

    // uint roundId = requestIdToRoundId[requestId];
    // if (roundId != roundIdCounter) {
    //   revert RequestIdIsNotForCurrentRound();
    // }
    // if (roundIdToIsFailed[roundId]) revert RoundAlreadyFailed();
    // Since third party developers can use KeccakRequester and potentially simulate submitting and resolving an entry inside the same block
    // We have to consider this posibility and not allow them to resolve in the same block as they submitted
    // if (roundIdToBlockNumber[roundId] == block.number) {
    //   revert CannotRequestAndResolveRandomNumberInsideSameBlock();
    // }
    uint roundResult = crashMultiplier;
    roundIdToRoundResult[roundIdCounter] = roundResult;
    isRoundPaused = false;
    emit IsRoundPausedUpdate(false);
    emit RoundResolved(roundIdCounter++, roundResult);
  }

  function getCrashMultiplierFromRandomNumberForSimulation(
    uint randomNumber
  ) external pure returns (uint) {
    uint randomNumberAfterHashAndShift = uint(
      keccak256(abi.encodePacked(randomNumber))
    ) >> 204;
    if (randomNumberAfterHashAndShift % 33 == 0) {
      return 100;
    }
    return
      (100 * E - randomNumberAfterHashAndShift) /
      (E - randomNumberAfterHashAndShift);
  }

  function simulateRequestId(
    uint requesterRequestCount
  ) public view returns (uint) {
    return
      uint256(
        keccak256(
          abi.encodePacked(
            block.chainid,
            address(this),
            requesterRequestCount,
            msg.sender
          )
        )
      );
  }
  //   function resolveRound() external onlyManagerOrOwner whenRoundPaused {
  //     // Store the multiplier for the round
  //     uint crashMultiplier = getCrashMultiplierFromRandomNumber(
  //       Randomness.getRandomness()
  //     );
  //     roundIdToCrashMultiplier[roundIdCounter] = crashMultiplier;
  //     // Initiate the next round by incrementing the round counter and unpausing the round (because it is a new round). Also emit an event for backend
  //     isRoundPaused = false;
  //     emit RoundResolved(roundIdCounter++, crashMultiplier);
  //   }
}
