// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/BaseSUContract.sol";
import "../requesters/VRFRequester.sol";

contract FareCoinFlipVRF is BaseSUContract, VRFRequester {
  error SideIsOver1();

  /**
   * Network: Mumbai
   * Aggregator: MATIC/USD
   * Address: 0xd0D5e3DB44DE05E9F294BB0a3bEEaF030DE24Ada
   *
   * Network: Mumbai
   * Aggregator: LINK/USD
   * Address: 0x1C2252aeeD50e0c9B64bDfF2735Ee3C932F5C408
   */
  // @NOTE removed commented out params
  constructor(
    BaseContractParams memory baseContractParams,
    VRFParams memory vrfParams
  ) BaseContract(baseContractParams) VRFRequester(vrfParams) {}

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
