// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IFarePPVNFT {
  // usedCount: Because of the stopGain and stopLoss limits, although `count` might be high, actually `usedCount` could be different
  // mintAmount: Rather than minting the same NFT again we will increase this value
  struct EntryMetadata {
    uint side;
    uint amount;
    uint stopLoss;
    uint stopGain;
    uint64 blockNumber;
    uint32 count;
    uint32 usedCount;
    uint mintAmount;
    address contractAddress;
    string contractName;
  }

  function mintNFT(address user, EntryMetadata calldata entryMetadata) external;
}
