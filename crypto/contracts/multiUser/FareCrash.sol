// @NOTE: If user cashouts on 2.00 and crashMultiplier is 2.00, right now I am considering the user has won
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/multiUser/BaseMUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareCrash is BaseMUContract, DynamicRequester {
  uint constant E = 2 ** 52;

  error SideShouldBeMoreThan100();

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) BaseContract(baseContractParams) DynamicRequester(dynamicRequesterParams) {}

  function contractSpecificCalculateUserReward(
    uint entryAmount,
    uint multiplier
  ) public pure override returns (uint) {
    return calculateUserRewardsWithoutPPV(entryAmount, multiplier);
  }

  function contractSpecificGetRoundResult(
    uint randomNumber
  ) public pure override returns (uint) {
    return getCrashMultiplierFromRandomNumber(randomNumber);
  }

  function contractSpecificGetMultiplier(
    uint entrySide,
    uint roundResult
  ) public pure override returns (uint) {
    return entrySide <= roundResult ? mulDiv(entrySide, PRECISION, 100) : 0;
  }

  // @NOTE: Sides should be in ascending order (this allows us to check uniqueness in O(n))
  function submitEntry(uint[] calldata sides, uint[] calldata amounts) public {
    uint len = sides.length;
    for (uint i; i < len; ) {
      if (sides[i] <= 100) revert SideShouldBeMoreThan100();
      unchecked {
        ++i;
      }
    }
    _submitEntry(sides, amounts);
  }

  function getCrashMultiplierFromRandomNumber(
    uint randomNumber
  ) private pure returns (uint) {
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
}
