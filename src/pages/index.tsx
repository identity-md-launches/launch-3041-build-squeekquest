import Head from 'next/head';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dashboard,
  Empty,
  EventDetail,
  Explorer,
  ExplorerTab,
  NftLookup,
  Notice,
  SettlementDetail,
  Source,
} from '../components/chain-views';
import { Dialog } from '../components/dialog';
import { GameMap } from '../components/game-map';
import { Hamster, Icon } from '../components/icons';
import { useChain } from '../hooks/use-chain';
import { API, ChainEvent, DataTypes, formatUint, paths, Settlement } from '../lib/api';
import {
  achievements,
  addRun,
  award,
  freshSave,
  hasQuest,
  level,
  loadSave,
  Quest,
  Save,
  Station,
  STATIONS,
  STORAGE_KEY,
  today,
  totalXp,
  xpFor,
} from '../lib/game';

type View = 'adventure' | 'missions' | 'explorer' | 'leaderboard';
type Modal =
  | { type: 'help' }
  | { type: 'profile' }
  | { type: 'station'; station: Station }
  | { type: 'settlement'; record: Settlement }
  | { type: 'event'; record: ChainEvent }
  | null;
const questList: {
  id: Quest;
  title: string;
  description: string;
  icon: string;
  station?: Station;
}[] = [
  {
    id: 'forage',
    title: 'A pocketful of sunshine',
    description: 'Collect 5 seeds and bring them back to the burrow.',
    icon: 'seed',
  },
  {
    id: 'block-scout',
    title: 'Follow the wheel',
    description: 'Visit Wheel works and log a settled Squeek block.',
    icon: 'cube',
    station: 'blocks',
  },
  {
    id: 'signal-hunter',
    title: 'A signal in the valley',
    description: 'Visit the Signal station and inspect a safe chain event.',
    icon: 'radio',
    station: 'events',
  },
  {
    id: 'squeek-friend',
    title: 'Make a Squeek friend',
    description: 'Visit Squeek grove and discover a real Genesis NFT.',
    icon: 'leaf',
    station: 'nft',
  },
];
const views: { id: View; label: string; icon: string }[] = [
  { id: 'adventure', label: 'Adventure', icon: 'compass' },
  { id: 'missions', label: 'Quest journal', icon: 'book' },
  { id: 'explorer', label: 'Chain explorer', icon: 'cube' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'trophy' },
];

