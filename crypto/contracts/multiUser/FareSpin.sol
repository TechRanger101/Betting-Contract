// TODO: Should implement renamings
// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../Manageable.sol";
import "../interfaces/IFareToken.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract FareSpin is ReentrancyGuard, Pausable, Manageable {
  using Counters for Counters.Counter;

  /* Global Variables START */
  address private _owner;
  IFareToken private fareToken;
  Counters.Counter private _currentRoundId;
  Counters.Counter private _currentContractModeId;

  // @NOTE Contract expected value % calculation:
  // ((CONTRACT_EXPECTED_VALUE_CEILING - contractMode.contractExpectedValueFloor) / CONTRACT_EXPECTED_VALUE_CEILING) / 100 = contractExpectedValuePercentage
  uint256 public constant CONTRACT_EXPECTED_VALUE_CEILING = 10 ** 18;

  // @NOTE 10%
  uint256 public constant REWARDS_MINT_CAP = 10 ** 17;
  // @NOTE Percent to rewards on entry
  uint256 public rewardsMint = 10 ** 16;
  address public rewardsAddress;

  bool public isRoundPaused = false;
  // @NOTE previous withdrawalPeriod
  // uint256 public withdrawalPeriod = 1 seconds;
  uint256 public withdrawalPeriod = 3 hours;

  /* Global Variables END */

  /* Structs START */
  struct Entry {
    uint256 amount;
    uint256 contractModeId;
    uint256 pickedNumber;
  }

  struct BatchEntry {
    // @NOTE Relates to index position in rounds[roundId].users[batchEntryId]
    uint256 batchEntryId;
    address user;
    bool settled;
    uint256 settledAt;
    uint256 totalEntryAmount;
    uint256 totalMintAmount;
    uint256 placedAt;
    uint256 withdrewAt;
    Entry[] entries;
  }

  struct ContractMode {
    uint256 id;
    uint256 cardinality;
    uint256 contractExpectedValueFloor;
    uint256 mintMultiplier;
    uint256 minAmount;
    uint256 maxAmount;
    uint256 entryLimit;
    bool isActive;
  }

  struct Eliminator {
    uint256 contractModeId;
    // @NOTE contractModeFloor at the time of the round
    uint256 recordedExpectedValueFloor;
    bool isEliminator;
  }

  struct Round {
    uint256 id;
    uint256 startedAt;
    uint256 endedAt;
    bytes32 randomHash;
    bytes32 revealKey;
    uint256 fullRandomNum;
    uint256 randomNum;
    uint256 randomEliminator;
    // @NOTE User addresses in round used to reference BatchEntry mapping
    address[] users;
    // @NOTE Eliminator[] is the length of contractModes at the time the round was concluded
    // Since contractModeFloors can be adjusted individually we need to store the contractModeFloors each round
    Eliminator[] eliminators;
  }

  struct EntryHistory {
    // @NOTE totalAmount placed for given contractMode
    uint256 gmAmount;
    // @NOTE amount of entries placed for given contractMode
    uint256 entryLimit;
    bool[] pickedList;
  }
  /* Structs END */

  /* Mappings START */
  // @NOTE contractModeId => ContractMode
  mapping(uint256 => ContractMode) public contractModes;
  // @NOTE roundId => Round
  mapping(uint256 => Round) public rounds;
  // @NOTE roundId => userAddress => BatchEntry
  mapping(uint256 => mapping(address => BatchEntry)) public batchEntryMap;
  // @NOTE roundId => bytes32(key to reveal randomHash)
  mapping(uint256 => bytes32) public randomHashMap;
  /* Mappings END */

  /* Events START */
  event ContractModeUpdated(uint256 indexed contractModeId);
  event EntrySubmitted(
    uint256 indexed roundId,
    uint256 indexed batchId,
    address indexed user
  );
  event EntrySettled(
    uint256 indexed roundId,
    address indexed user,
    bool hasMinted
  );
  event BatchEntriesSettled(address indexed user, uint256[] roundIds);
  event RoundConcluded(
    uint256 indexed roundId,
    bytes32 indexed revealKey,
    uint256 fullRandomNum,
    uint256 randomNum,
    uint256 randomEliminator
  );
  event NewRoundStarted(
    uint256 indexed roundId,
    bytes32 indexed randomHash,
    uint256 startedAt
  );
  event BatchEntryWithdraw(uint256 indexed roundId, address indexed user);
  event NFTMint(uint256 indexed roundId, address indexed user);
  event RoundPausedChanged(bool isPaused);

  /* Events END */

  constructor(address _fareTokenAddress, address _rewardsAddress) {
    require(
      _fareTokenAddress != address(0),
      "Not a valid address for _fareTokenAddress"
    );
    require(
      _rewardsAddress != address(0),
      "Not a valid address for _rewardsAddress"
    );

    // @NOTE Set owner to contract creator
    _owner = msg.sender;
    fareToken = IFareToken(_fareTokenAddress);
    rewardsAddress = _rewardsAddress;
  }

  /* Getters START */
  function getFareTokenAddress() public view returns (address fareAddress) {
    fareAddress = address(fareToken);
  }

  function getCurrentContractModeId() public view returns (uint256 id) {
    id = _currentContractModeId.current();
  }

  function getCurrentRoundId() public view returns (uint256 id) {
    id = _currentRoundId.current();
  }

  function getBatchEntryCount(
    uint256 roundId
  ) public view returns (uint256 count) {
    count = rounds[roundId].users.length;
  }

  function getEntryCount(
    uint256 roundId,
    address user
  ) public view returns (uint256 count) {
    count = batchEntryMap[roundId][user].entries.length;
  }

  function getEntriesByRoundUser(
    uint256 roundId,
    address user
  ) public view returns (Entry[] memory) {
    Entry[] memory entries = batchEntryMap[roundId][user].entries;
    return entries;
  }

  function getEntryByIndex(
    uint256 roundId,
    address user,
    uint256 entryIdx
  ) public view returns (Entry memory) {
    Entry memory entry = batchEntryMap[roundId][user].entries[entryIdx];
    return entry;
  }

  function getAllUsersByRoundId(
    uint256 roundId
  ) public view returns (address[] memory users) {
    users = rounds[roundId].users;
  }

  function getIsEliminator(
    uint256 roundId,
    uint256 contractModeId
  ) public view returns (bool isEliminator) {
    isEliminator = rounds[roundId].eliminators[contractModeId].isEliminator;
  }

  function getEliminatorsByRoundId(
    uint256 roundId
  ) public view returns (Eliminator[] memory eliminators) {
    eliminators = rounds[roundId].eliminators;
  }

  /* Getters END */

  /* Setters START */
  function setFareToken(address _fareTokenAddress) external onlyOwner {
    require(_fareTokenAddress != address(0), "_fareTokenAddress is invalid");
    fareToken = IFareToken(_fareTokenAddress);
  }

  function setRewardsAddress(address _rewardsAddress) external onlyOwner {
    require(_rewardsAddress != address(0), "_rewardsAddress is invalid");
    rewardsAddress = _rewardsAddress;
  }

  function setRewardsMint(uint256 percent) external onlyOwner {
    require(percent <= REWARDS_MINT_CAP, "Rewards mint % must be <= 10%");
    rewardsMint = percent;
  }

  function setContractMode(
    uint256 cardinality,
    uint256 contractExpectedValueFloor,
    uint256 mintMultiplier,
    uint256 minAmount,
    uint256 maxAmount,
    uint256 entryLimit
  ) external onlyOwner {
    require(entryLimit <= cardinality, "Limit greater than cardinality");
    if ((minAmount > 0 && maxAmount > 0) && minAmount > maxAmount) {
      revert("minAmount greater than maxAmount");
    }

    uint256 gmid = _currentContractModeId.current();
    contractModes[gmid] = ContractMode({
      id: gmid,
      cardinality: cardinality,
      contractExpectedValueFloor: contractExpectedValueFloor,
      mintMultiplier: mintMultiplier,
      minAmount: minAmount,
      maxAmount: maxAmount,
      entryLimit: entryLimit,
      isActive: true
    });

    _currentContractModeId.increment();
    emit ContractModeUpdated(gmid);
  }

  function setContractModeMinMax(
    uint256 contractModeId,
    uint256 minAmount,
    uint256 maxAmount
  ) external onlyOwner {
    if ((minAmount > 0 && maxAmount > 0) && minAmount > maxAmount) {
      revert("minAmount greater than maxAmount");
    }
    require(
      contractModeId < _currentContractModeId.current(),
      "Invalid contract mode"
    );

    contractModes[contractModeId].minAmount = minAmount;
    contractModes[contractModeId].maxAmount = maxAmount;
    emit ContractModeUpdated(contractModeId);
  }

  function setContractModeIsActive(
    uint256 contractModeId,
    bool isActive
  ) external onlyOwner {
    require(
      contractModeId < _currentContractModeId.current(),
      "Invalid contract mode"
    );

    contractModes[contractModeId].isActive = isActive;
    emit ContractModeUpdated(contractModeId);
  }

  function setContractExpectedValueFloor(
    uint256 contractModeId,
    uint256 _contractExpectedValueFloor
  ) external onlyOwner {
    require(
      contractModeId < _currentContractModeId.current(),
      "Invalid contract mode"
    );
    require(
      _contractExpectedValueFloor < CONTRACT_EXPECTED_VALUE_CEILING,
      "Floor must be less than ceiling"
    );

    contractModes[contractModeId]
      .contractExpectedValueFloor = _contractExpectedValueFloor;
    emit ContractModeUpdated(contractModeId);
  }

  function setContractModeEntryLimit(
    uint256 contractModeId,
    uint256 entryLimit
  ) external onlyOwner {
    require(
      contractModeId < _currentContractModeId.current(),
      "Invalid contract mode"
    );
    require(
      entryLimit <= contractModes[contractModeId].cardinality,
      "entryLimit > cardinality"
    );

    contractModes[contractModeId].entryLimit = entryLimit;
    emit ContractModeUpdated(contractModeId);
  }

  function setEliminators(uint256 randomEliminator, uint256 roundId) internal {
    uint256 cgmid = _currentContractModeId.current();

    for (uint256 gmid = 0; gmid < cgmid; gmid++) {
      rounds[roundId].eliminators.push(
        Eliminator({
          contractModeId: gmid,
          recordedExpectedValueFloor: contractModes[gmid]
            .contractExpectedValueFloor,
          isEliminator: randomEliminator >=
            contractModes[gmid].contractExpectedValueFloor
        })
      );
    }
  }

  function setRoundPaused(bool _paused) public onlyManagerOrOwner {
    isRoundPaused = _paused;
    emit RoundPausedChanged(_paused);
  }

  function setPauseContract(bool _paused) public onlyOwner {
    if (_paused) {
      _pause();
    } else {
      _unpause();
    }
  }

  /* Setters END */

  function createEntryHistory() internal view returns (EntryHistory[] memory) {
    uint256 contractModeCount = _currentContractModeId.current();
    EntryHistory[] memory entryHistory = new EntryHistory[](contractModeCount);

    for (uint256 gmid = 0; gmid < entryHistory.length; gmid++) {
      entryHistory[gmid] = EntryHistory({
        gmAmount: 0,
        entryLimit: 0,
        pickedList: new bool[](contractModes[gmid].cardinality)
      });
    }

    return entryHistory;
  }

  function placeBatchEntry(
    Entry[] memory entries
  ) external nonReentrant whenNotPaused {
    require(!isRoundPaused, "Round is paused");
    require(
      rounds[_currentRoundId.current()].startedAt > 0 &&
        rounds[_currentRoundId.current()].endedAt == 0,
      "Round has not started yet."
    );

    uint256 contractModeCount = _currentContractModeId.current();
    uint256 entryCount = entries.length;
    uint256 rid = _currentRoundId.current();
    uint256 batchEntryId = rounds[rid].users.length;

    uint256 totalEntryAmount = 0;

    // @NOTE Array index is contractModeId | used to enforce entry requirements
    EntryHistory[] memory entryHistory = createEntryHistory();

    // @NOTE Get storage reference for batchEntry by userAddress
    BatchEntry storage batchEntry = batchEntryMap[rid][msg.sender];

    require(
      batchEntry.totalEntryAmount == 0,
      "Already entered in current round"
    );

    for (uint256 idx = 0; idx < entryCount; idx++) {
      require(
        entries[idx].contractModeId < _currentContractModeId.current(),
        "Invalid contract mode"
      );
      ContractMode memory contractMode = contractModes[
        entries[idx].contractModeId
      ];

      require(entries[idx].amount != 0, "Amount cannot be zero");
      require(contractMode.isActive, "Contract mode is not active");
      require(
        entries[idx].pickedNumber < contractMode.cardinality,
        "Invalid picked number"
      );
      // @NOTE Ensure number has already been picked by user
      require(
        !entryHistory[contractMode.id].pickedList[entries[idx].pickedNumber],
        "Duplicate pickedNumber by contract"
      );

      entryHistory[contractMode.id].pickedList[
        entries[idx].pickedNumber
      ] = true;

      // @NOTE Ensure the max entry amount isn't exceeded for the specific contract mode
      if (contractMode.maxAmount > 0) {
        // @NOTE If maxAmount is set(> 0), then keep track of contractMode min/max requirements
        entryHistory[contractMode.id].gmAmount =
          entryHistory[contractMode.id].gmAmount +
          entries[idx].amount;
        require(
          entryHistory[contractMode.id].gmAmount < contractMode.maxAmount,
          "Contract mode max amount exceeded"
        );
      }

      entryHistory[contractMode.id].entryLimit =
        entryHistory[contractMode.id].entryLimit +
        1;
      require(
        entryHistory[contractMode.id].entryLimit <= contractMode.entryLimit,
        "Contract mode entry limit exceeded"
      );

      totalEntryAmount = totalEntryAmount + entries[idx].amount;

      batchEntry.entries.push(
        Entry({
          contractModeId: contractMode.id,
          pickedNumber: entries[idx].pickedNumber,
          amount: entries[idx].amount
        })
      );
    }

    // @NOTE If minAmount is set(> 0) for a contractMode, ensure the minAmount for each contractMode was met
    for (uint256 gmid = 0; gmid < contractModeCount; gmid++) {
      if (
        contractModes[gmid].minAmount > 0 &&
        entryHistory[gmid].gmAmount < contractModes[gmid].minAmount
      ) {
        revert("Contract mode min amount not met");
      }
    }

    // @NOTE Current index position for user
    batchEntry.batchEntryId = batchEntryId;
    batchEntry.user = msg.sender;
    // @NOTE Sum of all entry amounts
    batchEntry.totalEntryAmount = totalEntryAmount;
    // @NOTE Probably don't need this since it defaults to 0
    batchEntry.totalMintAmount = 0;
    // @NOTE Probably don't need this since it defaults to false
    batchEntry.settled = false;
    batchEntry.placedAt = block.timestamp;

    // @NOTE Add user's address to round users array
    rounds[rid].users.push(msg.sender);

    fareToken.burnFare(msg.sender, totalEntryAmount);
    fareToken.mintFare(
      rewardsAddress,
      (totalEntryAmount * rewardsMint) / 10 ** 18
    );

    emit EntrySubmitted(rid, batchEntryId, msg.sender);
  }

  function withdrawalBatchEntry() external nonReentrant whenNotPaused {
    uint256 rid = _currentRoundId.current();
    BatchEntry storage batchEntry = batchEntryMap[rid][msg.sender];
    require(batchEntry.totalEntryAmount != 0, "Batch entry does not exist");
    require(batchEntry.withdrewAt == 0, "Already withdrew entry");
    require(
      (batchEntry.placedAt + withdrawalPeriod) < block.timestamp,
      "Withdrawal not available yet"
    );
    require(!batchEntry.settled, "Entry already settled");

    batchEntry.withdrewAt = block.timestamp;

    fareToken.mintFare(msg.sender, batchEntry.totalEntryAmount);

    fareToken.burnFare(
      rewardsAddress,
      (batchEntry.totalEntryAmount * rewardsMint) / 10 ** 18
    );
    emit BatchEntryWithdraw(rid, msg.sender);
  }

  function settleBatchEntry(
    uint256 roundId,
    address user
  ) external nonReentrant whenNotPaused {
    BatchEntry storage batchEntry = batchEntryMap[roundId][user];
    Entry[] memory entries = batchEntry.entries;
    require(batchEntry.withdrewAt == 0, "You already withdrew from the round");
    require(batchEntry.totalEntryAmount != 0, "Batch entry does not exist");
    require(!batchEntry.settled, "Entry already settled");
    require(_currentRoundId.current() > roundId, "Round not yet resolved");

    bool hasMintedNFT = false;
    uint256 totalMintAmount = 0;

    for (uint256 idx = 0; idx < entries.length; idx++) {
      if (
        getIsEliminator(roundId, entries[idx].contractModeId) && !hasMintedNFT
      ) {
        mintEliminatorNFT(roundId, batchEntry.user);
        hasMintedNFT = true;
      } else {
        ContractMode memory contractMode = contractModes[
          entries[idx].contractModeId
        ];

        uint256 rng = rounds[roundId].randomNum;

        if (rng % contractMode.cardinality == entries[idx].pickedNumber) {
          totalMintAmount += (entries[idx].amount *
            contractMode.mintMultiplier);
        }
      }
    }

    if (totalMintAmount > 0) {
      fareToken.mintFare(batchEntry.user, totalMintAmount);
      batchEntry.totalMintAmount = totalMintAmount;
    }

    batchEntry.settled = true;
    batchEntry.settledAt = block.timestamp;

    emit EntrySettled(roundId, batchEntry.user, batchEntry.totalMintAmount > 0);
  }

  function batchSettleEntries(
    uint256[] memory roundIds,
    address user
  ) public nonReentrant whenNotPaused {
    require(roundIds.length > 0, "BatchEntry list cannot be empty.");
    require(
      roundIds.length < 21,
      "You can only settle 20 batch entries at a time."
    );
    for (uint256 index = 0; index < roundIds.length; index++) {
      uint256 roundId = roundIds[index];
      BatchEntry storage batchEntry = batchEntryMap[roundId][user];
      Entry[] memory entries = batchEntry.entries;
      require(
        batchEntry.withdrewAt == 0,
        "You already withdrew from the round"
      );
      require(batchEntry.totalEntryAmount != 0, "Batch entry does not exist");
      require(!batchEntry.settled, "Entry already settled");
      require(_currentRoundId.current() > roundId, "Round not yet resolved");

      bool hasMintedNFT = false;
      uint256 totalMintAmount = 0;

      for (uint256 idx = 0; idx < entries.length; idx++) {
        if (
          getIsEliminator(roundId, entries[idx].contractModeId) && !hasMintedNFT
        ) {
          mintEliminatorNFT(roundId, user);
          hasMintedNFT = true;
        } else {
          ContractMode memory contractMode = contractModes[
            entries[idx].contractModeId
          ];

          uint256 rng = rounds[roundId].randomNum;

          if (rng % contractMode.cardinality == entries[idx].pickedNumber) {
            totalMintAmount += (entries[idx].amount *
              contractMode.mintMultiplier);
          }
        }
      }

      if (totalMintAmount > 0) {
        fareToken.mintFare(batchEntry.user, totalMintAmount);
        batchEntry.totalMintAmount = totalMintAmount;
      }

      batchEntry.settled = true;
      batchEntry.settledAt = block.timestamp;
    }

    emit BatchEntriesSettled(user, roundIds);
  }

  function concludeRound(
    bytes32 revealKey,
    uint256 fullRandomNum
  ) external onlyManagerOrOwner whenNotPaused {
    uint256 rid = _currentRoundId.current();
    Round storage round = rounds[rid];

    require(
      keccak256(abi.encodePacked(revealKey, fullRandomNum)) == round.randomHash,
      "revealKey and randomness is invalid."
    );
    require(
      rounds[_currentRoundId.current()].users.length > 0,
      "No users in round."
    );
    require(isRoundPaused, "Must pause round before concluding.");
    require(
      round.startedAt > 0 && round.endedAt == 0,
      "Round already concluded."
    );

    uint256 randomNum = fullRandomNum % 100;
    uint256 randomEliminator = fullRandomNum % CONTRACT_EXPECTED_VALUE_CEILING;

    round.id = rid;
    round.fullRandomNum = fullRandomNum;
    round.randomNum = randomNum;
    round.revealKey = revealKey;
    round.randomEliminator = randomEliminator;
    round.endedAt = block.timestamp;

    // @NOTE Set Round -> Eliminators[] with current eliminator floors and randomEliminator
    setEliminators(randomEliminator, rid);

    _currentRoundId.increment();
    emit RoundConcluded(
      rid,
      revealKey,
      fullRandomNum,
      randomNum,
      randomEliminator
    );
  }

  function startNewRound(
    bytes32 randomHash
  ) external onlyManagerOrOwner whenNotPaused {
    uint256 rid = _currentRoundId.current();
    Round storage round = rounds[rid];
    require(randomHash != bytes32(0), "randomHash is required.");
    require(
      round.startedAt == 0 && round.endedAt == 0,
      "Round already started."
    );

    round.startedAt = block.timestamp;
    round.randomHash = randomHash;
    randomHashMap[rid] = randomHash;

    isRoundPaused = false;
    emit RoundPausedChanged(false);
    emit NewRoundStarted(rid, randomHash, round.startedAt);
  }

  function mintEliminatorNFT(
    uint256 roundId,
    address user
  ) internal whenNotPaused {
    emit NFTMint(roundId, user);
  }

  function getRandomness() private view returns (uint256) {
    uint256 upperLimit = type(uint256).max;
    uint256 seed = uint256(
      keccak256(
        abi.encodePacked(
          block.timestamp +
            block.difficulty +
            ((uint256(keccak256(abi.encodePacked(block.coinbase)))) /
              (block.timestamp)) +
            block.gaslimit +
            ((uint256(keccak256(abi.encodePacked(msg.sender)))) /
              (block.timestamp)) +
            block.number
        )
      )
    );

    return (seed - ((seed / upperLimit) * upperLimit));
  }
}
