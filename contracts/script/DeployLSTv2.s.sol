// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RitualLSTv2} from "../RitualLSTv2.sol";

contract DeployLSTv2 is Script {
    address constant SBT_CONTRACT = 0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398;
    address constant XRITUAL_CONTRACT = 0x657F74071239744BCa740A45AA3dE7dbC985D2f7;
    uint256 constant RITUAL_CHAIN_ID = 1979;

    function run() external returns (RitualLSTv2 lst) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("RPC_URL");
        address deployer = vm.addr(privateKey);
        require(bytes(rpcUrl).length > 0, "RPC_URL missing");
        require(block.chainid == RITUAL_CHAIN_ID, "wrong chain");

        vm.startBroadcast(privateKey);
        lst = new RitualLSTv2(deployer, SBT_CONTRACT, XRITUAL_CONTRACT);
        vm.stopBroadcast();

        console.log("RitualLSTv2 deployed at:", address(lst));
        console.log("Deployer:", deployer);
        console.log("Block:", block.number);

        string memory object = "deployment";
        vm.serializeAddress(object, "RitualLSTv2", address(lst));
        vm.serializeAddress(object, "xRITUAL", XRITUAL_CONTRACT);
        vm.serializeAddress(object, "RitualSBT", SBT_CONTRACT);
        vm.serializeString(object, "network", "ritual-testnet");
        vm.serializeUint(object, "chainId", block.chainid);
        vm.serializeAddress(object, "deployer", deployer);
        string memory json = vm.serializeUint(object, "deployedAt", block.number);
        vm.writeJson(json, "./deployments.json");
    }
}
