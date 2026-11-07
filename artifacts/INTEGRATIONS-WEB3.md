# Web3 integration references and boundaries

Checked 2026-11-07. This extends the existing Chain Pulse integration; see `INTEGRATIONS.md` for its original game behavior.

## Official deployment

- [Squeekchain developer reference](https://docs.squeekchain.com/developers/) and [machine-readable deployment](https://docs.squeekchain.com/assets/deployments/sepolia.json): Ethereum Sepolia, chain `11155111`, release `core-sepolia-20261103`, revision 7. Testnet only; no mainnet deployment.
- [Official API reference](https://docs.squeekchain.com/developers/api/): `https://api.squeekchain.com/v1`.
- [Quickstart](https://docs.squeekchain.com/developers/quickstart/): historical reads and identity checks. The public explorer published in the deployment is `https://eth-sepolia.blockscout.com`; the app uses that explorer's `/api/eth-rpc` and `/api/v2` interfaces. No private RPC URL or key is embedded.
- [Indexing events](https://docs.squeekchain.com/developers/index-events/): `RoundRecorded`, `BatchSettled`, NFT custody and Staking events. Physical wheel activity, device acceptance and safe settlement are distinct stages.
- [Trust model](https://docs.squeekchain.com/security/proof-limits/): a settled protocol record is not proof that a player owns a hamster or personally ran a wheel.

The unchanged contract pins in `src/lib/api.ts` are:

| Contract | Address |
| --- | --- |
| SqueekCore proxy | `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4` |
| SqueekNFT | `0xc4c7982657f00509548f3a3a41db7fa439a6856b` |
| SqueekToken | `0xd78a3956cf63164d1fa1c622ad3c66623162fa1e` |
| SqueekMining | `0x2dccb11fcc2defdd188555e45acb52231e82e218` |
| SqueekStaking | `0x50fd1780526c3186a0c037c7622203bc4fb611ca` |

Core implementation: `0x6869d6102696243fd17013ab955d99cd0c522ad3`. Published runtime hash: `0x65b5780a4fccafedeca1260806364d2bb512b4501c097253f792ae2839565a9c`. The RPC path checks the EIP-1967 implementation slot and bytecode hash at the receipt's historical block. ABI fragments are bundled in `src/web3/event-abis.json`, copied from the official [Core](https://docs.squeekchain.com/assets/abi/SqueekCore.json), [NFT](https://docs.squeekchain.com/assets/abi/SqueekNFT.json), [Staking](https://docs.squeekchain.com/assets/abi/SqueekStaking.json) and [Mining](https://docs.squeekchain.com/assets/abi/SqueekMining.json) ABIs. No contract is created, changed or redeployed.

## Reads used by the new tools

| Interface | Purpose | Validation |
| --- | --- | --- |
| `/status`, `/core`, measurement endpoints | Existing live telemetry and world encounters | Existing release/identity validators, telemetry freshness, explicit provenance |
| `/settlements?range=24h` | Dashboard and recent evidence | Safe confirmations, block bounds, coherent completed-block range |
| `/events?category=players&limit=100&cursor=...` | Community activity rankings | Pinned deployment, safe provenance, stable paginated snapshot, unique block/transaction/log key |
| `/accounts/{address}?limit=25&cursor=...` | NFT custody and counts | Exact requested account, pinned chain/release, verified Core/collection capabilities, token ID bounds |
| `/accounts/{address}/activity?limit=25&cursor=...` | Confirmed account history | Exact account, safe source block, pinned release and capability status |
| `/squeeks/{tokenId}` | Official metadata | Existing NFT/deployment validator; data images rendered as images, never injected HTML |
| Explorer JSON-RPC | Receipt, canonical block, head, implementation and code | Chain ID, successful matching receipt, 12 confirmations, strict official event decoding and post-read block check |
| Explorer REST `/api/v2/transactions/{hash}`, `/logs`, `/blocks/{height}` | Alternate transport when RPC is unavailable | Success status, confirmations, block timestamp/identity, canonical raw log identity and a second block check |

The REST path is the same published explorer, not a substitute blockchain or generated transaction. For settlement rewards it additionally matches the raw BatchSettled log to safe official `/settlements?range=30d` history, checks the Core safe block and the published implementation/runtime identity returned by `/core`. This path **does not read historical proxy storage**. A transaction outside the history's recent settlement list may be confirmed while its settlement reward remains unavailable. A failed provenance/identity check never falls back to a more permissive source. Unknown/unavailable/error responses never become successful receipts.

A newly confirmed settlement can omit `sqkMintedBaseUnits` until Mining catches up. The existing validator now accepts that optional enrichment while continuing to require safe chain identity, confirmation status and coherent block ranges. No absent issuance value is converted to zero or treated as a game reward. This case was observed in actual API responses during the assignment and has a regression test.

RPC requests are spaced 450ms apart and respect rate-limit cooldowns. Existing API adapters respect their Retry-After cooldowns. Pending transaction refreshes occur every 15 seconds only while visible/open; rankings and settlement lists refresh every minute. Network/service availability still depends on the public services.

## Wallet packages and mobile entry

Official packages: [Wagmi Core configuration](https://wagmi.sh/core/api/createConfig), [injected discovery](https://wagmi.sh/core/api/connectors/injected), [Coinbase connector](https://wagmi.sh/core/api/connectors/coinbaseWallet), [Viem message verification](https://viem.sh/docs/actions/public/verifyMessage), [Coinbase SDK source](https://github.com/coinbase/coinbase-wallet-sdk), and [EIP-6963](https://eips.ethereum.org/EIPS/eip-6963). Exact versions/integrities are in `wallet-dependencies.json`; source entry is `src/web3/sdk-entry.mjs`. The SDK bundle includes Coinbase's optional peer explicitly. No relay or WalletConnect project ID is used.

Mobile URLs follow [MetaMask's dapp link](https://docs.metamask.io/metamask-connect/evm/guides/metamask-exclusive/use-deeplinks), [Coinbase's deep link](https://docs.cdp.coinbase.com/wallet-sdk/docs/deep-link), [Phantom's browse link](https://docs.phantom.com/phantom-deeplinks/other-methods/browse), and [Rabby Mobile's own handler](https://github.com/RabbyHub/rabby-mobile/blob/develop/apps/mobile/src/hooks/universalLink.ts). Rabby uses `/mobile/?_cmd=open-dapp&dapp=<encoded URL>`. These rows open wallet apps; actual handoff and installed-app behavior require a physical device. Phantom's published browse link originated for Solana; successful EVM injection depends on the installed Phantom version.

The proof message is an explicit local ownership check, with an address, origin/path, chain, cryptographic nonce, issue time and ten-minute expiry. EOA recovery is tried first; Viem can also verify contract/counterfactual wallet signatures when RPC supports it. A signature is never stored or used as a Community session credential. Account/network changes and reload clear the proof. No private key, seed phrase, token approval or broadcast transaction is requested by game code.

## Limits that are represented in the UI

The official API has no game-score submission or global XP/level/quest index. Local editable saves therefore cannot form an honest global Game leaderboard. The implemented community ranking compares safe public account actions, with explicit period and scan coverage. It does not call protocol reporters players or assign shared hamster runs/settlements to wallets.

There is no official SqueekQuest quest contract. The settlement objective and its XP/stamina/badges are local benefits backed by public evidence. The separate hash journal prevents the same receipt earning again on this browser, including across wallet changes and new games. Browser clearing, cross-device claims and deliberate local storage edits cannot be prevented by a static game; none can change the community on-chain ranking or grant tokens.

Genesis and Community mint eligibility are account-specific authenticated functions. [Community mint API documentation](https://docs.squeekchain.com/developers/api/#community-mint) requires an official Community session and a linked eligible wallet. This project has neither an authoritative login session nor an authorization to issue rewards. It links to [official Genesis](https://squeekchain.com/genesis) rather than inventing eligibility, a mint authorization, a recipient or a token reward.
