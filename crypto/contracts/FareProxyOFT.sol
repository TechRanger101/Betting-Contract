// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@layerzerolabs/solidity-examples/contracts/token/oft/OFTCore.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./interfaces/IFareToken.sol";

// @NOTE: Might want to have this contract as pausable. Just in case something goes as unexpected
// @NOTE inside OFT.sol contract there is this note: "override decimal() function is needed"
contract FareProxyOFT is OFTCore, Pausable {
  IFareToken internal immutable fareToken;

  constructor(address _lzEndpoint, address _token) OFTCore(_lzEndpoint) {
    fareToken = IFareToken(_token);
  }

  function circulatingSupply() public view virtual override returns (uint) {
    unchecked {
      return fareToken.totalSupply();
    }
  }

  function token() public view virtual override returns (address) {
    return address(fareToken);
  }

  function _debitFrom(
    address _from,
    uint16,
    bytes memory,
    uint _amount
  ) internal virtual override whenNotPaused returns (uint) {
    require(_from == _msgSender(), "ProxyOFT: owner is not send caller");
    uint before = fareToken.totalSupply();
    fareToken.burnFare(_from, _amount);
    return before - fareToken.totalSupply();
  }

  function _creditTo(
    uint16,
    address _toAddress,
    uint _amount
  ) internal virtual override whenNotPaused returns (uint) {
    uint before = fareToken.totalSupply();
    fareToken.mintFare(_toAddress, _amount);
    return fareToken.totalSupply() - before;
  }

  function setPause(bool isPause) public onlyOwner {
    if (isPause) {
      _pause();
    } else {
      _unpause();
    }
  }
}
