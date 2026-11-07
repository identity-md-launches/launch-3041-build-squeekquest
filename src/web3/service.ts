import { z } from 'zod';
import {
  API,
  CONTRACTS,
  INSTALLATION,
  RELEASE,
  fetchData,
  validate,
  type DataTypes,
} from '../lib/api';
import { NETWORK, isAddress, isHash } from './network';
import { loadWalletRuntime, type DecodedEvent, type RawLog, type WalletRuntime } from './runtime';

const uint = z.string().regex(/^(0|[1-9]\d*)$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const iso = z.string().datetime({ offset: true });
const envelope = {
  schemaVersion: z.literal(3),
  installationId: z.literal(INSTALLATION),
  status: z.literal('available'),
  generatedAt: iso,
  release: z.object({
    id: z.literal(RELEASE),
    protocolRevision: z.literal('staged-launch-1'),
    rewardModelRevision: z.literal('funded-stream-q128-1'),
  }),
  chain: z.object({
    chainId: z.literal(String(NETWORK.id)),
    target: z.literal('sepolia'),
    confirmations: z.literal('12'),
    safeThroughBlock: uint,
    safeBlockHash: hash,
  }),
  capabilities: z.object({
    core: z.object({ status: z.literal('verified') }),
    collection: z.object({ status: z.literal('verified') }),
  }),
};
export const accountSchema = z.object({
  ...envelope,
  account: address,
  tokenCounts: z.object({ wallet: uint, staking: uint }),
  tokens: z.array(
    z.object({
      tokenId: uint,
      custody: z.enum(['wallet', 'staking']),
      level: z.number().int().min(1).max(10),
      basePower: uint.nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
const source = z.object({
  blockNumber: uint,
  blockHash: hash,
  transactionHash: hash,
  logIndex: uint,
  blockTimestamp: iso,
  confirmationStatus: z.literal('safe'),
});
export const activitySchema = z.object({
  ...envelope,
  account: address,
  total: uint,
  activity: z.array(z.object({ id: z.string(), kind: z.string(), source }).passthrough()),
  nextCursor: z.string().nullable(),
});
export type AccountData = z.infer<typeof accountSchema>;
export type ActivityData = z.infer<typeof activitySchema>;
const cooldown = new Map<string, number>();
async function apiGet(path: string): Promise<unknown> {
  if (Date.now() < (cooldown.get(path) ?? 0))
    throw new Error('The API is busy. Wait a minute, then refresh.');
  let response;
  try {
    response = await fetch(API + path, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error('Unable to reach Squeekchain. Check your connection and refresh.');
  }
  if (!response.ok) {
    if ([429, 503].includes(response.status))
      cooldown.set(
        path,
        Date.now() +
          Math.min(300, Math.max(15, Number(response.headers.get('Retry-After')) || 60)) * 1000,
      );
    throw new Error(`Squeekchain returned ${response.status}. Try refreshing later.`);
  }
  const data = await response.json();
  if (data?.status === 'unavailable')
    throw new Error('The official indexer cannot provide this data yet. Try refreshing later.');
  return data;
}
export function validateAccount(input: unknown, requested: string): AccountData {
  const d = accountSchema.parse(input);
  if (d.account.toLowerCase() !== requested.toLowerCase())
    throw new Error('Account identity mismatch.');
  if (
    new Set(d.tokens.map((t) => t.tokenId)).size !== d.tokens.length ||
    d.tokens.some((t) => BigInt(t.tokenId) < 1n || BigInt(t.tokenId) > 9999n)
  )
    throw new Error('Invalid NFT inventory.');
  return d;
}
export function validateActivity(input: unknown, requested: string): ActivityData {
  const d = activitySchema.parse(input);
  if (
    d.account.toLowerCase() !== requested.toLowerCase() ||
    d.activity.some((e) => BigInt(e.source.blockNumber) > BigInt(d.chain.safeThroughBlock))
  )
    throw new Error('Activity is outside the safe account snapshot.');
  return d;
}
export async function getAccountData(account: string, cursor?: string) {
  if (!isAddress(account)) throw new Error('Enter a valid wallet address.');
  const path = `/accounts/${account.toLowerCase()}?limit=25${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
  return validateAccount(await apiGet(path), account);
}
export async function getActivity(account: string, cursor?: string) {
  if (!isAddress(account)) throw new Error('Enter a valid wallet address.');
  const path = `/accounts/${account.toLowerCase()}/activity?limit=25${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`;
  return validateActivity(await apiGet(path), account);
}

let rpcId = 0;
class RpcUnavailableError extends Error {}
let nextRpcAt = 0;
let rpcCooldownUntil = 0;
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  // All application RPC traffic is read-only. Signing is isolated in the wallet connector.
  if (
    ![
      'eth_chainId',
      'eth_getTransactionByHash',
      'eth_getTransactionReceipt',
      'eth_blockNumber',
      'eth_getBlockByNumber',
      'eth_getCode',
      'eth_getStorageAt',
    ].includes(method)
  )
    throw new Error('Unsupported read method.');
  if (Date.now() < rpcCooldownUntil)
    throw new RpcUnavailableError(
      'The official explorer is rate limited. Wait a minute, then refresh the receipt.',
    );
  // The public explorer is shared. Space reads rather than bursting its free API.
  const at = Math.max(Date.now(), nextRpcAt);
  nextRpcAt = at + 450;
  if (at > Date.now()) await new Promise((resolve) => setTimeout(resolve, at - Date.now()));
  let response;
  try {
    response = await fetch(NETWORK.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new RpcUnavailableError(
      'Unable to reach the official explorer RPC. Check your connection and refresh.',
    );
  }
  if (response.status === 429) {
    rpcCooldownUntil =
      Date.now() +
      Math.max(15, Math.min(300, Number(response.headers.get('Retry-After')) || 60)) * 1000;
    throw new RpcUnavailableError(
      'The official explorer is rate limited. Wait a minute, then refresh the receipt.',
    );
  }
  if (!response.ok)
    throw new RpcUnavailableError(`Explorer RPC returned ${response.status}. Try again later.`);
  const data = await response.json();
  if (data.error || !('result' in data))
    throw new RpcUnavailableError(
      'The explorer RPC could not complete this read. Try again later.',
    );
  return data.result as T;
}
type RpcTransaction = {
  hash: string;
  from: string;
  to: string | null;
  blockHash: string | null;
  blockNumber: string | null;
  chainId?: string;
};
type Receipt = {
  transactionHash: string;
  status: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  logs: RawLog[];
};
type Block = { number: string; hash: string; timestamp: string };
export type VerifiedTransaction = {
  hash: string;
  status: 'Pending' | 'Confirmed' | 'Failed' | 'Not found';
  from?: string;
  to?: string | null;
  blockNumber?: string;
  blockHash?: string;
  timestamp?: string;
  confirmations: number;
  events: DecodedEvent[];
  settlement: boolean;
  ownActivity: string[];
  checkedAt: number;
  readSource?: 'RPC' | 'Official explorer API';
  verificationNote?: string;
};
/** The canonical receipt, not a typed-in hash or the API's label, establishes success. */
export async function checkTransactionRpc(
  hashValue: string,
  runtime: () => Promise<Pick<WalletRuntime, 'decode' | 'hashCode'>> = loadWalletRuntime,
): Promise<VerifiedTransaction> {
  if (!isHash(hashValue))
    throw new Error('Enter a transaction hash with 0x and 64 hexadecimal characters.');
  const chain = await rpc<string>('eth_chainId', []);
  if (BigInt(chain) !== BigInt(NETWORK.id))
    throw new Error('Explorer RPC network mismatch. No transaction was approved.');
  const [tx, receipt, head] = await Promise.all([
    rpc<RpcTransaction | null>('eth_getTransactionByHash', [hashValue]),
    rpc<Receipt | null>('eth_getTransactionReceipt', [hashValue]),
    rpc<string>('eth_blockNumber', []),
  ]);
  const base: VerifiedTransaction = {
    hash: hashValue.toLowerCase(),
    status: tx ? 'Pending' : 'Not found',
    confirmations: 0,
    events: [],
    settlement: false,
    ownActivity: [],
    checkedAt: Date.now(),
    readSource: 'RPC',
  };
  if (!tx) return base;
  if (
    tx.hash.toLowerCase() !== base.hash ||
    !isAddress(tx.from) ||
    (tx.chainId && BigInt(tx.chainId) !== BigInt(NETWORK.id))
  )
    throw new Error('Transaction identity mismatch.');
  base.from = tx.from;
  base.to = tx.to;
  if (!receipt || !tx.blockNumber) return base;
  if (
    receipt.transactionHash.toLowerCase() !== base.hash ||
    receipt.blockHash !== tx.blockHash ||
    receipt.blockNumber !== tx.blockNumber ||
    receipt.from.toLowerCase() !== tx.from.toLowerCase()
  )
    throw new Error('Receipt identity mismatch. Refresh to recheck.');
  const block = await rpc<Block | null>('eth_getBlockByNumber', [receipt.blockNumber, false]);
  if (
    !block ||
    block.hash !== receipt.blockHash ||
    block.number !== receipt.blockNumber ||
    BigInt(head) < BigInt(block.number)
  )
    throw new Error('Block is no longer canonical. Refresh to recheck.');
  if (!['0x0', '0x1'].includes(receipt.status))
    throw new Error('Unknown receipt status. No transaction was approved.');
  base.blockNumber = BigInt(block.number).toString();
  base.blockHash = block.hash;
  base.timestamp = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
  base.confirmations = Number(BigInt(head) - BigInt(block.number) + 1n);
  base.status =
    receipt.status === '0x0' ? 'Failed' : base.confirmations >= 12 ? 'Confirmed' : 'Pending';
  if (base.status !== 'Confirmed') return base;
  const sdk = await runtime();
  base.events = sdk.decode(receipt.logs);
  if (base.events.some((e) => e.contract === CONTRACTS.core && e.name === 'BatchSettled')) {
    // Confirm the published implementation at the transaction's block, not just today's API label.
    const slot = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
    const implementation = await rpc<string>('eth_getStorageAt', [
      CONTRACTS.core,
      slot,
      receipt.blockNumber,
    ]);
    if ('0x' + implementation.slice(-40).toLowerCase() !== NETWORK.coreImplementation)
      throw new Error('Settlement implementation differs from the supported release.');
    const code = await rpc<string>('eth_getCode', [
      NETWORK.coreImplementation,
      receipt.blockNumber,
    ]);
    if (sdk.hashCode(code) !== NETWORK.coreRuntimeHash)
      throw new Error('Settlement implementation code differs from the official release.');
    base.settlement = true;
  }
  base.ownActivity = [
    ...new Set(
      base.events
        .filter(
          (e) =>
            e.contract === CONTRACTS.staking &&
            [
              'Deposited',
              'Withdrawn',
              'Staked',
              'Unstaked',
              'RewardClaimed',
              'ClaimedAndStaked',
            ].includes(e.name),
        )
        .map((e) => e.args.account?.toLowerCase())
        .filter((a): a is string => !!a && isAddress(a)),
    ),
  ];
  const finalBlock = await rpc<Block | null>('eth_getBlockByNumber', [receipt.blockNumber, false]);
  if (!finalBlock || finalBlock.hash !== block.hash)
    throw new Error('Block changed during verification. Refresh to recheck.');
  base.checkedAt = Date.now();
  return base;
}

const explorerTx = z.object({
  hash,
  block_number: z.number().int().nonnegative().nullable(),
  confirmations: z.number().int().nonnegative(),
  status: z.string().nullable(),
  result: z.string().nullable(),
  timestamp: iso.nullable(),
  from: z.object({ hash: address }),
  to: z.object({ hash: address }).nullable(),
});
const explorerBlock = z.object({
  hash,
  height: z.number().int().nonnegative(),
  timestamp: iso,
  type: z.literal('block'),
});
const explorerLog = z.object({
  address: z.object({ hash: address }),
  block_hash: hash,
  block_number: z.number().int().nonnegative(),
  transaction_hash: hash,
  data: z.string().regex(/^0x[0-9a-fA-F]*$/),
  topics: z.array(hash.nullable()),
  index: z.number().int().nonnegative(),
});
async function explorerGet(path: string) {
  let response;
  try {
    response = await fetch(NETWORK.explorer + '/api/v2' + path, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Unable to reach the official explorer. Check your connection and refresh.');
  }
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Official explorer API returned ${response.status}. Try refreshing later.`);
  return response.json();
}
/** Alternate public interface of the SAME explorer published by Squeekchain.
 * No failed provenance check falls back: only unavailable RPC transport does.
 * Rewards additionally require matching safe official settlement history.
 */
export async function checkExplorerTransaction(
  hashValue: string,
  runtime: () => Promise<Pick<WalletRuntime, 'decode' | 'hashCode'>> = loadWalletRuntime,
): Promise<VerifiedTransaction> {
  if (!isHash(hashValue)) throw new Error('Enter a full Sepolia transaction hash.');
  const base: VerifiedTransaction = {
    hash: hashValue.toLowerCase(),
    status: 'Not found',
    confirmations: 0,
    events: [],
    settlement: false,
    ownActivity: [],
    checkedAt: Date.now(),
    readSource: 'Official explorer API',
    verificationNote:
      'The explorer RPC is unavailable. This result uses the official explorer’s public REST API.',
  };
  const raw = await explorerGet('/transactions/' + hashValue);
  if (!raw) return base;
  const tx = explorerTx.parse(raw);
  if (tx.hash.toLowerCase() !== base.hash)
    throw new Error('Explorer transaction identity mismatch.');
  base.from = tx.from.hash;
  base.to = tx.to?.hash ?? null;
  base.confirmations = tx.confirmations;
  if (tx.block_number === null) {
    base.status = 'Pending';
    return base;
  }
  const block = explorerBlock.parse(await explorerGet('/blocks/' + tx.block_number));
  if (
    block.height !== tx.block_number ||
    tx.timestamp === null ||
    Date.parse(block.timestamp) !== Date.parse(tx.timestamp)
  )
    throw new Error('Explorer block identity mismatch.');
  base.blockNumber = String(block.height);
  base.blockHash = block.hash;
  base.timestamp = block.timestamp;
  if (tx.status === 'error') {
    base.status = 'Failed';
    return base;
  }
  if (tx.status !== 'ok' || tx.result !== 'success') {
    base.status = 'Pending';
    return base;
  }
  base.status = tx.confirmations >= 12 ? 'Confirmed' : 'Pending';
  if (base.status !== 'Confirmed') return base;
  const sdk = await runtime();
  let cursor: Record<string, string | number> | null = null;
  const logs: RawLog[] = [];
  for (let page = 0; page < 20; page++) {
    const query = cursor
      ? '?' + new URLSearchParams(Object.entries(cursor).map(([k, v]) => [k, String(v)]))
      : '';
    const result = z
      .object({
        items: z.array(explorerLog),
        next_page_params: z.record(z.string(), z.union([z.string(), z.number()])).nullable(),
      })
      .parse(await explorerGet('/transactions/' + hashValue + '/logs' + query));
    for (const log of result.items) {
      if (
        log.transaction_hash.toLowerCase() !== base.hash ||
        log.block_hash !== block.hash ||
        log.block_number !== block.height
      )
        throw new Error('Explorer logs do not match the canonical block.');
      logs.push({
        address: log.address.hash,
        data: log.data,
        topics: log.topics.filter((t): t is string => t !== null),
        logIndex: '0x' + log.index.toString(16),
      });
    }
    cursor = result.next_page_params;
    if (!cursor) break;
    if (page === 19)
      throw new Error(
        'This transaction has too many event pages to verify safely. Use its explorer link.',
      );
  }
  base.events = sdk.decode(logs);
  const batch = base.events.find((e) => e.contract === CONTRACTS.core && e.name === 'BatchSettled');
  if (batch) {
    const [coreRaw, history] = await Promise.all([
      apiGet('/core'),
      fetchData('settlements', { path: '/settlements?range=30d', force: true }),
    ]);
    const core = validate('core', coreRaw);
    const identity = z
      .object({
        identities: z.object({ proxyImplementation: z.string() }),
        implementation: z.object({ runtimeHash: z.string() }),
      })
      .parse(coreRaw);
    if (
      identity.identities.proxyImplementation.toLowerCase() !== NETWORK.coreImplementation ||
      identity.implementation.runtimeHash !== NETWORK.coreRuntimeHash
    )
      throw new Error('Official SqueekCore identity differs from the supported release.');
    const evidence = history.recentSettlements.find(
      (s) =>
        s.transactionHash.toLowerCase() === base.hash &&
        s.ethereumBlockNumber === base.blockNumber &&
        s.logIndex === batch.logIndex &&
        Date.parse(s.blockTimestamp) === Date.parse(block.timestamp),
    );
    if (evidence && BigInt(base.blockNumber) <= BigInt(core.chain.safeThroughBlock)) {
      base.settlement = true;
      base.verificationNote +=
        ' Settlement matches safe Squeekchain history and the published SqueekCore identity. Historical proxy storage was not read through RPC.';
    } else
      base.verificationNote +=
        ' This receipt is outside the available safe settlement history. No settlement reward is available.';
  }
  const again = explorerBlock.parse(await explorerGet('/blocks/' + tx.block_number));
  if (again.hash !== block.hash)
    throw new Error('Block changed during verification. Refresh to recheck.');
  base.checkedAt = Date.now();
  return base;
}
export async function checkTransaction(hashValue: string): Promise<VerifiedTransaction> {
  try {
    return await checkTransactionRpc(hashValue);
  } catch (error) {
    if (!(error instanceof RpcUnavailableError)) throw error;
    return checkExplorerTransaction(hashValue);
  }
}

export type RankingWindow = 'daily' | 'weekly' | 'all';
export type RankingRow = { address: string; actions: number; transactions: number };
export async function getRankings(window: RankingWindow) {
  const now = new Date();
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cutoff =
    window === 'all' ? 0 : window === 'daily' ? day : day - ((now.getUTCDay() + 6) % 7) * 86400000;
  const seen = new Set<string>(),
    rows = new Map<string, { actions: number; transactions: Set<string> }>();
  let cursor: string | null = null,
    complete = false,
    count = 0,
    safeBlock = '',
    oldest = '';
  // Bounded public scan; its coverage is always shown. A static site cannot claim a full private game index.
  for (let page = 0; page < 10; page++) {
    const d: DataTypes['events'] = await fetchData('events', {
      force: true,
      path: `/events?category=players&limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`,
    });
    if (safeBlock && d.chain.safeThroughBlock !== safeBlock)
      throw new Error(
        'The ranking snapshot changed during pagination. Refresh to restart the scan.',
      );
    safeBlock ||= d.chain.safeThroughBlock;
    for (const e of d.events) {
      const at = Date.parse(e.occurredAt);
      if (at < cutoff) {
        complete = true;
        continue;
      }
      oldest = !oldest || e.occurredAt < oldest ? e.occurredAt : oldest;
      const id = `${e.source.blockHash.toLowerCase()}:${e.source.transactionHash.toLowerCase()}:${e.source.logIndex}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const who = e.payload.account;
      if (typeof who !== 'string' || !isAddress(who)) continue;
      const key = who.toLowerCase(),
        row = rows.get(key) ?? { actions: 0, transactions: new Set<string>() };
      row.actions++;
      row.transactions.add(e.source.transactionHash.toLowerCase());
      rows.set(key, row);
      count++;
    }
    cursor = d.nextCursor;
    if (!cursor || complete) {
      complete = true;
      break;
    }
  }
  return {
    rows: [...rows]
      .map(([address, r]) => ({ address, actions: r.actions, transactions: r.transactions.size }))
      .sort((a, b) => b.actions - a.actions || a.address.localeCompare(b.address)),
    complete,
    count,
    safeBlock,
    oldest,
    checkedAt: Date.now(),
  };
}
