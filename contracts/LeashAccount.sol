// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGroth16Verifier {
    function verifyProof(uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[4] calldata input) external view returns (bool);
}

contract LeashAccount {
    address public owner;
    IGroth16Verifier public immutable verifier;
    bytes32 public policyCommitment;
    bool public treasuryFrozen;
    mapping(bytes32 => bool) public usedNullifiers;

    constructor(address _owner, address _verifier, bytes32 _commitment) {
        owner = _owner;
        verifier = IGroth16Verifier(_verifier);
        policyCommitment = _commitment;
    }

    function emergencyFreeze(bool _freeze) external {
        require(msg.sender == owner, "Not owner");
        treasuryFrozen = _freeze;
    }

    function updatePolicyCommitment(bytes32 _newCommitment) external {
        require(msg.sender == owner, "Not owner");
        policyCommitment = _newCommitment;
    }

    function executeVerifiedTrade(address target, bytes calldata data, bytes32 nullifier, uint256[2] calldata a, uint256[2][2] calldata b, uint256[2] calldata c, uint256[4] calldata input) external returns (bytes memory) {
        require(!treasuryFrozen, "Treasury frozen");
        require(!usedNullifiers[nullifier], "Replay blocked");
        require(bytes32(input[0]) == policyCommitment, "Commitment mismatch");
        require(verifier.verifyProof(a, b, c, input), "Invalid ZK proof");
        usedNullifiers[nullifier] = true;
        (bool ok, bytes memory res) = target.call(data);
        require(ok, "Settlement failed");
        return res;
    }
}
