// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../singleUser/FareRoulette.sol";

contract FareRouletteMock is FareRoulette {
  uint[] public mockRandomNumbers;

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) FareRoulette(baseContractParams, dynamicRequesterParams) {}

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
