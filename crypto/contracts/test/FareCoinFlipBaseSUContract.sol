// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/BaseSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareCoinFlipBaseSUContract is BaseSUContract, DynamicRequester {
  uint[] public mockRandomNumbers;

  error SideIsOver1();

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) BaseContract(baseContractParams) DynamicRequester(dynamicRequesterParams) {}

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    // Get the rightmost bit
    return randomNumber & uint256(1);
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
    // Rather than (PRECISION * 2) do (PRECISION << 1) for gas optimization
    return entrySide == protocolSide ? (PRECISION << 1) : 0;
  }

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public view virtual override returns (uint) {
    return calculateUserRewardsWithPPV(entryAmount, multiplier);
  }

  function submitEntry(
    uint side,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) public {
    if (side >= 2) revert SideIsOver1();
    _submitEntry(side, amount, stopLoss, stopGain, count);
  }

  function setMockRandomNumbers(uint[] memory _mockRandomNumbers) public {
    mockRandomNumbers = _mockRandomNumbers;
  }

  function expandRandomNumberTo(
    uint256 randomValue,
    uint256 expandToCount
  ) internal view override returns (uint256[] memory expandedValues) {
    return mockRandomNumbers;
  }
}
