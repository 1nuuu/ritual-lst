#!/bin/bash
set -e
source contracts/.env

EXISTING_ADDRESS=$(grep '^NEXT_PUBLIC_SBT_ADDRESS=' .env.local | cut -d '=' -f2-)
if [ -n "$EXISTING_ADDRESS" ] && [ "$ALLOW_REDEPLOY" != "1" ]; then
  echo "NEXT_PUBLIC_SBT_ADDRESS already set: $EXISTING_ADDRESS"
  echo "Run with ALLOW_REDEPLOY=1 only when you intentionally want to deploy a replacement contract."
  exit 0
fi

if [ -n "$EXISTING_ADDRESS" ]; then
  echo "Existing SBT address will be replaced after successful deployment: $EXISTING_ADDRESS"
fi

echo "Running tests first..."
cd contracts
forge test -vv

echo "Deploying RitualSBT to Ritual Chain..."
set +e
OUTPUT=$(forge script script/DeploySBT.s.sol \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://explorer.ritualfoundation.org/api \
  -vvvv 2>&1)
STATUS=$?
set -e

cd ..
echo "$OUTPUT"

ADDRESS=$(echo "$OUTPUT" | sed -n 's/.*RitualSBT deployed at:[^0-9a-fA-F]*\(0x[a-fA-F0-9]\{40\}\).*/\1/p' | tail -n 1)
if [ -n "$ADDRESS" ]; then
  CODE=$(cast code "$ADDRESS" --rpc-url "$RPC_URL" || true)
  if [ -z "$CODE" ] || [ "$CODE" = "0x" ]; then
    echo "Forge printed an address, but no bytecode was found at $ADDRESS."
    exit 1
  fi

  sed -i "s|NEXT_PUBLIC_SBT_ADDRESS=.*|NEXT_PUBLIC_SBT_ADDRESS=$ADDRESS|" .env.local
  echo ""
  echo "Contract address written to .env.local"
  echo "NEXT_PUBLIC_SBT_ADDRESS=$ADDRESS"
  if [ "$STATUS" -ne 0 ]; then
    echo "Forge exited with status $STATUS after deployment. Contract verification may have failed."
  fi
else
  echo "Could not extract address. Check output above."
  exit 1
fi
