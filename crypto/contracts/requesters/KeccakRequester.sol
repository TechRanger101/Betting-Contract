// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./BaseRequester.sol";
import "../libraries/Randomness.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

abstract contract KeccakRequester is BaseRequester, Ownable {
  address immutable keccakResolver;
  uint public batchResolveLimit = 20;

  mapping(address => uint) public addressToRequestCount;
  mapping(uint => uint) public requestIdToBlockNumber;

  event KeccakRandomNumberRequested(uint indexed requestId);
  event FailedRequestIds(uint[] failedRequestIds);

  struct KeccakParams {
    address keccakResolver;
  }

  error InvalidKeccakResolverAddress();
  error NotKeccakResolver();
  error RequestIdInProgress();
  error RequestIdNotInProgress();
  error CannotRequestAndResolveRandomNumberInsideSameBlock();
  error ExceedsBatchResolveLimit();
  error InternalFunction();

  constructor(KeccakParams memory keccakParams) {
    if (keccakParams.keccakResolver == address(0))
      revert InvalidKeccakResolverAddress();
    keccakResolver = keccakParams.keccakResolver;
  }

  modifier onlyKeccakResolver() {
    _onlyKeccakResolver();
    _;
  }

  function _onlyKeccakResolver() private view {
    if (msg.sender != keccakResolver) revert NotKeccakResolver();
  }

  function setBatchResolveLimit(uint _batchResolveLimit) public onlyOwner {
    batchResolveLimit = _batchResolveLimit;
  }

  function requestRandomNumber() internal virtual override returns (uint) {
    return requestKeccak();
  }

  function requestKeccak() internal returns (uint) {
    uint requesterRequestCount = addressToRequestCount[msg.sender]++;
    // @NOTE: I am not sure but I would guess this allows us to avoid requestId collision
    uint requestId = uint256(
      keccak256(
        abi.encodePacked(
          block.chainid,
          address(this),
          requesterRequestCount,
          msg.sender
        )
      )
    );
    if (requestIdToBlockNumber[requestId] != 0) revert RequestIdInProgress();
    requestIdToBlockNumber[requestId] = block.number;
    emit KeccakRandomNumberRequested(requestId);
    return requestId;
  }

  // NOTE: Main concern is that resolver address would be malicious and not resolve until they find a result they want. Do you have an idea on how to resolve this issue?
  // NOTE: Looking forward for advices (maybe allowing anybody to resolve?, maybe we could restrict the resolvement up till X amount of blocks pass so that they can only try for X amount of blocks?)
  function resolveKeccak(uint requestId) external onlyKeccakResolver {
    uint requestedBlockNumber = requestIdToBlockNumber[requestId];
    if (requestedBlockNumber == 0) revert RequestIdNotInProgress();
    // Since third party developers can use KeccakRequester and potentially simulate submitting and resolving an entry inside the same block
    // We have to consider this posibility and not allow them to resolve in the same block as they submitted
    if (requestedBlockNumber == block.number)
      revert CannotRequestAndResolveRandomNumberInsideSameBlock();
    delete requestIdToBlockNumber[requestId];
    resolveRandomNumber(requestId, Randomness.getRandomness());
  }

  // NOTE: Same concerns as `resolveKeccak`
  function batchResolveKeccak(
    uint[] calldata requestIds
  ) external onlyKeccakResolver {
    uint len = requestIds.length;
    if (len > batchResolveLimit) revert ExceedsBatchResolveLimit();
    uint nonce = uint256(
      keccak256(abi.encodePacked(block.timestamp, address(this), msg.sender))
    );
    unchecked {
      // Check if it causes an overflow
      if (nonce + len < nonce) {
        // In the case of overflow, decrease nonce with len to make sure that it does not overflow
        nonce -= len;
      }
    }
    uint[] memory failedRequestIds = new uint[](len);
    uint errorCount;
    for (uint i; i < len; ) {
      uint currentRequestId = requestIds[i];
      uint requestedBlockNumber = requestIdToBlockNumber[currentRequestId];
      if (requestedBlockNumber == block.number) {
        failedRequestIds[errorCount++] = currentRequestId;
        unchecked {
          ++i;
        }
        continue;
      }
      (bool success, ) = address(this).call(
        abi.encodeWithSelector(
          this.resolveRandomNumbersWrapper.selector,
          currentRequestId,
          Randomness.getRandomnessWithNonce(nonce + i)
        )
      );
      if (!success) {
        failedRequestIds[errorCount++] = currentRequestId;
      } else {
        // If request has resolved successfully, delete the data about that request
        delete requestIdToBlockNumber[currentRequestId];
      }
      unchecked {
        ++i;
      }
    }
    if (errorCount != 0) {
      emit FailedRequestIds(failedRequestIds);
    }
  }

  function resolveRandomNumbersWrapper(
    uint requestId,
    uint randomNumber
  ) public {
    if (msg.sender != address(this)) revert InternalFunction();
    resolveRandomNumber(requestId, randomNumber);
  }
}
