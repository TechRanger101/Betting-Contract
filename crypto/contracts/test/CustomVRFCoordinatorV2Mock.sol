// SPDX-License-Identifier: MIT

// solhint-disable-next-line
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/mocks/VRFCoordinatorV2Mock.sol";

contract CustomVRFCoordinatorV2Mock is VRFCoordinatorV2Mock {
  constructor(
    uint96 _baseFee,
    uint96 _gasPriceLink
  ) VRFCoordinatorV2Mock(_baseFee, _gasPriceLink) {}

  function customFulfillRandomWords(
    uint256 _requestId,
    address _consumer,
    uint[] calldata randomNumbers
  ) external {
    uint256 startGas = gasleft();
    if (s_requests[_requestId].subId == 0) {
      revert("nonexistent request");
    }
    Request memory req = s_requests[_requestId];

    uint256[] memory words = randomNumbers;

    // @NOTE unused code block
    // for (uint256 i = 0; i < req.numWords; i++) {
    //     words[i] = uint256(keccak256(abi.encode(_requestId, i)));
    // }

    VRFConsumerBaseV2 v;
    bytes memory callReq = abi.encodeWithSelector(
      v.rawFulfillRandomWords.selector,
      _requestId,
      words
    );
    (bool success, ) = _consumer.call{gas: req.callbackGasLimit}(callReq);

    uint96 payment = uint96(
      BASE_FEE + ((startGas - gasleft()) * GAS_PRICE_LINK)
    );
    if (s_subscriptions[req.subId].balance < payment) {
      revert InsufficientBalance();
    }
    s_subscriptions[req.subId].balance -= payment;
    delete (s_requests[_requestId]);
    emit RandomWordsFulfilled(_requestId, _requestId, payment, success);
  }
}
