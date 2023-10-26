// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../singleUser/FareCoinFlip.sol";

contract FareCoinFlipMock is FareCoinFlip {
  bool[] public mockIsNFTMints;
  uint[] public mockRandomNumbers;

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  ) FareCoinFlip(nftorurbppvsuContractParams, dynamicRequesterParams) {}

  function setMockRandomNumbers(uint[] memory _mockRandomNumbers) public {
    mockRandomNumbers = _mockRandomNumbers;
  }

  function expandRandomNumberTo(
    uint256 randomValue,
    uint256 expandToCount
  ) internal view override returns (uint256[] memory expandedValues) {
    return mockRandomNumbers;
  }

  function setMockIsNFTMint(bool[] memory _isNFTMints) external {
    mockIsNFTMints = _isNFTMints;
  }

  function checkIfNFTMint(
    uint randomNumber
  ) internal view override returns (bool) {
    uint len = mockRandomNumbers.length;
    for (uint i = 0; i < len; ) {
      if (mockRandomNumbers[i] == randomNumber) {
        return mockIsNFTMints[i];
      }
      unchecked {
        ++i;
      }
    }
    return false;
    // return mockIsNFTMint;
  }

  function simulateRequestId(
    uint requesterRequestCount
  ) public view returns (uint) {
    return
      uint256(
        keccak256(
          abi.encodePacked(
            block.chainid,
            address(this),
            requesterRequestCount,
            msg.sender
          )
        )
      );
  }
}
