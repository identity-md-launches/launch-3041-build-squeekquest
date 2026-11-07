# Verified public transaction examples

These are existing third-party Sepolia transactions, not transactions sent by this assignment. Live explorer reads, HTTP statuses, canonical block comparisons, parties, confirmations and timestamps are recorded in [`web3-live-examples.json`](web3-live-examples.json), checked 2026-11-07. Confirmation counts are snapshots, not live counters in this document.

| Example | Transaction | Ethereum block | Result |
| --- | --- | --- | --- |
| Hamster work settlement | [`0x36241b56acbf8c82e4a7e24cbfce7d561d58a279fc1199954835d8a61b5309f4`](https://eth-sepolia.blockscout.com/tx/0x36241b56acbf8c82e4a7e24cbfce7d561d58a279fc1199954835d8a61b5309f4) | 12081156, 2026-11-07 04:00:36 UTC | Successful; 269 confirmations at the documented read. Core `RoundRecorded` and `BatchSettled` logs match the canonical block. |
| Squeek NFT deposited in Staking | [`0xad46f709574dfa7eb52cc1827448fe6f0cbbb0c4e2818577d71baeb2048efe9a`](https://eth-sepolia.blockscout.com/tx/0xad46f709574dfa7eb52cc1827448fe6f0cbbb0c4e2818577d71baeb2048efe9a) | 12081181, 2026-11-07 04:05:36 UTC | Successful; 244 confirmations at the documented read. The official account API reports Squeek #8768 in Staking custody. |

The first receipt contains active round 481 with work 353, followed by BatchSettled at log 295. The settlement sender is `0x4c63e6365df8471f4f45f1a9614b51b633b9b5a7`; the Core proxy is `0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4`. The reporter named in the event is a different protocol role. Neither address is asserted to be a game player or owner of a physical hamster.

The NFT account is `0x35d5fd8a9e4402d0e04457e081d1f00fe26c38c1`. Its [official account endpoint](https://api.squeekchain.com/v1/accounts/0x35d5fd8a9e4402d0e04457e081d1f00fe26c38c1) and [activity endpoint](https://api.squeekchain.com/v1/accounts/0x35d5fd8a9e4402d0e04457e081d1f00fe26c38c1/activity) supplied the real profile/NFT test inputs. This is a public example account, not an account controlled by this project.

The early read-only RPC capture includes the historical Core implementation slot and code. Hashing that code with Viem produced `0x65b5780a4fccafedeca1260806364d2bb512b4501c097253f792ae2839565a9c`, matching the official deployment descriptor. Later RPC calls returned HTTP 429; subsequent live receipt checks used the explicitly labeled REST path of the same official explorer. No subscription upgrade was requested.

The browser harness selects a current safe settlement from the official API for its reward/reload check and records that actual hash in `web3-chromium.json` / `web3-webkit.json`. Controlled pending/failed/reorg cases are separately labeled in those reports. A real transaction is not claimed to have failed or remained pending merely because a test altered its response.
