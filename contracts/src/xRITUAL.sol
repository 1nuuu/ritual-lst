// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title xRITUAL
/// @notice Standalone ERC20 liquid staking token minted/burned only by the staking pool.
contract xRITUAL {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    address public stakingPool;
    address private immutable deployer;
    bool private stakingPoolSet;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    modifier onlyStakingPool() {
        require(msg.sender == stakingPool, "only staking pool");
        _;
    }

    constructor(string memory name_, string memory symbol_, address stakingPool_) {
        require(stakingPool_ != address(0), "zero staking pool");
        name = name_;
        symbol = symbol_;
        deployer = msg.sender;
        stakingPool = stakingPool_;
    }

    /// @notice One-time wiring of the RitualLST staking pool after both contracts are deployed.
    function setStakingPool(address stakingPool_) external {
        require(msg.sender == deployer, "only deployer");
        require(!stakingPoolSet, "staking pool set");
        require(stakingPool_ != address(0), "zero address");
        stakingPool = stakingPool_;
        stakingPoolSet = true;
    }

    function mint(address to, uint256 amount) external onlyStakingPool {
        require(to != address(0), "mint to zero");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function burn(address from, uint256 amount) external onlyStakingPool {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "allowance exceeded");
            allowance[from][msg.sender] = currentAllowance - amount;
        }
        return _transfer(from, to, amount);
    }

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(to != address(0), "transfer to zero");
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
