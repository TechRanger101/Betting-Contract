//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../interfaces/IFareToken.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

// Base Contract
abstract contract BaseContract is Ownable {
  // @NOTE: `fareToken` should be immutable so that owner would not be able to update it after deployment
  IFareToken public immutable fareToken;
  // @NOTE: `protocolAddress` is the address for the protocol to get rewards, it is immutable
  address public immutable protocolAddress;
  // @NOTE: `hostAddress` is the address for 3rd party developer to get rewards, it could be updated by the owner
  address public hostAddress;

  // @NOTE: Represents PRECISION, should be used as 1 in calculations
  uint public constant PRECISION = 1 ether;

  uint public immutable protocolProbabilityValue;
  // @NOTE: 1.00%
  uint public constant MIN_PROTOCOL_PROBABILITY_VALUE = PRECISION / 100;

  // 15% of the protocolProbabilityValue, will be used to set HOST_REWARDS_PERCENTAGE inside constructor
  uint public constant HOST_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE =
    (PRECISION * 15) / 100;
  // 5% of the protocolProbabilityValue, will be used to set PROTOCOL_REWARDS_PERCENTAGE inside constructor
  uint
    public constant PROTOCOL_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE =
    (PRECISION * 5) / 100;

  uint public immutable HOST_REWARDS_PERCENTAGE;
  uint public immutable PROTOCOL_REWARDS_PERCENTAGE;

  struct BaseContractParams {
    address fareTokenAddress;
    address protocolAddress;
    address hostAddress;
    uint protocolProbabilityValue;
  }

  error InvalidFareTokenAddress();
  error InvalidProtocolAddress();
  error InvalidHostAddress();
  error InvalidPPV();
  error HostAndProtocolRewardsExceedsPPV();

  constructor(BaseContractParams memory baseContractParams) {
    if (baseContractParams.fareTokenAddress == address(0))
      revert InvalidFareTokenAddress();
    if (baseContractParams.protocolAddress == address(0))
      revert InvalidProtocolAddress();
    if (
      baseContractParams.protocolProbabilityValue <
      MIN_PROTOCOL_PROBABILITY_VALUE
    ) revert InvalidPPV();
    if (
      HOST_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE +
        PROTOCOL_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE >=
      PRECISION
    ) revert HostAndProtocolRewardsExceedsPPV();
    fareToken = IFareToken(baseContractParams.fareTokenAddress);
    protocolAddress = baseContractParams.protocolAddress;
    protocolProbabilityValue = baseContractParams.protocolProbabilityValue;
    setHostAddress(baseContractParams.hostAddress);
    // Set host rewards percentage based on protocolProbabilityValue
    HOST_REWARDS_PERCENTAGE = mulDiv(
      baseContractParams.protocolProbabilityValue,
      HOST_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE,
      PRECISION
    );
    // Set protocol rewards percentage based on protocolProbabilityValue
    PROTOCOL_REWARDS_PERCENTAGE = mulDiv(
      baseContractParams.protocolProbabilityValue,
      PROTOCOL_REWARD_PERCENTAGE_OF_PROTOCOL_PROBABILITY_VALUE,
      PRECISION
    );
  }

  function setHostAddress(address _hostAddress) public onlyOwner {
    if (_hostAddress == address(0)) revert InvalidHostAddress();
    hostAddress = _hostAddress;
  }

  function calculateProtocolRewards(uint amount) internal view returns (uint) {
    return mulDiv(amount, PROTOCOL_REWARDS_PERCENTAGE, PRECISION);
  }

  function calculateHostRewards(uint amount) internal view returns (uint) {
    return mulDiv(amount, HOST_REWARDS_PERCENTAGE, PRECISION);
  }

  function calculateUserRewardsWithoutPPV(
    uint entryAmount,
    uint multiplier
  ) internal pure returns (uint) {
    return mulDiv(entryAmount, multiplier, PRECISION);
  }

  function calculateUserRewardsWithPPV(
    uint entryAmount,
    uint multiplier
  ) internal view returns (uint) {
    return
      mulDiv(
        mulDiv(multiplier, PRECISION - protocolProbabilityValue, PRECISION),
        entryAmount,
        PRECISION
      );
  }

  /**
   * @notice Calculates floor(x * y / denominator) with full precision. Throws if result overflows a uint256 or denominator == 0
   * @dev Original credit to Remco Bloemen under MIT license (https://xn--2-umb.com/21/muldiv)
   * with further edits by Uniswap Labs also under MIT license.
   */
  function mulDiv(
    uint256 x,
    uint256 y,
    uint256 denominator
  ) internal pure returns (uint256 result) {
    unchecked {
      // @NOTE 512-bit multiply [prod1 prod0] = x * y. Compute the product mod 2^256 and mod 2^256 - 1,
      // then use the Chinese Remainder Theorem to reconstruct the 512 bit result.
      // The result is stored in two 256 variables such that product = prod1 * 2^256 + prod0.
      uint256 prod0; // Least significant 256 bits of the product
      uint256 prod1; // Most significant 256 bits of the product
      assembly {
        let mm := mulmod(x, y, not(0))
        prod0 := mul(x, y)
        prod1 := sub(sub(mm, prod0), lt(mm, prod0))
      }

      // #@NOTE Handle non-overflow cases, 256 by 256 division.
      if (prod1 == 0) {
        return prod0 / denominator;
      }

      // @NOTE Make sure the result is less than 2^256. Also prevents denominator == 0.
      require(denominator > prod1, "Math: mulDiv overflow");

      ///////////////////////////////////////////////
      // 512 by 256 division.
      ///////////////////////////////////////////////

      // @NOTE Make division exact by subtracting the remainder from [prod1 prod0].
      uint256 remainder;
      assembly {
        // @NOTE Compute remainder using mulmod.
        remainder := mulmod(x, y, denominator)

        // @NOTE Subtract 256 bit number from 512 bit number.
        prod1 := sub(prod1, gt(remainder, prod0))
        prod0 := sub(prod0, remainder)
      }

      // @NOTE Factor powers of two out of denominator and compute largest
      // power of two divisor of denominator. Always >= 1.
      // See https://cs.stackexchange.com/q/138556/92363.

      // @NOTE Does not overflow because the denominator cannot be zero at this stage in the function.
      uint256 twos = denominator & (~denominator + 1);
      assembly {
        // @NOTE Divide denominator by twos.
        denominator := div(denominator, twos)

        // @NOTE Divide [prod1 prod0] by twos.
        prod0 := div(prod0, twos)

        // @NOTE Flip twos such that it is 2^256 / twos. If twos is zero, then it becomes one.
        twos := add(div(sub(0, twos), twos), 1)
      }

      // @NOTE Shift in bits from prod1 into prod0.
      prod0 |= prod1 * twos;

      // @NOTE Invert denominator mod 2^256. Now that denominator is an odd number,
      // it has an inverse modulo 2^256 such that denominator * inv = 1 mod 2^256.
      // Compute the inverse by starting with a seed that is correct for
      // four bits. That is, denominator * inv = 1 mod 2^4.
      uint256 inverse = (3 * denominator) ^ 2;

      // @NOTE Use the Newton-Raphson iteration to improve the precision. Thanks
      // to Hensel's lifting lemma, this also works in modular arithmetic,
      // doubling the correct bits in each step.
      inverse *= 2 - denominator * inverse; // inverse mod 2^8
      inverse *= 2 - denominator * inverse; // inverse mod 2^16
      inverse *= 2 - denominator * inverse; // inverse mod 2^32
      inverse *= 2 - denominator * inverse; // inverse mod 2^64
      inverse *= 2 - denominator * inverse; // inverse mod 2^128
      inverse *= 2 - denominator * inverse; // inverse mod 2^256

      // @NOTE Because the division is now exact we can divide by multiplying with
      // the modular inverse of denominator. This will give us the correct result modulo 2^256.
      // Since the preconditions guarantee that the outcome is less than 2^256, this is the final result.
      // We don't need to compute the high bits of the result and prod1 is no longer required.
      result = prod0 * inverse;
      return result;
    }
  }
}
