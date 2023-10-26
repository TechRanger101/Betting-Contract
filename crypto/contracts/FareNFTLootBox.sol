// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract FareNFTLootBox is ERC721, ERC721Burnable, Ownable {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _nftIdCounter;
    string internal nftURI;

    mapping(address => bool) public minterWhitelist;

    constructor(string memory _nftURI) ERC721("Fare Loot Box", "FARELB") {
        nftURI = _nftURI;
    }

    modifier onlyWhitelist() {
        require(minterWhitelist[msg.sender], "Not on whitelist");
        _;
    }

    // Getters START

    function getLatestNftId() public view returns (uint256 latestNftId) {
        latestNftId = _nftIdCounter.current();
    }

    function _baseURI() internal view override returns (string memory) {
        return nftURI;
    }

    // Getters END

    // Setters START

    function setBaseURI(string memory _nftURI) external onlyOwner {
        nftURI = _nftURI;
    }

    function setWhitelistAddress(address minter, bool isActive)
        external
        onlyOwner
    {
        minterWhitelist[minter] = isActive;
    }

    // Setters END

    function safeMint(address to) public onlyWhitelist returns (uint256) {
        uint256 tokenId = _nftIdCounter.current();
        _nftIdCounter.increment();
        _safeMint(to, tokenId);
        return tokenId;
    }
}
