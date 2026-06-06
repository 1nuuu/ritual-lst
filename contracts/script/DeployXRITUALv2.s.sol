// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {xRITUALv2} from "../src/xRITUALv2.sol";

contract DeployXRITUALv2 is Script {
    address constant RITUAL_LST_V1 = 0x161f394F46c0Eb7Cc6AE4691815130684b607eaE;
    address constant RITUAL_LST_V2 = 0x86c78B7512801748496Cc11fbA9725a29A583E63;
    uint256 constant RITUAL_CHAIN_ID = 1979;

    function run() external returns (xRITUALv2 token) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        require(block.chainid == RITUAL_CHAIN_ID, "wrong chain");

        vm.startBroadcast(privateKey);

        token = new xRITUALv2("Ritual Staked RITUAL", "xRITUAL");

        token.addStakingPool(RITUAL_LST_V1);
        token.addStakingPool(RITUAL_LST_V2);

        vm.stopBroadcast();

        console.log("xRITUALv2 deployed at:", address(token));
        console.log("V1 pool added:", RITUAL_LST_V1);
        console.log("V2 pool added:", RITUAL_LST_V2);
        console.log("Deployer:", deployer);
        console.log("Block:", block.number);
    }
}
