// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Counter
/// @notice A simple counter contract demonstrating the same concept as the
///         pallet-template counter - get, set, and increment a value.
///         This same Solidity source compiles to both EVM (via solc) and
///         PVM (via resolc) bytecode.
contract Counter {
    mapping(address => uint256) private counters;

    event CounterSet(address indexed who, uint256 value);
    event CounterIncremented(address indexed who, uint256 newValue);

    /// @notice Set the counter for the caller to a specific value.
    function setCounter(uint256 value) external {
        counters[msg.sender] = value;
        emit CounterSet(msg.sender, value);
    }

    /// @notice Increment the counter for the caller by one.
    function increment() external {
        counters[msg.sender] += 1;
        emit CounterIncremented(msg.sender, counters[msg.sender]);
    }

    /// @notice Get the counter value for a given account.
    function getCounter(address account) external view returns (uint256) {
        return counters[account];
    }
}
