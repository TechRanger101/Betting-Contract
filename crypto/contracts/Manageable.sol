//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

// Add Manager role after Owner to allow different levels of access
abstract contract Manageable is Ownable {
  mapping(address => bool) public addressToIsManager;

  event ManagerStatusUpdate(address indexed manager, bool indexed status);

  error NotManagerOrOwner();

  modifier onlyManagerOrOwner() {
    _onlyManagerOrOwner();
    _;
  }

  function _onlyManagerOrOwner() internal view virtual {
    if (owner() != msg.sender && !addressToIsManager[msg.sender])
      revert NotManagerOrOwner();
  }

  function setManagerStatus(address _manager, bool _status) public onlyOwner {
    addressToIsManager[_manager] = _status;
    emit ManagerStatusUpdate(_manager, _status);
  }
}
