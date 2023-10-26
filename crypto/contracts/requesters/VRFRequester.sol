// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./BaseRequester.sol";

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Abstract contract that allows inheriting contract to easily make VRF requests using Chainlink
 */
abstract contract VRFRequester is BaseRequester, VRFConsumerBaseV2, Ownable {
  // @NOTE VRF Coordinator
  VRFCoordinatorV2Interface internal VRF_COORDINATOR;

  // @NOTE VRF related values
  uint64 public subscriptionId;
  uint16 public requestConfirmations;
  uint32 public callbackGasLimit;
  bytes32 public keyHash;

  struct VRFParams {
    address vrfCoordinator;
    uint64 subscriptionId;
    uint16 requestConfirmations;
    uint32 callbackGasLimit;
    bytes32 keyHash;
  }

  error InvalidVRFCoordinatorAddress();

  constructor(
    VRFParams memory vrfParams
  ) VRFConsumerBaseV2(vrfParams.vrfCoordinator) {
    if (vrfParams.vrfCoordinator == address(0))
      revert InvalidVRFCoordinatorAddress();
    VRF_COORDINATOR = VRFCoordinatorV2Interface(vrfParams.vrfCoordinator);
    subscriptionId = vrfParams.subscriptionId;
    requestConfirmations = vrfParams.requestConfirmations;
    callbackGasLimit = vrfParams.callbackGasLimit;
    keyHash = vrfParams.keyHash;
  }

  function getVRFCoordinatorAddress() public view returns (address vrfAddress) {
    vrfAddress = address(VRF_COORDINATOR);
  }

  function setVRFRequestParameters(
    address _vrfCoordinator,
    uint64 _subscriptionId,
    uint16 _requestConfirmations,
    uint32 _callbackGasLimit,
    bytes32 _keyHash
  ) external onlyOwner {
    VRF_COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
    subscriptionId = _subscriptionId;
    requestConfirmations = _requestConfirmations;
    callbackGasLimit = _callbackGasLimit;
    keyHash = _keyHash;
  }

  function requestRandomNumber() internal virtual override returns (uint) {
    return requestVRF();
  }

  function requestVRF() internal returns (uint256 requestId) {
    requestId = VRF_COORDINATOR.requestRandomWords(
      keyHash,
      subscriptionId,
      requestConfirmations,
      callbackGasLimit,
      1
    );
  }

  // @NOTE This is the original callback function that will be called by Chainlink.
  // It will call back the `resolveRandomNumbers` defined by the `BaseRequester`
  function fulfillRandomWords(
    uint256 requestId,
    uint256[] memory randomWords
  ) internal override {
    resolveRandomNumber(requestId, randomWords[0]);
  }
}
