// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IFareNFTLootBox {
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeMint(address to) external returns (uint256);
}
