// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/BaseSUContract.sol";

import "../requesters/QRNGRequester.sol";

contract FareCoinFlipQRNG is BaseSUContract, QRNGRequester {
  error SideIsOver1();

  constructor(
    BaseContractParams memory baseContractParams,
    QRNGParams memory qrngParams
  ) BaseContract(baseContractParams) QRNGRequester(qrngParams) {}

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    return randomNumber % 2;
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
    // Rather than (PRECISION * 2) do (PRECISION << 1) for gas optimization
    return entrySide == protocolSide ? (PRECISION << 1) : 0;
  }

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public view virtual override returns (uint) {
    return calculateUserRewardsWithoutPPV(entryAmount, multiplier);
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
