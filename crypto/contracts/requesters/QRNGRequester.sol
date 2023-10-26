//SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./BaseRequester.sol";

import "@api3/airnode-protocol/contracts/rrp/requesters/RrpRequesterV0.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Abstract contract that allows inheriting contract to easily make QRNG request using API3
 */
abstract contract QRNGRequester is BaseRequester, RrpRequesterV0, Ownable {
  // Airnode related values
  address public airnode;
  bytes32 public endpointIdUint256;
  bytes32 public endpointIdUint256Array;
  address public sponsorWallet;

  struct QRNGParams {
    address airnodeRrp;
  }

  constructor(
    QRNGParams memory qrngParams
  ) RrpRequesterV0(qrngParams.airnodeRrp) {}

  function setQRNGRequestParameters(
    address _airnode,
    bytes32 _endpointIdUint256Array,
    address _sponsorWallet
  ) external onlyOwner {
    airnode = _airnode;
    endpointIdUint256Array = _endpointIdUint256Array;
    // Be aware of the difference between sponsor wallet and sponsor address. Check API3 documentation for most up to date info about it
    sponsorWallet = _sponsorWallet;
  }

  function requestRandomNumber() internal virtual override returns (uint) {
    return requestQRNG();
  }

  function requestQRNG() internal returns (uint requestId) {
    requestId = uint(
      airnodeRrp.makeFullRequest(
        airnode,
        endpointIdUint256,
        address(this),
        sponsorWallet,
        address(this),
        this.resolveQRNG.selector,
        ""
      )
    );
  }

  // This is the original callback function that will be called by sponsor wallet.
  // It will call back the `resolveRandomNumber` defined by the `BaseRequester`
  function resolveQRNG(
    bytes32 requestId,
    bytes calldata data
  ) external onlyAirnodeRrp {
    uint256 qrngUint256 = abi.decode(data, (uint256));
    resolveRandomNumber(uint(requestId), qrngUint256);
  }
}
