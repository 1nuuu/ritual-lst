# Ritual Staking

Next.js App Router frontend and Foundry contracts for the Ritual Staking SBT access flow on Ritual Chain.

## Deployed SBT

- Chain: Ritual Chain testnet (`1979`)
- Contract: `0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398`
- Explorer: `https://explorer.ritualfoundation.org/address/0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398`

The SBT starts with `maxSupply = 200` and has `HARD_MAX_SUPPLY = 1000`. Supply can be increased by the owner, but cannot be lowered below the minted count or raised above the hard cap.

## Frontend Setup

Copy `.env.example` to `.env.local` and fill every value:

```bash
NEXT_PUBLIC_CHAIN_ID=1979
NEXT_PUBLIC_CHAIN_NAME=Ritual Chain
NEXT_PUBLIC_RPC_URL=https://rpc.ritualfoundation.org
NEXT_PUBLIC_EXPLORER_URL=https://explorer.ritualfoundation.org
NEXT_PUBLIC_SBT_ADDRESS=0xbeF776D31F0fb4F141e12443Eb0956F5fBd75398
NEXT_PUBLIC_PROTOCOL_NAME=Ritual Staking
NEXT_PUBLIC_TOKEN_SYMBOL=RITUAL
NEXT_PUBLIC_LST_SYMBOL=xRITUAL
NEXT_PUBLIC_SBT_NAME=Ritual Identity SBT
NEXT_PUBLIC_SBT_SYMBOL=rSBT
```

Run locally:

```bash
npm install
npm run dev
```

Production check:

```bash
npm run build
npm audit --omit=dev --audit-level=moderate
```

## Contract Setup

Install Foundry and dependencies before running contract tests:

```bash
cd contracts
forge install foundry-rs/forge-std
forge test -vv
```

Copy `contracts/.env.example` to `contracts/.env` only for local deploy tasks. Never commit `contracts/.env`.

## Vercel

Set the `NEXT_PUBLIC_*` variables above in Vercel Project Settings for Production and Preview. Do not add deploy-only secrets such as `PRIVATE_KEY` or `PINATA_JWT` to Vercel unless you build a backend that explicitly needs them.

## Security Notes

- `.env`, `.env.local`, `contracts/.env`, build output, logs, Foundry broadcast artifacts, and dependency folders are ignored by Git.
- Contract address, chain, RPC URL, explorer URL, branding, SBT name, and SBT symbol are environment-driven.
- Rotate any private key or Pinata token used during development before public launch.
- Perform a real Vercel Preview mint with a test wallet before promoting to Production.
