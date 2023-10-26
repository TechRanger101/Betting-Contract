// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface IFareItems {
    function exists(uint256 id) external view returns (bool);
    function mintBatch(address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data) external;
}
