// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../../requesters/BaseRequester.sol";
import "../../base/BaseContract.sol";
import "../../Manageable.sol";
import "../../interfaces/IFareToken.sol";

abstract contract BaseMUContract is BaseRequester, BaseContract, Manageable {
  uint public roundIdCounter;
  bool public isRoundPaused;
  uint public minEntryAmount;

  mapping(uint => uint) public requestIdToRoundId;
  // @NOTE: Cannot declare it as `public` gives the following error: "Internal or recursive type is not allowed for public state variables."
  mapping(uint => mapping(address => Entry)) internal roundIdToUserToEntry;
  mapping(uint => uint) public roundIdToRoundResult;
  mapping(uint => uint) public roundIdToBlockNumber;
  mapping(uint => bool) public roundIdToIsFailed;

  event EntrySubmitted(
    address indexed user,
    uint indexed roundId,
    uint[] sides,
    uint[] amounts
  );
  event EntryWithdrew(address indexed user, uint indexed roundId);
  event EntriesClaimed(
    address indexed user,
    uint[] roundIds,
    uint[] userRewards
  );
  event RoundResolved(uint indexed roundId, uint indexed roundResult);
  event RoundFailed(uint indexed roundId);
  event IsRoundPausedUpdate(bool indexed status);
  event RequestedRandomNumberForRound(
    uint indexed roundId,
    uint indexed requestId
  );

  modifier whenRoundNotPaused() {
    _whenRoundNotPaused();
    _;
  }

  modifier whenRoundPaused() {
    _whenRoundPaused();
    _;
  }

  struct Entry {
    uint[] sides;
    uint[] amounts;
  }

  error RoundPaused();
  error RoundNotPaused();
  error EntryIsEmpty();
  error EntrySideAndAmountLengthMismatch();
  error EntrySidesShouldBeInAscendingOrder();
  error EntryWithZeroTokens();
  error EntryAmountLowerThanMinEntryAmount();
  error EntryAlreadySubmittedForTheRound();
  error EntryDoesNotExistForTheRound();
  error CannotClaimForZeroRounds();
  error RoundNotResolvedYet();
  error RequestIdIsNotForCurrentRound();
  error TooEarlyToFail();
  error CannotWithdrawFromASuccessfulRound();
  error CannotClaimFromAFailedRound();
  error RoundAlreadyFailed();

  function contractSpecificGetRoundResult(
    uint randomNumber
  ) public view virtual returns (uint);

  // @NOTE: Given entry and roundResult calculate the multiplier so that rewards will be calculated correctly
  // @NOTE: If you want to set multiplier as x2. You should not just return 2. You should return `PRECISION * 2`
  // @NOTE: Reason why is that we want to allow higher precision for multipliers. For example for x2.5 => `PRECISION * 5 / 2`
  // @NOTE: Therefore, we are using the variable `PRECISION` to have extra precision
  function contractSpecificGetMultiplier(
    uint entrySide,
    uint roundResult
  ) public view virtual returns (uint);

  function contractSpecificCalculateUserReward(
    uint entryAmount,
    uint multipliers
  ) public view virtual returns (uint);

  function _whenRoundNotPaused() private view {
    if (isRoundPaused) revert RoundPaused();
  }

  function _whenRoundPaused() private view {
    if (!isRoundPaused) revert RoundNotPaused();
  }

  function getEntryOfUserForRound(
    address user,
    uint roundId
  ) public view returns (Entry memory) {
    return roundIdToUserToEntry[roundId][user];
  }

  function setMinEntryAmount(uint _minEntryAmount) public onlyOwner {
    minEntryAmount = _minEntryAmount;
  }

  // @NOTE: Sides should be in ascending order (this allows us to check uniqueness in O(n))
  function _submitEntry(
    uint[] memory sides,
    uint[] memory amounts
  ) internal virtual whenRoundNotPaused {
    uint sideLen = sides.length;
    uint amountLen = amounts.length;
    if (sideLen != amountLen) revert EntrySideAndAmountLengthMismatch();
    if (sideLen == 0) revert EntryIsEmpty();
    if (roundIdToUserToEntry[roundIdCounter][msg.sender].amounts.length != 0)
      revert EntryAlreadySubmittedForTheRound();
    if (amounts[0] == 0) revert EntryWithZeroTokens();
    uint maxSide = sides[0];
    uint totalAmount = amounts[0];
    for (uint i = 1; i < sideLen; ) {
      if (amounts[i] == 0) revert EntryWithZeroTokens();
      // @NOTE: By making this, we are making sure that sides are unique
      if (sides[i] <= maxSide) revert EntrySidesShouldBeInAscendingOrder();
      maxSide = sides[i];
      totalAmount += amounts[i];
      unchecked {
        ++i;
      }
    }
    if (totalAmount < minEntryAmount)
      revert EntryAmountLowerThanMinEntryAmount();

    // @NOTE: Burn user's token
    fareToken.burnFare(msg.sender, totalAmount);
    // @NOTE: Mint rewards for host
    fareToken.mintFare(hostAddress, calculateHostRewards(totalAmount));
    // @NOTE: Mint rewards for protocol
    fareToken.mintFare(protocolAddress, calculateProtocolRewards(totalAmount));

    roundIdToUserToEntry[roundIdCounter][msg.sender] = Entry({
      sides: sides,
      amounts: amounts
    });
    emit EntrySubmitted(msg.sender, roundIdCounter, sides, amounts);
  }

  function withdrawEntry(uint roundId, address user) public virtual {
    _withdrawEntry(roundId, user);
  }

  function _withdrawEntry(uint roundId, address user) internal virtual {
    if (roundIdCounter <= roundId) revert RoundNotResolvedYet();
    if (!roundIdToIsFailed[roundId])
      revert CannotWithdrawFromASuccessfulRound();

    // @NOTE: We are already calculating the totalAmount inside submitEntry. We could just add that as a field to the struct if it allows for gas optimization
    // @NOTE: What I have thought is that, considering the usage frequency of `withdrawEntry` and `submitEntry`. SubmitEntry will be called each round whereas withdrawEntry will hopefully called in edge cases
    // @NOTE: Therefore, I have decided to optimize the submitEntry for now. But the other could be better as well
    uint[] memory entryAmounts = roundIdToUserToEntry[roundId][user].amounts;
    uint len = entryAmounts.length;
    if (len == 0) revert EntryDoesNotExistForTheRound();
    uint totalAmount;
    for (uint i; i < len; ) {
      totalAmount += entryAmounts[i];
      unchecked {
        ++i;
      }
    }
    // @NOTE: Mint user's token
    fareToken.mintFare(user, totalAmount);
    // @NOTE: Burn rewards for host
    // @NOTE: We are aware that host can maliciously transfer the FARE tokens out of their wallet and cause withdrawals to revert. But what would be the solution?
    fareToken.burnFare(hostAddress, calculateHostRewards(totalAmount));
    // @NOTE: Burn rewards for protocol
    fareToken.burnFare(protocolAddress, calculateProtocolRewards(totalAmount));

    delete roundIdToUserToEntry[roundId][user];
    emit EntryWithdrew(user, roundIdCounter);
  }

  function pauseRoundAndRequestRandomNumber()
    external
    whenRoundNotPaused
    onlyManagerOrOwner
  {
    isRoundPaused = true;
    uint requestId = requestRandomNumber();
    requestIdToRoundId[requestId] = roundIdCounter;
    roundIdToBlockNumber[roundIdCounter] = block.number;
    emit IsRoundPausedUpdate(true);
    emit RequestedRandomNumberForRound(roundIdCounter, requestId);
  }

  function resolveRandomNumber(
    uint requestId,
    uint randomNumber
  ) internal virtual override {
    _resolveAndUnpauseRound(requestId, randomNumber);
  }

  // TODO: We might have to require resolveRound to be called after max of X blocks or something, after round gets paused. Because some third party developer could submit entry to win 100x as the owner of the contract
  // TODO: They would not resolve it until they find the roundResult they want. Could potentialy do this with KeccakResolver?
  // TODO: We probably should handle this case directly inside KeccakRequester
  function _resolveAndUnpauseRound(
    uint requestId,
    uint randomNumber
  ) internal whenRoundPaused {
    uint roundId = requestIdToRoundId[requestId];
    if (roundId != roundIdCounter) revert RequestIdIsNotForCurrentRound();
    uint roundResult = contractSpecificGetRoundResult(randomNumber);
    roundIdToRoundResult[roundIdCounter] = roundResult;
    isRoundPaused = false;
    emit IsRoundPausedUpdate(false);
    emit RoundResolved(roundIdCounter++, roundResult);
  }

  function randomNumberFailure() public whenRoundPaused {
    if (
      block.number <
      roundIdToBlockNumber[roundIdCounter] +
        MIN_BLOCK_AMOUNT_FOR_RANDOM_NUMBER_FAILURE
    ) revert TooEarlyToFail();
    roundIdToIsFailed[roundIdCounter] = true;
    isRoundPaused = false;
    emit IsRoundPausedUpdate(false);
    emit RoundFailed(roundIdCounter++);
  }

  function claim(uint roundId, address user) external {
    Entry memory entry = roundIdToUserToEntry[roundId][user];
    uint len = entry.sides.length;
    if (roundIdCounter <= roundId) revert RoundNotResolvedYet();
    if (len == 0) revert EntryDoesNotExistForTheRound();
    if (roundIdToIsFailed[roundId]) revert CannotClaimFromAFailedRound();

    delete roundIdToUserToEntry[roundId][user];
    uint roundResult = roundIdToRoundResult[roundId];
    uint totalUserReward;
    for (uint i; i < len; ) {
      totalUserReward += contractSpecificCalculateUserReward(
        entry.amounts[i],
        contractSpecificGetMultiplier(entry.sides[i], roundResult)
      );
      unchecked {
        ++i;
      }
    }

    if (totalUserReward != 0) {
      fareToken.mintFare(user, totalUserReward);
    }
    // Although technically for roundIds where user did not win it is not a claim. This event will emit those as well
    uint[] memory roundIds = new uint[](1);
    roundIds[0] = roundId;
    uint[] memory userRewards = new uint[](1);
    userRewards[0] = totalUserReward;
    emit EntriesClaimed(user, roundIds, userRewards);
  }

  // @NOTE: Would be more efficient if you called `filterWinningRounds()` externally and only call this function with returned roundIds
  function batchClaim(uint[] calldata roundIds, address user) external {
    uint len = roundIds.length;
    if (len == 0) revert CannotClaimForZeroRounds();
    uint[] memory userRewards = new uint[](len);
    uint totalUserReward;
    for (uint i; i < len; ) {
      if (roundIdCounter <= roundIds[i] || roundIdToIsFailed[roundIds[i]]) {
        unchecked {
          ++i;
        }
        continue;
      }
      uint userReward = _deleteEntryStorageAndReturnUserReward(
        roundIds[i],
        user
      );
      userRewards[i] = userReward;
      totalUserReward += userReward;
      unchecked {
        ++i;
      }
    }
    if (totalUserReward != 0) {
      fareToken.mintFare(user, totalUserReward);
    }
    // Although technically for roundIds where user did not win it is not a claim. This event will emit those as well
    emit EntriesClaimed(user, roundIds, userRewards);
  }

  function _deleteEntryStorageAndReturnUserReward(
    uint roundId,
    address user
  ) private returns (uint) {
    Entry memory entry = roundIdToUserToEntry[roundId][user];
    if (entry.amounts.length == 0) return 0;
    delete roundIdToUserToEntry[roundId][user];
    uint roundResult = roundIdToRoundResult[roundId];
    uint len = entry.sides.length;
    uint totalUserReward;
    for (uint i; i < len; ) {
      totalUserReward += contractSpecificCalculateUserReward(
        entry.amounts[i],
        contractSpecificGetMultiplier(entry.sides[i], roundResult)
      );
      unchecked {
        ++i;
      }
    }
    return totalUserReward;
  }

  function filterWinningRounds(
    uint[] calldata roundIds,
    address user
  ) external view returns (uint[] memory) {
    uint len = roundIds.length;
    uint[] memory winningRoundIds = new uint[](len);
    uint winningCount;
    for (uint roundIndex; roundIndex < len; ) {
      uint[] memory entrySides = roundIdToUserToEntry[roundIds[roundIndex]][
        user
      ].sides;
      uint entryLen = entrySides.length;
      // If there is no entry data just skip this roundId
      if (
        entryLen == 0 ||
        roundIdCounter <= roundIds[roundIndex] ||
        roundIdToIsFailed[roundIds[roundIndex]]
      ) {
        unchecked {
          ++roundIndex;
        }
        continue;
      }
      uint roundResult = roundIdToRoundResult[roundIds[roundIndex]];
      for (uint sideIndex; sideIndex < entryLen; ) {
        if (
          contractSpecificGetMultiplier(entrySides[sideIndex], roundResult) != 0
        ) {
          winningRoundIds[winningCount] = roundIds[roundIndex];
          unchecked {
            ++winningCount;
          }
          break;
        }
        unchecked {
          ++sideIndex;
        }
      }
      unchecked {
        ++roundIndex;
      }
    }
    return winningRoundIds;
  }
}
