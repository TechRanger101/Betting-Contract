//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract FareKeyNFT is ERC721Enumerable, Ownable {
  string public contractURI;
  string public baseTokenURI;
  uint public constant MAX_SUPPLY = 888;

  event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

  error ArrayLengthsMismatch();
  error ExceedsMaxSupply();

  constructor(
    string memory name_,
    string memory symbol_
  ) ERC721(name_, symbol_) {}

  function _baseURI() internal view virtual override returns (string memory) {
    return baseTokenURI;
  }

  function setContractURI(string memory _contractURI) public onlyOwner {
    contractURI = _contractURI;
  }

  function setBaseTokenURI(string memory _baseTokenURI) public onlyOwner {
    baseTokenURI = _baseTokenURI;
    // @dev So that marketplaces would update the metadata
    emit BatchMetadataUpdate(0, type(uint).max);
  }

  function batchMint(
    uint[] calldata tokenIds,
    address[] calldata users
  ) external onlyOwner {
    if (tokenIds.length != users.length) revert ArrayLengthsMismatch();
    uint currentSupply = totalSupply();
    uint mintAmount = users.length;
    if (currentSupply + mintAmount > MAX_SUPPLY) revert ExceedsMaxSupply();
    for (uint i; i < mintAmount; ) {
      _safeMint(users[i], tokenIds[i]);
      unchecked {
        ++i;
      }
    }
  }
}
