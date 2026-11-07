import { useCallback, useEffect, useRef, useState } from 'react';
import type { WalletState } from '../hooks/use-wallet';
import type { ChainState } from '../hooks/use-chain';
import { API, CONTRACTS, fetchData, type DataTypes } from '../lib/api';
import { playerLevel, survivalAchievements, type SurvivalSave } from '../lib/survival';
import { Hamster, Icon } from './icons';
import { NETWORK, addressLink, isAddress, isHash, shortAddress, txLink } from '../web3/network';
import {
  checkTransaction,
  getAccountData,
  getActivity,
  getRankings,
  type AccountData,
  type ActivityData,
  type RankingWindow,
  type VerifiedTransaction,
} from '../web3/service';
import { EVIDENCE_KEY, readEvidence, type EvidenceRecord } from '../web3/evidence';

export type Web3Tab = 'dashboard' | 'profile' | 'leaderboard' | 'checker' | 'nfts' | 'quests';
const TABS: { id: Web3Tab; name: string; icon: string }[] = [
  { id: 'dashboard', name: 'Squeekchain', icon: 'radio' },
  { id: 'profile', name: 'Web3 profile', icon: 'shield' },
  { id: 'leaderboard', name: 'Leaderboard', icon: 'trophy' },
  { id: 'checker', name: 'Check transaction', icon: 'search' },
  { id: 'nfts', name: 'NFT inventory', icon: 'cube' },
  { id: 'quests', name: 'On-chain quests', icon: 'book' },
];
const message = (e: unknown) =>
  e instanceof Error && e.name !== 'ZodError'
    ? e.message
    : 'This response does not match the supported official deployment. Try again later.';
