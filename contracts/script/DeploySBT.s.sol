// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RitualSBT} from "../src/RitualSBT.sol";

contract DeploySBT is Script {
    function run() external returns (RitualSBT sbt) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory sbtName = vm.envString("SBT_NAME");
        string memory sbtSymbol = vm.envString("SBT_SYMBOL");
        uint256 mintPrice = vm.envUint("SBT_MINT_PRICE_WEI");
        uint256 initialMaxSupply = vm.envUint("SBT_INITIAL_MAX_SUPPLY");
        uint256 hardMaxSupply = vm.envUint("SBT_HARD_MAX_SUPPLY");
        string memory sbtBaseURI = vm.envOr("SBT_BASE_URI", string(""));

        vm.startBroadcast(privateKey);
        sbt = new RitualSBT(sbtName, sbtSymbol, mintPrice, initialMaxSupply, hardMaxSupply);
        if (bytes(sbtBaseURI).length > 0) {
            sbt.setBaseURI(sbtBaseURI);
        }
        vm.stopBroadcast();

        console.log("RitualSBT deployed at:", address(sbt));
        console.log("RitualSBT mint price:", mintPrice);
        console.log("RitualSBT initial max supply:", initialMaxSupply);
        console.log("RitualSBT hard max supply:", hardMaxSupply);
        if (bytes(sbtBaseURI).length > 0) {
            console.log("RitualSBT base URI:", sbtBaseURI);
        }
    }
}
