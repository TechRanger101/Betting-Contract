// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../base/singleUser/nftBasedPPV/NFTorURBPPVSUContract.sol";
import "../requesters/DynamicRequester.sol";

contract FareBomb is NFTorURBPPVSUContract, DynamicRequester {
  mapping(uint => mapping(uint => uint))
    public bombCountToRevealCountToMultiplier;

  error BombCountIs0OrOver24();
  error InvalidEncodeRevealArray();
  error SumOfBombCountAndRevealCountExceeds25();

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams,
    DynamicRequesterParams memory dynamicRequesterParams
  )
    NFTorURBPPVSUContract(nftorurbppvsuContractParams)
    DynamicRequester(dynamicRequesterParams)
  {
    // Initialize the multipliers for specific bombCounts and revealCounts
    // So that you do not have to recompute them again and again, you would just access a state variable
    for (uint bombCount; bombCount < 25; bombCount++) {
      // For each bombCount
      for (uint revealCount; revealCount < 25; revealCount++) {
        if (bombCount + revealCount > 25) continue;
        // For each revealCount
        uint aggregateMultiplier = PRECISION;
        for (uint i; i < revealCount; i++) {
          // We are calculating the specific multiplier for given bombCount and getRevealCount
          // We have to use a for loop based on revealCount
          aggregateMultiplier = mulDiv(
            aggregateMultiplier,
            mulDiv(
              (25 - i) * PRECISION,
              PRECISION,
              (25 - i - bombCount) * PRECISION
            ),
            PRECISION
          );
        }

        bombCountToRevealCountToMultiplier[bombCount][
          revealCount
        ] = aggregateMultiplier;
      }
    }
  }

  // Allows you to get a bit's value
  // If _boolNumber is 0, then we will get the rightmost bit
  // Therefore, when you increase the boolNumber, you will get the bit on the left
  function getBoolean(
    uint256 _packedBools,
    uint256 _boolNumber
  ) private pure returns (bool) {
    uint256 flag = (_packedBools >> _boolNumber) & uint256(1);
    return (flag == 1 ? true : false);
  }

  // Allows you to set a bit's value
  // If _boolNumber is 0, then we will get the rightmost bit
  // Therefore, when you increase the boolNumber, you will get the bit on the left
  function setBoolean(
    uint256 _packedBools,
    uint256 _boolNumber,
    bool _value
  ) private pure returns (uint256) {
    if (_value) {
      _packedBools = _packedBools | (uint256(1) << _boolNumber);
      return _packedBools;
    } else {
      _packedBools = _packedBools & ~(uint256(1) << _boolNumber);
      return _packedBools;
    }
  }

  // Allows you to encode uint8 bombCount, uint8 revealCount and uint32 revealArray as a uint256
  // [208 bit: empty, 8 bit: bombCount; 8 bit: revealCount, 32 bit: revealArray]
  function encodeSide(
    uint8 bombCount,
    uint8 revealCount,
    uint32 revealArray
  ) private pure returns (uint side) {
    side =
      (uint(bombCount) << 40) +
      (uint(revealCount) << 32) +
      uint(revealArray);
  }

  // Allows you to decode a uint256 side as uint8 bombCount, uint8 revealCount, uint32 revealArray
  function decodeSide(
    uint side
  )
    private
    pure
    returns (uint8 bombCount, uint8 revealCount, uint32 revealArray)
  {
    bombCount = uint8(side >> 40);
    revealCount = uint8(side >> 32);
    revealArray = uint32(side);
  }

  // Given revealArray from user, returns how many positions user wants to reveal
  // It does it by iteration rightmost 25 bits and counting true bits
  function getRevealCount(
    uint32 revealArray
  ) private pure returns (uint8 revealCount) {
    revealCount = 0;
    for (uint i; i < 25; ) {
      if (getBoolean(revealArray, i)) {
        revealCount++;
      }
      unchecked {
        ++i;
      }
    }
  }

  // This function is only for the usage of frontend.
  // If user wants to reveal positions [2, 24], this function would return the corresponding uint32 to represent it correctly
  // In the case of [2, 24], it would be something like 0001 0000 0000 0000 0000 0000 0100 = 16777220
  // We are not doing this process inside the `encodeSideAndSubmitEntry` to save gas
  function encodeRevealArray(
    uint[] calldata rawRevealArray
  ) external pure returns (uint32) {
    uint len = rawRevealArray.length;
    uint encodedRevealArray = 0;
    for (uint i; i < len; ) {
      encodedRevealArray = setBoolean(
        encodedRevealArray,
        rawRevealArray[i],
        true
      );
      unchecked {
        ++i;
      }
    }
    return uint32(encodedRevealArray);
  }

  // Handles side encoding and input requirements for submitEntry
  function encodeSideAndSubmitEntry(
    uint8 bombCount,
    uint32 encodedRevealArray,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) external {
    // For FareBomb, user will indicate how many bombs they are playing with and the indexes that they want to reveal.
    // To represent that values. We will use uint256 and we will think it as bit[]
    // So, it will be a bit[256]
    // We will store: bombCount, revealCount and revealArray inside those 256 bits
    // We will store bombCount in uint8, revealCount in uint8, revealArray in uint32
    // Lets use this one => (Left padding) Example: If you want to reveal 0th and 2nd indexes => [...000000000101] => You would give "5", 0b101, 0x05
    // Inside the revealArray, if ith (from right) bit is 1 then it means, user is trying to reveal that position (i)
    if (bombCount == 0 || bombCount > 24) revert BombCountIs0OrOver24();
    // For the map, we are using 25 bits, therefore revealArray should not be larger than 2**25. Because, with 25 bits we can represent at most 2**25 - 1
    if (encodedRevealArray == 0 || encodedRevealArray >= 2 ** 25)
      revert InvalidEncodeRevealArray();

    uint8 revealCount = getRevealCount(encodedRevealArray);
    if (revealCount + bombCount > 25)
      revert SumOfBombCountAndRevealCountExceeds25();

    _submitEntry(
      encodeSide(bombCount, revealCount, encodedRevealArray),
      amount,
      stopLoss,
      stopGain,
      count
    );
  }

  function getNewBombIndex(
    uint startingIndex,
    uint currentMap,
    uint stepCount
  ) private pure returns (uint) {
    uint i;
    // Iterate stepCount amount
    for (; i < stepCount; ) {
      // Check if it is a bomb
      bool isBomb = getBoolean(currentMap, (startingIndex + i) % 25);
      if (isBomb) {
        // If it is a bomb, increase the stepCount so that, we would have an extra iteration for each bomb we have seen
        // Which could also be understood as, skipping the bombs or not incremeting our count if it was a bomb
        stepCount++;
      }
      unchecked {
        ++i;
      }
    }
    return (startingIndex + i) % 25;
  }

  // We must have bombCount amount of randomNumbers to represent each bomb
  // Since we need to have randomNumbers from 0 to 25, randomNumber would represent the bomb index
  // @NOTE: randomNumber will not directly represent bombIndex, because in that case, we might get the same randomNumber therefore try to put 2 bombs to the same place.
  // @NOTE: Since we dont want to put 2 bombs to a same place, we can try to handle it by adding 1 till we find a new empty place.
  // @NOTE: But the upper approach would create a case where positions that are adjacent to the bomb would have a higher chance to get a new bomb
  // @NOTE: Since, we want each position to have the same probability to contain a bomb, we will do something different
  // @NOTE: What we will do is, with first randomNumber we will put a bomb there, and we will have a `currentIndex` just after the bomb
  // @NOTE: With the second randomNumber, we will start from our `currentIndex` and add secondRandomNumber amount positions. Put a bomb there and update `currentIndex` just after the bomb
  // @NOTE: During iterating, if we encounter a bomb, we will increase our iteration count. With this update, we will never put a second bomb to the same place and each position will have the same probability
  // We should be able to create up to 24 randomNumbers (0 < randomNumber < 24) from a single randomNumber provided from Requester which is a uint256 randomNumber
  // Requester returns us a uint256 randomNumber, we will take (mod 25) to find a unique randomNumber and update the original randomNumber by dividing it by 100. Therefore, each randomNumber will be independent
  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public pure override returns (uint) {
    // Given uint256 randomNumber. Based on the bombCount, inside the entrySide, create bombArray
    (uint bombCount, , ) = decodeSide(entrySide);
    uint bombArray = 0;
    uint currentIndex = 0;
    for (uint i; i < bombCount; ) {
      // Create new randomNumbers on each iteration from a single randomNumber
      // @NOTE: What I had in mind was to get the (mod 100) for the random number to access the last 2 digits of the random number
      // @NOTE: Since those 2 digits can represent 0-99 and each number has the same probability, I can just take (mod 25) and numbers from 0-24 would have the same probability
      // @NOTE: Since, I am taking a (mod 25) at the end I dont have to take (mod 100) beforehand
      // @NOTE: Because, everything before the last 2 digits is divisable by 100, and therefore divisable by 25
      // @NOTE: So, I am only taking a (mod 25) and then dividing the original randomNumber by 100 to have new last 2 digits on each iteration
      // Get randomNumber based on last 2 digits
      uint currentRandomNumber = randomNumber % 25;
      // Update the original randomNumber to have new randomNumber on each iteration
      randomNumber = randomNumber / 100;
      // Get index for the new bomb
      uint newBombIndex = getNewBombIndex(
        currentIndex,
        bombArray,
        currentRandomNumber
      );

      // Set specific bit to true to represent that there is a bomb
      bombArray = setBoolean(bombArray, newBombIndex, true);
      // Set the currentIndex to be the next index after bomb
      currentIndex = (newBombIndex + 1) % 25;
      unchecked {
        ++i;
      }
    }
    return bombArray;
  }

  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public view override returns (uint) {
    (uint bombCount, uint revealCount, uint revealArray) = decodeSide(
      entrySide
    );
    (, , uint bombArray) = decodeSide(protocolSide);
    bool hit = false;
    for (uint i; i < 25; ) {
      if (getBoolean(revealArray, i) && getBoolean(bombArray, i)) {
        hit = true;
        break;
      }
      unchecked {
        ++i;
      }
    }
    if (hit) return 0;
    return bombCountToRevealCountToMultiplier[bombCount][revealCount];
  }
}