const date = (value: string) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function External({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="web3-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Icon name="external" size={14} />
    </a>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="web3-empty">{children}</div>;
}
function Failure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="web3-failure">
      <p className="web3-error" role="alert">
        {error}
      </p>
      <button className="sq-button" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
export function Web3Hub({
  wallet,
  save,
  chain,
  initialTab,
  initialAddress,
  onReward,
  retryChain,
}: {
  wallet: WalletState;
  save: SurvivalSave;
  chain: ChainState;
  initialTab: Web3Tab;
  initialAddress?: string;
  onReward: (tx: VerifiedTransaction) => Promise<EvidenceRecord[]>;
  retryChain: () => void;
}) {
  const [tab, setTab] = useState<Web3Tab>(initialTab);
  const [profileAddress, setProfileAddress] = useState(initialAddress || wallet.address || '');
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<EvidenceRecord[]>([]),
    [journalError, setJournalError] = useState('');
  useEffect(() => {
    const update = () => {
      try {
        setRecords(readEvidence(localStorage.getItem(EVIDENCE_KEY)));
      } catch (e) {
        setJournalError(message(e));
      }
    };
    update();
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, []);
  const showProfile = (address: string) => {
    setProfileAddress(address);
    setTab('profile');
    history.replaceState(null, '', `#web3/profile/${address}`);
  };
  const check = (hash: string) => {
    setQuery(hash);
    setTab('checker');
  };
  const reward = async (tx: VerifiedTransaction) => {
    setRecords(await onReward(tx));
  };
  return (
    <div className="web3-hub">
      <nav className="web3-nav" aria-label="Web3 panels">
        {TABS.map((t) => (
          <button
            className={tab === t.id ? 'selected' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            key={t.id}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={18} />
            {t.name}
          </button>
        ))}
      </nav>
      <div className="web3-network">
        <span>
          <Icon name="shield" size={16} />
          Sepolia testnet · Chain {NETWORK.id}
        </span>
        <span>
          {wallet.address
            ? wallet.wrongNetwork
              ? 'Wallet on another network'
              : 'Wallet connected'
            : 'Read-only · wallet disconnected'}
        </span>
      </div>
      {journalError && (
        <p role="alert" className="web3-error">
          {journalError}
        </p>
      )}
      {tab === 'dashboard' && <Dashboard chain={chain} retry={retryChain} check={check} />}
      {tab === 'profile' && (
        <Profile
          wallet={wallet}
          address={profileAddress}
          setAddress={showProfile}
          save={save}
          records={records}
          check={check}
        />
      )}
      {tab === 'nfts' && (
        <NftInventory wallet={wallet} initialAddress={profileAddress || wallet.address || ''} />
      )}
      {tab === 'leaderboard' && (
        <Leaderboard wallet={wallet} save={save} showProfile={showProfile} />
      )}
      {tab === 'checker' && (
        <TransactionChecker
          initialQuery={query}
          wallet={wallet}
          checkProfile={showProfile}
          records={records}
          reward={reward}
        />
      )}
      {tab === 'quests' && (
        <OnchainQuests
          records={records}
          goCheck={() => setTab('checker')}
          goDashboard={() => setTab('dashboard')}
        />
      )}
      <p className="web3-note">
        Public reads use the official Squeekchain API and its published Sepolia explorer. Game XP,
        energy and badges are local, with no token value. No transaction is sent by this game.
      </p>
    </div>
  );
}

function Dashboard({
  chain,
  retry,
  check,
}: {
  chain: ChainState;
  retry: () => void;
  check: (hash: string) => void;
}) {
  const [settlements, setSettlements] = useState<DataTypes['settlements']>();
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await fetchData('settlements');
      if (alive.current) setSettlements(d);
    } catch (e) {
      if (alive.current) {
        setError(message(e));
        setSettlements(undefined);
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const t = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 60000);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh]);
  const telemetry = chain.status.data?.measurement;
  const fresh =
    !!telemetry &&
    !chain.status.error &&
    telemetry.freshness === 'online' &&
    Date.now() - Date.parse(telemetry.observedAt) < telemetry.staleAfterSeconds * 1000;
  const core = !chain.core.error ? chain.core.data : undefined;
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>Hamster status</h3>
          <p>Squeektoshi’s wheel, from sensor to settlement.</p>
        </div>
        <button className="sq-button" onClick={retry}>
          Refresh status
        </button>
      </div>
      <dl className="web3-metrics">
        <Metric
          label="Sensor"
          value={fresh ? (telemetry.coreStatus === 'ACTIVE' ? 'Active' : 'Resting') : 'Unknown'}
        />
        <Metric
          label="Wheel RPM"
          value={fresh ? (telemetry.rpmMilli / 1000).toLocaleString() : 'Unknown'}
        />
        <Metric label="Provenance" value={fresh ? telemetry.provenance : 'Unavailable'} />
        <Metric
          label="Settled Squeek blocks"
          value={core ? core.core.blockHeight : 'Unavailable'}
        />
      </dl>
      <p className="web3-note">
        {fresh
          ? `Sensor observed ${date(telemetry.observedAt)}. ${telemetry.provenance === 'hardware' ? 'Reported by hardware.' : 'This reading is not live hardware evidence.'}`
          : 'Fresh sensor data is unavailable. Refresh to try again.'}{' '}
        Sensor readings and optimistic blocks are not confirmed transactions.
      </p>
      {chain.status.error && <p className="web3-error">{chain.status.error}</p>}
      <div className="web3-heading">
        <div>
          <h3>Confirmed settlements</h3>
          <p>Official safe history · latest settlements in 24 hours.</p>
        </div>
        <button className="sq-button" disabled={loading} onClick={() => void refresh()}>
          {loading ? 'Refreshing…' : 'Refresh settlements'}
        </button>
      </div>
      {error && <Failure error={error} retry={() => void refresh()} />}
      {!settlements && loading && <p role="status">Reading official settlement history…</p>}
      {settlements && (
        <>
          <dl className="web3-metrics">
            <Metric label="Settlements in 24h" value={settlements.summary.settlementCount} />
            <Metric label="Work accepted in 24h" value={settlements.summary.workAdded} />
            <Metric
              label="Squeek blocks completed"
              value={settlements.summary.completedBlockCount}
            />
          </dl>
          <ul className="web3-list">
            {settlements.recentSettlements.map((s) => (
              <li key={`${s.transactionHash}:${s.logIndex}`}>
                <div>
                  <strong>
                    Blocks {s.firstCompletedBlock}–{s.lastCompletedBlock}
                  </strong>
                  <span>Confirmed · {date(s.blockTimestamp)}</span>
                  <code className="web3-address">{s.transactionHash}</code>
                </div>
                <button className="sq-button" onClick={() => check(s.transactionHash)}>
                  Verify receipt
                </button>
              </li>
            ))}
          </ul>
          {!settlements.recentSettlements.length && (
            <Empty>No recent settlements in this window. Refresh later.</Empty>
          )}
          <p className="web3-note">
            Safe through Ethereum block {settlements.chain.safeThroughBlock}. Updated{' '}
            {date(settlements.generatedAt)}. These are protocol settlements, shared by all players.
          </p>
        </>
      )}
      <div className="web3-heading">
        <div>
          <h3>Genesis eligibility</h3>
          <p>
            The official Community account determines eligibility. A game score or wallet signature
            cannot establish it.
          </p>
        </div>
      </div>
      <External href="https://squeekchain.com/genesis">Open official Genesis</External>
      <details className="web3-details">
        <summary>Network and contract references</summary>
        <p>The published release is {RELEASE_TEXT}. Mainnet is not available.</p>
        <ul>
          {Object.entries(CONTRACTS).map(([k, v]) => (
            <li key={k}>
              {k}:{' '}
              <External href={addressLink(v)}>
                <code className="web3-address">{v}</code>
              </External>
            </li>
          ))}
        </ul>
        <External href="https://docs.squeekchain.com/developers/">
          Official deployment and ABI reference
        </External>
        <br />
        <External href={API + '/status'}>Official sensor API</External>
      </details>
    </>
  );
}
const RELEASE_TEXT = 'core-sepolia-20261103, revision 7';

