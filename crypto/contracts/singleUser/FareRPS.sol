//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/nftBasedPPV/NFTorURBPPVSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareRPS is NFTorURBPPVSUContract, DynamicRequester {
  enum LDW {
    LOSE,
    DRAW,
    WIN
  }

  // Represents side
  // 0 => rock
  // 1 => paper
  // 2 => scissors
  enum RPS {
    ROCK,
    PAPER,
    SCISSORS
  }

  error SideIsOver2();

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  )
    NFTorURBPPVSUContract(nftorurbppvsuContractParams)
    DynamicRequester(dynamicRequesterParams)
  {}

  function submitEntry(
    uint side,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) public {
    if (side >= 3) revert SideIsOver2();
    _submitEntry(side, amount, stopLoss, stopGain, count);
  }

  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    return randomNumber % 3;
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public pure override returns (uint) {
    return
      uint256(uint8(calculateOutcome(RPS(entrySide), RPS(protocolSide)))) *
      PRECISION;
  }

  /* I know writing smart code is not the best practice but I enjoyed trying to find pattern the for this one. 
    Given Rock is 0, Paper is 1, Scissors is 2 and  => R(0), P(1), S(2)
    Outcomes Lose is 0, Draw is 1, Win is 2 => L(0), D(1), W(2)
    If we draw a matrix to inspect if any patterns exist it would be like this: 
        - column headers represent entrySide
        - row headers represent protocolSide

         | R(0) | P(1) | S(2)
    ---------------------------
    R(0) | D(1) | W(2) | L(0)
    ---------------------------
    P(1) | L(0) | D(1) | W(2)
    ---------------------------
    S(2) | W(2) | L(0) | D(1)
    

    From the pattern here is the formula => LDW[(ES + 2 * PS + 1) % 3]
    
    Here is how I found out the equation =>
    From the pattern I have tried and seen a formula that holds for each case => LDW[(ES + 2 * PS + 1) % 3]
        So, when you multiply PS's move with 2, add ES's move, add 1 and take modulo for 3. You will have the correct index for LDW enum
        NOTE: If I had choosen DWL equation would be => DWL[(ES + 2 * PS) % 3] but I have choosen LDW intentionly for the index of the result to represent multiplier
        This way LDW's uint8 value also represents the multiplier (0, 1, 2)
        For example when outcome is L (0) user reward would be multiplied with 0. For D (1) it would be multiplied with 1. For W (2) it would be multiplied with 2.
    When you take a look at the rows, they always go as LDW (our order). So, when ES increases by one result increases by one as well.
    Therefore, ES will be multiplied by 1 in our equation. 
    When you take a look at the columns. They always go as DLW (not our order). But, if you go 2 steps each time, it will be our order
    Therefore, PS will be multiplied by 2 in our equation.
    We have the multipliers for ES and PS values now we have to find the offset value by giving values for one point. 
    Current equation => LDW[(ES + 2 * PS + x) % 3]
    Given the (ES, PS) => (R,P) => (0,1) => L (0) => 0 = (ES + 2 * PS + x) % 3
    From the upper equation when we put the values in => 0 = (0 + 2 * 1 + x) % 3 => x = 1 (mod 3)
    Therefore x = 1, 4, 7... (x = 1 (mod 3)) let's take x = 1 to make it easier
    Our equation results to LDW[(ES + 2 * PS + 1) % 3]
    */
  function calculateOutcome(
    RPS entrySide,
    RPS protocolSide
  ) public pure returns (LDW) {
    return LDW((uint8(entrySide) + 2 * uint8(protocolSide) + 1) % 3);
  }
}
