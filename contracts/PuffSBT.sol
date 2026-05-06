// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*  ═══════════════════════════════════════════════════════════════
    PuffSBT — Soul-Bound Token for Puff Staking Access
    ═══════════════════════════════════════════════════════════════
    • Non-transferable ERC-721 (reverts on transfer/approve)
    • One SBT per address (identity layer)
    • Required to access Puff Staking vault (future phases)
    • Free mint on Ritual testnet
    ═══════════════════════════════════════════════════════════════ */

contract PuffSBT {
    // ── ERC-721 Metadata ─────────────────────────────────────────
    string public constant name     = "Puff Staking SBT";
    string public constant symbol   = "pSBT";

    // ── State ────────────────────────────────────────────────────
    uint256 private _nextTokenId = 1;
    uint256 public  totalSupply;
    address public  owner;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) public  tokenOfOwner; // 1 SBT per address

    // ── Events ───────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Minted(address indexed to, uint256 indexed tokenId, uint256 timestamp);

    // ── Errors ───────────────────────────────────────────────────
    error SoulBound();
    error AlreadyMinted();
    error ZeroAddress();

    // ── Constructor ──────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ═════════════════════════════════════════════════════════════
    //  MINT — Free, one per address
    // ═════════════════════════════════════════════════════════════

    function mint() external returns (uint256 tokenId) {
        if (msg.sender == address(0)) revert ZeroAddress();
        if (_balances[msg.sender] > 0) revert AlreadyMinted();

        tokenId = _nextTokenId++;
        _owners[tokenId] = msg.sender;
        _balances[msg.sender] = 1;
        tokenOfOwner[msg.sender] = tokenId;
        totalSupply++;

        emit Transfer(address(0), msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, block.timestamp);
    }

    // ═════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ═════════════════════════════════════════════════════════════

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "nonexistent token");
        return tokenOwner;
    }

    function hasSBT(address account) external view returns (bool) {
        return _balances[account] > 0;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_owners[tokenId] != address(0), "nonexistent token");
        // On-chain SVG metadata
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(abi.encodePacked(
                '{"name":"Puff Staking Ritualist #',
                _toString(tokenId),
                '","description":"Soul-Bound Token granting access to Puff Staking protocol on Ritual Network.","image":"data:image/svg+xml;base64,',
                _base64Encode(_generateSVG(tokenId)),
                '"}'
            ))
        ));
    }

    // ═════════════════════════════════════════════════════════════
    //  SOUL-BOUND: Block all transfers
    // ═════════════════════════════════════════════════════════════

    function transferFrom(address, address, uint256) external pure {
        revert SoulBound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert SoulBound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert SoulBound();
    }

    function approve(address, uint256) external pure {
        revert SoulBound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert SoulBound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    // ── ERC-165 ──────────────────────────────────────────────────
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd  // ERC-721
            || interfaceId == 0x5b5e139f  // ERC-721Metadata
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    // ═════════════════════════════════════════════════════════════
    //  INTERNAL: On-chain SVG generation
    // ═════════════════════════════════════════════════════════════

    function _generateSVG(uint256 tokenId) internal pure returns (bytes memory) {
        return abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#080808"/>',
            '<rect x="1" y="1" width="398" height="398" fill="none" stroke="#1a1a1a" stroke-width="1"/>',
            '<text x="200" y="140" text-anchor="middle" font-family="serif" font-size="48" font-weight="300" fill="#f2f2f2">Puff</text>',
            '<text x="200" y="175" text-anchor="middle" font-family="monospace" font-size="11" fill="#444" letter-spacing="4">STAKING</text>',
            '<line x1="160" y1="200" x2="240" y2="200" stroke="#333" stroke-width="1"/>',
            '<text x="200" y="240" text-anchor="middle" font-family="monospace" font-size="12" fill="#4ade80">RITUALIST</text>',
            '<text x="200" y="268" text-anchor="middle" font-family="monospace" font-size="28" fill="#f2f2f2">#',
            _toString(tokenId),
            '</text>',
            '<text x="200" y="360" text-anchor="middle" font-family="monospace" font-size="9" fill="#333" letter-spacing="2">SOUL-BOUND TOKEN</text>',
            '<circle cx="200" cy="320" r="3" fill="#4ade80" opacity="0.6"/>',
            '</svg>'
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen + 32);
        assembly {
            let tablePtr := add(TABLE, 1)
            let resultPtr := add(result, 32)
            let dataPtr := data
            let endPtr := add(dataPtr, mload(data))
            for {} lt(dataPtr, endPtr) {} {
                dataPtr := add(dataPtr, 3)
                let input := mload(dataPtr)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(18, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(12, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(shr(6, input), 0x3F))))
                resultPtr := add(resultPtr, 1)
                mstore8(resultPtr, mload(add(tablePtr, and(input, 0x3F))))
                resultPtr := add(resultPtr, 1)
            }
            switch mod(mload(data), 3)
            case 1 { mstore8(sub(resultPtr, 1), 0x3d) mstore8(sub(resultPtr, 2), 0x3d) }
            case 2 { mstore8(sub(resultPtr, 1), 0x3d) }
            mstore(result, encodedLen)
        }
        return string(result);
    }
}
