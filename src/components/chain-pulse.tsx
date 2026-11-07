import { Icon } from './icons';
import { API, paths, txUrl } from '../lib/api';
import type { ChainState } from '../hooks/use-chain';
import { fresh, measurementView } from '../lib/chain-pulse';
import { pulseNames } from '../lib/adventure';
import type { PulseState } from '../lib/adventure-state';

export function PulseStrip({
  chain,
  now,
  onOpen,
}: {
  chain: ChainState;
  now: number;
  onOpen: () => void;
}) {
  const m = measurementView(chain.status, now),
    core = fresh(chain.core, now) ? chain.core.data : null;
  return (
    <button className="pulse-strip" onClick={onOpen} aria-label="Open Chain Pulse details">
      <span>
        <Icon name="radio" size={17} />
        <strong>Chain Pulse</strong>
        <span className="pulse-state">
          {chain.core.loading && !chain.core.data
            ? 'Connecting'
            : core
              ? 'Connected'
              : 'Offline / unknown'}
        </span>
      </span>
      <span>
        <b>
          {m.status === 'IDLE'
            ? 'Resting'
            : m.status === 'ACTIVE'
              ? 'Running'
              : m.status === 'COUNTER_FAULT'
                ? 'Counter fault'
                : 'Unknown'}
        </b>
        <span>
          {m.rpm} RPM · {m.provenance}
        </span>
      </span>
      <span>
        <b>
          {core
            ? `#${BigInt(core.core.blockHeight).toLocaleString('en-US')} settled`
            : 'Unknown height'}
        </b>
        <span>{m.known ? `Wheel data ${m.age}s old` : 'Wheel data age unknown'}</span>
      </span>
      <Icon name="chevron" size={16} />
    </button>
  );
}
export function PulseDetails({
  chain,
  pulse,
  now,
  retry,
  walk,
  claim,
}: {
  chain: ChainState;
  pulse: PulseState;
  now: number;
  retry: () => void;
  walk: (x: number, y: number) => void;
  claim: (id: string) => void;
}) {
  const m = measurementView(chain.status, now),
    core = fresh(chain.core, now) ? chain.core.data : null;
  const stats = fresh(chain.stats, now, 300000) ? chain.stats.data : null;
  const blocks =
    fresh(chain.blocks, now) && chain.blocks.data?.freshness === 'fresh' ? chain.blocks.data : null;
  const pending = pulse.events.filter((e) => !e.resolved);
  return (
    <>
      <div className="panel-summary">
        <p>
          {core
            ? 'Safe SqueekCore data connected.'
            : 'Live state is unknown. Your adventure stays playable.'}
        </p>
        <button className="sq-button" disabled={chain.core.loading} onClick={retry}>
          <Icon name="refresh" size={16} />
          {chain.core.loading ? 'Reconnecting…' : 'Reconnect'}
        </button>
      </div>
      <dl className="pulse-readings">
        <div>
          <dt>Hamster status</dt>
          <dd>{m.status}</dd>
        </div>
        <div>
          <dt>Wheel RPM</dt>
          <dd>{m.rpm}</dd>
        </div>
        <div>
          <dt>Measurement origin</dt>
          <dd>{m.provenance}</dd>
        </div>
        <div>
          <dt>Reading age</dt>
          <dd>{m.known ? `${m.age} seconds` : 'Unknown / stale'}</dd>
        </div>
        <div>
          <dt>Settled height</dt>
          <dd>{core ? BigInt(core.core.blockHeight).toLocaleString('en-US') : 'Unknown'}</dd>
        </div>
        <div>
          <dt>Projected height</dt>
          <dd>
            {blocks ? BigInt(blocks.projected.blockHeight).toLocaleString('en-US') : 'Unknown'}
            <small>Optimistic; never triggers rewards</small>
          </dd>
        </div>
      </dl>
      {(chain.status.error || chain.core.error || chain.measurements.error) && (
        <p className="pulse-error" role="status">
          {chain.core.error || chain.status.error || chain.measurements.error} Gameplay remains
          available. Reconnect or wait for the next automatic retry.
        </p>
      )}
      <p className="panel-note">
        Hardware means a physical wheel reading. Simulated and replay readings describe test or
        historical sources. Derived data is computed. Missing provenance is unknown; accepted
        measurement receipts do not by themselves prove hardware activity.
      </p>
      <div className="section-divider">
        <h3>World pulses</h3>
        <span>
          {pending.length} waiting · {pulse.completed} completed
        </span>
      </div>
      <p className="panel-note">
        Each new settled block opens one forest encounter. First connection establishes a baseline;
        old blocks give no rewards. All items and XP are local game progress.
      </p>
      {pulse.cursor && pulse.target && BigInt(pulse.target) > BigInt(pulse.cursor) && (
        <p className="panel-note">
          {(BigInt(pulse.target) - BigInt(pulse.cursor)).toString()} confirmed pulses queued.
          Complete forest encounters to make room.
        </p>
      )}
      {pending.length ? (
        <div className="pulse-events">
          {pending.map((e) => (
            <article key={e.id}>
              <div>
                <h3>{pulseNames[e.kind]}</h3>
                <p>Settled Squeek block #{e.height}</p>
                <a href={txUrl(e.tx)} target="_blank" rel="noreferrer">
                  View snapshot source <Icon name="external" size={12} />
                </a>
              </div>
              <button className="sq-button" onClick={() => walk(e.x, e.y)}>
                Find encounter
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="pulse-empty">
          {pulse.baseline
            ? `Watching from settled block #${pulse.baseline}. New encounters appear when SqueekCore confirms a higher height.`
            : 'Waiting for a validated SqueekCore baseline. Explore the forest while the API reconnects.'}
        </p>
      )}
      <div className="section-divider">
        <h3>Measurement field notes</h3>
        <span>{pulse.measurementClaims.length} recorded</span>
      </div>
      <p className="panel-note">
        Record an accepted measurement milestone for 45 local XP once per receipt. These are
        historical observations, dated below; they are separate from settled-block pulses.
      </p>
      {pulse.measurements.length ? (
        <div className="measurement-list">
          {pulse.measurements.slice(0, 8).map((e) => (
            <article key={e.id}>
              <div>
                <h3>{e.type.replace('measurement.', '').replaceAll('_', ' ')}</h3>
                <p>
                  {new Date(e.at).toLocaleString()} ·{' '}
                  {e.provenance === 'unknown' ? 'Provenance not supplied' : e.provenance}
                </p>
                <details>
                  <summary>Receipt ID</summary>
                  <code>{e.id}</code>
                </details>
              </div>
              <button
                className="sq-button"
                disabled={pulse.measurementClaims.includes(e.id)}
                onClick={() => claim(e.id)}
              >
                {pulse.measurementClaims.includes(e.id) ? 'Recorded' : 'Record · 45 XP'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="pulse-empty">
          No validated measurement receipts available yet. Reconnect to check the official feed.
        </p>
      )}
      <div className="section-divider">
        <h3>Seven-day activity</h3>
        <span>
          {stats
            ? `${(stats.activity.coverage.coverageBps / 100).toFixed(1)}% coverage`
            : 'Unknown'}
        </span>
      </div>
      {stats ? (
        <>
          <p className="panel-note">
            {stats.activity.summary.activeDayCount} observed active days. Derived from accepted
            rounds. Coverage is {stats.activity.coverage.complete ? 'complete' : 'partial'}; missing
            observations are unknown.
          </p>
          <div className="activity-days">
            {stats.activity.days.map((d) => (
              <div key={d.date}>
                <span>{d.date.slice(5)}</span>
                <progress
                  aria-label={`${d.date} observation coverage`}
                  max={10000}
                  value={d.coverage.coverageBps}
                />
                <span>
                  {d.coverage.coverageBps > 0
                    ? `${BigInt(d.observedWorkUnits).toLocaleString()} work`
                    : 'Unknown'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="pulse-empty">Activity statistics are unavailable or stale.</p>
      )}
      <details className="api-sources">
        <summary>Official data sources</summary>
        {(['status', 'core', 'blocks', 'measurements', 'stats'] as const).map((k) => (
          <a key={k} href={API + paths[k]} target="_blank" rel="noreferrer">
            {paths[k]} <Icon name="external" size={12} />
          </a>
        ))}
      </details>
    </>
  );
}
