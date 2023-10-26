// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/nftBasedPPV/NFTorURBPPVSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareCoinFlip is NFTorURBPPVSUContract, DynamicRequester {
  error SideIsOver1();

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  )
    NFTorURBPPVSUContract(nftorurbppvsuContractParams)
    DynamicRequester(dynamicRequesterParams)
  {}

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    return randomNumber & uint256(1);
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
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
}
