import { CONTRACTS, INSTALLATION, type DataTypes } from './api';
import { newPulse, pulseSchema, type PulseState, type PulseEvent } from './adventure-state';
import type { Resource } from '../hooks/use-chain';
export const PULSE_KEY = 'squeekquest.chain-pulse.v1';
export const fresh = (r: Resource<unknown>, now = Date.now(), maxAge = 90000) =>
  !!r.data &&
  !r.error &&
  !!r.checkedAt &&
  now - r.checkedAt <= maxAge &&
  now - r.checkedAt >= -5000;
export function readPulse(raw: string | null): PulseState | null {
  try {
    return raw ? pulseSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
export function mergePulse(save: PulseState, ledger: PulseState | null): PulseState {
  if (!ledger) return save;
  const newer = BigInt(ledger.cursor ?? '0') > BigInt(save.cursor ?? '0') ? ledger : save;
  const older = newer === save ? ledger : save;
  const oldEvents = new Map(older.events.map((e) => [e.id, e]));
  // A missing historical event below a durable cursor has already been retired.
  // Never revive it from an older imported save after the short journal was pruned.
  const events = newer.events.map((e) => ({
    ...e,
    resolved:
      e.resolved ||
      !!oldEvents.get(e.id)?.resolved ||
      (older.cursor !== null && BigInt(e.height) <= BigInt(older.cursor) && !oldEvents.has(e.id)),
  }));
  return {
    ...newer,
    events: [
      ...events.filter((e) => !e.resolved),
      ...events.filter((e) => e.resolved).slice(-40),
    ].slice(-100),
    measurementIds: [...new Set([...save.measurementIds, ...ledger.measurementIds])].slice(-4000),
    measurementClaims: [...new Set([...save.measurementClaims, ...ledger.measurementClaims])],
    measurements: newer.measurements,
    completed: Math.max(save.completed, ledger.completed),
  };
}
export function advancePulse(
  pulse: PulseState,
  resource: Resource<DataTypes['core']>,
  now = Date.now(),
): PulseState {
  if (!fresh(resource, now)) return pulse;
  const d = resource.data!;
  if (
    !d.source ||
    BigInt(d.source.blockNumber) > BigInt(d.chain.safeThroughBlock) ||
    BigInt(d.chain.confirmations) < 12n ||
    d.identities.core.toLowerCase() !== CONTRACTS.core
  )
    return pulse;
  const height = d.core.blockHeight;
  if (pulse.cursor === null) return { ...pulse, baseline: height, cursor: height, target: height };
  if (
    BigInt(height) < BigInt(pulse.cursor) ||
    BigInt(height) < BigInt(pulse.target ?? pulse.cursor)
  )
    return pulse;
  let target = BigInt(height) > BigInt(pulse.target ?? '0') ? height : pulse.target!;
  const events = pulse.events
    .filter((e) => !e.resolved)
    .concat(pulse.events.filter((e) => e.resolved).slice(-40));
  let cursor = BigInt(pulse.cursor),
    room = Math.max(0, 12 - events.filter((e) => !e.resolved).length);
  const kinds: PulseEvent['kind'][] = ['cache', 'wave', 'portal', 'encounter'];
  for (let i = 0; i < Math.min(4, room) && cursor < BigInt(target); i++) {
    cursor++;
    const slot = Number(cursor % 8n),
      kind = kinds[Number(cursor % 4n)];
    events.push({
      id: `${INSTALLATION}:${CONTRACTS.core}:${cursor}`,
      height: cursor.toString(),
      kind,
      x: 420 + slot * 48,
      y: 442,
      resolved: false,
      tx: d.source.transactionHash,
    });
  }
  if (cursor.toString() === pulse.cursor && target === pulse.target) return pulse;
  return { ...pulse, target, cursor: cursor.toString(), events };
}
export function ingestMeasurements(
  pulse: PulseState,
  resource: Resource<DataTypes['measurements']>,
  now = Date.now(),
): PulseState {
  if (
    !fresh(resource, now) ||
    now - Date.parse(resource.data!.generatedAt) > 120000 ||
    now - Date.parse(resource.data!.generatedAt) < -30000
  )
    return pulse;
  const incoming = resource.data!.events.filter(
    (e) => Date.parse(e.occurredAt) <= now + 30000 && e.source.disposition === 'accepted',
  );
  const ids = new Set(pulse.measurementIds);
  const additions = incoming.filter((e) => !ids.has(e.id));
  if (!additions.length) return pulse;
  return {
    ...pulse,
    measurementIds: [...new Set([...pulse.measurementIds, ...additions.map((e) => e.id)])].slice(
      -4000,
    ),
    measurements: [
      ...additions.map((e) => ({
        id: e.id,
        type: e.type,
        at: e.occurredAt,
        provenance: e.source.provenance ?? ('unknown' as const),
      })),
      ...pulse.measurements,
    ].slice(0, 40),
  };
}
export function claimMeasurement(pulse: PulseState, id: string): PulseState | null {
  const m = pulse.measurements.find((e) => e.id === id);
  if (!m || pulse.measurementClaims.includes(id)) return null;
  return { ...pulse, measurementClaims: [...pulse.measurementClaims, id] };
}
export function measurementView(resource: Resource<DataTypes['status']>, now = Date.now()) {
  const m = resource.data?.measurement;
  const valid =
    fresh(resource, now) &&
    m &&
    m.freshness === 'online' &&
    now - Date.parse(m.observedAt) <= m.staleAfterSeconds * 1000 &&
    now - Date.parse(m.observedAt) >= -30000;
  return {
    known: !!valid,
    status: valid ? m.coreStatus : 'UNKNOWN',
    rpm: valid
      ? (m.rpmMilli / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })
      : 'Unknown',
    provenance: valid ? m.provenance : 'unknown',
    age: m ? Math.max(0, Math.floor((now - Date.parse(m.observedAt)) / 1000)) : null,
  };
}
export { newPulse };
