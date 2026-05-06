// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RitualSBT} from "../src/RitualSBT.sol";

contract SetSBTBaseURI is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address sbtAddress = vm.envAddress("SBT_ADDRESS");
        string memory sbtBaseURI = vm.envString("SBT_BASE_URI");

        vm.startBroadcast(privateKey);
        RitualSBT(sbtAddress).setBaseURI(sbtBaseURI);
        vm.stopBroadcast();

        console.log("RitualSBT base URI set for:", sbtAddress);
        console.log("RitualSBT base URI:", sbtBaseURI);
    }
}
