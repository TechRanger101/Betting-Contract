// @NOTE: NFT or User Rewards Based Protocol Probability Value Single User Contract (NFTorURBPPVSUContract)
// @NOTE: Dynamically change whether we use NFT or User Rewards based PPV by setting `ppvType`

//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./NFTBPPVSUContract.sol";

abstract contract NFTorURBPPVSUContract is NFTBPPVSUContract {
  // @NOTE: ppvType: 0 => NFT based ppv, 1 => User Rewards based ppv
  // @NOTE: If ppvType is 0, it would work as same as `NFTBPPVSUContract`
  // @NOTE: If ppvType is not 0, it would work as `BaseSUContract` with `contractSpecificCalculateUserRewards` function implementing `calculateUserRewardsWithPPV`
  uint public ppvType;

  struct NFTorURBPPVSUContractParams {
    NFTBPPVSUContractParams nftbppvsuContractParams;
  }

  constructor(
    NFTorURBPPVSUContractParams memory nftorurbppvsuContractParams
  ) NFTBPPVSUContract(nftorurbppvsuContractParams.nftbppvsuContractParams) {}

  function setPPVType(uint _ppvType) public onlyOwner {
    ppvType = _ppvType;
  }

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
      if (ppvType == 0) {
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
            uint userReward = calculateUserRewardsWithoutPPV(
              entry.amount,
              entryMultiplier
            );
            userRewards[i] = userReward;
            grossUserRewards += userReward;
          }
        }
      } else {
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
          uint userReward = calculateUserRewardsWithPPV(
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
