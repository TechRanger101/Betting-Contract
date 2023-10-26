// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/BaseSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FarePlinko is BaseSUContract, DynamicRequester {
  mapping(uint => mapping(uint => mapping(uint => uint))) riskLevelToRowCountToProtocolSideToMultiplier;

  error RiskLevelIsOver2();
  error RowCountIsLessThan8OrOver16();
  error InvalidMultipliers();

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams,
    uint[17][9][3] memory _multipliers
  ) BaseContract(baseContractParams) DynamicRequester(dynamicRequesterParams) {
    setAllMultipliers(_multipliers);
  }

  function encodeSideAndSubmitEntry(
    uint8 riskLevel,
    uint8 rowCount,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) external payable {
    if (riskLevel >= 3) revert RiskLevelIsOver2();
    if (rowCount < 8 || rowCount > 16) revert RowCountIsLessThan8OrOver16();
    _submitEntry(
      encodeSide(riskLevel, rowCount),
      amount,
      stopLoss,
      stopGain,
      count
    );
  }

  function encodeSide(
    uint8 riskLevel,
    uint8 rowCount
  ) private pure returns (uint side) {
    side = (uint(riskLevel) << 8) + uint(rowCount);
  }

  function decodeSide(
    uint side
  ) private pure returns (uint8 riskLevel, uint8 rowCount) {
    riskLevel = uint8(side >> 8);
    rowCount = uint8(side);
  }

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    (, uint8 rowCount) = decodeSide(entrySide);
    uint position = 0;
    for (uint i; i < rowCount; ) {
      uint currentRandomNumber = randomNumber & uint256(1);
      randomNumber = randomNumber >> 1;
      if (currentRandomNumber == 1) {
        position++;
      }
      unchecked {
        ++i;
      }
    }
    return position;
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public view override returns (uint) {
    (uint8 riskLevel, uint8 rowCount) = decodeSide(entrySide);
    return
      riskLevelToRowCountToProtocolSideToMultiplier[uint(riskLevel)][
        uint(rowCount)
      ][protocolSide];
  }

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public pure override returns (uint) {
    return calculateUserRewardsWithoutPPV(entryAmount, multiplier);
  }

  function setAllMultipliers(uint[17][9][3] memory _multipliers) private {
    for (uint8 rL; rL < 3; ) {
      for (uint8 rC; rC < 9; ) {
        setMultipliersForRiskLevelAndRowCount(rL, rC + 8, _multipliers[rL][rC]);
        unchecked {
          ++rC;
        }
      }
      unchecked {
        ++rL;
      }
    }
  }

  function setMultipliersForRiskLevelAndRowCount(
    uint8 riskLevel,
    uint8 rowCount,
    uint[17] memory multipliers
  ) private {
    if (riskLevel >= 3) revert RiskLevelIsOver2();
    if (rowCount < 8 || rowCount > 16) revert RowCountIsLessThan8OrOver16();

    for (uint8 pos; pos <= rowCount; ) {
      riskLevelToRowCountToProtocolSideToMultiplier[uint(riskLevel)][
        uint(rowCount)
      ][pos] = multipliers[pos];
      unchecked {
        ++pos;
      }
    }
  }
}
