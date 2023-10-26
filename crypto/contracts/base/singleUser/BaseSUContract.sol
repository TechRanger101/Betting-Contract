//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../BaseContract.sol";
import "../../requesters/BaseRequester.sol";

// Base Single User Contract
abstract contract BaseSUContract is BaseRequester, BaseContract {
  uint public maxEntryCount = 20;
  uint public minEntryAmount;

  struct Entry {
    uint requestId;
    uint side;
    uint amount;
    uint stopLoss;
    uint stopGain;
    uint64 blockNumber;
    uint32 count;
  }

  mapping(uint => address) public requestIdToUser;
  mapping(address => Entry) public userToEntry;

  event EntrySubmitted(
    uint indexed requestId,
    address indexed user,
    uint side,
    uint amount,
    uint count
  );
  event EntryResolved(
    uint indexed requestId,
    address indexed user,
    uint[] protocolSides,
    uint[] userRewards,
    uint usedCount
  );
  event EntryWithdrew(uint indexed requestId, address indexed user);

  error EntryInProgress();
  error CountExceedsMaxEntryCount();
  error EntryWithZeroTokens();
  error EntryAmountLowerThanMinEntryAmount();
  error EntryNotInProgress();
  error TooEarlyToWithdraw();
  error InvalidMaxEntryCount();
  error RequestIdNotResolvable();

  function withdrawEntry() public virtual {
    _withdrawEntry();
  }

  function resolveRandomNumber(
    uint requestId,
    uint randomNumber
  ) internal virtual override {
    _resolveEntry(requestId, randomNumber);
  }

  // @NOTE Given randomNumber and entrySide returns protocolSide
  function contractSpecificGetProtocolSide(
    uint randomNumber,
    uint entrySide
  ) public view virtual returns (uint);

  // @NOTE Given protocolSide and entrySide calculate the multiplier so that rewards will be calculated correctly
  // @NOTE If you want to set multiplier as x2. You should not just return 2. You should return `PRECISION * 2`
  // @NOTE Reason why is that we want to allow higher precision for multipliers. For example for x2.5 => `PRECISION * 5 / 2`
  // @NOTE Therefore, we are using the variable `PRECISION` to have extra precision
  function contractSpecificGetMultiplier(
    uint protocolSide,
    uint entrySide
  ) public view virtual returns (uint);

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public view virtual returns (uint);

  function _submitEntry(
    uint side,
    uint amount,
    uint stopLoss,
    uint stopGain,
    uint32 count
  ) internal virtual {
    uint totalAmount = amount * count;
    if (userToEntry[msg.sender].blockNumber != 0) revert EntryInProgress();
    if (count > maxEntryCount) revert CountExceedsMaxEntryCount();
    if (totalAmount == 0) revert EntryWithZeroTokens();
    if (totalAmount < minEntryAmount)
      revert EntryAmountLowerThanMinEntryAmount();

    uint requestId = requestRandomNumber();
    requestIdToUser[requestId] = msg.sender;
    userToEntry[msg.sender] = Entry({
      requestId: requestId,
      side: side,
      amount: amount,
      stopLoss: stopLoss,
      stopGain: stopGain,
      blockNumber: uint64(block.number),
      count: count
    });
    fareToken.burnFare(msg.sender, totalAmount);
    emit EntrySubmitted(requestId, msg.sender, side, amount, count);
  }

  function _resolveEntry(uint requestId, uint randomNumber) internal virtual {
    address user = requestIdToUser[requestId];
    if (user == address(0)) revert RequestIdNotResolvable();
    Entry memory entry = userToEntry[user];
    uint len = entry.count;
    uint[] memory expandedRandomNumbers = expandRandomNumberTo(
      randomNumber,
      len
    );
    uint[] memory protocolSides = new uint[](len);
    uint[] memory userRewards = new uint[](len);
    uint grossUserRewards;
    uint i;
    for (; i < len; ) {
      uint protocolSide = contractSpecificGetProtocolSide(
        expandedRandomNumbers[i],
        entry.side
      );
      protocolSides[i] = protocolSide;
      uint entryMultiplier = contractSpecificGetMultiplier(
        protocolSide,
        entry.side
      );
      if (entryMultiplier > 0) {
        uint userReward = contractSpecificCalculateUserRewards(
          entry.amount,
          entryMultiplier
        );
        userRewards[i] = userReward;
        grossUserRewards += userReward;
      }

      bool isLimitsTriggered = checkStopLimits(
        entry.stopGain,
        entry.stopLoss,
        grossUserRewards,
        entry.amount * (i + 1) // To calculate currentBurnedAmount (if i = 0, it means user burned x1 the amount of the entry)
      );
      if (isLimitsTriggered) {
        uint remainingEntryCount = len - i - 1;
        // @NOTE Increase grossUserRewards for unused entries because of the limit trigger
        grossUserRewards += remainingEntryCount * entry.amount;
        // @NOTE Increase i to correctly represent actually used entry count.
        // This value will be used when minting for hostRewards and protocolRewards
        // Ex: when you hit it while i = 0. Actually used entry count would be 1
        unchecked {
          ++i;
        }
        break;
      }
      unchecked {
        ++i;
      }
    }
    delete requestIdToUser[requestId];
    delete userToEntry[user];

    if (grossUserRewards > 0) {
      // @NOTE Mint rewards for user
      fareToken.mintFare(user, grossUserRewards);
    }
    // @NOTE: Mint rewards for host
    fareToken.mintFare(hostAddress, calculateHostRewards(entry.amount * i));
    // @NOTE: Mint rewards for protocol
    fareToken.mintFare(
      protocolAddress,
      calculateProtocolRewards(entry.amount * i)
    );

    emit EntryResolved(requestId, user, protocolSides, userRewards, i);
  }

  function _withdrawEntry() internal virtual {
    Entry memory entry = userToEntry[msg.sender];
    if (entry.blockNumber == 0) revert EntryNotInProgress();
    if (
      block.number <=
      entry.blockNumber + MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE
    ) revert TooEarlyToWithdraw();

    delete requestIdToUser[entry.requestId];
    delete userToEntry[msg.sender];

    // @NOTE Mint rewards for the user
    fareToken.mintFare(msg.sender, entry.amount * entry.count);
    emit EntryWithdrew(entry.requestId, msg.sender);
  }

  function setMaxEntryCount(uint _maxEntryCount) public onlyOwner {
    if (_maxEntryCount == 0) revert InvalidMaxEntryCount();
    maxEntryCount = _maxEntryCount;
  }

  function setMinEntryAmount(uint _minEntryAmount) public onlyOwner {
    minEntryAmount = _minEntryAmount;
  }

  // @NOTE: If grossUserRewards is bigger than currentBurnedAmount check stopGain else check stopLoss
  // @NOTE: Before checking stop loss or checking stop gain make sure that stopGain or stopLoss limit is not 0.
  // @NOTE: Because it would mean there is no limit. If it is zero return false
  function checkStopLimits(
    uint stopGain,
    uint stopLoss,
    uint grossUserRewards,
    uint currentBurnedAmount
  ) internal pure returns (bool) {
    return
      grossUserRewards > currentBurnedAmount
        ? (
          stopGain != 0
            ? grossUserRewards - currentBurnedAmount >= stopGain
            : false
        )
        : (
          stopLoss != 0
            ? currentBurnedAmount - grossUserRewards >= stopLoss
            : false
        );
  }
}
