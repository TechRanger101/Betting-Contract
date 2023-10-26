//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./interfaces/IFareToken.sol";
import "./interfaces/IFarePPVNFT.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "base64-sol/base64.sol";

contract FarePPVNFT is ERC721Enumerable, IFarePPVNFT, Ownable {
  IFareToken public fareToken;
  mapping(uint => EntryMetadata) public tokenIdToEntryMetadata;

  error InvalidFareTokenAddress();
  error FareTokenContractNotWhitelisted();
  error FareTokenContractNotAllowedByUser();
  error NonExistingTokenId();

  constructor(
    string memory name_,
    string memory symbol_,
    address _fareTokenAddress
  ) ERC721(name_, symbol_) {
    setFareToken(_fareTokenAddress);
  }

  // Since this is not a contract for 3rd party developers, rather it is a contract to hold all nfts of each contract
  // We are allowing the owner to change the fareToken
  function setFareToken(address _fareTokenAddress) public onlyOwner {
    if (_fareTokenAddress == address(0)) revert InvalidFareTokenAddress();
    fareToken = IFareToken(_fareTokenAddress);
  }

  function mintNFT(address user, EntryMetadata calldata params) external {
    if (!fareToken.contractWhitelist(address(this)))
      revert FareTokenContractNotWhitelisted();
    if (!fareToken.didUserAllowContract(user, address(this)))
      revert FareTokenContractNotAllowedByUser();
    uint currentSupply = totalSupply();
    _safeMint(user, ++currentSupply);
    tokenIdToEntryMetadata[currentSupply] = params;
  }

  function tokenURI(
    uint256 tokenId
  ) public view override(ERC721) returns (string memory) {
    if (!_exists(tokenId)) revert NonExistingTokenId();
    return constructTokenURI(tokenIdToEntryMetadata[tokenId]);
  }

  function constructTokenURI(
    EntryMetadata memory params
  ) public pure returns (string memory) {
    string memory description = generateDescription(params);
    string memory image = generateSVGImage(params);

    return
      string(
        abi.encodePacked(
          "data:application/json;base64,",
          Base64.encode(
            bytes(
              abi.encodePacked(
                '{"name":"',
                params.contractName,
                '", \n"description":"',
                description,
                '", \n"image": "',
                "data:image/svg+xml;base64,",
                image,
                '"}'
              )
            )
          )
        )
      );
  }

  function generateDescription(
    EntryMetadata memory entryMetadata
  ) private pure returns (string memory) {
    return
      string(
        abi.encodePacked(
          abi.encodePacked(
            "This NFT represents a reward from a Fare Protocol's contrat\nContract Address: ",
            Strings.toHexString(entryMetadata.contractAddress),
            "\nEntry Side: ",
            Strings.toString(entryMetadata.side),
            "\nEntry Amount: ",
            Strings.toString(entryMetadata.amount),
            "\nEntry Count: "
          ),
          abi.encodePacked(
            Strings.toString(entryMetadata.count),
            "\nEntry StopLoss: ",
            Strings.toString(entryMetadata.stopLoss),
            "\nEntry StopGain: ",
            Strings.toString(entryMetadata.stopGain),
            "\nEntry Block Number: ",
            Strings.toString(entryMetadata.blockNumber)
          ),
          abi.encodePacked(
            "\nEntry NFT mint amount: ",
            Strings.toString(entryMetadata.mintAmount),
            "\nEntry Used Count: ",
            Strings.toString(entryMetadata.usedCount)
          )
        )
      );
  }

  function generateSVGImage(
    EntryMetadata memory entryMetadata
  ) private pure returns (string memory) {
    return
      Base64.encode(
        abi.encodePacked(
          abi.encodePacked(
            '<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid meet"><style type="text/css"><![CDATA[text { font-family: monospace; font-size: 21px;} .h1 {font-size: 40px; font-weight: 600;}]]></style><rect width="800" height="800" fill="#ffffff" /><text x="20" y="70" style="font-size:28px;">Address: ',
            Strings.toHexString(entryMetadata.contractAddress),
            '</text><text x="20" y="100" style="font-size:28px;">Side: ',
            Strings.toString(entryMetadata.side),
            '</text><text x="20" y="130" style="font-size:28px;">Amount: ',
            Strings.toString(entryMetadata.amount),
            '</text><text x="20" y="160" style="font-size:28px;">Count: '
          ),
          abi.encodePacked(
            Strings.toString(entryMetadata.count),
            '</text><text x="20" y="190" style="font-size:28px;">StopLoss: ',
            Strings.toString(entryMetadata.stopLoss),
            '</text><text x="20" y="220" style="font-size:28px;">StopGain: ',
            Strings.toString(entryMetadata.stopGain),
            '</text><text x="20" y="250" style="font-size:28px;">BlockNumber: ',
            Strings.toString(entryMetadata.blockNumber)
          ),
          abi.encodePacked(
            '</text><text x="20" y="280" style="font-size:28px;">MintAmount: ',
            Strings.toString(entryMetadata.mintAmount),
            '</text><text x="20" y="310" style="font-size:28px;">UsedCount: ',
            Strings.toString(entryMetadata.usedCount),
            "</text></svg>"
          )
        )
      );
  }
}
