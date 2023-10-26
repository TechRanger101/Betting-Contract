// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IFareItems.sol";
import "./interfaces/IFareNFTLootBox.sol";

contract FareNFTLootBoxController is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    using SafeMath for uint256;

    Counters.Counter private _latestLootTableId;
    // Change to interfaces with the lootbox and items
    IFareNFTLootBox public fareLootBox;
    IFareItems public fareItems;
    uint256 private _maxItemThreshold;
    uint256 public selectedLootTableId = 0;

    // @TODO: Make this dynamic instead of an enum
    enum Rarity {
        COMMON,
        UNCOMMON,
        RARE,
        EPIC,
        LEGENDARY,
        UNIQUE
    }

    struct LootTableItem {
        uint256 itemId;
        uint256 weight;
    }

    struct LootBox {
        bool isOpened;
        Rarity rarity;
        uint256 lootTableId;
        uint256 itemThreshold;
    }

    mapping(uint256 => LootTableItem[]) public lootTableMap;
    mapping(uint256 => uint256) public lootTableWeightMap;
    mapping(uint256 => LootBox) public lootBoxMap;

    constructor(
        address _itemAddress,
        address _nftAddress,
        uint256 threshold
    ) {
        fareItems = IFareItems(_itemAddress);
        fareLootBox = IFareNFTLootBox(_nftAddress);
        _maxItemThreshold = threshold;
    }

    // Getters START

    function getLatestLootTableId() external view returns (uint256) {
        return _latestLootTableId.current();
    }

    function getLootItemCount(uint256 lootTableId)
        external
        view
        returns (uint256)
    {
        return lootTableMap[lootTableId].length;
    }

    // Getters END

    // Setters START

    function setItemThrehold(uint256 newThreshold) external onlyOwner {
        _maxItemThreshold = newThreshold;
    }

    function setSelectedLootTableId(uint256 lootTableId) external onlyOwner {
        selectedLootTableId = lootTableId;
    }

    function setLootTable(LootTableItem[] memory lootTableItems)
        external
        onlyOwner
    {
        uint256 ltId = _latestLootTableId.current();
        LootTableItem[] storage lootTable = lootTableMap[ltId];
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < lootTableItems.length; i++) {
            require(
                fareItems.exists(lootTableItems[i].itemId),
                "Item does not exist"
            );
            lootTable.push(
                LootTableItem({
                    itemId: lootTableItems[i].itemId,
                    weight: lootTableItems[i].weight
                })
            );
            totalWeight = totalWeight.add(lootTableItems[i].weight);
        }
        lootTableWeightMap[ltId] = totalWeight;
        _latestLootTableId.increment();
    }

    // Setters END

    function rewardLootBoxToken(
        Rarity rarity,
        uint256 itemThreshold,
        address owner
    ) external onlyOwner nonReentrant {
        require(
            itemThreshold <= _maxItemThreshold,
            "Item threshold exceeds limit"
        );

        uint256 nftId = fareLootBox.safeMint(owner);
        LootBox storage lootBox = lootBoxMap[nftId];
        lootBox.isOpened = false;
        lootBox.rarity = rarity;
        lootBox.itemThreshold = itemThreshold;
        lootBox.lootTableId = selectedLootTableId;
    }

    function openLootBox(uint256 lootBoxId) public {
        address nftOwner = fareLootBox.ownerOf(lootBoxId);

        require(nftOwner == msg.sender, "Not the owner");
        require(!lootBoxMap[lootBoxId].isOpened, "Already opened");

        LootBox storage lootBox = lootBoxMap[lootBoxId];
        LootTableItem[] memory lootTableItems = lootTableMap[
            lootBox.lootTableId
        ];
        uint256 totalWeight = lootTableWeightMap[lootBox.lootTableId];

        uint256[] memory itemIds = new uint256[](lootBox.itemThreshold);
        uint256[] memory amounts = new uint256[](lootBox.itemThreshold);

        for (uint256 i = 0; i < lootBox.itemThreshold; i++) {
            uint256 selectedItemId = retrieveItem(
                lootTableItems,
                totalWeight,
                i
            );
            itemIds[i] = selectedItemId;
            amounts[i] = 1;
        }

        // Batch mint the items
        fareItems.mintBatch(nftOwner, itemIds, amounts, "");

        lootBox.isOpened = true;
    }

    function retrieveItem(
        LootTableItem[] memory items,
        uint256 totalWeight,
        uint256 nonce
    ) private view returns (uint256 selectedItemId) {
        uint256 randomNum = getRandomness(totalWeight + 1, nonce);
        uint256 currentWeight = 0;
        for (uint256 i = 0; i < items.length; i++) {
            currentWeight += items[i].weight;
            if (randomNum <= currentWeight) {
                selectedItemId = items[i].itemId;
                break;
            }
        }
    }

    function getRandomness(uint256 upperLimit, uint256 nonce)
        private
        view
        returns (uint256)
    {
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp +
                        block.difficulty +
                        ((
                            uint256(keccak256(abi.encodePacked(block.coinbase)))
                        ) / (block.timestamp)) +
                        block.gaslimit +
                        nonce +
                        ((uint256(keccak256(abi.encodePacked(msg.sender)))) /
                            (block.timestamp)) +
                        block.number
                )
            )
        );

        return (seed - ((seed / upperLimit) * upperLimit));
    }
}
