// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../libraries/Randomness.sol";

contract GetRandomnessMock {
  function getRandomness() public view returns (uint256) {
    return Randomness.getRandomness();
  }
}
