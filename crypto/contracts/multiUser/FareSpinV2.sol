// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/multiUser/BaseMUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareSpinV2 is BaseMUContract, DynamicRequester {
  uint public mode0TotalAmountLimit;
  uint public mode1TotalAmountLimit;
  uint public mode2TotalAmountLimit;

  error ModeCannotBeMoreThanTwo();
  error IndexesRangeFromZeroToOneForModeZero();
  error IndexesRangeFromZeroToNineForModeOne();
  error IndexesRangeFromZeroToNinetyNineForModeTwo();
  error CanHaveOneEntryAtMostForModeZero();
  error CanHaveFourEntryAtMostForModeOne();
  error CanHaveNineEntryAtMostForModeTwo();
  error ExceedsAmountLimitForModeZero();
  error ExceedsAmountLimitForModeOne();
  error ExceedsAmountLimitForModeTwo();

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) BaseContract(baseContractParams) DynamicRequester(dynamicRequesterParams) {}

  function setModeTotalAmountLimits(
    uint _mode0TotalAmountLimit,
    uint _mode1TotalAmountLimit,
    uint _mode2TotalAmountLimit
  ) public onlyOwner {
    mode0TotalAmountLimit = _mode0TotalAmountLimit;
    mode1TotalAmountLimit = _mode1TotalAmountLimit;
    mode2TotalAmountLimit = _mode2TotalAmountLimit;
  }

  // Mode indicates which type of entry they want to submit
  // To be more precise, whether they are submitting an entry for 2x, 10x, 100x. Represented by 0, 1, 2
  // Index is the position they want submit their entry on
  // To be more precise, if you have used mode as 0 (x2) you can either choose index as 0 or 1
  // For example if mode is 1 (x10), index starts from 0 and goes till 9
  // It would be similar when mode is 2 (0 to 99)
  function encodeSide(uint8 mode, uint8 index) public pure returns (uint side) {
    side = (uint(mode) << 8) + index;
  }

  function decodeSide(uint side) public pure returns (uint mode, uint index) {
    mode = side >> 8;
    index = uint(uint8(side));
  }

  // @NOTE: Sides should be in ascending order (this allows us to check uniqueness in O(n))
  function submitEntry(uint[] calldata sides, uint[] calldata amounts) public {
    uint mode0EntryCount;
    uint mode0TotalAmount;
    uint mode1EntryCount;
    uint mode1TotalAmount;
    uint mode2EntryCount;
    uint mode2TotalAmount;
    // @NOTE: We do not have to check for length mismatch of the input arrays because it will be done in `_submitEntry`
    uint len = sides.length;
    for (uint i; i < len; ) {
      (uint mode, uint index) = decodeSide(sides[i]);
      if (mode > 2) revert ModeCannotBeMoreThanTwo();
      if (mode == 0) {
        if (index > 1) revert IndexesRangeFromZeroToOneForModeZero();
        mode0TotalAmount += amounts[i];
        unchecked {
          ++mode0EntryCount;
        }
      } else if (mode == 1) {
        if (index > 9) revert IndexesRangeFromZeroToNineForModeOne();
        mode1TotalAmount += amounts[i];
        unchecked {
          ++mode1EntryCount;
        }
      } else {
        if (index > 99) revert IndexesRangeFromZeroToNinetyNineForModeTwo();
        mode2TotalAmount += amounts[i];
        unchecked {
          ++mode2EntryCount;
        }
      }
      unchecked {
        ++i;
      }
    }
    if (mode0EntryCount > 1) revert CanHaveOneEntryAtMostForModeZero();
    if (mode1EntryCount > 4) revert CanHaveFourEntryAtMostForModeOne();
    if (mode2EntryCount > 9) revert CanHaveNineEntryAtMostForModeTwo();
    if (mode0TotalAmountLimit != 0 && mode0TotalAmount > mode0TotalAmountLimit)
      revert ExceedsAmountLimitForModeZero();
    if (mode1TotalAmountLimit != 0 && mode1TotalAmount > mode1TotalAmountLimit)
      revert ExceedsAmountLimitForModeOne();
    if (mode2TotalAmountLimit != 0 && mode2TotalAmount > mode2TotalAmountLimit)
      revert ExceedsAmountLimitForModeTwo();
    _submitEntry(sides, amounts);
  }

  function contractSpecificGetRoundResult(
    uint randomNumber
  ) public pure override returns (uint) {
    return (randomNumber % 100);
  }

  function contractSpecificGetMultiplier(
    uint entrySide,
    uint roundResult
  ) public pure override returns (uint) {
    (uint mode, uint index) = decodeSide(entrySide);
    if (mode == 0) {
      return index == (roundResult % 2) ? 2 * PRECISION : 0;
    } else if (mode == 1) {
      return index == (roundResult % 10) ? 10 * PRECISION : 0;
    } else {
      return index == roundResult ? 100 * PRECISION : 0;
    }
  }

  function contractSpecificCalculateUserReward(
    uint entryAmount,
    uint multiplier
  ) public view override returns (uint) {
    return calculateUserRewardsWithPPV(entryAmount, multiplier);
  }
}
