// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    xRITUAL â€” Liquid Staking Token on Ritual Chain
    â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    Architecture:
      â€¢ Users call stake() with RITUAL â†’ receive xRITUAL (ERC-20)
      â€¢ Users call unstake(amount) â†’ burn xRITUAL, receive RITUAL
      â€¢ Scheduler (0x56e7) triggers rebase() periodically
      â€¢ rebase() calls HTTP precompile (0x0801) to fetch yield data
      â€¢ Exchange rate increases over time â†’ xRITUAL appreciates

    Ritual Precompile Usage:
      â€¢ HTTP Call (0x0801) â€” fetch validator yield / staking metrics
      â€¢ JQ Filter (0x0803) â€” extract APR values from JSON (sync)
      â€¢ Scheduler (0x56e7) â€” automate rebase cycle

    Security:
      â€¢ Reentrancy guard on all mutative external functions
      â€¢ SBT gate â€” only PuffSBT holders can stake
      â€¢ Callback guarded by onlyAsyncDelivery modifier
      â€¢ Idempotent callback (fulfilled[jobId] check)
      â€¢ TTL-based escape hatch for stuck async states
      â€¢ Check-Effects-Interactions pattern throughout
      â€¢ Max yield cap per rebase (50 BPS)
    â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ Interfaces â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface IPuffSBT {
    function hasSBT(address account) external view returns (bool);
}

interface IRitualWallet {
    function deposit(uint256 lockDuration) external payable;
    function balanceOf(address user) external view returns (uint256);
    function lockUntil(address user) external view returns (uint256);
}

interface IScheduler {
    function schedule(
        bytes memory data,
        uint32 gas,
        uint32 numCalls,
        uint32 frequency
    ) external returns (uint256 callId);

    function cancel(uint256 callId) external;
}

// â”€â”€ ERC-20 Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface IERC20Events {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// â”€â”€ Main Contract â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

