import { z } from 'zod';

export const API = 'https://api.squeekchain.com/v1';
export const DOCS = 'https://docs.squeekchain.com/developers/';
export const RELEASE = 'core-sepolia-20261103';
export const INSTALLATION = `sepolia-${RELEASE}`;
export const CONTRACTS = {
  core: '0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4',
  collection: '0xc4c7982657f00509548f3a3a41db7fa439a6856b',
  token: '0xd78a3956cf63164d1fa1c622ad3c66623162fa1e',
  mining: '0x2dccb11fcc2defdd188555e45acb52231e82e218',
  staking: '0x50fd1780526c3186a0c037c7622203bc4fb611ca',
} as const;

const uint = z.string().regex(/^(0|[1-9]\d*)$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const iso = z.string().datetime({ offset: true });
const pin = (value: string) =>
  z.string().refine((v) => v.toLowerCase() === value, 'Unexpected deployment address');
const chain = z.object({
  chainId: z.literal('11155111'),
  target: z.literal('sepolia'),
  safeThroughBlock: uint,
  confirmations: uint.refine((v) => BigInt(v) >= 12n),
});
const release = z.object({
  id: z.literal(RELEASE),
  protocolRevision: z.literal('staged-launch-1'),
  rewardModelRevision: z.literal('funded-stream-q128-1'),
});
const deployment = z.object({
  releaseId: z.literal(RELEASE),
  chainId: z.literal('11155111'),
  revision: z.literal(7),
  components: z.object({
    core: z.object({ address: pin(CONTRACTS.core) }),
    collection: z.object({ address: pin(CONTRACTS.collection) }),
    token: z.object({ address: pin(CONTRACTS.token) }),
    mining: z.object({ address: pin(CONTRACTS.mining) }),
    staking: z.object({ address: pin(CONTRACTS.staking) }),
  }),
});
const envelope = { installationId: z.literal(INSTALLATION) };
const onchain = { ...envelope, status: z.literal('available'), chain };
const economyEnvelope = { ...onchain, generatedAt: iso, release, deployment };

export const schemas = {
  status: z.object({
    ...envelope,
    schemaVersion: z.literal(1),
    generatedAt: iso,
    measurement: z
      .object({
        freshness: z.enum(['online', 'stale']),
        observedAt: iso,
        receivedAt: iso,
        staleAfterSeconds: z.number().positive(),
        rpmMilli: z.number().int().nonnegative(),
        speedMmPerSecond: z.number().int().nonnegative(),
        distanceMm: z.number().int().nonnegative(),
        cumulativeWorkUnits: uint,
        provenance: z.enum(['hardware', 'simulated', 'replay', 'derived']),
        coreStatus: z.enum(['IDLE', 'ACTIVE', 'COUNTER_FAULT']),
      })
      .nullable(),
    oracle: z.object({
      state: z.enum(['accepted', 'stale', 'blocked', 'unavailable']),
      reason: z.string().nullable(),
    }),
  }),
  core: z.object({
    ...onchain,
    schemaVersion: z.literal(1),
    identities: z.object({ core: pin(CONTRACTS.core) }),
    core: z.object({
      cumulativeBlockUnits: uint.optional(),
      blockHeight: uint,
      blockProgress: uint.refine((v) => BigInt(v) < 1_000_000_000n),
      cumulativeWork: uint,
      settledThroughRound: uint,
      workPerThousandBlocks: uint,
      paused: z.boolean(),
    }),
    source: z.object({ transactionHash: hash, blockNumber: uint, blockTimestamp: uint }).nullable(),
  }),
  events: z.object({
    ...economyEnvelope,
    schemaVersion: z.literal(4),
    nextCursor: z.string().nullable(),
    events: z.array(
      z.object({
        id: z.string().min(1),
        type: z.string().min(1),
        occurredAt: iso,
        source: z.object({
          kind: z.literal('chain'),
          chainId: z.literal('11155111'),
          target: z.literal('sepolia'),
          releaseId: z.literal(RELEASE),
          contractAddress: address,
          blockNumber: uint,
          blockHash: hash,
          transactionHash: hash,
          logIndex: uint,
          confirmationStatus: z.literal('safe'),
        }),
        payload: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  measurements: z.object({
    ...envelope,
    schemaVersion: z.literal(4),
    status: z.literal('available'),
    generatedAt: iso,
    category: z.literal('measurement'),
    events: z.array(
      z.object({
        id: z.string().min(1).max(250),
        type: z.string().startsWith('measurement.'),
        occurredAt: iso,
        source: z.object({
          kind: z.literal('measurement'),
          installationId: z.literal(INSTALLATION),
          receiptCursor: uint,
          telemetryId: z.string().min(1),
          observedAt: iso,
          receivedAt: iso,
          disposition: z.literal('accepted'),
          provenance: z.enum(['hardware', 'simulated', 'replay', 'derived']).optional(),
        }),
        payload: z.record(z.string(), z.unknown()),
      }),
    ),
  }),
  stats: z.object({
    ...envelope,
    schemaVersion: z.literal(1),
    generatedAt: iso,
    range: z.enum(['7d', '30d']),
    lifetime: z.object({
      acceptedWorkUnits: uint,
      observedDistanceMm: uint,
      settledBlockCount: uint,
    }),
    activity: z.object({
      coverage: z.object({
        coverageBps: z.number().int().min(0).max(10000),
        complete: z.boolean(),
      }),
      summary: z.object({
        activeDayCount: z.number().int().nonnegative(),
        observedDistanceMm: uint,
      }),
      days: z.array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          observedWorkUnits: uint,
          coverage: z.object({ coverageBps: z.number().min(0).max(10000) }),
        }),
      ),
    }),
  }),
  blocks: z.object({
    ...envelope,
    schemaVersion: z.literal('game-block-projection.v1'),
    status: z.literal('available'),
    generatedAt: iso,
    chain: z.object({ chainId: z.literal('11155111'), coreAddress: pin(CONTRACTS.core) }),
    freshness: z.enum(['fresh', 'stale']),
    anchor: z.object({ blockHeight: uint, transactionHash: hash.nullable() }),
    projected: z.object({ blockHeight: uint }),
    blocks: z.array(
      z
        .object({
          height: uint,
          workThreshold: uint,
          roundId: uint,
          completingAt: z.string().nullable(),
        })
        .passthrough(),
    ),
  }),
  economy: z.object({
    ...economyEnvelope,
    schemaVersion: z.literal(3),
    asset: z.object({
      symbol: z.literal('SQK'),
      decimals: z.literal(18),
      address: pin(CONTRACTS.token),
    }),
    supply: z.object({
      capBaseUnits: uint,
      liveSupplyBaseUnits: uint,
      totalBurnedBaseUnits: uint,
      miningMintedBaseUnits: uint,
    }),
    staking: z.object({ totalStakedBaseUnits: uint, paused: z.boolean() }),
    nft: z.object({
      live: uint,
      issued: uint,
      burned: uint,
      collectionCap: uint,
      mergesOpen: z.boolean(),
    }),
  }),
  settlements: z.object({
    ...onchain,
    schemaVersion: z.literal(3),
    generatedAt: iso,
    summary: z.object({ settlementCount: uint, completedBlockCount: uint, workAdded: uint }),
    recentSettlements: z.array(
      z.object({
        transactionHash: hash,
        firstCompletedBlock: uint,
        lastCompletedBlock: uint,
        completedBlockCount: uint,
        workAdded: uint,
        blockHeight: uint,
        ethereumBlockNumber: uint,
        blockTimestamp: iso,
        confirmationStatus: z.literal('safe'),
        logIndex: uint,
        sqkMintedBaseUnits: uint.nullable().optional(),
      }),
    ),
  }),
  nft: z.object({
    ...economyEnvelope,
    schemaVersion: z.literal(3),
    tokenId: uint,
    level: z.number().int().min(1).max(10),
    basePower: uint,
    custody: z.object({ owner: address, burned: z.boolean() }),
    mergeState: z.string(),
    metadata: z.object({
      status: z.literal('available'),
      name: z.string(),
      description: z.string(),
      imageDataUri: z.string().optional(),
      imageUrl: z.string().url().optional(),
      attributes: z.array(
        z.object({ traitType: z.string(), value: z.union([z.string(), z.number()]) }),
      ),
    }),
  }),
};
export type DataTypes = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> };
export type Endpoint = keyof DataTypes;
export type ChainEvent = DataTypes['events']['events'][number];
export type Settlement = DataTypes['settlements']['recentSettlements'][number];
export const paths: Record<Endpoint, string> = {
  status: '/status',
  measurements: '/events?category=measurement&limit=40',
  core: '/core',
  events: '/events?limit=20',
  stats: '/measurement/stats?range=7d',
  blocks: '/measurement/blocks',
  economy: '/economy/state',
  settlements: '/settlements?range=24h',
  nft: '/squeeks/1',
};

export class DataError extends Error {
  constructor(
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
    this.name = 'DataError';
  }
}

export function validate<K extends Endpoint>(key: K, input: unknown): DataTypes[K] {
  if (input && typeof input === 'object' && 'status' in input && input.status === 'unavailable') {
    const reason =
      'reason' in input && typeof input.reason === 'string'
        ? input.reason.replaceAll('_', ' ')
        : 'service unavailable';
    throw new DataError(`SqueekChain reports: ${reason}. Try refreshing later.`);
  }
  const parsed = schemas[key].safeParse(input);
  if (!parsed.success)
    throw new DataError(
      'This response could not be validated for the supported Sepolia deployment. Try refreshing later.',
    );
  const data = parsed.data as DataTypes[K];
  if (key === 'core') {
    const d = data as DataTypes['core'];
    if (
      !d.source ||
      BigInt(d.source.blockNumber) > BigInt(d.chain.safeThroughBlock) ||
      (d.core.cumulativeBlockUnits !== undefined &&
        BigInt(d.core.cumulativeBlockUnits) / 1_000_000_000n !== BigInt(d.core.blockHeight))
    )
      throw new DataError('SqueekCore settlement is not confirmed by the safe snapshot.');
  }
  if (key === 'events') {
    const d = data as DataTypes['events'];
    const allowed = Object.values(CONTRACTS) as string[];
    if (
      d.events.some(
        (e) =>
          !allowed.includes(e.source.contractAddress.toLowerCase()) ||
          BigInt(e.source.blockNumber) > BigInt(d.chain.safeThroughBlock),
      )
    )
      throw new DataError('Event provenance did not match the supported safe deployment.');
  }
  if (key === 'settlements') {
    const d = data as DataTypes['settlements'];
    if (
      d.recentSettlements.some(
        (s) =>
          BigInt(s.ethereumBlockNumber) > BigInt(d.chain.safeThroughBlock) ||
          BigInt(s.firstCompletedBlock) > BigInt(s.lastCompletedBlock) ||
          BigInt(s.lastCompletedBlock) - BigInt(s.firstCompletedBlock) + 1n !==
            BigInt(s.completedBlockCount),
      )
    )
      throw new DataError('Settlement block range could not be validated.');
  }
  return data;
}

type CacheEntry = { data: unknown; etag: string | null; at: number };
const cache = new Map<string, CacheEntry>();
const cooldowns = new Map<string, number>();
export async function fetchData<K extends Endpoint>(
  key: K,
  options: { path?: string; signal?: AbortSignal; force?: boolean } = {},
): Promise<DataTypes[K]> {
  const path = options.path ?? paths[key];
  const previous = cache.get(path);
  if (Date.now() < (cooldowns.get(path) ?? 0))
    throw new DataError('SqueekChain is busy. Wait before refreshing.');
  if (!options.force && previous && Date.now() - previous.at < (key === 'stats' ? 60000 : 5000))
    return previous.data as DataTypes[K];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  try {
    const response = await fetch(API + path, {
      signal,
      headers: previous?.etag ? { 'If-None-Match': previous.etag } : {},
      cache: 'no-store',
    });
    if (response.status === 304 && previous) {
      previous.at = Date.now();
      return previous.data as DataTypes[K];
    }
    if (!response.ok) {
      const retry = Math.max(1, Math.min(300, Number(response.headers.get('Retry-After')) || 15));
      if (response.status === 429 || response.status === 503)
        cooldowns.set(path, Date.now() + retry * 1000);
      throw new DataError(
        `SqueekChain API returned ${response.status}. ${response.status === 429 || response.status === 503 ? `Wait ${retry} seconds, then refresh.` : 'Try refreshing later.'}`,
        retry,
      );
    }
    const data = validate(key, await response.json());
    cache.set(path, { data, at: Date.now(), etag: response.headers.get('ETag') });
    return data;
  } catch (error) {
    if (error instanceof DataError) throw error;
    throw new DataError('Unable to reach SqueekChain. Check your connection and refresh.');
  } finally {
    clearTimeout(timeout);
  }
}

export function formatUint(value?: string | null) {
  return value === undefined || value === null
    ? 'Unavailable'
    : BigInt(value).toLocaleString('en-US');
}
export function formatSqk(value?: string | null, digits = 2) {
  if (value === undefined || value === null) return 'Unavailable';
  const n = BigInt(value),
    unit = 10n ** 18n;
  const whole = (n / unit).toLocaleString('en-US');
  const fraction = (n % unit).toString().padStart(18, '0').slice(0, digits);
  return digits ? `${whole}.${fraction}` : whole;
}
export const txUrl = (hash: string) => `https://eth-sepolia.blockscout.com/tx/${hash}`;
export const blockUrl = (height: string) => `https://eth-sepolia.blockscout.com/block/${height}`;
