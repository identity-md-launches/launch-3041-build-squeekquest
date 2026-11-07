import {
  createConfig,
  http,
  connect as wagmiConnect,
  disconnect as wagmiDisconnect,
  reconnect as wagmiReconnect,
  getAccount,
  getConnectors,
  watchAccount as wagmiWatchAccount,
  watchConnectors as wagmiWatchConnectors,
  switchChain,
  signMessage,
} from '@wagmi/core';
import { injected, coinbaseWallet } from '@wagmi/connectors';
import { createPublicClient, decodeEventLog, getAddress, keccak256 } from 'viem';
import { sepolia } from 'viem/chains';
import abiByContract from './event-abis.json' with { type: 'json' };

// This is the explorer published in Squeekchain's Sepolia deployment descriptor.
const rpc = 'https://eth-sepolia.blockscout.com/api/eth-rpc';
const chain = {
  ...sepolia,
  rpcUrls: { default: { http: [rpc] } },
  blockExplorers: { default: { name: 'Blockscout', url: 'https://eth-sepolia.blockscout.com' } },
};
const config = createConfig({
  chains: [chain],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected(),
    coinbaseWallet({
      appName: 'SqueekQuest',
      appLogoUrl: new URL('./favicon.svg', document.baseURI).href,
    }),
  ],
  transports: { [chain.id]: http(rpc, { timeout: 12000, retryCount: 1 }) },
});
const client = createPublicClient({
  chain,
  transport: http(rpc, { timeout: 12000, retryCount: 1 }),
});
export const account = () => getAccount(config);
export const connectors = () => getConnectors(config);
export const watchAccount = (fn) => wagmiWatchAccount(config, { onChange: fn });
export const watchConnectors = (fn) => wagmiWatchConnectors(config, { onChange: fn });
export const reconnect = () => wagmiReconnect(config);
export const connect = (uid) => {
  const connector = getConnectors(config).find((c) => c.uid === uid);
  if (!connector) throw new Error('Wallet is no longer available. Reopen the wallet picker.');
  return wagmiConnect(config, { connector });
};
export const disconnect = () => wagmiDisconnect(config);
export const switchNetwork = () => switchChain(config, { chainId: chain.id });
export async function prove(message) {
  const before = getAccount(config);
  if (!before.address || before.chainId !== chain.id) throw new Error('Connect to Sepolia first.');
  const signature = await signMessage(config, { message });
  const after = getAccount(config);
  if (after.address !== before.address || after.chainId !== chain.id) return false;
  // Supports EOAs and contract wallets (ERC-1271 / ERC-6492), not just signature recovery.
  return client.verifyMessage({ address: before.address, message, signature, mode: 'eoa' });
}
export const checksum = getAddress;
export const hashCode = keccak256;
export function decode(logs) {
  return logs.flatMap((log) => {
    const abi = abiByContract[log.address.toLowerCase()];
    if (!abi || log.removed) return [];
    try {
      const event = decodeEventLog({ abi, topics: log.topics, data: log.data, strict: true });
      return [
        {
          name: event.eventName,
          contract: log.address.toLowerCase(),
          logIndex: BigInt(log.logIndex).toString(),
          args: Object.fromEntries(Object.entries(event.args).map(([k, v]) => [k, String(v)])),
        },
      ];
    } catch {
      return [];
    }
  });
}
