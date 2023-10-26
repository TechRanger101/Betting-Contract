// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./interfaces/IFareToken.sol";
import "./Manageable.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract FareToken is ERC20, Pausable, Manageable, IFareToken {
  uint256 public constant INITIAL_SUPPLY = 50000000000 * 10 ** 18; // 50 Billion initial Supply
  uint256 public mintLimit = 0;
  uint256 public burnLimit = 0;
  address private _owner;

  mapping(address => bool) public contractWhitelist;
  mapping(address => mapping(address => bool)) public contractUserAllowList;

  constructor(
    uint256 _mintLimit,
    uint256 _burnLimit
  ) ERC20("Fare Protocol", "FARE") {
    mintLimit = _mintLimit;
    burnLimit = _burnLimit;
    _owner = msg.sender; // Set owner to contract creator

    _mint(msg.sender, INITIAL_SUPPLY);
  }

  // Modifiers START

  modifier onlyWhitelist() {
    _onlyWhitelist();
    _;
  }

  function _onlyWhitelist() private view {
    require(contractWhitelist[msg.sender], "Not on whitelist");
  }

  // Modifiers END

  // Getters START

  function didUserAllowContract(
    address _user,
    address _contractAddress
  ) public view returns (bool) {
    return contractUserAllowList[_contractAddress][_user];
  }

  // Getters END

  // Setters START

  function setAllowContractMintBurn(
    address _contractAddress,
    bool _allow
  ) public {
    // Allow contract to mint/burn
    require(contractWhitelist[_contractAddress], "Contract not whitelisted");
    contractUserAllowList[_contractAddress][msg.sender] = _allow;
  }

  function setBurnLimit(uint256 _burnLimit) external onlyOwner {
    burnLimit = _burnLimit;
  }

  function setMintLimit(uint256 _mintLimit) external onlyOwner {
    mintLimit = _mintLimit;
  }

  function setWhitelistAddress(
    address contractAddress,
    bool isActive
  ) external onlyOwner {
    contractWhitelist[contractAddress] = isActive;
  }

  function setPauseContract(bool _paused) public onlyManagerOrOwner {
    if (_paused) {
      _pause();
    } else {
      _unpause();
    }
  }

  // Setters END

  function mintFare(
    address user,
    uint256 amount
  ) external onlyWhitelist whenNotPaused {
    require(
      didUserAllowContract(user, msg.sender),
      "User did not allow contract to mint"
    );
    require(amount <= mintLimit, "Amount exceeds mint limit");
    _mint(user, amount);
  }

  function burnFare(
    address user,
    uint256 amount
  ) external onlyWhitelist whenNotPaused {
    require(
      didUserAllowContract(user, msg.sender),
      "User did not allow contract to burn"
    );
    require(amount <= burnLimit, "Amount exceeds burn limit");
    _burn(user, amount);
  }
}
