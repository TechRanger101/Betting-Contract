// @NOTE: NFT Based Protocol Probability Value Single User Contract (NFTBPPVSUContract)
// @NOTE: There exists a PPV because we are minting a NFT with some probability (ppv)
// @NOTE: If NFT is minted, it concludes the entry. Else entry continues with calculating user rewards without ppv

//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "../BaseSUContract.sol";
import "../../../interfaces/IFarePPVNFT.sol";

abstract contract NFTBPPVSUContract is BaseSUContract {
  IFarePPVNFT public immutable farePPVNFT;
  // @NOTE: To be shown in nft
  string public contractName;

  struct NFTBPPVSUContractParams {
    BaseContractParams baseContractParams;
    address farePPVNFTAddress;
    string contractName;
  }

  error InvalidFarePPVNFTAddress();
  error EmptyContractName();

  constructor(
    NFTBPPVSUContractParams memory nftbppvsuContractParams
  ) BaseContract(nftbppvsuContractParams.baseContractParams) {
    if (nftbppvsuContractParams.farePPVNFTAddress == address(0))
      revert InvalidFarePPVNFTAddress();
    if (bytes(nftbppvsuContractParams.contractName).length == 0)
      revert EmptyContractName();
    farePPVNFT = IFarePPVNFT(nftbppvsuContractParams.farePPVNFTAddress);
    contractName = nftbppvsuContractParams.contractName;
  }

  function checkIfNFTMint(
    uint randomNumber
  ) internal view virtual returns (bool) {
    return (randomNumber % PRECISION) <= protocolProbabilityValue;
  }

  function contractSpecificCalculateUserRewards(
    uint entryAmount,
    uint multiplier
  ) public view virtual override returns (uint) {
    return calculateUserRewardsWithoutPPV(entryAmount, multiplier);
  }

  // @NOTE: Use randomNumber to check protocolProbabilityValue percentage
  // @NOTE: Use the randomNumber only to check if it hits the protocolProbabilityValue. If it hits, just increment nftCount, dont even calculate userRewards
  // @NOTE: If it does not hit the protocolProbabilityValue, create a new randomNumber to continue to resolve entry and calculate user rewards without ppv
  function _resolveEntry(
    uint requestId,
    uint randomNumber
  ) internal virtual override {
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
    uint nftCount;
    uint i;
    for (; i < len; ) {
      bool isNFTMint = checkIfNFTMint(expandedRandomNumbers[i]);
      if (isNFTMint) {
        // When NFT is minted for that entry, to let frontend know, we say the protocolSide is the max uint value
        protocolSides[i] = type(uint).max;
        unchecked {
          ++nftCount;
        }
      } else {
        uint randomNumberAfterNFT = expandRandomNumberTo(
          expandedRandomNumbers[i],
          1
        )[0];
        uint protocolSide = contractSpecificGetProtocolSide(
          randomNumberAfterNFT,
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

    if (nftCount > 0) {
      farePPVNFT.mintNFT(
        user,
        IFarePPVNFT.EntryMetadata({
          side: entry.side,
          amount: entry.amount,
          stopLoss: entry.stopLoss,
          stopGain: entry.stopGain,
          blockNumber: entry.blockNumber,
          count: uint32(len),
          contractAddress: address(this),
          mintAmount: nftCount,
          usedCount: uint32(i),
          contractName: contractName
        })
      );
    }

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
}
