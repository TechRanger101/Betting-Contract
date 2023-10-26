// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/BaseSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareRoulette is BaseSUContract, DynamicRequester {
  enum COLOR {
    GREEN,
    RED,
    BLACK
  }

  error SideIsOver45();

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) BaseContract(baseContractParams) DynamicRequester(dynamicRequesterParams) {}

  function submitEntry(
    uint side,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) public {
    if (side >= 46) revert SideIsOver45();
    _submitEntry(side, amount, stopLoss, stopGain, count);
  }

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public pure override returns (uint) {
    return calculateUserRewardsWithoutPPV(entryAmount, multiplier);
  }

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    return randomNumber % 37;
  }

  // Assuming entrySide is 0<=entrySide<=45, anything more than 45 would be considered as 45
  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
    if (entrySide <= 36) {
      return entrySide == protocolSide ? 36 * PRECISION : 0;
    } else if (entrySide == 37 || entrySide == 38) {
      // Check isRed (37) or isBlack (38)
      COLOR protocolColor = getColor(protocolSide);
      // red is represented as 1, black is represented as 2
      // user's entry on red is represented as 37, on black as 38
      // Therefore, entrySide % 36 will give us either 1 or 2
      // Where again 1 is red and black is 2
      // Therefore, we compare the equivalency to check if user won their black or red entry
      return uint(protocolColor) == entrySide % 36 ? 2 * PRECISION : 0;
    } else if (entrySide == 39) {
      // Check is 1to18
      return protocolSide > 0 && protocolSide <= 18 ? 2 * PRECISION : 0;
    } else if (entrySide == 40) {
      // Check is 19to36
      return protocolSide > 18 && protocolSide <= 36 ? 2 * PRECISION : 0;
    } else if (entrySide == 41) {
      // Check isOdd
      return (protocolSide % 2) * 2 * PRECISION;
    } else if (entrySide == 42) {
      // Check isEven
      // @NOTE: 0 is not considered as even. First ternary operation is for that case
      return protocolSide == 0 ? 0 : protocolSide % 2 == 0 ? 2 * PRECISION : 0;
    } else if (entrySide == 43) {
      // Check first dozen <1to12>
      return protocolSide > 0 && protocolSide <= 12 ? 3 * PRECISION : 0;
    } else if (entrySide == 44) {
      // Check second dozen <13to24>
      return protocolSide > 12 && protocolSide <= 24 ? 3 * PRECISION : 0;
    } else {
      // Check second dozen <25to36>
      return protocolSide > 24 && protocolSide <= 36 ? 3 * PRECISION : 0;
    }
  }

  // With assumption that 0<=protocolSide<=36, anything more than 36 would be considered as 36
  function getColor(uint protocolSide) private pure returns (COLOR) {
    if (protocolSide == 0) {
      return COLOR.GREEN;
    } else if (protocolSide >= 1 && protocolSide <= 10) {
      if (protocolSide % 2 == 0) {
        return COLOR.BLACK;
      } else {
        return COLOR.RED;
      }
    } else if (protocolSide >= 11 && protocolSide <= 18) {
      if (protocolSide % 2 == 0) {
        return COLOR.RED;
      } else {
        return COLOR.BLACK;
      }
    } else if (protocolSide >= 19 && protocolSide <= 28) {
      if (protocolSide % 2 == 0) {
        return COLOR.BLACK;
      } else {
        return COLOR.RED;
      }
    } else {
      if (protocolSide % 2 == 0) {
        return COLOR.RED;
      } else {
        return COLOR.BLACK;
      }
    }
  }
}
