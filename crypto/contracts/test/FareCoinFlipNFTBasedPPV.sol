// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/nftBasedPPV/NFTBPPVSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareCoinFlipNFTBasedPPV is NFTBPPVSUContract, DynamicRequester {
  bool[] public mockIsNFTMints;
  uint[] public mockRandomNumbers;

  error SideIsOver1();

  constructor(
    NFTBPPVSUContractParams memory nftbppvsuContractparams,
    DynamicRequesterParams memory dynamicRequesterParams
  )
    NFTBPPVSUContract(nftbppvsuContractparams)
    DynamicRequester(dynamicRequesterParams)
  {}

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
}