function useAccountRead(address: string) {
  const [data, setData] = useState<AccountData>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError('');
    if (!isAddress(address)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getAccountData(address)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => live && setError(message(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [address, revision]);
  return { data, error, loading, refresh: () => setRevision((v) => v + 1), setData };
}
function useActivityRead(address: string) {
  const [data, setData] = useState<ActivityData>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError('');
    if (!isAddress(address)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getActivity(address)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => live && setError(message(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [address, revision]);
  return { data, error, loading, refresh: () => setRevision((v) => v + 1), setData };
}
function AddressSearch({
  initial,
  onSearch,
  label = 'Wallet address',
}: {
  initial: string;
  onSearch: (address: string) => void;
  label?: string;
}) {
  const [value, setValue] = useState(initial),
    [error, setError] = useState('');
  useEffect(() => setValue(initial), [initial]);
  return (
    <form
      className="web3-search"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isAddress(value.trim())) {
          setError('Enter 0x followed by 40 hexadecimal characters for a non-zero address.');
          return;
        }
        setError('');
        onSearch(value.trim());
      }}
    >
      <label>
        {label}
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
          aria-describedby={error ? 'address-error' : undefined}
        />
      </label>
      <button className="sq-button" type="submit">
        Look up wallet
      </button>
      {error && (
        <p id="address-error" className="web3-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
function Profile({
  wallet,
  address,
  setAddress,
  save,
  records,
  check,
}: {
  wallet: WalletState;
  address: string;
  setAddress: (v: string) => void;
  save: SurvivalSave;
  records: EvidenceRecord[];
  check: (hash: string) => void;
}) {
  const selected = address || wallet.address || '';
  const self = !!wallet.address && selected.toLowerCase() === wallet.address.toLowerCase();
  const account = useAccountRead(selected),
    activity = useActivityRead(selected);
  const [historyError, setHistoryError] = useState(''),
    [paging, setPaging] = useState(false);
  useEffect(() => {
    setHistoryError('');
    setPaging(false);
  }, [selected]);
  const mine = records.filter((r) => r.account === selected.toLowerCase());
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>Web3 player profile</h3>
          <p>Public chain history alongside your local adventure.</p>
        </div>
        {wallet.address && (
          <button className="sq-button" onClick={() => setAddress(wallet.address!)}>
            My wallet
          </button>
        )}
      </div>
      <AddressSearch initial={selected} onSearch={setAddress} />
      {selected ? (
        <>
          <div className="web3-player">
            <Hamster face />
            <div>
              <h3>{self ? save.name : 'Community explorer'}</h3>
              <code className="web3-address">{selected}</code>
              <External href={addressLink(selected)}>View wallet on explorer</External>
            </div>
          </div>
          {self && (
            <>
              <dl className="web3-metrics">
                <Metric label="Game level" value={playerLevel(save)} />
                <Metric label="Local XP" value={save.xp} />
                <Metric label="Story quests" value={save.adventure.claimed.length} />
                <Metric
                  label="Game achievements"
                  value={
                    survivalAchievements(save).filter((a) => a.earned).length +
                    Number(save.adventure.bossDefeated) +
                    Number(save.pulse.completed > 0) +
                    Number(save.pulse.measurementClaims.length > 0)
                  }
                />
              </dl>
              <p className="web3-note">
                This browser’s save. Editable local progress is excluded from community on-chain
                rankings.
              </p>
              <div className="web3-proof">
                <p>
                  {wallet.verified
                    ? 'Ownership verified for this session.'
                    : 'Verify ownership to attach new settlement field notes to this wallet.'}
                </p>
                <button
                  className="sq-button"
                  disabled={wallet.wrongNetwork || !!wallet.busy || wallet.verified}
                  onClick={() => void wallet.prove()}
                >
                  {wallet.busy === 'sign'
                    ? 'Waiting for signature…'
                    : wallet.verified
                      ? 'Ownership verified'
                      : 'Sign ownership message'}
                </button>
                {wallet.wrongNetwork && (
                  <button className="sq-button" onClick={() => void wallet.switchNetwork()}>
                    Switch to Sepolia
                  </button>
                )}
                {wallet.error && (
                  <p className="web3-error" role="alert">
                    {wallet.error}
                  </p>
                )}
                <small>
                  A ten-minute, origin-bound message. No tokens, permissions or transaction. This is
                  local verification, not a Community login.
                </small>
              </div>
            </>
          )}
          <dl className="web3-metrics">
            <Metric label="Recorded settlements" value={mine.length} />
            <Metric
              label="Active rounds witnessed"
              value={mine.reduce((n, r) => n + r.rounds, 0)}
            />
            <Metric label="Personal hamster runs" value="Not attributable" />
            <Metric label="NFTs in wallet" value={account.data?.tokenCounts.wallet ?? 'Unknown'} />
          </dl>
          <p className="web3-note">
            Witnessed rounds describe the shared hamster. The protocol does not assign physical runs
            to player wallets. Field notes here are kept on this device.
          </p>
          <div className="web3-heading">
            <h3>Confirmed transaction history</h3>
            <button className="sq-button" disabled={activity.loading} onClick={activity.refresh}>
              Refresh history
            </button>
          </div>
          {activity.error && <Failure error={activity.error} retry={activity.refresh} />}
          {activity.loading && <p role="status">Reading account activity…</p>}
          {activity.data && (
            <>
              <p>
                {activity.data.total} official activity entries. Showing the latest{' '}
                {activity.data.activity.length}.
              </p>
              <ActivityList data={activity.data} check={check} />
              {activity.data.nextCursor && (
                <button
                  className="sq-button"
                  disabled={paging}
                  onClick={async () => {
                    setPaging(true);
                    setHistoryError('');
                    try {
                      const d = await getActivity(selected, activity.data!.nextCursor!);
                      activity.setData({
                        ...d,
                        activity: [...activity.data!.activity, ...d.activity],
                      });
                    } catch (e) {
                      setHistoryError(message(e));
                    } finally {
                      setPaging(false);
                    }
                  }}
                >
                  {paging ? 'Loading…' : 'Load more history'}
                </button>
              )}
              {historyError && (
                <p role="alert" className="web3-error">
                  {historyError} Refresh history to restart.
                </p>
              )}
              {!activity.data.activity.length && (
                <Empty>
                  No confirmed Squeekchain activity for this wallet. You can still explore the game.
                </Empty>
              )}
            </>
          )}
          {account.error && <Failure error={account.error} retry={account.refresh} />}
          <h3 className="web3-section-title">Verified activity achievements</h3>
          <AchievementList records={mine} />
        </>
      ) : (
        <Empty>
          Connect a wallet in the header or look up a public address to see its chain profile.
        </Empty>
      )}
    </>
  );
}
function ActivityList({ data, check }: { data: ActivityData; check: (hash: string) => void }) {
  return (
    <ul className="web3-list">
      {data.activity.map((e) => (
        <li key={e.id}>
          <div>
            <strong>{e.kind.replaceAll('_', ' ')}</strong>
            <span>Confirmed · {date(e.source.blockTimestamp)}</span>
            <code className="web3-address">{e.source.transactionHash}</code>
          </div>
          <button className="sq-button" onClick={() => check(e.source.transactionHash)}>
            Check transaction
          </button>
        </li>
      ))}
    </ul>
  );
}
function NftInventory({ wallet, initialAddress }: { wallet: WalletState; initialAddress: string }) {
  const [address, setAddress] = useState(initialAddress || wallet.address || ''),
    [moreError, setMoreError] = useState(''),
    [paging, setPaging] = useState(false);
  const account = useAccountRead(address);
  const [selected, setSelected] = useState(''),
    [metadata, setMetadata] = useState<DataTypes['nft']>(),
    [metadataError, setMetadataError] = useState('');
  useEffect(() => {
    setSelected('');
    setMetadata(undefined);
    setMetadataError('');
  }, [address]);
  useEffect(() => {
    let live = true;
    setMetadata(undefined);
    setMetadataError('');
    if (!selected) return;
    void fetchData('nft', { path: `/squeeks/${selected}` })
      .then((d) => {
        if (live) setMetadata(d);
      })
      .catch((e) => live && setMetadataError(message(e)));
    return () => {
      live = false;
    };
  }, [selected]);
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>NFT inventory</h3>
          <p>Squeeks held in a wallet or deposited in official Staking.</p>
        </div>
        {wallet.address && (
          <button className="sq-button" onClick={() => setAddress(wallet.address!)}>
            My wallet
          </button>
        )}
      </div>
      <AddressSearch initial={address} onSearch={setAddress} />
      {account.loading && <p role="status">Reading safe NFT ownership…</p>}
      {account.error && <Failure error={account.error} retry={account.refresh} />}
      {account.data && (
        <>
          <dl className="web3-metrics">
            <Metric label="Wallet-owned" value={account.data.tokenCounts.wallet} />
            <Metric label="Deposited in Staking" value={account.data.tokenCounts.staking} />
            <Metric label="Safe Ethereum block" value={account.data.chain.safeThroughBlock} />
          </dl>
          {!account.data.tokens.length ? (
            <Empty>
              No Squeeks reported for this wallet. In-game collectibles and resources remain in your
              satchel.
            </Empty>
          ) : (
            <ul className="web3-nft-grid">
              {account.data.tokens.map((t) => (
                <li key={t.tokenId}>
                  <button className="web3-nft" onClick={() => setSelected(t.tokenId)}>
                    <Icon name="cube" size={28} />
                    <strong>Squeek #{t.tokenId}</strong>
                    <span>
                      Level {t.level} · {t.custody === 'wallet' ? 'In wallet' : 'In Staking'}
                    </span>
                    <span>View official metadata</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {account.data.nextCursor && (
            <button
              className="sq-button"
              disabled={paging}
              onClick={async () => {
                setPaging(true);
                setMoreError('');
                try {
                  const next = await getAccountData(address, account.data!.nextCursor!);
                  account.setData({ ...next, tokens: [...account.data!.tokens, ...next.tokens] });
                } catch (e) {
                  setMoreError(message(e));
                } finally {
                  setPaging(false);
                }
              }}
            >
              {paging ? 'Loading…' : 'Load more Squeeks'}
            </button>
          )}
          {moreError && (
            <p className="web3-error" role="alert">
              {moreError}
            </p>
          )}
          <button className="sq-button" onClick={account.refresh}>
            Refresh ownership
          </button>
        </>
      )}
      {selected && (
        <section className="web3-metadata">
          <h3>Squeek #{selected}</h3>
          {!metadata && !metadataError && <p role="status">Loading official metadata…</p>}
          {metadataError && (
            <p className="web3-error" role="alert">
              {metadataError}
            </p>
          )}
          {metadata && (
            <>
              {metadata.metadata.imageDataUri?.startsWith('data:image/') && (
                <img
                  src={metadata.metadata.imageDataUri}
                  alt={`Official Squeek ${selected}`}
                  width={200}
                  height={200}
                />
              )}
              <h3>{metadata.metadata.name}</h3>
              <p>{metadata.metadata.description}</p>
              <External
                href={`${NETWORK.explorer}/token/${CONTRACTS.collection}/instance/${selected}`}
              >
                View Squeek on explorer
              </External>
            </>
          )}
        </section>
      )}
      {!address && (
        <Empty>Connect a wallet or enter an address to look up real NFT ownership.</Empty>
      )}
    </>
  );
}

function Leaderboard({
  wallet,
  save,
  showProfile,
}: {
  wallet: WalletState;
  save: SurvivalSave;
  showProfile: (a: string) => void;
}) {
  const [mode, setMode] = useState('chain'),
    [window, setWindow] = useState<RankingWindow>('daily'),
    [metric, setMetric] = useState('actions');
  const [data, setData] = useState<Awaited<ReturnType<typeof getRankings>>>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (mode !== 'chain') return;
    let live = true;
    const load = async () => {
      setLoading(true);
      setError('');
      setData(undefined);
      try {
        const d = await getRankings(window);
        if (live) setData(d);
      } catch (e) {
        if (live) setError(message(e));
      } finally {
        if (live) setLoading(false);
      }
    };
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [mode, window, revision]);
  const rows = data
    ? [...data.rows].sort(
        (a, b) =>
          (metric === 'transactions' ? b.transactions - a.transactions : b.actions - a.actions) ||
          a.address.localeCompare(b.address),
      )
    : [];
  const rank = wallet.address
    ? rows.findIndex((r) => r.address === wallet.address!.toLowerCase())
    : -1;
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>Community leaderboard</h3>
          <p>Compare confirmed public activity across Squeekchain.</p>
        </div>
        <button className="sq-button" disabled={loading} onClick={() => setRevision((v) => v + 1)}>
          Refresh rankings
        </button>
      </div>
      <div className="sq-segmented" role="group" aria-label="Leaderboard source">
        <button aria-pressed={mode === 'chain'} onClick={() => setMode('chain')}>
          On-chain rankings
        </button>
        <button aria-pressed={mode === 'game'} onClick={() => setMode('game')}>
          Game rankings
        </button>
      </div>
      {mode === 'chain' ? (
        <>
          <div className="web3-filters">
            <div>
              <label htmlFor="ranking-period">Period</label>
              <select
                id="ranking-period"
                value={window}
                onChange={(e) => setWindow(e.target.value as RankingWindow)}
              >
                <option value="daily">Daily · UTC</option>
                <option value="weekly">Weekly · Monday UTC</option>
                <option value="all">All time · available history</option>
              </select>
            </div>
            <div>
              <label htmlFor="ranking-metric">Rank by</label>
              <select
                id="ranking-metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
              >
                <option value="actions">Verified actions</option>
                <option value="transactions">Unique transactions</option>
              </select>
            </div>
          </div>
          <p className="web3-note">
            Only safe events from the official deployment count. Local XP, levels and quests cannot
            be verified globally. Shared hamster runs and protocol settlements are not player-owned
            actions.
          </p>
          {loading && <p role="status">Validating public ranking events…</p>}
          {error && <Failure error={error} retry={() => setRevision((v) => v + 1)} />}
          {data && (
            <>
              <p className="web3-coverage">
                {data.complete
                  ? 'Complete API coverage for this period.'
                  : 'Partial ranking · scan limited to 1,000 recent events.'}{' '}
                {data.count} validated actions · {rows.length} wallets. Updated{' '}
                {new Date(data.checkedAt).toLocaleTimeString()}. Refreshes every minute.
              </p>
              {wallet.address && (
                <p>
                  {rank >= 0
                    ? `Your rank in this coverage: ${rank + 1} of ${rows.length}.`
                    : 'Your wallet is not ranked in this coverage.'}
                </p>
              )}
              <ol className="web3-ranking">
                {rows.slice(0, 100).map((r, i) => (
                  <li
                    key={r.address}
                    className={r.address === wallet.address?.toLowerCase() ? 'my-rank' : ''}
                  >
                    <span className="rank-number">{i + 1}</span>
                    <Hamster face />
                    <a
                      href={`#web3/profile/${r.address}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
                          return;
                        e.preventDefault();
                        showProfile(r.address);
                      }}
                    >
                      <strong>
                        {r.address === wallet.address?.toLowerCase()
                          ? save.name
                          : 'Community explorer'}
                      </strong>
                      <code>{shortAddress(r.address)}</code>
                    </a>
                    <strong>
                      {metric === 'transactions' ? r.transactions : r.actions}
                      <small>{metric === 'transactions' ? 'transactions' : 'actions'}</small>
                    </strong>
                  </li>
                ))}
              </ol>
              {!rows.length && (
                <Empty>No verified player activity in this period. Try weekly or all time.</Empty>
              )}
              {rows.length > 100 && (
                <p className="web3-note">Showing the top 100 wallets of this coverage.</p>
              )}
              <p className="web3-note">
                Safe through Ethereum block {data.safeBlock}.{' '}
                {data.oldest ? `Oldest counted event: ${date(data.oldest)}.` : ''} Rankings are
                reconstructed from the public API; no invented names or scores.
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <Empty>
            <h3>Global game rankings are unavailable</h3>
            <p>
              Squeekchain has no official game-score API. This static game cannot share or validate
              browser saves. Your local record stays playable and is never presented as a global
              score.
            </p>
          </Empty>
          <dl className="web3-metrics">
            <Metric label="Local XP" value={save.xp} />
            <Metric label="Level" value={playerLevel(save)} />
            <Metric label="Story quests" value={save.adventure.claimed.length} />
            <Metric label="Foraging runs" value={save.runs.length} />
          </dl>
          <p className="web3-note">
            All-time local adventure. Daily and weekly game ranks require an authoritative game
            service; neither is available.
          </p>
        </>
      )}
    </>
  );
}

function TransactionChecker({
  initialQuery,
  wallet,
  checkProfile,
  records,
  reward,
}: {
  initialQuery: string;
  wallet: WalletState;
  checkProfile: (a: string) => void;
  records: EvidenceRecord[];
  reward: (tx: VerifiedTransaction) => Promise<void>;
}) {
  const [query, setQuery] = useState(initialQuery),
    [submitted, setSubmitted] = useState(''),
    [tx, setTx] = useState<VerifiedTransaction>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [note, setNote] = useState(''),
    [claiming, setClaiming] = useState(false);
  const seq = useRef(0);
  const check = useCallback(async (value: string) => {
    const id = ++seq.current;
    setLoading(true);
    setError('');
    setTx(undefined);
    setNote('');
    setSubmitted(value);
    try {
      const result = await checkTransaction(value);
      if (id === seq.current) setTx(result);
    } catch (e) {
      if (id === seq.current) setError(message(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (initialQuery) void check(initialQuery);
    return () => {
      seq.current++;
    };
  }, [initialQuery, check]);
  useEffect(() => {
    if (tx?.status !== 'Pending') return;
    const t = setInterval(() => {
      if (!document.hidden) void check(tx.hash);
    }, 15000);
    return () => clearInterval(t);
  }, [tx, check]);
  const duplicate = !!tx && records.some((r) => r.hash === tx.hash);
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>Transaction checker</h3>
          <p>Verify a Sepolia receipt, or look up a wallet’s confirmed activity.</p>
        </div>
      </div>
      <form
        className="web3-search"
        onSubmit={(e) => {
          e.preventDefault();
          const value = query.trim();
          setNote('');
          if (isAddress(value)) {
            checkProfile(value);
            return;
          }
          if (!isHash(value)) {
            setError(
              'Enter a full wallet address (42 characters) or transaction hash (66 characters).',
            );
            return;
          }
          void check(value);
        }}
      >
        <label>
          Wallet address or transaction hash
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste 0x…"
            aria-invalid={!!error}
            aria-describedby={error ? 'transaction-error' : undefined}
          />
        </label>
        <button className="sq-button sq-primary" disabled={loading} type="submit">
          {loading ? 'Checking…' : 'Verify transaction'}
        </button>
      </form>
      {wallet.address && (
        <button className="sq-text-button" onClick={() => checkProfile(wallet.address!)}>
          Look up my wallet
        </button>
      )}
      {error && (
        <div id="transaction-error">
          <Failure
            error={error}
            retry={() => {
              if (isHash(submitted)) void check(submitted);
              else setError('');
            }}
          />
        </div>
      )}
      {!tx && !loading && !error && (
        <Empty>
          Paste a transaction hash, or choose “Verify receipt” on the Squeekchain dashboard. A
          missing transaction is never marked confirmed.
        </Empty>
      )}
      {tx && (
        <section className="web3-receipt">
          <div className="web3-heading">
            <h3>{tx.status}</h3>
            <button className="sq-button" disabled={loading} onClick={() => void check(tx.hash)}>
              Refresh receipt
            </button>
          </div>
          <dl className="web3-receipt-fields">
            <Metric
              label="Transaction hash"
              value={<code className="web3-address">{tx.hash}</code>}
            />
            <Metric label="Ethereum block" value={tx.blockNumber ?? 'Not mined'} />
            <Metric label="Confirmations" value={`${tx.confirmations} / 12 required`} />
            <Metric label="Timestamp" value={tx.timestamp ? date(tx.timestamp) : 'Not available'} />
            <Metric
              label="Sender"
              value={tx.from ? <code className="web3-address">{tx.from}</code> : 'Not available'}
            />
            <Metric
              label="Receiver"
              value={
                tx.from ? (
                  <code className="web3-address">{tx.to ?? 'Contract creation'}</code>
                ) : (
                  'Not available'
                )
              }
            />
          </dl>
          <External href={txLink(tx.hash)}>View transaction on official explorer</External>
          <p className="web3-note">
            Source: {tx.readSource || 'RPC'}.{' '}
            {tx.verificationNote ||
              'Receipt, canonical block and confirmation count checked through the published Sepolia explorer RPC.'}
          </p>
          {tx.status === 'Pending' && (
            <p role="status">
              Waiting for a successful canonical receipt with 12 confirmations. Checks every 15
              seconds while this panel is open. No reward has been issued.
            </p>
          )}
          {tx.status === 'Failed' && (
            <p>The receipt reverted. This transaction earns no quest progress or reward.</p>
          )}
          {tx.status === 'Not found' && (
            <p>
              No transaction was found on Sepolia. Check the hash and selected network, then
              refresh. This is not confirmation of a pending transaction.
            </p>
          )}
          {tx.status === 'Confirmed' && (
            <>
              <h3 className="web3-section-title">Official contract events</h3>
              {tx.events.length ? (
                <ul className="web3-event-list">
                  {tx.events.map((e) => (
                    <li key={`${e.contract}:${e.logIndex}`}>
                      <strong>{e.name}</strong>
                      <span>
                        Log {e.logIndex} · {shortAddress(e.contract)}
                      </span>
                      <dl>
                        {Object.entries(e.args).map(([k, v]) => (
                          <Metric
                            key={k}
                            label={k}
                            value={<code className="web3-address">{v}</code>}
                          />
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No recognized Squeekchain events. A successful transfer alone does not verify a
                  settlement or quest.
                </p>
              )}
              <p className="web3-status">
                {tx.settlement
                  ? 'Settlement verified against official SqueekCore evidence.'
                  : 'No verified settlement in this receipt.'}
              </p>
              {tx.ownActivity.some((a) => a === wallet.address?.toLowerCase()) && (
                <p>
                  Confirmed Staking activity belongs to your connected wallet. There is no
                  SqueekQuest quest contract.
                </p>
              )}
              {tx.settlement && (
                <div className="web3-proof">
                  <h3>Settlement field note</h3>
                  <p>
                    Record this public settlement for +90 local XP and up to +20 stamina. One reward
                    per transaction on this device. It does not count as your own hamster run or
                    improve your on-chain rank.
                  </p>
                  <button
                    className="sq-button"
                    disabled={duplicate || claiming}
                    onClick={async () => {
                      setClaiming(true);
                      setNote('');
                      try {
                        await reward(tx);
                        setNote('Field note recorded. +90 local XP; stamina restored by up to 20.');
                      } catch (e) {
                        setNote(message(e));
                      } finally {
                        setClaiming(false);
                      }
                    }}
                  >
                    {duplicate
                      ? 'Already recorded'
                      : claiming
                        ? 'Rechecking receipt…'
                        : 'Record settlement · +90 XP'}
                  </button>
                  <small>
                    {wallet.verified
                      ? 'This field note will be linked locally to your verified wallet.'
                      : 'Verify wallet ownership in Web3 profile first to attach your wallet. Unlinked notes still earn local game XP.'}
                  </small>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {note && (
        <p className="web3-note" role="status">
          {note}
        </p>
      )}
    </>
  );
}
export function AchievementList({ records }: { records: EvidenceRecord[] }) {
  const rounds = records.reduce((n, r) => n + r.rounds, 0);
  const entries = [
    {
      name: 'Settlement scout',
      detail: 'Record one verified settlement.',
      current: records.length,
      target: 1,
    },
    {
      name: 'Chain naturalist',
      detail: 'Record five unique confirmed settlements.',
      current: records.length,
      target: 5,
    },
    {
      name: 'Wheel witness',
      detail: 'Witness ten active settled rounds in recorded receipts.',
      current: rounds,
      target: 10,
    },
  ];
  return (
    <ul className="web3-achievements">
      {entries.map((a) => (
        <li key={a.name}>
          <Icon name={a.current >= a.target ? 'trophy' : 'shield'} size={22} />
          <div>
            <strong>{a.name}</strong>
            <p>{a.detail}</p>
            <span>
              {Math.min(a.current, a.target)} / {a.target} ·{' '}
              {a.current >= a.target ? 'Unlocked locally' : 'In progress'}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
function OnchainQuests({
  records,
  goCheck,
  goDashboard,
}: {
  records: EvidenceRecord[];
  goCheck: () => void;
  goDashboard: () => void;
}) {
  return (
    <>
      <div className="web3-heading">
        <div>
          <h3>On-chain quests</h3>
          <p>Local objectives backed by confirmed public evidence.</p>
        </div>
      </div>
      <div className="web3-proof">
        <h3>Witness a settlement</h3>
        <p>
          Find a real settlement, verify its canonical receipt and record a field note. The receipt
          must succeed, have at least 12 confirmations and contain the official SqueekCore
          BatchSettled event.
        </p>
        <progress aria-label="First settlement quest" value={Math.min(1, records.length)} max={1} />
        <p>
          {records.length
            ? 'First settlement complete. Keep a journal of new settlements.'
            : '0 / 1 verified settlement recorded.'}{' '}
          Reward per unique receipt: 90 local XP and up to 20 stamina.
        </p>
        <div className="web3-actions">
          <button className="sq-button" onClick={goDashboard}>
            Find a settlement
          </button>
          <button className="sq-button" onClick={goCheck}>
            Check a transaction
          </button>
        </div>
      </div>
      <AchievementList records={records} />
      <h3 className="web3-section-title">Verification evidence</h3>
      <ul className="web3-list">
        {records
          .slice(-20)
          .reverse()
          .map((r) => (
            <li key={r.hash}>
              <div>
                <strong>Confirmed settlement · Ethereum block {r.blockNumber}</strong>
                <span>
                  {date(r.timestamp)} · {r.rounds} active rounds
                </span>
                <External href={txLink(r.hash)}>
                  <code className="web3-address">{r.hash}</code>
                </External>
              </div>
              <span>+90 local XP</span>
            </li>
          ))}
      </ul>
      {!records.length && (
        <Empty>
          Record your first verified receipt to start this journal. Pending, failed and repeated
          transactions earn nothing.
        </Empty>
      )}
      <p className="web3-note">
        No official SqueekQuest contract or quest transaction exists. These quests award only local
        game progress. The journal survives new adventures on this device; clearing browser data
        removes it.
      </p>
    </>
  );
}
