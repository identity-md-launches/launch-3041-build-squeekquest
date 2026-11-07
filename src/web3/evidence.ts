import { z } from 'zod';
import type { VerifiedTransaction } from './service';

export const EVIDENCE_KEY = 'squeekquest.web3.evidence.v1';
const record = z.object({
  hash: z.string().regex(/^0x[0-9a-f]{64}$/),
  blockHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  blockNumber: z.string().regex(/^\d+$/),
  timestamp: z.string(),
  recordedAt: z.string(),
  settlement: z.boolean(),
  rounds: z.number().int().nonnegative(),
  account: z.string().optional(),
  reward: z.literal(90),
});
export type EvidenceRecord = z.infer<typeof record>;
export function readEvidence(raw: string | null): EvidenceRecord[] {
  if (!raw) return [];
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error(
      'The local evidence journal is damaged. Export your browser data before clearing it.',
    );
  }
  const parsed = z.array(record).max(10000).safeParse(input);
  if (!parsed.success)
    throw new Error(
      'The local evidence journal is damaged. Export your browser data before clearing it.',
    );
  return parsed.data;
}
export function evidenceFor(
  tx: VerifiedTransaction,
  existing: EvidenceRecord[],
  account?: string,
): EvidenceRecord {
  if (
    tx.status !== 'Confirmed' ||
    tx.confirmations < 12 ||
    !tx.blockHash ||
    !tx.blockNumber ||
    !tx.timestamp ||
    !tx.settlement ||
    Date.now() - tx.checkedAt > 30000
  )
    throw new Error('A fresh, confirmed settlement is required. Verify the transaction again.');
  if (existing.some((e) => e.hash === tx.hash.toLowerCase()))
    throw new Error('This transaction has already earned its local reward.');
  if (existing.length >= 10000)
    throw new Error('The local evidence journal is full. No additional rewards were issued.');
  return {
    hash: tx.hash.toLowerCase(),
    blockHash: tx.blockHash,
    blockNumber: tx.blockNumber,
    timestamp: tx.timestamp,
    recordedAt: new Date().toISOString(),
    settlement: true,
    rounds: tx.events.filter((e) => e.name === 'RoundRecorded' && BigInt(e.args.work || '0') > 0n)
      .length,
    ...(account ? { account: account.toLowerCase() } : {}),
    reward: 90,
  };
}
