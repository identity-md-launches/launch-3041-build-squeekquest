import { useState, type ReactNode } from 'react';
import {
  API,
  blockUrl,
  ChainEvent,
  CONTRACTS,
  DataTypes,
  DOCS,
  Endpoint,
  fetchData,
  formatSqk,
  formatUint,
  paths,
  Settlement,
  txUrl,
} from '../lib/api';
import type { ChainState, Resource } from '../hooks/use-chain';
import { Icon } from './icons';

export function Notice({
  resource,
  label = 'Data',
  onRetry,
}: {
  resource: Resource<unknown>;
  label?: string;
  onRetry?: () => void;
}) {
  if (resource.error)
    return (
      <div className="data-notice" role="status">
        <Icon name="radio" size={18} />
        <div>
          <strong>{resource.data ? 'Last successful reading' : 'Data unavailable'}</strong>
          <p>{resource.error}</p>
          {!!resource.data && <p>This reading is stale. Chain quests are paused.</p>}
        </div>
        {onRetry && (
          <button className="text-button" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  if (resource.loading && !resource.data)
    return (
      <div className="data-notice loading" role="status">
        <Icon name="refresh" size={18} />
        <span>Reading {label.toLowerCase()} from SqueekChain…</span>
      </div>
    );
  return null;
}
export function Source({
  path,
  checkedAt,
  safeBlock,
}: {
  path: string;
  checkedAt?: number;
  safeBlock?: string;
}) {
  return (
    <div className="source-line">
      <a href={API + path} target="_blank" rel="noreferrer">
        <Icon name="shield" size={14} />
        Official API <Icon name="external" size={12} />
      </a>
      <span>
        {checkedAt
          ? `Checked ${new Date(checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : 'Awaiting response'}
        {safeBlock ? ` · Safe through #${formatUint(safeBlock)}` : ''}
      </span>
    </div>
  );
}
export function Metric({
  icon,
  label,
  value,
  note,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  note: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="metric-label">
        <Icon name={icon} size={18} />
        {label}
      </span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-note">
        {note}
        {onClick && <Icon name="arrow" size={16} />}
      </span>
    </>
  );
  return onClick ? (
    <button className="metric" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="metric">{inner}</div>
  );
}
export function Dashboard({ chain, go }: { chain: ChainState; go: (tab: string) => void }) {
  const m = chain.status.data?.measurement;
  return (
    <section className="dashboard-strip" aria-label="SqueekChain at a glance">
      <Metric
        icon="cube"
        label="Settled Squeek blocks"
        value={formatUint(chain.core.data?.core.blockHeight)}
        note={
          chain.core.error
            ? chain.core.data
              ? 'Last reading · stale'
              : 'API unavailable'
            : 'Confirmed on Sepolia'
        }
        onClick={() => go('blocks')}
      />
      <Metric
        icon="wheel"
        label="Wheel speed"
        value={m ? `${(m.rpmMilli / 1000).toFixed(1)} rpm` : 'Unavailable'}
        note={
          chain.status.error
            ? chain.status.data
              ? 'Last reading · stale'
              : 'API unavailable'
            : m
              ? `${m.coreStatus === 'ACTIVE' ? 'Running' : m.coreStatus === 'IDLE' ? 'Resting' : 'Counter fault'} · ${m.provenance}`
              : 'Waiting for the device'
        }
        onClick={() => go('overview')}
      />
      <Metric
        icon="seed"
        label="SQK live supply"
        value={formatSqk(chain.economy.data?.supply.liveSupplyBaseUnits, 0)}
        note={
          chain.economy.error
            ? chain.economy.data
              ? 'Last reading · stale'
              : 'API unavailable'
            : 'Testnet tokens · 18 decimals'
        }
        onClick={() => go('economy')}
      />
      <Metric
        icon="leaf"
        label="Living Squeeks"
        value={formatUint(chain.economy.data?.nft.live)}
        note={
          chain.economy.error
            ? chain.economy.data
              ? 'Last reading · stale'
              : 'API unavailable'
            : 'The Genesis NFT collection'
        }
        onClick={() => go('squeeks')}
      />
    </section>
  );
}
export function SettlementDetail({ record }: { record: Settlement }) {
  return (
    <div className="record-detail">
      <span className="status-tag">
        <Icon name="shield" size={14} />
        Safe settlement
      </span>
      <h3>
        Squeek blocks #{formatUint(record.firstCompletedBlock)} to #
        {formatUint(record.lastCompletedBlock)}
      </h3>
      <p>
        Accepted wheel work completed {formatUint(record.completedBlockCount)} Squeek blocks in this
        settlement.
      </p>
      <dl className="detail-grid">
        <div>
          <dt>Work added</dt>
          <dd>{formatUint(record.workAdded)} units</dd>
        </div>
        <div>
          <dt>Ethereum block</dt>
          <dd>
            <a href={blockUrl(record.ethereumBlockNumber)} target="_blank" rel="noreferrer">
              #{formatUint(record.ethereumBlockNumber)} <Icon name="external" size={13} />
            </a>
          </dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>{new Date(record.blockTimestamp).toLocaleString()}</dd>
        </div>
        <div>
          <dt>SQK issued by protocol</dt>
          <dd>{formatSqk(record.sqkMintedBaseUnits)} SQK</dd>
        </div>
      </dl>
      <Transaction hash={record.transactionHash} />
      <p className="small muted">
        Squeek blocks measure settled wheel work. Ethereum blocks hold the settlement transaction.
        Protocol issuance is not a game reward.
      </p>
    </div>
  );
}
export function Transaction({ hash }: { hash: string }) {
  return (
    <div className="transaction">
      <span className="small muted">Transaction hash</span>
      <a href={txUrl(hash)} target="_blank" rel="noreferrer">
        <code>{hash}</code>
        <Icon name="external" size={16} />
      </a>
    </div>
  );
}
export function EventDetail({ event }: { event: ChainEvent }) {
  return (
    <div className="record-detail">
      <span className="status-tag">
        <Icon name="shield" size={14} />
        Safe blockchain event
      </span>
      <h3>{eventName(event.type)}</h3>
      <dl className="detail-grid">
        <div>
          <dt>Ethereum block</dt>
          <dd>#{formatUint(event.source.blockNumber)}</dd>
        </div>
        <div>
          <dt>Occurred</dt>
          <dd>{new Date(event.occurredAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Event type</dt>
          <dd>
            <code>{event.type}</code>
          </dd>
        </div>
        <div>
          <dt>Log index</dt>
          <dd>{formatUint(event.source.logIndex)}</dd>
        </div>
      </dl>
      <Transaction hash={event.source.transactionHash} />
      <details className="raw-details">
        <summary>Inspect event payload</summary>
        <pre>{JSON.stringify(event.payload, null, 2)}</pre>
      </details>
      <p className="small muted">
        Sourced from the supported SqueekChain contracts on Sepolia, at or below the API&apos;s safe
        block.
      </p>
    </div>
  );
}
export function eventName(type: string) {
  return type
    .split('.')
    .map((s) => s.replaceAll('_', ' '))
    .join(' · ')
    .replace(/^./, (s) => s.toUpperCase());
}

export type ExplorerTab = 'overview' | 'blocks' | 'events' | 'economy' | 'squeeks';
const tabs: { id: ExplorerTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'compass' },
  { id: 'blocks', label: 'Blocks', icon: 'cube' },
  { id: 'events', label: 'Events', icon: 'radio' },
  { id: 'economy', label: 'Economy', icon: 'seed' },
  { id: 'squeeks', label: 'Squeeks', icon: 'leaf' },
];
export function Explorer({
  chain,
  tab,
  setTab,
  refresh,
  inspectSettlement,
  inspectEvent,
}: {
  chain: ChainState;
  tab: ExplorerTab;
  setTab: (t: ExplorerTab) => void;
  refresh: (keys?: Endpoint[]) => Promise<void>;
  inspectSettlement: (s: Settlement) => void;
  inspectEvent: (e: ChainEvent) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [extra, setExtra] = useState<ChainEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState('');
  const m = chain.status.data?.measurement;
  const events = [
    ...new Map([...(chain.events.data?.events ?? []), ...extra].map((e) => [e.id, e])).values(),
  ];
  const filteredEvents = events.filter(
    (e) =>
      (category === 'all' || e.type.startsWith(category + '.')) &&
      `${e.type} ${e.source.transactionHash} ${e.source.blockNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function more() {
    const cursor = nextCursor === undefined ? chain.events.data?.nextCursor : nextCursor;
    if (!cursor) return;
    setMoreLoading(true);
    setMoreError('');
    try {
      const d = await fetchData('events', {
        path: `/events?limit=20&cursor=${encodeURIComponent(cursor)}`,
      });
      setExtra((s) => [...s, ...d.events]);
      setNextCursor(d.nextCursor);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : 'Unable to load more events.');
    } finally {
      setMoreLoading(false);
    }
  }
  return (
    <section className="explorer">
      <div className="section-tabs" role="group" aria-label="Explorer sections">
        {tabs.map((t) => (
          <button
            className={tab === t.id ? 'selected' : ''}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            key={t.id}
          >
            <Icon name={t.icon} size={17} />
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <Notice
            resource={chain.status}
            label="network status"
            onRetry={() => void refresh(['status'])}
          />
          <div className="explorer-intro">
            <div>
              <h2>One hamster. A whole network.</h2>
              <p>Follow the journey from the wheel to a confirmed Squeek block.</p>
            </div>
            <span className="status-tag">
              <Icon name="shield" size={15} />
              Ethereum Sepolia
            </span>
          </div>
          <div className="metric-grid">
            <Metric
              icon="wheel"
              label="Wheel speed"
              value={m ? `${(m.rpmMilli / 1000).toFixed(1)} rpm` : 'Unavailable'}
              note={
                m ? `${m.coreStatus.toLowerCase()} · ${m.provenance}` : 'No accepted measurement'
              }
            />
            <Metric
              icon="compass"
              label="Device daily distance"
              value={m ? `${(m.distanceMm / 1000000).toFixed(3)} km` : 'Unavailable'}
              note="Device day starts at 12:00 UTC"
            />
            <Metric
              icon="cube"
              label="Settled Squeek blocks"
              value={formatUint(chain.core.data?.core.blockHeight)}
              note={chain.core.data?.core.paused ? 'Core paused' : 'Settled SqueekCore work'}
            />
            <Metric
              icon="radio"
              label="Oracle state"
              value={chain.status.data?.oracle.state ?? 'Unavailable'}
              note={m ? `Measurement ${m.freshness}` : 'Waiting for a measurement'}
            />
          </div>
          <Source path={paths.status} checkedAt={chain.status.checkedAt} />
          <div className="explorer-columns">
            <section className="plain-panel">
              <h3>The next settled block</h3>
              <Notice resource={chain.core} onRetry={() => void refresh(['core'])} />
              {chain.core.data && (
                <>
                  <div className="progress-heading">
                    <span>Block progress</span>
                    <strong>
                      {(Number(chain.core.data.core.blockProgress) / 10000000).toFixed(1)}%
                    </strong>
                  </div>
                  <progress max={1000000000} value={Number(chain.core.data.core.blockProgress)} />
                  <p className="small muted">
                    {formatUint(chain.core.data.core.cumulativeWork)} work units settled through
                    round {formatUint(chain.core.data.core.settledThroughRound)}.
                  </p>
                  <Source
                    path={paths.core}
                    checkedAt={chain.core.checkedAt}
                    safeBlock={chain.core.data.chain.safeThroughBlock}
                  />
                </>
              )}
            </section>
            <section className="plain-panel">
              <h3>Beyond the settled frontier</h3>
              <Notice resource={chain.blocks} onRetry={() => void refresh(['blocks'])} />
              {chain.blocks.data && (
                <>
                  <p>
                    <strong>{chain.blocks.data.blocks.length}</strong> provisional blocks in the
                    current projection.
                  </p>
                  <p className="small muted">
                    These are optimistic measurements. They are not settled and cannot complete a
                    chain quest.
                  </p>
                  <Source path={paths.blocks} checkedAt={chain.blocks.checkedAt} />
                </>
              )}
            </section>
          </div>
          <ActivityChart resource={chain.stats} />
          <details className="raw-details">
            <summary>How data is validated</summary>
            <p>
              Only the documented Sepolia release is accepted. Records must match response versions,
              chain ID 11155111, deployed contract addresses, and the safe block frontier. This is
              API provenance validation, not independent cryptographic or RPC verification.
            </p>
            <p>
              Snapshots refresh every 30 seconds while this tab is visible; measurement statistics
              refresh every 2 minutes. A cached response may be unchanged. Data errors pause chain
              quest claims.
            </p>
            <a className="inline-link" href={DOCS} target="_blank" rel="noreferrer">
              Read the official deployment documentation <Icon name="external" size={14} />
            </a>
          </details>
        </>
      )}
      {tab === 'blocks' && (
        <>
          <div className="explorer-intro">
            <div>
              <h2>Work, settled on-chain.</h2>
              <p>Recent settlements that completed Squeek blocks in the last 24 hours.</p>
            </div>
          </div>
          <Notice resource={chain.settlements} onRetry={() => void refresh(['settlements'])} />
          {chain.settlements.data && (
            <>
              <div className="metric-grid three">
                <Metric
                  icon="cube"
                  label="Completed in 24 hours"
                  value={formatUint(chain.settlements.data.summary.completedBlockCount)}
                  note="Squeek blocks"
                />
                <Metric
                  icon="wheel"
                  label="Settled work in 24 hours"
                  value={formatUint(chain.settlements.data.summary.workAdded)}
                  note="Accepted work units"
                />
                <Metric
                  icon="check"
                  label="Settlements in 24 hours"
                  value={formatUint(chain.settlements.data.summary.settlementCount)}
                  note="Including settlements with no blocks"
                />
              </div>
              <div className="data-list">
                <div className="data-list-head">
                  <span>Squeek block range</span>
                  <span>Work added</span>
                  <span>Ethereum block</span>
                  <span>Explore</span>
                </div>
                {chain.settlements.data.recentSettlements.length ? (
                  chain.settlements.data.recentSettlements.map((s) => (
                    <button
                      className="settlement-row"
                      key={s.transactionHash + ':' + s.logIndex}
                      onClick={() => inspectSettlement(s)}
                    >
                      <span>
                        <span className="row-icon">
                          <Icon name="cube" />
                        </span>
                        <strong>
                          #{formatUint(s.firstCompletedBlock)} to #
                          {formatUint(s.lastCompletedBlock)}
                        </strong>
                        <small>{new Date(s.blockTimestamp).toLocaleString()}</small>
                      </span>
                      <span>{formatUint(s.workAdded)} units</span>
                      <span>#{formatUint(s.ethereumBlockNumber)}</span>
                      <span className="row-link">
                        Inspect <Icon name="arrow" size={16} />
                      </span>
                    </button>
                  ))
                ) : (
                  <Empty
                    icon="cube"
                    title="No completed blocks in this window"
                    text="The wheel may be resting. Refresh later for new settlements."
                  />
                )}
              </div>
              <Source
                path={paths.settlements}
                checkedAt={chain.settlements.checkedAt}
                safeBlock={chain.settlements.data.chain.safeThroughBlock}
              />
            </>
          )}
        </>
      )}
      {tab === 'events' && (
        <>
          <div className="explorer-intro">
            <div>
              <h2>Little actions. Real records.</h2>
              <p>Safe blockchain events from the supported SqueekChain contracts.</p>
            </div>
          </div>
          <Notice
            resource={chain.events}
            onRetry={() => {
              setExtra([]);
              setNextCursor(undefined);
              void refresh(['events']);
            }}
          />
          <div className="filter-row">
            <label className="search-field">
              <Icon name="search" size={18} />
              <span className="sr-only">
                Search loaded events by type, transaction hash or block
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search type, hash or block"
                type="search"
              />
            </label>
            <label className="select-field">
              <span>Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="all">All events</option>
                {[...new Set(events.map((e) => e.type.split('.')[0]))].sort().map((c) => (
                  <option key={c} value={c}>
                    {c === 'nft' ? 'Squeeks' : c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="small muted">
            {filteredEvents.length} matching records in {events.length} loaded events
          </p>
          <div className="event-list">
            {filteredEvents.map((e) => (
              <button className="event-row" onClick={() => inspectEvent(e)} key={e.id}>
                <span className="row-icon">
                  <Icon
                    name={
                      e.type.startsWith('nft')
                        ? 'leaf'
                        : e.type.startsWith('system')
                          ? 'cube'
                          : 'seed'
                    }
                  />
                </span>
                <span className="event-row-main">
                  <strong>{eventName(e.type)}</strong>
                  <span className="small muted">
                    Block #{formatUint(e.source.blockNumber)} ·{' '}
                    {new Date(e.occurredAt).toLocaleString()}
                  </span>
                </span>
                <span className="status-tag">
                  <Icon name="check" size={12} />
                  Safe
                </span>
                <Icon name="chevron" size={18} />
              </button>
            ))}
            {!filteredEvents.length && !chain.events.loading && (
              <Empty
                icon="radio"
                title="No matching events"
                text={
                  query || category !== 'all'
                    ? 'Try another search or clear the filters.'
                    : 'No validated events are available in this response.'
                }
                action={
                  query || category !== 'all' ? (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery('');
                        setCategory('all');
                      }}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            )}
          </div>
          {moreError && (
            <p role="status" className="error-text">
              {moreError}
            </p>
          )}
          {(nextCursor === undefined ? chain.events.data?.nextCursor : nextCursor) && (
            <button
              className="button secondary load-more"
              disabled={moreLoading}
              onClick={() => void more()}
            >
              {moreLoading ? 'Loading events…' : 'Load more events'}
              <Icon name="down" size={16} />
            </button>
          )}
          <Source
            path={paths.events}
            checkedAt={chain.events.checkedAt}
            safeBlock={chain.events.data?.chain.safeThroughBlock}
          />
        </>
      )}
      {tab === 'economy' && (
        <>
          <div className="explorer-intro">
            <div>
              <h2>A peek at the SQK economy.</h2>
              <p>Protocol totals on Sepolia. These testnet tokens have no game payout.</p>
            </div>
          </div>
          <Notice resource={chain.economy} onRetry={() => void refresh(['economy'])} />
          {chain.economy.data && (
            <>
              <div className="metric-grid">
                <Metric
                  icon="seed"
                  label="Live supply"
                  value={formatSqk(chain.economy.data.supply.liveSupplyBaseUnits)}
                  note="SQK · exact to 2 decimal places"
                />
                <Metric
                  icon="wheel"
                  label="Issued by mining"
                  value={formatSqk(chain.economy.data.supply.miningMintedBaseUnits)}
                  note="SQK issued by the protocol"
                />
                <Metric
                  icon="leaf"
                  label="Total staked"
                  value={formatSqk(chain.economy.data.staking.totalStakedBaseUnits)}
                  note={
                    chain.economy.data.staking.paused ? 'Staking paused' : 'SQK · protocol staking'
                  }
                />
                <Metric
                  icon="seed"
                  label="Total burned"
                  value={formatSqk(chain.economy.data.supply.totalBurnedBaseUnits)}
                  note="SQK permanently burned"
                />
              </div>
              <Source
                path={paths.economy}
                checkedAt={chain.economy.checkedAt}
                safeBlock={chain.economy.data.chain.safeThroughBlock}
              />
              <p className="small muted">
                Amounts are read as unsigned integer strings and formatted using BigInt with 18
                decimals. Displayed fractions are truncated, never rounded upward.
              </p>
              <h3 className="section-heading">Verify the contracts</h3>
              <div className="contract-list">
                {Object.entries(CONTRACTS).map(([name, address]) => (
                  <a
                    href={`https://eth-sepolia.blockscout.com/address/${address}`}
                    target="_blank"
                    rel="noreferrer"
                    key={name}
                  >
                    <strong>
                      {name === 'collection'
                        ? 'SqueekNFT'
                        : `Squeek${name[0].toUpperCase() + name.slice(1)}`}
                    </strong>
                    <code>{address}</code>
                    <Icon name="external" size={15} />
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === 'squeeks' && (
        <>
          <div className="explorer-intro">
            <div>
              <h2>Meet the Squeeks.</h2>
              <p>Look up a Genesis Squeek and explore its real on-chain identity.</p>
            </div>
          </div>
          {chain.economy.data && (
            <div className="collection-summary">
              <Icon name="leaf" />
              <strong>{formatUint(chain.economy.data.nft.live)} living Squeeks</strong>
              <span className="muted">
                of {formatUint(chain.economy.data.nft.issued)} issued ·{' '}
                {formatUint(chain.economy.data.nft.burned)} burned in merges
              </span>
            </div>
          )}
          <NftLookup />
        </>
      )}
    </section>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function ActivityChart({ resource }: { resource: Resource<DataTypes['stats']> }) {
  const days = resource.data?.activity.days ?? [];
  const max = days.reduce(
    (m, d) => (BigInt(d.observedWorkUnits) > m ? BigInt(d.observedWorkUnits) : m),
    1n,
  );
  return (
    <section className="activity-chart plain-panel">
      <div className="section-title">
        <h3>A week at the wheel</h3>
        <span className="small muted">Observed work · device days at 12:00 UTC</span>
      </div>
      <Notice resource={resource} label="measurement statistics" />
      {resource.data && (
        <>
          <div className="bars">
            {days.map((d) => (
              <div className="bar-column" key={d.date}>
                <span className="bar-value">
                  {d.coverage.coverageBps === 0 ? 'No data' : formatUint(d.observedWorkUnits)}
                </span>
                <div className={`bar-track ${d.coverage.coverageBps === 0 ? 'missing' : ''}`}>
                  <div
                    className="bar-fill"
                    style={{ height: `${Number((BigInt(d.observedWorkUnits) * 100n) / max)}%` }}
                  />
                </div>
                <span className="bar-label">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="small muted">
            Coverage: {(resource.data.activity.coverage.coverageBps / 100).toFixed(1)}%.{' '}
            {resource.data.activity.coverage.complete
              ? 'Complete window.'
              : 'Partial history; missing measurements are not zero activity.'}
          </p>
          <Source path={paths.stats} checkedAt={resource.checkedAt} />
        </>
      )}
    </section>
  );
}
export function NftLookup({ onObserve }: { onObserve?: (nft: DataTypes['nft']) => void }) {
  const [id, setId] = useState('1');
  const [resource, setResource] = useState<Resource<DataTypes['nft']>>({ loading: false });
  const [validation, setValidation] = useState('');
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[1-9]\d{0,3}$/.test(id) || Number(id) > 9999) {
      setValidation('Enter a Squeek ID from 1 to 9999.');
      (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus();
      return;
    }
    setValidation('');
    setResource({ loading: true });
    try {
      const data = await fetchData('nft', { path: `/squeeks/${id}` });
      if (data.tokenId !== id) throw new Error('The returned Squeek ID did not match the request.');
      setResource({ data, loading: false, checkedAt: Date.now() });
    } catch (e) {
      setResource({
        loading: false,
        error: e instanceof Error ? e.message : 'Unable to look up this Squeek.',
      });
    }
  }
  const nft = resource.data;
  const image = nft?.metadata.imageDataUri;
  const safeImage =
    image && /^data:image\/(svg\+xml|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
      ? image
      : undefined;
  return (
    <>
      <form className="nft-search" onSubmit={(e) => void lookup(e)}>
        <label htmlFor="squeek-id">
          Squeek ID <span className="small muted">1 to 9999</span>
        </label>
        <div className="input-action">
          <input
            id="squeek-id"
            name="squeek-id"
            inputMode="numeric"
            value={id}
            aria-invalid={!!validation}
            aria-describedby={validation ? 'nft-error' : undefined}
            onChange={(e) => setId(e.target.value)}
            maxLength={5}
          />
          <button className="button primary" type="submit" disabled={resource.loading}>
            {resource.loading ? 'Looking up…' : 'Find Squeek'}
            <Icon name="search" size={17} />
          </button>
        </div>
        {validation && (
          <p id="nft-error" className="error-text" role="alert">
            {validation}
          </p>
        )}
      </form>
      <Notice resource={resource} label="Squeek NFT" />
      {nft && (
        <article className="nft-card">
          {safeImage ? (
            <img
              src={safeImage}
              alt={`On-chain artwork for ${nft.metadata.name}`}
              className="nft-image"
            />
          ) : (
            <div className="nft-image nft-image-empty">
              <Icon name="leaf" size={48} />
              <span>Artwork unavailable</span>
            </div>
          )}
          <div className="nft-info">
            <span className="status-tag">
              <Icon name="shield" size={14} />
              Verified API record
            </span>
            <h3>{nft.metadata.name}</h3>
            <p>{nft.metadata.description}</p>
            <dl className="detail-grid">
              <div>
                <dt>Level</dt>
                <dd>{nft.level}</dd>
              </div>
              <div>
                <dt>Base power</dt>
                <dd>{formatUint(nft.basePower)}</dd>
              </div>
              <div>
                <dt>Merge state</dt>
                <dd>{nft.mergeState}</dd>
              </div>
              <div>
                <dt>Custody</dt>
                <dd>{nft.custody.burned ? 'Burned' : 'Owned'}</dd>
              </div>
            </dl>
            <div className="owner-line">
              <span className="small muted">Owner</span>
              <a
                href={`https://eth-sepolia.blockscout.com/address/${nft.custody.owner}`}
                target="_blank"
                rel="noreferrer"
              >
                <code>{nft.custody.owner}</code>
                <Icon name="external" size={13} />
              </a>
            </div>
            {onObserve && (
              <button className="button primary" onClick={() => onObserve(nft)}>
                Log this Squeek <Icon name="check" size={17} />
              </button>
            )}
            <Source
              path={`/squeeks/${nft.tokenId}`}
              checkedAt={resource.checkedAt}
              safeBlock={nft.chain.safeThroughBlock}
            />
          </div>
          <details className="raw-details nft-traits">
            <summary>Explore {nft.metadata.attributes.length} traits</summary>
            <dl className="detail-grid">
              {nft.metadata.attributes.map((a, i) => (
                <div key={a.traitType + i}>
                  <dt>{a.traitType}</dt>
                  <dd>{a.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </article>
      )}
    </>
  );
}
