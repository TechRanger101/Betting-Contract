// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract FareItems is ERC1155, Ownable, ERC1155Burnable, ERC1155Supply {
    using SafeMath for uint256;
    using Counters for Counters.Counter;

    Counters.Counter private _itemIds;
    address public controllerAddress;

    constructor(string memory baseURL, address _controllerAddress)
        ERC1155(baseURL)
    {
        // Create a null item at id 1
        // Used for adding empty weight in a LootTable
        _mint(msg.sender, _itemIds.current(), 1, "Genesis No Item");
        controllerAddress = _controllerAddress;

        // itemId 0 => null item
        _itemIds.increment();
    }

    // Getters START

    function getLatestItemId() public view returns (uint256 latestItemId) {
        latestItemId = _itemIds.current();
    }

    // Getters END

    // Setters START

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    // Setters END

    function createItemToken(uint256 _quantity, bytes memory _metadata)
        external
        onlyOwner
    {
        _mint(msg.sender, _itemIds.current(), _quantity, _metadata);
        _itemIds.increment();
    }

    function mint(
        address account,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) external onlyOwner {
        _mint(account, id, amount, data);
    }

    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external {
        require(msg.sender == controllerAddress, "Not controller address");
        _mintBatch(to, ids, amounts, data);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155, ERC1155Supply) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}
