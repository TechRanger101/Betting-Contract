// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IFareToken is IERC20 {
  function mintFare(address user, uint256 amount) external;

  function burnFare(address user, uint256 amount) external;

  function setAllowContractMintBurn(
    address _contractAddress,
    bool _allow
  ) external;

  function didUserAllowContract(
    address _user,
    address _contractAddress
  ) external view returns (bool);

  function contractWhitelist(
    address _contractAddress
  ) external view returns (bool);
}
