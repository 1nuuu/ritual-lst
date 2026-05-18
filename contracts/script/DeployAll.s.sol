// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RitualLST} from "../RitualLST.sol";
import {xRITUAL} from "../src/xRITUAL.sol";

contract DeployAll is Script {
    address internal constant SBT_CONTRACT = 0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398;
    uint256 internal constant RITUAL_CHAIN_ID = 1979;

    function run() external returns (xRITUAL xRitual, RitualLST lst) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("RPC_URL");
        address deployer = vm.addr(privateKey);

        require(bytes(rpcUrl).length > 0, "RPC_URL missing");

        vm.startBroadcast(privateKey);

        require(block.chainid == RITUAL_CHAIN_ID, "wrong chain");

        xRitual = new xRITUAL("Ritual Staked RITUAL", "xRITUAL", deployer);
        lst = new RitualLST(deployer, SBT_CONTRACT, address(xRitual));
        xRitual.setStakingPool(address(lst));

        vm.stopBroadcast();

        console.log("xRITUAL deployed at:", address(xRitual));
        console.log("RitualLST deployed at:", address(lst));
        console.log("Network:", "ritual-testnet");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Deployed at block:", block.number);

        string memory object = "deployment";
        vm.serializeAddress(object, "RitualLST", address(lst));
        vm.serializeAddress(object, "xRITUAL", address(xRitual));
        vm.serializeString(object, "network", "ritual-testnet");
        vm.serializeUint(object, "chainId", block.chainid);
        vm.serializeAddress(object, "deployer", deployer);
        string memory json = vm.serializeUint(object, "deployedAt", block.number);
        vm.writeJson(json, "./deployments.json");
    }
}
