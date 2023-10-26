// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./KeccakRequester.sol";
import "./VRFRequester.sol";
import "./QRNGRequester.sol";

abstract contract DynamicRequester is
  KeccakRequester,
  VRFRequester,
  QRNGRequester
{
  enum RequesterType {
    KECCAK,
    VRF,
    QRNG
  }

  RequesterType activeRequesterType;

  struct DynamicRequesterParams {
    KeccakParams keccakParams;
    VRFParams vrfParams;
    QRNGParams qrngParams;
  }

  constructor(
    DynamicRequesterParams memory dynamicRequesterParams
  )
    KeccakRequester(dynamicRequesterParams.keccakParams)
    VRFRequester(dynamicRequesterParams.vrfParams)
    QRNGRequester(dynamicRequesterParams.qrngParams)
  {}

  function setActiveRequesterType(
    RequesterType _requesterType
  ) public onlyOwner {
    activeRequesterType = _requesterType;
  }

  function requestRandomNumber()
    internal
    override(KeccakRequester, VRFRequester, QRNGRequester)
    returns (uint)
  {
    if (activeRequesterType == RequesterType.KECCAK) {
      return requestKeccak();
    } else if (activeRequesterType == RequesterType.VRF) {
      return requestVRF();
    } else {
      return requestQRNG();
    }
  }
}
