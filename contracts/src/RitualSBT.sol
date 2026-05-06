// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RitualSBT {
    error AlreadyMinted();
    error FeeTransferFailed();
    error IncorrectMintFee(uint256 expected, uint256 received);
    error InvalidAddress();
    error InvalidMintPrice();
    error InvalidSupplyConfig();
    error MaxSupplyAboveHardCap();
    error MaxSupplyBelowMinted();
    error MaxSupplyReached();
    error NotOwner();
    error Soulbound();
    error TokenDoesNotExist(uint256 tokenId);

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, uint256 timestamp);

    string private _name;
    string private _symbol;
    string private _baseURI;
    uint256 private _nextTokenId = 1;

    uint256 public immutable MINT_PRICE;
    uint256 public immutable HARD_MAX_SUPPLY;
    uint256 public maxSupply;
    address public immutable owner;
    mapping(address => uint256) public addressToTokenId;
    mapping(uint256 => uint256) public mintedAt;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintPrice_,
        uint256 initialMaxSupply_,
        uint256 hardMaxSupply_
    ) {
        if (mintPrice_ == 0) revert InvalidMintPrice();
        if (initialMaxSupply_ == 0 || hardMaxSupply_ == 0 || initialMaxSupply_ > hardMaxSupply_) {
            revert InvalidSupplyConfig();
        }

        owner = msg.sender;
        _name = name_;
        _symbol = symbol_;
        MINT_PRICE = mintPrice_;
        maxSupply = initialMaxSupply_;
        HARD_MAX_SUPPLY = hardMaxSupply_;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x80ac58cd // ERC-721
            || interfaceId == 0x5b5e139f // ERC-721 metadata
            || interfaceId == 0xb45a3c0e; // ERC-5192
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function balanceOf(address account) public view returns (uint256) {
        if (account == address(0)) revert InvalidAddress();
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenDoesNotExist(tokenId);
        return tokenOwner;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireMinted(tokenId);
        return true;
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function mint() external payable returns (uint256 tokenId) {
        if (balanceOf(msg.sender) > 0) revert AlreadyMinted();
        if (_nextTokenId > maxSupply) revert MaxSupplyReached();
        if (msg.value != MINT_PRICE) {
            revert IncorrectMintFee(MINT_PRICE, msg.value);
        }

        tokenId = _nextTokenId++;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] = 1;
        addressToTokenId[msg.sender] = tokenId;
        mintedAt[tokenId] = block.timestamp;

        emit Transfer(address(0), msg.sender, tokenId);
        emit Locked(tokenId);
        emit Minted(msg.sender, tokenId, block.timestamp);

        (bool sent,) = payable(owner).call{value: msg.value}("");
        if (!sent) revert FeeTransferFailed();
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        _baseURI = baseURI_;
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        uint256 minted = _nextTokenId - 1;
        if (newMaxSupply < minted) revert MaxSupplyBelowMinted();
        if (newMaxSupply > HARD_MAX_SUPPLY) revert MaxSupplyAboveHardCap();
        maxSupply = newMaxSupply;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        _requireMinted(tokenId);
        return string.concat(_baseURI, _toString(tokenId));
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        _requireMinted(tokenId);
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function _requireMinted(uint256 tokenId) private view {
        if (_owners[tokenId] == address(0)) revert TokenDoesNotExist(tokenId);
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }

        return string(buffer);
    }
}
