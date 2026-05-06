// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {RitualSBT} from "../src/RitualSBT.sol";

contract RitualSBTTest is Test {
    event Minted(address indexed to, uint256 indexed tokenId, uint256 timestamp);

    uint256 private constant MINT_PRICE = 0.01 ether;
    RitualSBT private sbt;
    address private owner = makeAddr("owner");
    address private minter = makeAddr("minter");

    function setUp() public {
        vm.prank(owner);
        sbt = new RitualSBT("Ritual Identity SBT", "rSBT", MINT_PRICE, 200, 1000);
        vm.deal(minter, 1 ether);
    }

    function testMintSuccess() public {
        vm.warp(1_979);

        vm.expectEmit(true, true, false, true);
        emit Minted(minter, 1, block.timestamp);

        vm.prank(minter);
        uint256 tokenId = sbt.mint{value: MINT_PRICE}();

        assertEq(tokenId, 1);
        assertEq(sbt.balanceOf(minter), 1);
        assertEq(sbt.addressToTokenId(minter), 1);
        assertEq(sbt.mintedAt(1), block.timestamp);
        assertEq(sbt.totalSupply(), 1);
        assertTrue(sbt.locked(1));
    }

    function testMintForwardsFeeToOwner() public {
        uint256 ownerBalanceBefore = owner.balance;

        vm.prank(minter);
        sbt.mint{value: MINT_PRICE}();

        assertEq(owner.balance, ownerBalanceBefore + MINT_PRICE);
        assertEq(address(sbt).balance, 0);
    }

    function testMintRevertsWithIncorrectFee() public {
        vm.prank(minter);
        vm.expectRevert(abi.encodeWithSelector(RitualSBT.IncorrectMintFee.selector, MINT_PRICE, 0));
        sbt.mint();
    }

    function testSecondMintRevertsWithAlreadyMinted() public {
        vm.prank(minter);
        sbt.mint{value: MINT_PRICE}();

        vm.prank(minter);
        vm.expectRevert(RitualSBT.AlreadyMinted.selector);
        sbt.mint{value: MINT_PRICE}();
    }

    function testTransferFromReverts() public {
        vm.prank(minter);
        uint256 tokenId = sbt.mint{value: MINT_PRICE}();

        vm.prank(minter);
        vm.expectRevert(RitualSBT.Soulbound.selector);
        sbt.transferFrom(minter, address(0xBEEF), tokenId);
    }

    function testTokenIdStartsFromOne() public {
        vm.prank(minter);
        uint256 tokenId = sbt.mint{value: MINT_PRICE}();

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(1), minter);
    }

    function testSupportsNftAndSoulboundInterfaces() public view {
        assertTrue(sbt.supportsInterface(0x80ac58cd)); // ERC-721 NFT
        assertTrue(sbt.supportsInterface(0x5b5e139f)); // ERC-721 metadata
        assertTrue(sbt.supportsInterface(0xb45a3c0e)); // ERC-5192 soulbound
    }

    function testTokenUriUsesBaseUriForNftMetadata() public {
        vm.prank(owner);
        sbt.setBaseURI("ipfs://metadata-cid/");

        vm.prank(minter);
        uint256 tokenId = sbt.mint{value: MINT_PRICE}();

        assertEq(sbt.tokenURI(tokenId), "ipfs://metadata-cid/1");
    }

    function testInitialMaxSupplyIsTwoHundredWithHardCap() public view {
        assertEq(sbt.MINT_PRICE(), MINT_PRICE);
        assertEq(sbt.maxSupply(), 200);
        assertEq(sbt.HARD_MAX_SUPPLY(), 1000);
    }

    function testConstructorRejectsZeroMintPrice() public {
        vm.expectRevert(RitualSBT.InvalidMintPrice.selector);
        new RitualSBT("Ritual Identity SBT", "rSBT", 0, 200, 1000);
    }

    function testConstructorRejectsInvalidSupplyConfig() public {
        vm.expectRevert(RitualSBT.InvalidSupplyConfig.selector);
        new RitualSBT("Ritual Identity SBT", "rSBT", MINT_PRICE, 1001, 1000);

        vm.expectRevert(RitualSBT.InvalidSupplyConfig.selector);
        new RitualSBT("Ritual Identity SBT", "rSBT", MINT_PRICE, 0, 1000);

        vm.expectRevert(RitualSBT.InvalidSupplyConfig.selector);
        new RitualSBT("Ritual Identity SBT", "rSBT", MINT_PRICE, 200, 0);
    }

    function testOwnerCanIncreaseMaxSupplyUpToHardCap() public {
        vm.prank(owner);
        sbt.setMaxSupply(1000);

        assertEq(sbt.maxSupply(), 1000);
    }

    function testNonOwnerCannotSetMaxSupply() public {
        vm.prank(minter);
        vm.expectRevert(RitualSBT.NotOwner.selector);
        sbt.setMaxSupply(250);
    }

    function testSetMaxSupplyCannotExceedHardCap() public {
        vm.prank(owner);
        vm.expectRevert(RitualSBT.MaxSupplyAboveHardCap.selector);
        sbt.setMaxSupply(1001);
    }

    function testSetMaxSupplyCannotGoBelowMinted() public {
        vm.prank(minter);
        sbt.mint{value: MINT_PRICE}();

        vm.prank(owner);
        vm.expectRevert(RitualSBT.MaxSupplyBelowMinted.selector);
        sbt.setMaxSupply(0);
    }

    function testMintRevertsAfterMaxSupplyReached() public {
        for (uint160 i = 1; i <= 200; i++) {
            address account = address(i);
            vm.deal(account, MINT_PRICE);
            vm.prank(account);
            uint256 tokenId = sbt.mint{value: MINT_PRICE}();
            assertEq(tokenId, i);
        }

        address nextMinter = address(uint160(201));
        vm.deal(nextMinter, MINT_PRICE);
        vm.prank(nextMinter);
        vm.expectRevert(RitualSBT.MaxSupplyReached.selector);
        sbt.mint{value: MINT_PRICE}();

        assertEq(sbt.totalSupply(), 200);
    }
}