export default function Home() {
  const { state: chain, refresh } = useChain();
  const [save, setSave] = useState<Save>(freshSave);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [view, setView] = useState<View>('adventure');
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('overview');
  const [modal, setModal] = useState<Modal>(null);
  const [tracked, setTracked] = useState<Quest>('forage');
  const [visited, setVisited] = useState<Station[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(0);
  const audio = useRef<AudioContext | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const questDate = today();
  const completed = questList.filter((q) => hasQuest(save, q.id, questDate)).length;
  const dailyReady =
    hasQuest(save, 'forage', questDate) &&
    ['block-scout', 'signal-hunter', 'squeek-friend'].some((q) =>
      hasQuest(save, q as Quest, questDate),
    );
  const earned = achievements(save);

  useEffect(() => {
    let stored: Save;
    try {
      stored = loadSave(localStorage.getItem(STORAGE_KEY));
    } catch {
      stored = freshSave();
      setStorageError(true);
    }
    setSave(stored);
    document.documentElement.dataset.theme = stored.theme;
    setLoaded(true);
    setNow(Date.now());
    const onHash = () => {
      const [v, sub] = location.hash.slice(1).split('/');
      if (views.some((x) => x.id === v)) setView(v as View);
      if (['overview', 'blocks', 'events', 'economy', 'squeeks'].includes(sub))
        setExplorerTab(sub as ExplorerTab);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      window.removeEventListener('hashchange', onHash);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    const root = document.documentElement;
    root.classList.add('theme-changing');
    root.dataset.theme = save.theme;
    void root.offsetHeight;
    requestAnimationFrame(() => root.classList.remove('theme-changing'));
  }, [save, loaded]);

  const finish = useCallback((seeds: number, seconds: number) => {
    setSave((s) =>
      addRun(
        award(s, 'forage', `${seeds} seeds returned to the burrow in ${seconds} seconds`),
        seeds,
        seconds,
      ),
    );
    setAnnouncement('Foraging run saved. Your daily forage earns 80 local XP once per UTC day.');
  }, []);
  const visit = useCallback((station: Station) => {
    setVisited((s) => (s.includes(station) ? s : [...s, station]));
    setModal({ type: 'station', station });
  }, []);
  const playSound = useCallback(() => {
    if (!saveRef.current.sound || !audio.current) return;
    try {
      const ctx = audio.current;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1080, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* Optional sound cannot block play. */
    }
  }, []);
  function toggleSound() {
    if (!save.sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current
          .resume()
          .catch(() => setAnnouncement('Sound is unavailable in this browser.'));
      } catch {
        setAnnouncement('Sound is unavailable in this browser.');
        return;
      }
    }
    setSave((s) => ({ ...s, sound: !s.sound }));
  }
  function wakeSound() {
    if (!saveRef.current.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => {});
    } catch {
      // Browser audio support never blocks an adventure.
    }
  }
  function go(v: View, tab?: ExplorerTab) {
    setView(v);
    if (tab) setExplorerTab(tab);
    location.hash = v + (v === 'explorer' ? `/${tab ?? explorerTab}` : '');
  }
  function track(q: Quest) {
    setTracked(q);
    go('adventure');
    setAnnouncement(
      q === 'forage'
        ? 'Collect five seeds, then return to the burrow.'
        : `Start exploring, then select ${questList.find((x) => x.id === q)?.station ? STATIONS[questList.find((x) => x.id === q)!.station!].name : 'a station'} on the map.`,
    );
  }
  function healthy(key: 'events' | 'settlements' | 'economy' | 'core') {
    const r = chain[key];
    return !!r.data && !r.error && !!r.checkedAt && Date.now() - r.checkedAt < 90000;
  }
  function claim(quest: Quest, evidence: string) {
    if (hasQuest(save, quest)) {
      setAnnouncement('This quest is already complete for today. Come back after 00:00 UTC.');
      return;
    }
    setSave((s) => award(s, quest, evidence));
    setAnnouncement(`Quest complete. ${xpFor[quest]} local XP added to your journal.`);
    setModal(null);
  }
  function claimSettlement(record: Settlement) {
    if (
      !visited.includes('blocks') ||
      !healthy('settlements') ||
      !chain.settlements.data?.recentSettlements.some(
        (s) => s.transactionHash === record.transactionHash && s.logIndex === record.logIndex,
      )
    ) {
      setAnnouncement('Visit Wheel works and refresh a validated settlement before claiming.');
      return;
    }
    claim(
      'block-scout',
      `${record.transactionHash} · log ${record.logIndex} · Squeek blocks ${record.firstCompletedBlock}-${record.lastCompletedBlock}`,
    );
  }
  function claimEvent(event: ChainEvent) {
    if (
      !visited.includes('events') ||
      !healthy('events') ||
      !chain.events.data?.events.some((e) => e.id === event.id)
    ) {
      setAnnouncement('Visit the Signal station and refresh a validated event before claiming.');
      return;
    }
    claim(
      'signal-hunter',
      `${event.source.transactionHash} · log ${event.source.logIndex} · ${event.type}`,
    );
  }
  function observeNft(nft: DataTypes['nft']) {
    if (!visited.includes('nft') || Date.now() - Date.parse(nft.generatedAt) > 90000) {
      setAnnouncement('Visit Squeek grove and look up a fresh NFT record to complete this quest.');
      return;
    }
    claim(
      'squeek-friend',
      `Squeek #${nft.tokenId} · safe Ethereum block ${nft.chain.safeThroughBlock} · ${nft.custody.owner}`,
    );
  }
  const networkFresh =
    !!chain.status.data &&
    !chain.status.error &&
    !!chain.status.checkedAt &&
    now - chain.status.checkedAt < 90000;
  const measurementFresh =
    networkFresh &&
    chain.status.data?.measurement?.freshness === 'online' &&
    now - Date.parse(chain.status.data.measurement.receivedAt) <=
      chain.status.data.measurement.staleAfterSeconds * 1000;

  const titles: Record<View, [string, string]> = {
    adventure: [
      'Small paws. Big discoveries.',
      'A hamster adventure connected to the real SqueekChain.',
    ],
    missions: [
      'Every discovery tells a story.',
      'Explore the valley and collect evidence in your quest journal.',
    ],
    explorer: ['Curiosity, meet the chain.', 'Real SqueekChain data, with a trail you can follow.'],
    leaderboard: [
      'A place for your best runs.',
      'Your foraging records, saved right here on this device.',
    ],
  };
  return (
    <>
      <Head>
        <title>SqueekQuest | A little hamster adventure</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <a className="skip-link" href="#main">
        Skip to game and content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#adventure"
            onClick={() => go('adventure')}
            aria-label="SqueekQuest home"
          >
            <span className="brand-icon">
              <Hamster face />
            </span>
            <span>
              Squeek<span className="brand-quest">Quest</span>
              <span className="brand-period">.</span>
            </span>
          </a>
          <nav aria-label="Main navigation" className="main-nav">
            {views.map((v) => (
              <a
                href={`#${v.id}`}
                className={view === v.id ? 'active' : ''}
                aria-current={view === v.id ? 'page' : undefined}
                onClick={() => go(v.id)}
                key={v.id}
              >
                <Icon name={v.icon} size={17} />
                {v.label}
              </a>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button"
              onClick={() => setModal({ type: 'help' })}
              aria-label="How to play"
            >
              <Icon name="help" />
            </button>
            <button
              className="icon-button"
              onClick={toggleSound}
              aria-label="Game sound"
              title={save.sound ? 'Mute game sound' : 'Enable game sound'}
              aria-pressed={save.sound}
            >
              <Icon name={save.sound ? 'sound' : 'mute'} />
            </button>
            <button
              className="icon-button"
              onClick={() =>
                setSave((s) => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }))
              }
              aria-label={save.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <Icon name={save.theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button
              className="profile-button"
              onClick={() => setModal({ type: 'profile' })}
              aria-label={`Explorer profile, level ${level(save)}`}
            >
              <span className="avatar">
                <Hamster face />
              </span>
              <span>Level {level(save)}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="page-wrap" tabIndex={-1}>
        <div className="page-intro">
          <div>
            <h1>{titles[view][0]}</h1>
            <p>{titles[view][1]}</p>
          </div>
          <div className={`network-badge ${measurementFresh ? 'online' : ''}`}>
            <span className="status-dot" />
            <span>
              {chain.status.loading && !chain.status.data
                ? 'Connecting to SqueekChain'
                : measurementFresh
                  ? 'SqueekChain connected'
                  : networkFresh
                    ? 'Device reading stale'
                    : 'Chain data unavailable'}
            </span>
            <span className="network-chain">Sepolia</span>
          </div>
        </div>
        {storageError && (
          <div className="data-notice" role="status">
            <Icon name="help" />
            <p>
              Browser storage is unavailable. You can play, but progress will last only for this
              visit.
            </p>
          </div>
        )}
        <div className="mobile-nav" role="group" aria-label="Game sections">
          {views.map((v) => (
            <button
              key={v.id}
              className={view === v.id ? 'active' : ''}
              onClick={() => go(v.id)}
              aria-pressed={view === v.id}
            >
              <Icon name={v.icon} size={17} />
              <span>
                {v.id === 'missions' ? 'Quests' : v.id === 'explorer' ? 'Explorer' : v.label}
              </span>
            </button>
          ))}
        </div>
        <div hidden={view !== 'adventure'}>
          <div className="adventure-layout">
            <div className="adventure-main">
              <GameMap
                onFinish={finish}
                onStation={visit}
                onSound={playSound}
                onStart={wakeSound}
                active={view === 'adventure' && !modal}
              />
              <div className="world-note">
                <span className="world-note-icon">
                  <Icon name="leaf" size={22} />
                </span>
                <div>
                  <strong>A little play. A real connection.</strong>
                  <p>The valley is imaginary. The SqueekChain discoveries are real.</p>
                </div>
                <a
                  href="#explorer/overview"
                  onClick={() => go('explorer', 'overview')}
                  className="inline-link"
                >
                  Explore the chain
                  <Icon name="arrow" size={16} />
                </a>
              </div>
            </div>
            <aside className="quest-sidebar">
              <section className="quest-panel">
                <div className="section-title">
                  <h2>Today&apos;s quests</h2>
                  <span className="quest-count">{completed}/4</span>
                </div>
                <p className="muted small">A fresh adventure every day at 00:00 UTC.</p>
                <div className="quest-list">
                  {questList.map((q) => (
                    <button
                      className={`quest-row ${tracked === q.id ? 'tracked' : ''} ${hasQuest(save, q.id) ? 'is-complete' : ''}`}
                      key={q.id}
                      onClick={() => track(q.id)}
                      aria-label={`Track ${q.title}${hasQuest(save, q.id) ? ', completed' : ''}`}
                    >
                      <span className={`quest-icon ${hasQuest(save, q.id) ? 'complete-icon' : ''}`}>
                        <Icon name={hasQuest(save, q.id) ? 'check' : q.icon} size={21} />
                      </span>
                      <span className="quest-row-copy">
                        <strong>{q.title}</strong>
                        <span className="small muted">
                          {hasQuest(save, q.id)
                            ? 'Completed today'
                            : q.station
                              ? STATIONS[q.station].name
                              : 'Collect 5 seeds'}
                        </span>
                      </span>
                      <span className="quest-xp">
                        +{xpFor[q.id]}
                        <span>XP</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="tracked-quest">
                  <Icon name="flag" size={16} />
                  <p>{questList.find((q) => q.id === tracked)?.description}</p>
                </div>
                <button className="text-button journal-link" onClick={() => go('missions')}>
                  Open quest journal <Icon name="arrow" size={17} />
                </button>
              </section>
              <section className="daily-panel">
                <span className="daily-icon">
                  <Icon name="sun" size={25} />
                </span>
                <div>
                  <h3>A balanced little day</h3>
                  <p>Finish a forage and one chain quest.</p>
                  <div className="daily-bottom">
                    <span className="small">Daily challenge · +50 XP</span>
                    {hasQuest(save, 'daily') ? (
                      <span className="daily-done">
                        <Icon name="check" size={16} />
                        Done
                      </span>
                    ) : (
                      <button
                        className="text-button"
                        disabled={!dailyReady}
                        onClick={() => claim('daily', 'Daily forage and chain discovery completed')}
                      >
                        {dailyReady ? 'Claim XP' : 'In progress'}
                        {dailyReady && <Icon name="arrow" size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              </section>
              <div className="player-progress">
                <span className="small">
                  Level {level(save)} · {level(save) < 3 ? 'Valley explorer' : 'Seasoned explorer'}
                </span>
                <strong>{totalXp(save) % 400} / 400 XP</strong>
                <progress max={400} value={totalXp(save) % 400} />
                <span className="small muted">XP and progress are saved on this device.</span>
              </div>
            </aside>
          </div>
          <div className="section-title live-section-heading">
            <h2>Meanwhile, on SqueekChain</h2>
            <button
              className="text-button"
              onClick={() => void refresh()}
              disabled={Object.values(chain).some((x) => x.loading)}
            >
              <Icon name="refresh" size={15} />
              Refresh data
            </button>
          </div>
          <Dashboard chain={chain} go={(t) => go('explorer', t as ExplorerTab)} />
          <div className="chain-footnote">
            <span>
              <Icon name="shield" size={14} />
              Official API · 12-block confirmation delay
            </span>
            <a
              className="inline-link"
              href="#explorer/overview"
              onClick={() => go('explorer', 'overview')}
            >
              See sources & status <Icon name="arrow" size={15} />
            </a>
          </div>
        </div>
        {view === 'missions' && (
          <>
            <div className="journal-overview">
              <div>
                <Icon name="book" size={28} />
                <strong>{completed} of 4 quests complete</strong>
                <span className="muted">{questDate} · UTC</span>
              </div>
              <p>
                Quests award local game XP once a day. No SQK, NFT, or blockchain transaction is
                created.
              </p>
            </div>
            <div className="mission-grid">
              {questList.map((q, i) => (
                <article
                  className={`mission-card ${hasQuest(save, q.id) ? 'is-complete' : ''}`}
                  key={q.id}
                >
                  <div className="mission-card-heading">
                    <span className="quest-icon">
                      <Icon name={q.icon} size={27} />
                    </span>
                    <span className="quest-xp">+{xpFor[q.id]} XP</span>
                  </div>
                  <h2>{q.title}</h2>
                  <p>{q.description}</p>
                  <ol>
                    {q.id === 'forage' ? (
                      <>
                        <li>Start an adventure in Squeek valley.</li>
                        <li>Collect at least five sunflower seeds.</li>
                        <li>Return to the burrow to save your run.</li>
                      </>
                    ) : (
                      <>
                        <li>
                          Start an adventure and visit{' '}
                          {q.station ? STATIONS[q.station].name : 'a station'}.
                        </li>
                        <li>
                          {q.id === 'squeek-friend'
                            ? 'Look up a Squeek ID from the official API.'
                            : 'Inspect a validated, safe blockchain record.'}
                        </li>
                        <li>Log the evidence to complete the quest.</li>
                      </>
                    )}
                  </ol>
                  <div className="mission-card-footer">
                    <span className="small muted">
                      {q.id === 'forage' ? 'Play quest' : 'Chain discovery quest'}
                    </span>
                    {hasQuest(save, q.id) ? (
                      <span className="status-tag">
                        <Icon name="check" size={14} />
                        Completed
                      </span>
                    ) : (
                      <button
                        className={i === 0 ? 'button primary' : 'button secondary'}
                        onClick={() => track(q.id)}
                      >
                        Track quest <Icon name="arrow" size={16} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <section className="achievements-section">
              <div className="section-title">
                <h2>A few proud little moments</h2>
                <span className="small muted">
                  {earned.filter((a) => a.earned).length} of {earned.length} achievements
                </span>
              </div>
              <div className="achievement-list">
                {earned.map((a) => (
                  <div className={`achievement ${a.earned ? 'earned' : ''}`} key={a.id}>
                    <span className="achievement-icon">
                      <Icon name={a.icon} size={25} />
                    </span>
                    <div>
                      <strong>{a.name}</strong>
                      <p>{a.description}</p>
                    </div>
                    <span className="small muted">{a.earned ? 'Unlocked' : 'Locked'}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="evidence-section">
              <h2>Discovery log</h2>
              <p className="muted">
                Your completed quests and the evidence behind them. Saved on this device.
              </p>
              {save.receipts.length ? (
                <div className="receipt-list">
                  {[...save.receipts]
                    .reverse()
                    .slice(0, 30)
                    .map((r) => (
                      <details key={r.date + r.quest}>
                        <summary>
                          <span>
                            {questList.find((q) => q.id === r.quest)?.title ??
                              'A balanced little day'}
                          </span>
                          <span className="small muted">
                            {r.date} · +{xpFor[r.quest]} XP
                          </span>
                        </summary>
                        <p className="receipt-evidence">{r.evidence}</p>
                      </details>
                    ))}
                </div>
              ) : (
                <Empty
                  icon="book"
                  title="Your story starts in the valley"
                  text="Complete a quest to add your first entry."
                  action={
                    <button className="button secondary" onClick={() => go('adventure')}>
                      Explore the valley <Icon name="arrow" size={17} />
                    </button>
                  }
                />
              )}
            </section>
          </>
        )}
        {view === 'explorer' && (
          <>
            <div className="explorer-toolbar">
              <span className="small muted">Sepolia testnet · Read-only exploration</span>
              <button
                className="button secondary"
                onClick={() => void refresh()}
                disabled={Object.values(chain).some((x) => x.loading)}
              >
                <Icon name="refresh" size={16} />
                {Object.values(chain).some((x) => x.loading) ? 'Refreshing…' : 'Refresh data'}
              </button>
            </div>
            <Explorer
              chain={chain}
              tab={explorerTab}
              setTab={(t) => go('explorer', t)}
              refresh={refresh}
              inspectSettlement={(record) => setModal({ type: 'settlement', record })}
              inspectEvent={(record) => setModal({ type: 'event', record })}
            />
          </>
        )}
        {view === 'leaderboard' && (
          <Leaderboard
            save={save}
            go={() => go('adventure')}
            edit={() => setModal({ type: 'profile' })}
          />
        )}
        <div className="sr-only" role="status">
          {announcement}
        </div>
        <div className={`announcement ${announcement ? 'visible' : ''}`}>
          {announcement && (
            <>
              <Icon name="check" size={18} />
              <span>{announcement}</span>
              <button
                className="icon-button"
                onClick={() => setAnnouncement('')}
                aria-label="Dismiss update"
              >
                <Icon name="close" size={16} />
              </button>
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          <Icon name="leaf" size={17} />
          Made for curious paws.
        </span>
        <span className="footer-disclaimer">Independent community project · Sepolia testnet</span>
        <div>
          <a href="https://squeekchain.com/" target="_blank" rel="noreferrer">
            SqueekChain <Icon name="external" size={13} />
          </a>
          <a href="https://docs.squeekchain.com/" target="_blank" rel="noreferrer">
            Documentation <Icon name="external" size={13} />
          </a>
        </div>
      </footer>
      {modal?.type === 'help' && (
        <Dialog title="A little guide to the valley" onClose={() => setModal(null)}>
          <div className="help-intro">
            <span className="help-hamster">
              <Hamster />
            </span>
            <p>
              You&apos;re a curious hamster in a valley with a real connection to SqueekChain.
              Explore at your own pace.
            </p>
          </div>
          <ol className="help-steps">
            <li>
              <strong>Fill your cheeks.</strong>
              <span>
                Start an adventure, collect 5 seeds, then return to the burrow. Click a seed to walk
                to it, use arrow keys or WASD, or use the touch direction buttons.
              </span>
            </li>
            <li>
              <strong>Follow your curiosity.</strong>
              <span>
                Select a station to walk there. At Wheel works, the Signal station, and Squeek
                grove, inspect real API records and log a discovery.
              </span>
            </li>
            <li>
              <strong>Grow as an explorer.</strong>
              <span>
                Finish quests for local XP and achievements. Quests reset at 00:00 UTC. Every 400 XP
                adds a level.
              </span>
            </li>
          </ol>
          <div className="info-block">
            <Icon name="shield" />
            <p>
              No wallet or funds needed. Game seeds and XP have no monetary value. All progress and
              leaderboard runs stay in this browser; they are not shared or secured on-chain.
            </p>
          </div>
          <button className="button primary" onClick={() => setModal(null)}>
            Back to exploring <Icon name="arrow" size={17} />
          </button>
        </Dialog>
      )}
      {modal?.type === 'profile' && (
        <Profile
          save={save}
          onClose={() => setModal(null)}
          onSave={(name) => {
            setSave((s) => ({ ...s, name }));
            setAnnouncement('Explorer name saved on this device.');
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'station' && (
        <Dialog title={STATIONS[modal.station].name} onClose={() => setModal(null)} wide>
          {modal.station === 'blocks' && (
            <>
              <p className="dialog-lead">
                Follow the wheel&apos;s work into a settled Squeek block. Log a real settlement to
                complete your discovery.
              </p>
              <Notice resource={chain.settlements} onRetry={() => void refresh(['settlements'])} />
              {chain.settlements.data?.recentSettlements[0] ? (
                <>
                  <SettlementDetail record={chain.settlements.data.recentSettlements[0]} />
                  <Source
                    path={paths.settlements}
                    checkedAt={chain.settlements.checkedAt}
                    safeBlock={chain.settlements.data.chain.safeThroughBlock}
                  />
                  <button
                    className="button primary claim-button"
                    disabled={!healthy('settlements') || hasQuest(save, 'block-scout')}
                    onClick={() => claimSettlement(chain.settlements.data!.recentSettlements[0])}
                  >
                    {hasQuest(save, 'block-scout') ? 'Logged for today' : 'Log discovery · +120 XP'}
                    <Icon name="check" size={17} />
                  </button>
                </>
              ) : (
                !chain.settlements.loading &&
                !chain.settlements.error && (
                  <Empty
                    icon="cube"
                    title="Waiting for settled work"
                    text="No completed Squeek blocks in this 24-hour response. Check back after the wheel runs."
                  />
                )
              )}
            </>
          )}
          {modal.station === 'events' && (
            <>
              <p className="dialog-lead">
                The valley is full of signals. Choose a real, safe event and inspect the record
                behind it.
              </p>
              <Notice resource={chain.events} onRetry={() => void refresh(['events'])} />
              <div className="event-list station-events">
                {chain.events.data?.events.slice(0, 5).map((e) => (
                  <button
                    className="event-row"
                    key={e.id}
                    onClick={() => setModal({ type: 'event', record: e })}
                  >
                    <span className="row-icon">
                      <Icon name="radio" />
                    </span>
                    <span className="event-row-main">
                      <strong>{e.type.replaceAll('_', ' ').replace('.', ' · ')}</strong>
                      <span className="small muted">
                        Ethereum block #{formatUint(e.source.blockNumber)}
                      </span>
                    </span>
                    <Icon name="chevron" size={17} />
                  </button>
                ))}
              </div>
              {chain.events.data && !chain.events.data.events.length && (
                <Empty
                  icon="radio"
                  title="No safe events in this response"
                  text="Refresh later to discover new SqueekChain activity."
                />
              )}
              <Source
                path={paths.events}
                checkedAt={chain.events.checkedAt}
                safeBlock={chain.events.data?.chain.safeThroughBlock}
              />
            </>
          )}
          {modal.station === 'nft' && (
            <>
              <p className="dialog-lead">
                Meet a real Genesis NFT. Choose an ID, inspect its identity, then log your new
                friend.
              </p>
              <NftLookup onObserve={hasQuest(save, 'squeek-friend') ? undefined : observeNft} />
              {hasQuest(save, 'squeek-friend') && (
                <p className="status-tag">
                  <Icon name="check" size={15} />
                  Squeek friend quest completed today.
                </p>
              )}
            </>
          )}
        </Dialog>
      )}
      {modal?.type === 'settlement' && (
        <Dialog title="A block discovery" onClose={() => setModal(null)} wide>
          <SettlementDetail record={modal.record} />
          {visited.includes('blocks') ? (
            <button
              className="button primary claim-button"
              onClick={() => claimSettlement(modal.record)}
              disabled={!healthy('settlements') || hasQuest(save, 'block-scout')}
            >
              {hasQuest(save, 'block-scout') ? 'Logged for today' : 'Log discovery · +120 XP'}
              <Icon name="check" size={17} />
            </button>
          ) : (
            <p className="info-block">
              <Icon name="compass" />
              Visit Wheel works in the adventure to log this discovery as a quest.
            </p>
          )}
        </Dialog>
      )}
      {modal?.type === 'event' && (
        <Dialog title="A signal worth following" onClose={() => setModal(null)} wide>
          <EventDetail event={modal.record} />
          {visited.includes('events') ? (
            <button
              className="button primary claim-button"
              onClick={() => claimEvent(modal.record)}
              disabled={!healthy('events') || hasQuest(save, 'signal-hunter')}
            >
              {hasQuest(save, 'signal-hunter') ? 'Logged for today' : 'Log discovery · +150 XP'}
              <Icon name="check" size={17} />
            </button>
          ) : (
            <p className="info-block">
              <Icon name="compass" />
              Visit the Signal station in the adventure to log this event as a quest.
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}

function Profile({
  save,
  onSave,
  onClose,
}: {
  save: Save;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(save.name);
  const [error, setError] = useState('');
  return (
    <Dialog title="Your explorer profile" onClose={onClose}>
      <div className="profile-summary">
        <Hamster />
        <div>
          <h3>{save.name}</h3>
          <p>
            Level {level(save)} · {totalXp(save)} local XP
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n || n.length > 24) {
            setError('Choose a name between 1 and 24 characters.');
            (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus();
            return;
          }
          onSave(n);
        }}
      >
        <label className="form-label" htmlFor="explorer-name">
          Explorer name
        </label>
        <input
          id="explorer-name"
          name="nickname"
          autoComplete="nickname"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'name-error' : 'name-hint'}
        />
        {error && (
          <p className="error-text" id="name-error" role="alert">
            {error}
          </p>
        )}
        <p id="name-hint" className="small muted">
          Stored only in this browser. You can change it any time.
        </p>
        <button className="button primary" type="submit">
          Save explorer name <Icon name="check" size={17} />
        </button>
      </form>
    </Dialog>
  );
}
function Leaderboard({ save, go, edit }: { save: Save; go: () => void; edit: () => void }) {
  const [sort, setSort] = useState('fastest');
  const runs = [...save.runs].sort((a, b) =>
    sort === 'fastest'
      ? a.seconds - b.seconds || b.seeds - a.seeds
      : Date.parse(b.date) - Date.parse(a.date),
  );
  function download() {
    const b = new Blob(
      [
        JSON.stringify(
          {
            game: 'SqueekQuest',
            scope: 'This device only',
            exportedAt: new Date().toISOString(),
            ...save,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'squeekquest-progress.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  return (
    <section className="leaderboard-section">
      <div className="leaderboard-banner">
        <span className="trophy-art">
          <Icon name="trophy" size={44} />
        </span>
        <div>
          <h2>Little legends, local to you.</h2>
          <p>
            This leaderboard ranks your completed runs on this device. There is no shared or global
            ranking.
          </p>
        </div>
        <button className="button secondary" onClick={edit}>
          <Icon name="edit" size={16} />
          Edit name
        </button>
      </div>
      <div className="filter-row">
        <label className="select-field">
          <span>Sort runs</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="fastest">Fastest first</option>
            <option value="recent">Most recent</option>
          </select>
        </label>
        <button className="text-button" onClick={download}>
          <Icon name="download" size={17} />
          Export progress
        </button>
      </div>
      {runs.length ? (
        <div className="leaderboard-table">
          <div className="leaderboard-head">
            <span>Rank</span>
            <span>Explorer</span>
            <span>Seeds</span>
            <span>Time</span>
            <span>Completed</span>
          </div>
          {runs.map((r, i) => (
            <div className="leaderboard-row" key={r.id}>
              <span className={i === 0 ? 'rank-first' : ''}>
                {i === 0 ? <Icon name="trophy" size={19} /> : i + 1}
              </span>
              <strong>{r.name}</strong>
              <span>{r.seeds}</span>
              <span>{r.seconds}s</span>
              <span className="small muted">{new Date(r.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon="trophy"
          title="Your first adventure belongs here"
          text="Finish a foraging run to set a record. Find five seeds and return to the burrow."
          action={
            <button className="button primary" onClick={go}>
              Start exploring <Icon name="arrow" size={17} />
            </button>
          }
        />
      )}
      <p className="small muted">
        Up to 50 completed runs are saved. Daily foraging XP is awarded once per UTC day; replaying
        improves your run records.
      </p>
    </section>
  );
}
