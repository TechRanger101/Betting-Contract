// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

contract ExpandRandomNumberToMock {
  function expandRandomNumberTo(
    uint256 randomValue,
    uint256 expandToCount
  ) public view returns (uint256[] memory) {
    uint256[] memory expandedValues = new uint256[](expandToCount);
    uint i = uint256(keccak256(abi.encodePacked(block.timestamp)));
    unchecked {
      // Check if it causes an overflow
      if (i + expandToCount < i) {
        // In the case of overflow, decrease i with expandToCount to make sure that it does not overflow
        i -= expandToCount;
      }
    }
    uint loopLimit = i + expandToCount;
    for (uint j; i < loopLimit; ) {
      expandedValues[j] = uint256(keccak256(abi.encode(randomValue, i)));
      unchecked {
        ++j;
        ++i;
      }
    }
    return expandedValues;
  }
}
