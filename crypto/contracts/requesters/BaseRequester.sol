// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

abstract contract BaseRequester {
  // @NOTE: Should ask auditors about proper value. Considering we are using Arbitrum
  uint public constant MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE = 200;

  function requestRandomNumber() internal virtual returns (uint256);

  function resolveRandomNumber(
    uint256 requestId,
    uint256 randomNumber
  ) internal virtual;

  function expandRandomNumberTo(
    uint256 randomValue,
    uint256 expandToCount
  ) internal view virtual returns (uint256[] memory) {
    uint256[] memory expandedValues = new uint256[](expandToCount);
    uint i = uint256(
      keccak256(abi.encodePacked(block.timestamp, msg.sender, address(this)))
    );
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
