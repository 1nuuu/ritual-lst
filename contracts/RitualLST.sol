// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPuffSBT {
    function balanceOf(address account) external view returns (uint256);
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

interface ITEEServiceRegistry {
    struct TEEServiceNode {
        address paymentAddress;
        address teeAddress;
        uint8 teeType;
        bytes publicKey;
        string endpoint;
        bytes32 certPubKeyHash;
        uint8 capability;
    }

    struct TEEServiceContext {
        TEEServiceNode node;
        bool isValid;
        bytes32 workloadId;
    }

    function getCapabilityIndexStatus()
        external
        view
        returns (
            uint256 cursor,
            uint256 total,
            bool initialized,
            bool finalized
        );

    function pickServiceByCapability(
        uint8 capability,
        bool checkValidity,
        uint256 seed,
        uint256 maxProbes
    ) external view returns (address teeAddress, bool found);

    function getServicesByCapability(
        uint8 capability,
        bool checkValidity
    ) external view returns (TEEServiceContext[] memory);
}

interface IERC20Events {
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract RitualLST is IERC20Events {
    address constant HTTP_PRECOMPILE = 0x0000000000000000000000000000000000000801;
    address constant JQ_PRECOMPILE = 0x0000000000000000000000000000000000000803;
    address constant ASYNC_DELIVERY = 0x5A16214fF555848411544b005f7Ac063742f39F6;
    IRitualWallet constant WALLET = IRitualWallet(0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948);
    IScheduler constant SCHEDULER = IScheduler(0x56e776BAE2DD60664b69Bd5F865F1180ffB7D58B);
    ITEEServiceRegistry constant TEE_REGISTRY =
        ITEEServiceRegistry(0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F);

    uint8 public constant HTTP_CALL_CAPABILITY = 0;
    uint256 public constant HTTP_TTL_BLOCKS = 100;
    string public constant YIELD_API_URL =
        "https://eth-api.lido.fi/v1/protocol/steth/apr/last";
    string public constant YIELD_JQ_FILTER = ".data.apr | tostring";

    IPuffSBT public sbtContract;

    uint256 private _locked = 1;

    string public constant name = "Ritual Staked RITUAL";
    string public constant symbol = "xRITUAL";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    uint256 public totalStaked;
    uint256 public unbondingPeriod = 1714;

    struct UnbondingRequest {
        uint256 amount;
        uint256 claimBlock;
    }

    mapping(address => UnbondingRequest) public unbondingRequests;

    /// @notice Exchange rate scaled by 1e18. Starts at 1:1.
    uint256 public exchangeRate = 1e18;

    /// @notice Latest yield value applied in basis points.
    uint256 public currentAPR;

    uint256 public lastRebaseBlock;
    uint256 public schedulerCallId;

    address public owner;
    address public pendingOwner;

    mapping(bytes32 => bool) public fulfilled;
    uint256 public constant PENDING_TTL = 500;
    bool public hasPendingRebase;
    uint256 public pendingRebaseBlock;

    uint256 public constant MAX_YIELD_BPS_PER_REBASE = 50;

    uint256 public constant PROTOCOL_FEE_BPS = 500;
    address public feeRecipient;

    event Staked(address indexed user, uint256 ritualAmount, uint256 xRitualMinted);
    event Unstaked(address indexed user, uint256 xRitualBurned, uint256 ritualReturned);
    event UnstakeRequested(address indexed user, uint256 amount, uint256 claimBlock);
    event UnstakeClaimed(address indexed user, uint256 amount);
    event UnbondingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event Rebased(uint256 newExchangeRate, uint256 yieldAdded, uint256 blockNumber);
    event SchedulerConfigured(uint256 callId, uint32 frequency, uint32 numCalls);
    event RebaseFailed(bytes32 jobId, string reason);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event SbtContractUpdated(address indexed oldSbtContract, address indexed newSbtContract);

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

    constructor(address _feeRecipient, address _sbtContract) {
        require(_feeRecipient != address(0), "zero fee recipient");
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        sbtContract = IPuffSBT(_sbtContract);
        lastRebaseBlock = block.number;
    }

    receive() external payable {}

    function stake() external payable nonReentrant returns (uint256 xRitualMinted) {
        require(sbtContract.balanceOf(msg.sender) > 0, "mint SBT first");
        require(msg.value > 0, "must send RITUAL");

        xRitualMinted = (msg.value * 1e18) / exchangeRate;
        require(xRitualMinted > 0, "amount too small");

        totalStaked += msg.value;
        _mint(msg.sender, xRitualMinted);

        emit Staked(msg.sender, msg.value, xRitualMinted);
    }

    function previewStake(uint256 ritualAmount) external view returns (uint256) {
        return (ritualAmount * 1e18) / exchangeRate;
    }

    function unstake(uint256 xRitualAmount) external nonReentrant returns (uint256 ritualReturned) {
        require(xRitualAmount > 0, "zero amount");
        require(balanceOf[msg.sender] >= xRitualAmount, "insufficient xRITUAL");
        require(unbondingRequests[msg.sender].amount == 0, "claim pending unstake");

        ritualReturned = (xRitualAmount * exchangeRate) / 1e18;
        require(address(this).balance >= ritualReturned, "insufficient liquidity");

        _burn(msg.sender, xRitualAmount);
        totalStaked = ritualReturned >= totalStaked
            ? 0
            : totalStaked - ritualReturned;

        if (totalSupply == 0) {
            exchangeRate = 1e18;
        }

        uint256 claimBlock = block.number + unbondingPeriod;
        unbondingRequests[msg.sender] = UnbondingRequest({
            amount: ritualReturned,
            claimBlock: claimBlock
        });

        emit UnstakeRequested(msg.sender, ritualReturned, claimBlock);
    }

    function previewUnstake(uint256 xRitualAmount) external view returns (uint256) {
        return (xRitualAmount * exchangeRate) / 1e18;
    }

    function claimUnstaked() external nonReentrant {
        UnbondingRequest memory request = unbondingRequests[msg.sender];
        require(request.amount > 0, "no pending unstake");
        require(block.number >= request.claimBlock, "not claimable");

        delete unbondingRequests[msg.sender];

        (bool sent, ) = msg.sender.call{value: request.amount}("");
        require(sent, "transfer failed");

        emit UnstakeClaimed(msg.sender, request.amount);
    }

    function setUnbondingPeriod(uint256 newPeriod) external onlyOwner {
        uint256 oldPeriod = unbondingPeriod;
        unbondingPeriod = newPeriod;
        emit UnbondingPeriodUpdated(oldPeriod, newPeriod);
    }

    function getUnbondingRequest(
        address user
    ) external view returns (uint256 amount, uint256 claimBlock) {
        UnbondingRequest memory request = unbondingRequests[user];
        return (request.amount, request.claimBlock);
    }

    function blocksUntilClaimable(address user) external view returns (uint256) {
        UnbondingRequest memory request = unbondingRequests[user];
        if (request.amount == 0 || block.number >= request.claimBlock) {
            return 0;
        }
        return request.claimBlock - block.number;
    }

    function triggerRebase(uint256 /* executionIndex */) external {
        require(
            msg.sender == address(SCHEDULER) || msg.sender == owner,
            "only scheduler or owner"
        );
        _checkAutoExpiry();

        if (hasPendingRebase) return;

        hasPendingRebase = true;
        pendingRebaseBlock = block.number;

        bytes memory httpInput = _encodeYieldRequest(_selectHTTPExecutor());
        (bool success, bytes memory rawOutput) = HTTP_PRECOMPILE.call(httpInput);
        require(success, "HTTP call failed");

        _processYieldResponse(rawOutput);
    }

    function _processYieldResponse(bytes memory rawOutput) internal {
        (, bytes memory actualOutput) = abi.decode(rawOutput, (bytes, bytes));
        (
            uint16 statusCode,
            ,
            ,
            bytes memory body,
            string memory errorMessage
        ) = abi.decode(actualOutput, (uint16, string[], string[], bytes, string));

        if (bytes(errorMessage).length > 0) {
            hasPendingRebase = false;
            emit RebaseFailed(bytes32(0), errorMessage);
            return;
        }

        if (statusCode < 200 || statusCode >= 300) {
            hasPendingRebase = false;
            emit RebaseFailed(bytes32(0), "HTTP status error");
            return;
        }

        uint256 yieldBPS = _parseYieldBPS(body);
        if (yieldBPS > MAX_YIELD_BPS_PER_REBASE) {
            yieldBPS = MAX_YIELD_BPS_PER_REBASE;
        }

        _applyYield(yieldBPS);
    }

    function applyRebase(uint256 yieldBPS) external onlyOwner {
        _applyYield(yieldBPS);
    }

    function depositYield() external payable onlyOwner {
        require(msg.value > 0, "zero yield");
        require(totalSupply > 0, "no stakers");
        exchangeRate = (address(this).balance * 1e18) / totalSupply;
        emit Rebased(exchangeRate, msg.value, block.number);
    }

    function _applyYield(uint256 yieldBPS) internal {
        require(totalStaked > 0, "no stake");
        require(yieldBPS <= MAX_YIELD_BPS_PER_REBASE, "yield exceeds cap");

        uint256 balanceBeforeFee = address(this).balance;
        uint256 actualYield = balanceBeforeFee > totalStaked
            ? balanceBeforeFee - totalStaked
            : 0;
        uint256 expectedYield = (totalStaked * yieldBPS) / 10000;
        uint256 feeBase = actualYield < expectedYield ? actualYield : expectedYield;
        uint256 feeAmount = (feeBase * PROTOCOL_FEE_BPS) / 10000;

        currentAPR = yieldBPS;
        lastRebaseBlock = block.number;
        hasPendingRebase = false;

        if (feeAmount > 0) {
            (bool sent, ) = feeRecipient.call{value: feeAmount}("");
            require(sent, "fee transfer failed");
        }

        if (totalSupply > 0) {
            exchangeRate = (address(this).balance * 1e18) / totalSupply;
        }

        emit Rebased(exchangeRate, actualYield - feeAmount, block.number);
    }

    function _encodeYieldRequest(address executor) internal pure returns (bytes memory) {
        string[] memory headerKeys = new string[](1);
        string[] memory headerValues = new string[](1);
        headerKeys[0] = "Accept";
        headerValues[0] = "application/json";

        return abi.encode(
            executor,
            new bytes[](0),
            HTTP_TTL_BLOCKS,
            new bytes[](0),
            bytes(""),
            YIELD_API_URL,
            uint8(1),
            headerKeys,
            headerValues,
            bytes(""),
            uint256(0),
            uint8(0),
            false
        );
    }

    function _selectHTTPExecutor() internal view returns (address) {
        uint256 seed = uint256(
            keccak256(
                abi.encodePacked(blockhash(block.number - 1), address(this), lastRebaseBlock)
            )
        );

        (, , , bool finalized) = TEE_REGISTRY.getCapabilityIndexStatus();
        if (finalized) {
            (address executor, bool found) = TEE_REGISTRY.pickServiceByCapability(
                HTTP_CALL_CAPABILITY,
                true,
                seed,
                16
            );
            require(found && executor != address(0), "no HTTP executor");
            return executor;
        }

        ITEEServiceRegistry.TEEServiceContext[] memory services =
            TEE_REGISTRY.getServicesByCapability(HTTP_CALL_CAPABILITY, true);
        for (uint256 i = 0; i < services.length; i++) {
            address executor = services[i].node.teeAddress;
            if (services[i].isValid && executor != address(0)) {
                return executor;
            }
        }

        revert("no HTTP executor");
    }

    function _parseYieldBPS(bytes memory body) internal returns (uint256) {
        (bool ok, bytes memory jqOutput) = JQ_PRECOMPILE.call(
            abi.encode(YIELD_JQ_FILTER, string(body), uint8(2))
        );
        require(ok && jqOutput.length > 0, "yield parse failed");
        return _parsePercentToBps(_decodeJQString(jqOutput));
    }

    function _decodeJQString(bytes memory raw) internal pure returns (string memory) {
        if (raw.length >= 64) {
            uint256 offset = _loadWord(raw, 0);
            if (offset == 32 && raw.length >= 64) {
                uint256 length = _loadWord(raw, 32);
                if (raw.length >= 64 + length) {
                    return _copyString(raw, 64, length);
                }
            }
        }

        require(raw.length >= 96, "JQ output too short");
        uint256 strLen;
        assembly {
            strLen := mload(add(raw, 96))
        }
        require(raw.length >= 96 + strLen, "JQ output invalid");
        return _copyString(raw, 96, strLen);
    }

    function _loadWord(bytes memory data, uint256 offset) internal pure returns (uint256 word) {
        require(data.length >= offset + 32, "word out of bounds");
        assembly {
            word := mload(add(add(data, 32), offset))
        }
    }

    function _copyString(
        bytes memory data,
        uint256 offset,
        uint256 length
    ) internal pure returns (string memory) {
        bytes memory result = new bytes(length);
        for (uint256 i = 0; i < length; i++) {
            result[i] = data[offset + i];
        }
        return string(result);
    }

    function _parsePercentToBps(string memory value) internal pure returns (uint256) {
        bytes memory input = bytes(value);
        uint256 whole;
        uint256 fractional;
        uint256 fractionalDigits;
        bool seenDecimal;
        bool seenDigit;

        for (uint256 i = 0; i < input.length; i++) {
            bytes1 char = input[i];

            if (char >= 0x30 && char <= 0x39) {
                uint256 digit = uint8(char) - 48;
                seenDigit = true;

                if (seenDecimal) {
                    if (fractionalDigits < 2) {
                        fractional = (fractional * 10) + digit;
                        fractionalDigits++;
                    }
                } else {
                    whole = (whole * 10) + digit;
                }
            } else if (char == 0x2e && !seenDecimal) {
                seenDecimal = true;
            } else if (
                char == 0x20 ||
                char == 0x09 ||
                char == 0x0a ||
                char == 0x0d ||
                char == 0x22
            ) {
                continue;
            } else if (seenDigit) {
                break;
            }
        }

        require(seenDigit, "invalid yield");
        while (fractionalDigits < 2) {
            fractional *= 10;
            fractionalDigits++;
        }

        return (whole * 100) + fractional;
    }

    function _checkAutoExpiry() internal {
        if (hasPendingRebase && block.number > pendingRebaseBlock + PENDING_TTL) {
            hasPendingRebase = false;
        }
    }

    function depositForFees(uint256 lockBlocks) external payable {
        WALLET.deposit{value: msg.value}(lockBlocks);
    }

    function configureScheduler(
        uint32 frequency,
        uint32 numCalls
    ) external onlyOwner {
        if (schedulerCallId != 0) {
            SCHEDULER.cancel(schedulerCallId);
        }

        bytes memory callData = abi.encodeWithSelector(
            this.triggerRebase.selector,
            uint256(0)
        );

        schedulerCallId = SCHEDULER.schedule(
            callData,
            500_000,
            numCalls,
            frequency
        );

        emit SchedulerConfigured(schedulerCallId, frequency, numCalls);
    }

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

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function setSbtContract(address _sbtContract) external onlyOwner {
        require(_sbtContract != address(0), "zero address");
        address oldSbtContract = address(sbtContract);
        sbtContract = IPuffSBT(_sbtContract);
        emit SbtContractUpdated(oldSbtContract, _sbtContract);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "only pending owner");
        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit OwnershipTransferred(previousOwner, msg.sender);
    }

    function emergencyWithdraw() external onlyOwner {
        require(totalSupply == 0, "active stakers");
        (bool sent, ) = owner.call{value: address(this).balance}("");
        require(sent, "transfer failed");
    }
}
