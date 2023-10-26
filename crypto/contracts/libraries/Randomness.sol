// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

library Randomness {
  // @NOTE: This randomness should return different values for different contracts even if the resolving transactions are inside the same block
  function getRandomness() internal view returns (uint256) {
    uint256 upperLimit = type(uint256).max;
    uint256 seed = uint256(
      keccak256(
        abi.encodePacked(
          block.timestamp +
            block.difficulty +
            ((uint256(keccak256(abi.encodePacked(block.coinbase)))) /
              (block.timestamp)) +
            block.gaslimit +
            ((uint256(keccak256(abi.encodePacked(msg.sender)))) /
              (block.timestamp)) +
            block.number +
            ((uint256(keccak256(abi.encodePacked(address(this))))) /
              (block.timestamp))
        )
      )
    );

    return (seed - ((seed / upperLimit) * upperLimit));
  }

  // @NOTE: This randomness function should allow the contract to get different values even if it is called more than once inside the same transaction for the same contract
  function getRandomnessWithNonce(uint nonce) internal view returns (uint) {
    uint256 upperLimit = type(uint256).max;
    uint256 seed = uint256(
      keccak256(
        abi.encodePacked(
          block.timestamp +
            block.difficulty +
            ((uint256(keccak256(abi.encodePacked(block.coinbase)))) /
              (block.timestamp)) +
            block.gaslimit +
            ((uint256(keccak256(abi.encodePacked(msg.sender)))) /
              (block.timestamp)) +
            block.number +
            ((uint256(keccak256(abi.encodePacked(address(this))))) /
              (block.timestamp)) +
            ((uint256(keccak256(abi.encodePacked(nonce)))) / (block.timestamp))
        )
      )
    );

    return (seed - ((seed / upperLimit) * upperLimit));
  }
}