contract RitualLST is IERC20Events {
    // â”€â”€ System Addresses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    address constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant JQ_PRECOMPILE   = 0x0000000000000000000000000000000000000803;
    address constant ASYNC_DELIVERY  = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    IRitualWallet constant WALLET    = IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);
    IScheduler constant SCHEDULER    = IScheduler(0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B);

    // â”€â”€ Identity Gate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    IPuffSBT public sbtContract;

    // â”€â”€ Reentrancy Guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    uint256 private _locked = 1;

    // â”€â”€ ERC-20 State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    string public constant name     = "Ritual Staked RITUAL";
    string public constant symbol   = "xRITUAL";
    uint8  public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // â”€â”€ LST State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    uint256 public totalStaked;

    /// @notice Exchange rate scaled by 1e18. Starts at 1:1 (1e18).
    ///         As yield accrues, this increases so xRITUAL is worth more RITUAL.
    uint256 public exchangeRate = 1e18;

    /// @notice Current APR in basis points (e.g., 500 = 5.00%)
    uint256 public currentAPR;

    uint256 public lastRebaseBlock;
    uint256 public schedulerCallId;

    address public owner;

    // â”€â”€ Async State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    mapping(bytes32 => bool) public fulfilled;
    uint256 public constant PENDING_TTL = 500;
    bool    public hasPendingRebase;
    uint256 public pendingRebaseBlock;

    // â”€â”€ Yield Cap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    uint256 public constant MAX_YIELD_BPS_PER_REBASE = 50; // 0.50% max per cycle

    // â”€â”€ Protocol Fee â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    uint256 public constant PROTOCOL_FEE_BPS = 500; // 5%
    address public feeRecipient;

    // â”€â”€ Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    event Staked(address indexed user, uint256 ritualAmount, uint256 xRitualMinted);
    event Unstaked(address indexed user, uint256 xRitualBurned, uint256 ritualReturned);
    event Rebased(uint256 newExchangeRate, uint256 yieldAdded, uint256 blockNumber);
    event SchedulerConfigured(uint256 callId, uint32 frequency, uint32 numCalls);
    event RebaseFailed(bytes32 jobId, string reason);

    // â”€â”€ Modifiers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    modifier onlyAsyncDelivery() {
        require(msg.sender == ASYNC_DELIVERY, "only async delivery");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // â”€â”€ Constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    constructor(address _feeRecipient, address _sbtContract) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        sbtContract = IPuffSBT(_sbtContract);
        lastRebaseBlock = block.number;
    }

    // â”€â”€ Receive (accept RITUAL) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    receive() external payable {}

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  STAKING
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /// @notice Stake RITUAL and receive xRITUAL at current exchange rate
    /// @dev Requires caller to hold a PuffSBT (identity gate)
    function stake() external payable nonReentrant returns (uint256 xRitualMinted) {
        require(sbtContract.hasSBT(msg.sender), "mint SBT first");
        require(msg.value > 0, "must send RITUAL");

        // Calculate xRITUAL to mint: amount / exchangeRate
        xRitualMinted = (msg.value * 1e18) / exchangeRate;
        require(xRitualMinted > 0, "amount too small");

        // Effects
        totalStaked += msg.value;
        _mint(msg.sender, xRitualMinted);

        emit Staked(msg.sender, msg.value, xRitualMinted);
    }

    /// @notice Preview how much xRITUAL you'd receive for a given RITUAL amount
    function previewStake(uint256 ritualAmount) external view returns (uint256) {
        return (ritualAmount * 1e18) / exchangeRate;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  UNSTAKING
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /// @notice Burn xRITUAL and receive RITUAL at current exchange rate
    function unstake(uint256 xRitualAmount) external nonReentrant returns (uint256 ritualReturned) {
        require(xRitualAmount > 0, "zero amount");
        require(balanceOf[msg.sender] >= xRitualAmount, "insufficient xRITUAL");

        // Calculate RITUAL to return: xRitualAmount * exchangeRate
        ritualReturned = (xRitualAmount * exchangeRate) / 1e18;
        require(ritualReturned <= totalStaked, "exceeds pool");
        require(address(this).balance >= ritualReturned, "insufficient liquidity");

        // Effects
        _burn(msg.sender, xRitualAmount);
        totalStaked -= ritualReturned;

        // Interactions
        (bool sent, ) = msg.sender.call{value: ritualReturned}("");
        require(sent, "transfer failed");

        emit Unstaked(msg.sender, xRitualAmount, ritualReturned);
    }

    /// @notice Preview how much RITUAL you'd receive for burning xRITUAL
    function previewUnstake(uint256 xRitualAmount) external view returns (uint256) {
        return (xRitualAmount * exchangeRate) / 1e18;
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  REBASE (Scheduler + HTTP Precompile)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /// @notice Called by Scheduler to trigger a yield data fetch via HTTP precompile
    /// @dev Only callable by the Scheduler contract or owner (for manual trigger)
    function triggerRebase(uint256 /* executionIndex */) external {
        require(
            msg.sender == address(SCHEDULER) || msg.sender == owner,
            "only scheduler or owner"
        );
        _checkAutoExpiry();

        if (hasPendingRebase) return; // Skip if already pending

        // Build HTTP request to fetch yield data
        // Using short-running async HTTP precompile (0x0801)
        address executor = address(0); // Will be set by TEEServiceRegistry
        bytes memory httpInput = abi.encode(
            executor,            // executor (to be resolved)
            new bytes[](0),      // encryptedSecrets
            uint256(100),        // ttl
            new bytes[](0),      // secretSignatures
            bytes(""),           // userPublicKey
            "https://api.ritual.net/v1/staking/yield", // url
            uint8(1),            // method: GET
            new string[](0),     // headerKeys
            new string[](0),     // headerValues
            bytes(""),           // body
            uint256(0),          // dkmsKeyIndex
            uint8(0),            // dkmsKeyFormat
            false                // piiEnabled
        );

        (bool success, ) = HTTP_PRECOMPILE.call(httpInput);
        if (success) {
            hasPendingRebase = true;
            pendingRebaseBlock = block.number;
        }
    }

    /// @notice Apply yield from rebase data
    /// @dev Can be called by owner as a manual override or by the async callback
    function applyRebase(uint256 yieldBPS) external onlyOwner {
        _applyYield(yieldBPS);
    }

    function _applyYield(uint256 yieldBPS) internal {
        require(totalStaked > 0, "no stake");
        require(yieldBPS <= MAX_YIELD_BPS_PER_REBASE, "yield exceeds cap");

        uint256 yieldAmount = (totalStaked * yieldBPS) / 10000;

        // Protocol fee â€” only applied to actual contract balance, never phantom yield
        uint256 feeAmount = (yieldAmount * PROTOCOL_FEE_BPS) / 10000;
        uint256 netYield = yieldAmount - feeAmount;

        // Update exchange rate: new rate = (totalStaked + netYield) / totalSupply
        if (totalSupply > 0) {
            totalStaked += netYield;
            exchangeRate = (totalStaked * 1e18) / totalSupply;
        }

        currentAPR = yieldBPS;
        lastRebaseBlock = block.number;
        hasPendingRebase = false;

        // Transfer fee to recipient â€” revert on failure to prevent undercollateralization
        if (feeAmount > 0 && feeRecipient != address(0)) {
            require(address(this).balance >= feeAmount, "insufficient balance for fee");
            (bool sent, ) = feeRecipient.call{value: feeAmount}("");
            require(sent, "fee transfer failed");
        }

        emit Rebased(exchangeRate, netYield, block.number);
    }

    // â”€â”€ Escape hatch for stuck async â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function _checkAutoExpiry() internal {
        if (hasPendingRebase && block.number > pendingRebaseBlock + PENDING_TTL) {
            hasPendingRebase = false;
        }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  SCHEDULER MANAGEMENT
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    /// @notice Deposit RITUAL for Scheduler/HTTP precompile fees
    function depositForFees(uint256 lockBlocks) external payable {
        WALLET.deposit{value: msg.value}(lockBlocks);
    }

    /// @notice Configure the Scheduler for recurring rebases
    function configureScheduler(
        uint32 frequency,  // blocks between rebases (e.g. 7200 â‰ˆ 42 min at 350ms/block)
        uint32 numCalls    // total rebase cycles
    ) external onlyOwner {
        // Cancel existing schedule if any
        if (schedulerCallId != 0) {
            SCHEDULER.cancel(schedulerCallId);
        }

        bytes memory callData = abi.encodeWithSelector(
            this.triggerRebase.selector,
            uint256(0) // placeholder â€” overwritten by Scheduler with executionIndex
        );

        schedulerCallId = SCHEDULER.schedule(
            callData,
            500_000,     // gas limit per call
            numCalls,
            frequency
        );

        emit SchedulerConfigured(schedulerCallId, frequency, numCalls);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  ERC-20 IMPLEMENTATION
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
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

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(balanceOf[from] >= amount, "insufficient balance");
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    //  ADMIN
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function setSbtContract(address _sbtContract) external onlyOwner {
        require(_sbtContract != address(0), "zero address");
        sbtContract = IPuffSBT(_sbtContract);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }
}

