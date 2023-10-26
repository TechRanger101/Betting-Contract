// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../singleUser/FarePlinko.sol";

contract FarePlinkoMock is FarePlinko {
  uint[] public mockRandomNumbers;

  constructor(
    BaseContractParams memory baseContractParams,
    DynamicRequesterParams memory dynamicRequesterParams,
    uint[17][9][3] memory _multipliers
  ) FarePlinko(baseContractParams, dynamicRequesterParams, _multipliers) {}

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
