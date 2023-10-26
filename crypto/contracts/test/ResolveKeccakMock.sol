// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../libraries/Randomness.sol";

contract ResolveKeccakMock {
  function mockResolve(
    uint randomNumberAmount
  ) public view returns (uint[] memory) {
    uint[] memory randomNumbers = expandRandomNumberTo(
      Randomness.getRandomness(),
      1
    );
    uint randomNumberForContract = randomNumbers[0];

    uint[] memory expandedRandomNumbers = expandRandomNumberTo(
      randomNumberForContract,
      randomNumberAmount
    );

    return expandedRandomNumbers;
  }

  function mockResolveWithNFT(
    uint randomNumberAmount
  ) public view returns (uint[] memory) {
    uint[] memory randomNumbers = expandRandomNumberTo(
      Randomness.getRandomness(),
      1
    );
    uint randomNumberForContract = randomNumbers[0];

    uint[] memory expandedRandomNumbers = expandRandomNumberTo(
      randomNumberForContract,
      randomNumberAmount
    );

    for (uint i; i < randomNumberAmount; i++) {
      if ((expandedRandomNumbers[i] % 1 ether) <= 0.01 ether) {
        uint[] memory randomNumberAfterNFT = expandRandomNumberTo(
          expandedRandomNumbers[i],
          1
        );
        expandedRandomNumbers[i] = randomNumberAfterNFT[0];
      }
    }

    return expandedRandomNumbers;
  }

  function mockBatchResolve(
    uint[] memory randomNumberAmounts
  ) public view returns (uint[] memory) {
    uint len = randomNumberAmounts.length;
    uint totalRandomNumberAmount;
    for (uint i; i < len; i++) {
      totalRandomNumberAmount += randomNumberAmounts[i];
    }
    uint[] memory allRandomNumbers = new uint[](totalRandomNumberAmount);

    uint nonce = uint256(keccak256(abi.encodePacked(block.timestamp)));
    unchecked {
      // Check if it causes an overflow
      if (nonce + len < nonce) {
        // In the case of overflow, decrease nonce with len to make sure that it does not overflow
        nonce -= len;
      }
    }
    uint aggregateRandomNumberCount;
    for (uint i; i < len; i++) {
      uint[] memory currentRandomNumbers = expandRandomNumberTo(
        Randomness.getRandomnessWithNonce(nonce + i),
        1
      );

      uint randomNumberForContract = currentRandomNumbers[0];

      uint[] memory expandedRandomNumbers = expandRandomNumberTo(
        randomNumberForContract,
        randomNumberAmounts[i]
      );

      for (uint j; j < expandedRandomNumbers.length; j++) {
        allRandomNumbers[aggregateRandomNumberCount] = expandedRandomNumbers[j];
        aggregateRandomNumberCount++;
      }
    }

    return allRandomNumbers;
  }

  function expandRandomNumberTo(
    uint256 randomValue,
    uint256 expandToCount
  ) public view virtual returns (uint256[] memory) {
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
