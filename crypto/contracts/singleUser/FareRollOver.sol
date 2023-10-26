// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/nftBasedPPV/NFTorURBPPVSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareRollOver is NFTorURBPPVSUContract, DynamicRequester {
  error SideIsLessThan500OrOver9900();

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  )
    NFTorURBPPVSUContract(nftorurbppvsuContractParams)
    DynamicRequester(dynamicRequesterParams)
  {}

  // To have 2 digit precision after the dot (ex: 23.45). When user inputs 4567 it represents 45.67
  function submitEntry(
    uint side,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) public {
    if (side < 500 || side > 9900) revert SideIsLessThan500OrOver9900();
    _submitEntry(side, amount, stopLoss, stopGain, count);
  }

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    return randomNumber % 10000;
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
    return
      protocolSide >= entrySide
        ? ((PRECISION * 10000) / (10000 - entrySide))
        : 0;
  }
}
