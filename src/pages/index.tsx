import Head from 'next/head';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../components/dialog';
import { GameMap } from '../components/game-map';
import { Hamster, Icon } from '../components/icons';
import { ItemIcon } from '../components/item-icon';
import { SurvivalMap } from '../components/survival-map';
import { STORAGE_KEY } from '../lib/game';
import {
  AREA_HINTS,
  AREA_NAMES,
  BUILDINGS,
  BURROW,
  DAILY_QUESTS,
  ITEMS,
  RECIPES,
  SAVE_KEY,
  WORLDS,
  afford,
  bagCount,
  build,
  capacity,
  claimQuest,
  consume,
  craft,
  discard,
  distance,
  gather,
  harvest,
  maxHealth,
  maxStamina,
  migrateLegacy,
  nearestNode,
  newGame,
  playerLevel,
  readSave,
  recordRun,
  rest,
  rollDaily,
  survivalAchievements,
  travel,
  type Area,
  type Building,
  type Cost,
  type Item,
  type Result,
  type SurvivalSave,
  type Vec,
} from '../lib/survival';

type Panel =
  | 'inventory'
  | 'crafting'
  | 'building'
  | 'quests'
  | 'map'
  | 'help'
  | 'profile'
  | 'minigame'
  | 'new-game'
  | null;
const PANEL_NAMES: Record<NonNullable<Panel>, string> = {
  inventory: 'Your satchel',
  crafting: 'Crafting bench',
  building: 'Home at the burrow',
  quests: 'Quest journal',
  map: 'The wider world',
  help: 'A field guide for little paws',
  profile: 'Explorer profile',
  minigame: 'Sunflower scramble',
  'new-game': 'Start a new adventure?',
};
const MENU = [
  { id: 'inventory', name: 'Inventory', key: 'I', icon: 'bag' },
  { id: 'crafting', name: 'Crafting', key: 'C', icon: 'hammer' },
  { id: 'building', name: 'Build', key: 'B', icon: 'home' },
  { id: 'quests', name: 'Quests', key: 'J', icon: 'book' },
  { id: 'map', name: 'Map', key: 'M', icon: 'compass' },
] as const;

function CostLine({ cost, save }: { cost: Cost; save: SurvivalSave }) {
  return (
    <div className="cost-line">
      {Object.entries(cost).map(([key, qty]) => (
        <span
          key={key}
          className={save.inventory[key as Item] < qty ? 'cost-missing' : 'cost-ready'}
        >
          <ItemIcon item={key as Item} size={19} />
          <span>
            {save.inventory[key as Item]} / {qty} {ITEMS[key as Item].name.toLowerCase()}
          </span>
        </span>
      ))}
    </div>
  );
}
function Meter({
  label,
  value,
  max,
  kind,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  kind: string;
  icon: string;
}) {
  return (
    <div className={`sq-meter ${kind}`}>
      <div>
        <span>
          <Icon name={icon} size={16} />
          {label}
        </span>
        <strong>
          {Math.ceil(value)}
          <span> / {max}</span>
        </strong>
      </div>
      <meter min={0} max={max} value={value} aria-label={label} />
    </div>
  );
}
function PanelNote({ children }: { children: ReactNode }) {
  return <p className="panel-note">{children}</p>;
}

export default function Home() {
  const stateRef = useRef<SurvivalSave>(newGame());
  const [save, setSave] = useState<SurvivalSave>(stateRef.current);
  const [nameDraft, setNameDraft] = useState(stateRef.current.name);
  useEffect(() => setNameDraft(save.name), [save.name]);
  const [loaded, setLoaded] = useState(false),
    [hasSave, setHasSave] = useState(false),
    [storageError, setStorageError] = useState('');
  const [mode, setMode] = useState<'menu' | 'playing' | 'paused'>('menu');
  const [panel, setPanel] = useState<Panel>(null),
    [message, setMessage] = useState('Your little corner of the wild awaits.');
  const [selectedItem, setSelectedItem] = useState<Item>('berry'),
    [inventoryFilter, setInventoryFilter] = useState('all');
  const [navigateTo, setNavigateTo] = useState<Vec | null>(null),
    [savingLabel, setSavingLabel] = useState('Saved on this device');
  const [miniNote, setMiniNote] = useState('Collect 5 seeds, then bring them home.'),
    [miniKey, setMiniKey] = useState(0);
  const audio = useRef<AudioContext | null>(null),
    started = useRef(false),
    saveEnabled = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const snapshot = useCallback(() => setSave({ ...stateRef.current }), []);
  const persist = useCallback(() => {
    if (!saveEnabled.current) return;
    try {
      const current = { ...rollDaily(stateRef.current), savedAt: new Date().toISOString() };
      stateRef.current = current;
      localStorage.setItem(SAVE_KEY, JSON.stringify(current));
      setHasSave(true);
      setStorageError('');
      setSavingLabel('Saved on this device');
    } catch {
      setStorageError(
        'Storage is unavailable or full. Keep this page open and export your save to keep your progress.',
      );
      setSavingLabel('Save unavailable');
    }
  }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY),
        stored = readSave(raw);
      const migrated = stored ?? (!raw ? migrateLegacy(localStorage.getItem(STORAGE_KEY)) : null);
      if (migrated) {
        stateRef.current = migrated;
        setSave(migrated);
        setHasSave(true);
        saveEnabled.current = true;
        document.documentElement.dataset.theme = migrated.theme;
        if (!stored)
          setMessage('Your previous profile, XP and foraging records are ready to continue.');
      } else if (raw)
        setStorageError(
          'This save could not be read. Export it before starting again, or import a valid SqueekQuest save.',
        );
    } catch {
      setStorageError(
        'Browser storage is unavailable. Export your save before leaving to keep your progress.',
      );
    }
    setLoaded(true);
    const timer = setInterval(() => {
      if (saveEnabled.current) {
        const rolled = rollDaily(stateRef.current);
        if (rolled !== stateRef.current) {
          stateRef.current = rolled;
          setSave(rolled);
        }
        persist();
      }
    }, 5000);
    const hide = () => {
      if (document.hidden) {
        setMode((m) => (m === 'playing' ? 'paused' : m));
        persist();
      }
    };
    const leave = () => persist();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    };
  }, [persist]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('theme-changing');
    root.dataset.theme = save.theme;
    void root.offsetHeight;
    const f = requestAnimationFrame(() => root.classList.remove('theme-changing'));
    return () => cancelAnimationFrame(f);
  }, [save.theme]);
  useEffect(() => {
    if (panel || mode !== 'playing') persist();
  }, [panel, mode, persist]);
  const sound = useCallback(() => {
    if (!stateRef.current.sound || !audio.current) return;
    try {
      const ctx = audio.current,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      /* Optional audio never blocks play. */
    }
  }, []);
  function wakeAudio() {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume().catch(() => setMessage('Sound is unavailable in this browser.'));
    } catch {
      setMessage('Sound is unavailable in this browser.');
    }
  }
  const apply = useCallback(
    (r: Result) => {
      stateRef.current = r.save;
      setSave({ ...r.save });
      if (r.message) setMessage(r.message);
      if (r.success) sound();
    },
    [sound],
  );
  function act(fn: (s: SurvivalSave) => Result) {
    apply(fn(stateRef.current));
    persist();
  }
  function setSetting(patch: Partial<SurvivalSave>) {
    stateRef.current = { ...stateRef.current, ...patch };
    snapshot();
    if (saveEnabled.current) persist();
  }
  function open(p: NonNullable<Panel>) {
    setPanel(p);
  }
  function focusWorld() {
    setTimeout(() => document.querySelector<HTMLCanvasElement>('.survival-canvas')?.focus(), 0);
  }
  function close() {
    setPanel(null);
  }
  function start(fresh = false) {
    if (fresh) {
      const current = stateRef.current;
      stateRef.current = { ...newGame(current.name), sound: current.sound, theme: current.theme };
      snapshot();
      setNavigateTo(null);
    }
    started.current = true;
    saveEnabled.current = true;
    setHasSave(true);
    setMode('playing');
    setPanel(null);
    setMessage(
      fresh || !hasSave
        ? 'Gather wood, stone and fiber near the burrow. An axe is a good first craft.'
        : 'Welcome back. Your adventure is right where you left it.',
    );
    if (stateRef.current.sound) wakeAudio();
    persist();
    focusWorld();
  }
  function interact() {
    const s = stateRef.current,
      e = WORLDS[s.area].exits.find((e) => distance(s.position, e) < 65);
    if (e) {
      apply(travel(s, e));
      persist();
      return;
    }
    const n = nearestNode(s);
    if (n && distance(s.position, n) < 58) {
      act((s) => gather(s, n.id));
      return;
    }
    if (s.area === 'forest' && distance(s.position, BURROW) < 115) {
      open('building');
      return;
    }
    setMessage('Walk beside a tree, rock or plant. Press E or select it to gather.');
  }
  function exportSave() {
    const data = saveEnabled.current ? stateRef.current : null;
    if (!data) {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(SAVE_KEY);
      } catch {
        /* Storage may be denied. */
      }
      if (raw) {
        download(raw, 'squeekquest-unreadable-save.json');
        return;
      }
      setMessage('Start an adventure to create a save first.');
      return;
    }
    download(
      JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2),
      'squeekquest-save.json',
    );
    setMessage('Save exported. Keep the file to restore your adventure.');
  }
  function download(text: string, name: string) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importSave(file?: File) {
    if (!file) return;
    if (file.size > 250000) {
      setMessage('Choose a SqueekQuest JSON save smaller than 250 KB.');
      return;
    }
    try {
      const text = await file.text(),
        s = readSave(text) ?? migrateLegacy(text);
      if (!s) {
        setMessage('This file is not a valid SqueekQuest save. Your current progress is safe.');
        return;
      }
      stateRef.current = s;
      snapshot();
      saveEnabled.current = true;
      setHasSave(true);
      setMode('paused');
      persist();
      setMessage('Adventure imported. Continue when you are ready.');
    } catch {
      setMessage('Could not read that file. Choose a SqueekQuest JSON save.');
    }
    if (importRef.current) importRef.current.value = '';
  }
  const earned = survivalAchievements(save),
    currentLevel = playerLevel(save),
    atHome = save.area === 'forest' && distance(save.position, BURROW) < 170;
  const running = mode === 'playing' && !panel;
  const firstQuest =
    DAILY_QUESTS.find((q) => !save.daily.claimed.includes(q.id)) ?? DAILY_QUESTS[0];
  const allItems = (Object.keys(ITEMS) as Item[]).filter(
    (i) =>
      inventoryFilter === 'all' ||
      (inventoryFilter === 'supplies'
        ? ['berry', 'bandage', 'mix'].includes(i)
        : !['berry', 'bandage', 'mix'].includes(i)),
  );
  const ownedTools = (['axe', 'pickaxe', 'backpack'] as const).filter((k) => save.tools[k]);
  return (
    <div className="quest-app">
      <Head>
        <title>SqueekQuest | Small paws. Wild world.</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <a className="skip-link" href="#main">
        Skip to adventure
      </a>
      <header className="sq-header">
        <div className="sq-header-inner">
          <a
            href="#adventure"
            className="sq-brand"
            onClick={(e) => {
              e.preventDefault();
              setPanel(null);
              setMode(started.current ? 'paused' : 'menu');
            }}
            aria-label="SqueekQuest home"
          >
            <span className="sq-brand-mark">
              <Hamster face />
            </span>
            <span>
              Squeek<span>Quest</span>
              <i>.</i>
            </span>
          </a>
          <span className="sq-header-caption">A little life in the wild.</span>
          <div className="sq-utilities">
            <button
              className="sq-icon-button"
              aria-label="How to play"
              title="How to play"
              onClick={() => open('help')}
            >
              <Icon name="help" />
            </button>
            <button
              className="sq-icon-button"
              aria-label="Game sound"
              aria-pressed={save.sound}
              title={save.sound ? 'Mute sound' : 'Enable sound'}
              onClick={() => {
                if (!save.sound) wakeAudio();
                setSetting({ sound: !save.sound });
              }}
            >
              <Icon name={save.sound ? 'sound' : 'mute'} />
            </button>
            <button
              className="sq-icon-button"
              aria-label={save.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title="Change theme"
              onClick={() => setSetting({ theme: save.theme === 'light' ? 'dark' : 'light' })}
            >
              <Icon name={save.theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button
              className="sq-profile"
              onClick={() => open('profile')}
              aria-label={`Explorer profile, level ${currentLevel}`}
            >
              <Hamster face />
              <span>Level {currentLevel}</span>
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </div>
      </header>
      <main className="sq-page" id="main" tabIndex={-1}>
        <div className="sq-intro">
          <div>
            <h1>Small paws. Wild world.</h1>
            <p>A hamster survival adventure. Make yourself at home.</p>
          </div>
          <span className={`sq-save-state ${storageError ? 'save-error' : ''}`}>
            <Icon name={storageError ? 'help' : 'check'} size={16} />
            {storageError
              ? 'Export to keep progress'
              : hasSave
                ? savingLabel
                : 'An adventure of your own'}
          </span>
        </div>
        {storageError && (
          <div className="sq-warning" role="status">
            <p>{storageError}</p>
            <button className="sq-button" onClick={exportSave}>
              Export save
            </button>
          </div>
        )}
        <div className="adventure-layout">
          <section className="adventure-main" aria-label="Survival adventure">
            <div className="survival-hud">
              <Meter
                label="Health"
                value={save.health}
                max={maxHealth(save)}
                kind="health"
                icon="heart"
              />
              <Meter
                label="Stamina"
                value={save.stamina}
                max={maxStamina(save)}
                kind="stamina"
                icon="bolt"
              />
              <div className="sq-xp">
                <span>
                  <Icon name="star" size={16} />
                  Level {currentLevel}
                </span>
                <strong>{save.xp % 250} / 250 XP</strong>
                <progress max={250} value={save.xp % 250} aria-label="XP to next level" />
              </div>
              <button
                className="sq-icon-button pause-control"
                aria-label={mode === 'playing' ? 'Pause adventure' : 'Open adventure menu'}
                title={mode === 'playing' ? 'Pause' : 'Adventure menu'}
                onClick={() => setMode((m) => (m === 'playing' ? 'paused' : 'menu'))}
              >
                <Icon name={mode === 'playing' ? 'pause' : 'home'} />
              </button>
            </div>
            <div className="sq-world">
              <SurvivalMap
                stateRef={stateRef}
                running={running}
                onSnapshot={snapshot}
                onResult={apply}
                onPause={() => setMode('paused')}
                onPanel={open}
                onInteract={interact}
                navigateTo={navigateTo}
              />
              {mode !== 'playing' && (
                <div className="adventure-overlay">
                  <div className="adventure-menu">
                    <div className="menu-hamster">
                      <Hamster />
                    </div>
                    <h2>
                      {mode === 'paused'
                        ? 'A little breather.'
                        : hasSave
                          ? 'Your burrow is waiting.'
                          : 'A small adventure awaits.'}
                    </h2>
                    <p>
                      {mode === 'paused'
                        ? 'Your progress is safe. The wild can wait.'
                        : 'Explore. Gather. Build a place to belong.'}
                    </p>
                    <button
                      className="sq-button sq-primary sq-start"
                      disabled={!loaded}
                      onClick={() => start(false)}
                    >
                      <Icon name="play" size={17} />
                      {!loaded
                        ? 'Loading save…'
                        : hasSave
                          ? 'Continue adventure'
                          : 'Start adventure'}
                      <Icon name="arrow" size={17} />
                    </button>
                    {hasSave && (
                      <button className="sq-menu-link" onClick={() => open('new-game')}>
                        New game
                      </button>
                    )}
                    <span className="menu-save-hint">
                      {hasSave
                        ? `${save.name} · ${AREA_NAMES[save.area]} · Level ${currentLevel}`
                        : 'Saved in your browser · Play at your pace'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <nav className="sq-toolbar" aria-label="Adventure panels">
              {MENU.map((m) => (
                <button
                  key={m.id}
                  onClick={() => open(m.id)}
                  aria-label={`Open ${m.name.toLowerCase()}`}
                >
                  <Icon name={m.icon} size={19} />
                  <span>{m.name}</span>
                  <kbd>{m.key}</kbd>
                </button>
              ))}
            </nav>
            <div className="sq-game-footer">
              <p>
                <span className="desktop-directions">
                  <kbd>W</kbd>
                  <kbd>A</kbd>
                  <kbd>S</kbd>
                  <kbd>D</kbd> move <span>·</span> <kbd>Shift</kbd> sprint <span>·</span>{' '}
                </span>
                Select the ground to walk.
              </p>
              <button onClick={() => open('help')} className="sq-text-button">
                Field guide <Icon name="arrow" size={14} />
              </button>
            </div>
            <p className="adventure-message" role="status">
              <Icon name="leaf" size={17} />
              <span>{message}</span>
            </p>
          </section>
          <aside className="adventure-sidebar" aria-label="Adventure overview">
            <section className="sq-sidebar-section next-step">
              <div className="sidebar-title">
                <Icon name="flag" size={19} />
                <h2>Your next little step</h2>
              </div>
              <h3>
                {!save.tools.axe
                  ? 'Tools make light work.'
                  : !save.buildings.shelter
                    ? 'A place to call home.'
                    : save.visited.length < 3
                      ? 'Follow the trail.'
                      : 'Make your burrow thrive.'}
              </h3>
              <p>
                {!save.tools.axe
                  ? 'Gather wood, stone and fiber, then craft your first axe.'
                  : !save.buildings.shelter
                    ? 'Build a shelter in the forest clearing to rest and recover.'
                    : save.visited.length < 3
                      ? 'The path east leads to an abandoned village. The wilderness lies north of it.'
                      : 'Upgrade your structures, find hidden caches, and finish your daily quests.'}
              </p>
              <button
                className="sq-button"
                onClick={() =>
                  open(!save.tools.axe ? 'crafting' : !save.buildings.shelter ? 'building' : 'map')
                }
              >
                {!save.tools.axe
                  ? 'See the axe recipe'
                  : !save.buildings.shelter
                    ? 'Plan your shelter'
                    : 'Open world map'}
                <Icon name="arrow" size={15} />
              </button>
            </section>
            <section className="sq-sidebar-section">
              <div className="sidebar-title">
                <Icon name="bag" size={19} />
                <h2>In your satchel</h2>
                <span>
                  {bagCount(save)} / {capacity(save)}
                </span>
              </div>
              <div className="satchel-preview">
                {(['wood', 'stone', 'fiber', 'berry', 'seed', 'ore'] as const).map((i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedItem(i);
                      open('inventory');
                    }}
                    aria-label={`${ITEMS[i].name}, ${save.inventory[i]}. Open inventory.`}
                  >
                    <ItemIcon item={i} />
                    <strong>{save.inventory[i]}</strong>
                    <span>{ITEMS[i].name}</span>
                  </button>
                ))}
              </div>
              <button className="sq-text-button" onClick={() => open('inventory')}>
                Manage inventory
                <Icon name="arrow" size={14} />
              </button>
            </section>
            <section className="sq-sidebar-section daily-preview">
              <div className="sidebar-title">
                <Icon name="book" size={19} />
                <h2>A daily discovery</h2>
                <span>{save.daily.claimed.length} / 3</span>
              </div>
              <h3>{firstQuest.name}</h3>
              <p>{firstQuest.detail}</p>
              <div className="quest-progress-row">
                <progress
                  max={firstQuest.target}
                  value={Math.min(save.daily[firstQuest.field], firstQuest.target)}
                  aria-label={firstQuest.name}
                />
                <span>
                  {Math.min(save.daily[firstQuest.field], firstQuest.target)} / {firstQuest.target}
                </span>
              </div>
              <button className="sq-text-button" onClick={() => open('quests')}>
                Open quest journal
                <Icon name="arrow" size={14} />
              </button>
            </section>
            <section className="mini-teaser">
              <Icon name="seed" size={24} />
              <div>
                <h2>A pocketful of sunshine</h2>
                <p>A little seed-collecting detour.</p>
                <button
                  className="sq-text-button"
                  onClick={() => {
                    setMiniKey((k) => k + 1);
                    open('minigame');
                  }}
                >
                  Play Sunflower scramble
                  <Icon name="arrow" size={14} />
                </button>
              </div>
            </section>
          </aside>
        </div>
        <footer className="sq-footer">
          <span>
            <Icon name="home" size={15} />
            Made for small adventures. Progress stays in this browser.
          </span>
          <div>
            <button onClick={exportSave}>
              Export save
              <Icon name="download" size={14} />
            </button>
            <button onClick={() => open('profile')}>
              Settings
              <Icon name="chevron" size={14} />
            </button>
          </div>
        </footer>
      </main>
      {panel && (
        <Dialog
          title={PANEL_NAMES[panel]}
          onClose={close}
          wide={['inventory', 'crafting', 'building', 'quests', 'minigame', 'map'].includes(panel)}
        >
          <div className={`sq-panel panel-${panel}`}>
            {panel === 'inventory' && (
              <>
                <div className="panel-summary">
                  <p>Every little thing has a use.</p>
                  <span>
                    {bagCount(save)} / {capacity(save)} carried
                  </span>
                </div>
                <div className="sq-segmented" role="group" aria-label="Inventory filter">
                  {[
                    ['all', 'All items'],
                    ['materials', 'Materials'],
                    ['supplies', 'Supplies'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={inventoryFilter === id}
                      onClick={() => setInventoryFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="inventory-layout">
                  <div className="inventory-grid">
                    {allItems.map((i) => (
                      <button
                        key={i}
                        className={`inventory-slot ${selectedItem === i ? 'selected' : ''} ${!save.inventory[i] ? 'empty' : ''}`}
                        aria-pressed={selectedItem === i}
                        aria-label={`${ITEMS[i].name}, ${save.inventory[i]}`}
                        onClick={() => setSelectedItem(i)}
                      >
                        <ItemIcon item={i} size={36} />
                        <strong>{save.inventory[i]}</strong>
                        <span>{ITEMS[i].name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="item-detail">
                    <ItemIcon item={selectedItem} size={48} />
                    <h3>{ITEMS[selectedItem].name}</h3>
                    <p>{ITEMS[selectedItem].detail}</p>
                    <strong>{save.inventory[selectedItem]} in your satchel</strong>
                    <div className="item-actions">
                      {['berry', 'bandage', 'mix'].includes(selectedItem) && (
                        <button
                          className="sq-button sq-primary"
                          disabled={!save.inventory[selectedItem]}
                          onClick={() => act((s) => consume(s, selectedItem))}
                        >
                          {selectedItem === 'bandage'
                            ? 'Use bandage'
                            : selectedItem === 'berry'
                              ? 'Eat berries'
                              : 'Eat trail mix'}
                        </button>
                      )}
                      <button
                        className="sq-button"
                        disabled={!save.inventory[selectedItem]}
                        onClick={() => act((s) => discard(s, selectedItem))}
                      >
                        Drop one
                      </button>
                    </div>
                  </div>
                </div>
                <div className="tools-row">
                  <strong>Tools</strong>
                  {ownedTools.length ? (
                    ownedTools.map((k) => (
                      <span key={k}>
                        <ItemIcon item={k} size={23} />
                        {k === 'axe'
                          ? 'Woodland axe'
                          : k === 'pickaxe'
                            ? 'Stone pickaxe'
                            : 'Explorer pack'}
                        <Icon name="check" size={14} />
                      </span>
                    ))
                  ) : (
                    <span>Craft an axe or pickaxe to gather more.</span>
                  )}
                </div>
                <PanelNote>
                  Stacks combine automatically. Tools stay with you. Build a chest or craft a pack
                  for more space.
                </PanelNote>
              </>
            )}
            {panel === 'crafting' && (
              <>
                <PanelNote>
                  Craft tools once; they stay equipped. Recipes consume the materials shown. The
                  explorer pack needs the burrow workbench.
                </PanelNote>
                <div className="recipe-list">
                  {RECIPES.map((r) => {
                    const owned = 'tool' in r && r.tool ? save.tools[r.tool] : false;
                    const blocked = 'workbench' in r && r.workbench && !atHome;
                    return (
                      <article className="recipe-row" key={r.id}>
                        <span className="recipe-sprite">
                          <ItemIcon
                            item={r.id as Item | 'axe' | 'pickaxe' | 'backpack'}
                            size={36}
                          />
                        </span>
                        <div className="recipe-copy">
                          <h3>
                            {r.name}
                            {'amount' in r && (r.amount ?? 0) > 1 ? (
                              <span> ×{r.amount}</span>
                            ) : null}
                          </h3>
                          <p>{r.detail}</p>
                          <CostLine cost={r.cost} save={save} />
                          {blocked && <small>At the burrow workbench</small>}
                        </div>
                        <button
                          className={`sq-button ${!owned && afford(save, r.cost) && !blocked ? 'sq-primary' : ''}`}
                          disabled={!!owned || !afford(save, r.cost) || !!blocked}
                          onClick={() => act((s) => craft(s, r.id))}
                        >
                          {owned ? (
                            <>
                              <Icon name="check" size={15} />
                              Equipped
                            </>
                          ) : (
                            'Craft'
                          )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
            {panel === 'building' && (
              <>
                <div className="panel-summary">
                  <p>
                    {atHome
                      ? 'You are in the burrow clearing.'
                      : 'Build and upgrade in the forest burrow clearing.'}
                  </p>
                  <span>{Object.values(save.buildings).filter((v) => v > 0).length} / 4 built</span>
                </div>
                {!atHome && (
                  <button
                    className="sq-button"
                    onClick={() => {
                      setNavigateTo(
                        save.area === 'forest'
                          ? { x: BURROW.x + 70, y: BURROW.y + 40 }
                          : WORLDS[save.area].exits.find((e) => e.to !== 'wilderness')!,
                      );
                      close();
                      if (mode !== 'playing') setMode('playing');
                    }}
                  >
                    Walk toward home
                    <Icon name="arrow" size={16} />
                  </button>
                )}
                <div className="building-grid">
                  {(Object.keys(BUILDINGS) as Building[]).map((k) => {
                    const b = BUILDINGS[k],
                      lv = save.buildings[k];
                    return (
                      <article className="building-card" key={k}>
                        <div className="building-heading">
                          <Icon name={b.icon} size={26} />
                          <span>{lv ? `Level ${lv} / 3` : 'Not built'}</span>
                        </div>
                        <h3>{b.name}</h3>
                        <p>{b.detail[Math.max(0, lv - 1)]}</p>
                        {lv > 0 && lv < 3 && <p className="next-upgrade">Next: {b.detail[lv]}</p>}
                        {lv < 3 && <CostLine cost={b.costs[lv]} save={save} />}
                        <button
                          className="sq-button"
                          disabled={lv >= 3 || !atHome || !afford(save, b.costs[lv])}
                          onClick={() => act((s) => build(s, k))}
                        >
                          {lv >= 3 ? 'Fully upgraded' : lv ? 'Upgrade' : 'Build'}
                        </button>
                        {k === 'shelter' && lv > 0 && (
                          <button
                            className="sq-text-button"
                            disabled={!atHome}
                            onClick={() => act(rest)}
                          >
                            Rest and recover
                            <Icon name="moon" size={14} />
                          </button>
                        )}
                        {k === 'garden' && lv > 0 && (
                          <button
                            className="sq-text-button"
                            disabled={!atHome}
                            onClick={() => act(harvest)}
                          >
                            Harvest berries
                            <Icon name="leaf" size={14} />
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
                <PanelNote>
                  Built structures appear in the world. Chests expand your shared satchel; the
                  campfire heals within its clearing. Garden growth counts active adventure time.
                </PanelNote>
              </>
            )}
            {panel === 'quests' && (
              <>
                <div className="panel-summary">
                  <p>New little goals every day. Resets at 00:00 UTC.</p>
                  <span>{save.daily.date}</span>
                </div>
                <div className="journal-list">
                  {DAILY_QUESTS.map((q) => {
                    const claimed = save.daily.claimed.includes(q.id),
                      count = Math.min(save.daily[q.field], q.target);
                    return (
                      <article className="journal-quest" key={q.id}>
                        <span className="journal-icon">
                          <Icon
                            name={q.id === 'gather' ? 'leaf' : q.id === 'craft' ? 'hammer' : 'seed'}
                            size={24}
                          />
                        </span>
                        <div>
                          <h3>{q.name}</h3>
                          <p>{q.detail}</p>
                          <div className="quest-progress-row">
                            <progress max={q.target} value={count} aria-label={q.name} />
                            <span>
                              {count} / {q.target}
                            </span>
                          </div>
                        </div>
                        <div className="journal-reward">
                          <strong>+{q.xp} XP</strong>
                          {q.id === 'run' && count === 0 ? (
                            <button
                              className="sq-button"
                              onClick={() => {
                                setMiniKey((k) => k + 1);
                                open('minigame');
                              }}
                            >
                              Play
                            </button>
                          ) : (
                            <button
                              className="sq-button"
                              disabled={claimed || count < q.target}
                              onClick={() => act((s) => claimQuest(s, q.id))}
                            >
                              {claimed ? 'Claimed' : 'Claim XP'}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="section-divider">
                  <h3>Little milestones</h3>
                  <span>
                    {earned.filter((a) => a.earned).length} / {earned.length} unlocked
                  </span>
                </div>
                <div className="milestone-list">
                  {earned.map((a) => (
                    <div key={a.name} className={a.earned ? 'is-earned' : ''}>
                      <Icon name={a.earned ? 'check' : 'trophy'} size={22} />
                      <div>
                        <strong>{a.name}</strong>
                        <p>{a.detail}</p>
                      </div>
                      <span>{a.earned ? 'Unlocked' : 'Locked'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {panel === 'map' && (
              <>
                <PanelNote>
                  The forest trail leads east to the village. Follow the village trail north to the
                  wilderness. Walk to a marker and interact to cross.
                </PanelNote>
                <div className="world-map-cards">
                  {(['forest', 'village', 'wilderness'] as Area[]).map((a, i) => (
                    <article
                      key={a}
                      className={`area-card area-${a} ${a === save.area ? 'current-area' : ''}`}
                    >
                      <div className="area-pixel-scene" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                        <i>{i + 1}</i>
                      </div>
                      <div>
                        <h3>{AREA_NAMES[a]}</h3>
                        <span>
                          {a === save.area
                            ? 'You are here'
                            : save.visited.includes(a)
                              ? 'Explored'
                              : 'Unexplored'}
                        </span>
                        <p>{AREA_HINTS[a]}</p>
                        <p className="area-materials">
                          {a === 'forest'
                            ? 'Wood · berries · fiber'
                            : a === 'village'
                              ? 'Stone · herbs · old ruins'
                              : 'Iron ore · herbs · thorns'}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="travel-actions">
                  {WORLDS[save.area].exits.map((e) => (
                    <button
                      key={e.to}
                      className="sq-button"
                      onClick={() => {
                        setNavigateTo({ ...e });
                        close();
                        if (mode !== 'playing') start(false);
                        setMessage(
                          `Following the trail to ${AREA_NAMES[e.to]}. Interact at the marker to cross.`,
                        );
                      }}
                    >
                      Walk {e.to === 'wilderness' ? 'north' : 'the trail'} to {AREA_NAMES[e.to]}
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
                <PanelNote>
                  Violet thorn patches hurt. Dark mud slows you. Water and ruined walls block your
                  path. Hidden caches reveal themselves when you get close.
                </PanelNote>
              </>
            )}
            {panel === 'help' && (
              <>
                <div className="help-intro">
                  <Hamster />
                  <p>
                    Leave the burrow with empty paws. Come home with a story, a few berries, and
                    enough wood for a roof.
                  </p>
                </div>
                <dl className="control-list">
                  <div>
                    <dt>Move</dt>
                    <dd>
                      WASD, arrow keys, or select a place on the ground. On a phone, use the
                      direction buttons.
                    </dd>
                  </div>
                  <div>
                    <dt>Gather & interact</dt>
                    <dd>
                      Stand beside a resource and press E, or select it to walk over and gather. Let
                      patches regrow for 75 active seconds.
                    </dd>
                  </div>
                  <div>
                    <dt>Sprint</dt>
                    <dd>
                      Hold Shift or turn Sprint on. It spends stamina; standing still restores it.
                    </dd>
                  </div>
                  <div>
                    <dt>Craft & build</dt>
                    <dd>
                      I opens your satchel, C crafting, B building, J quests, and M the map. Build
                      in the forest burrow clearing.
                    </dd>
                  </div>
                  <div>
                    <dt>Stay well</dt>
                    <dd>
                      Eat berries or trail mix from your inventory. Use bandages, rest in a shelter,
                      or warm up by a campfire. Thorns cost 12 health each second.
                    </dd>
                  </div>
                  <div>
                    <dt>Explore</dt>
                    <dd>
                      Follow the path east to the village, then north to the wilderness. Press E at
                      a trail marker to cross. Fainting returns you home and costs up to 20 XP;
                      supplies are kept.
                    </dd>
                  </div>
                  <div>
                    <dt>Save & pause</dt>
                    <dd>
                      Escape pauses. Progress saves every 5 seconds and when you pause or leave.
                      Export a save for a backup. Clearing browser data removes local progress.
                    </dd>
                  </div>
                </dl>
                <button
                  className="sq-button sq-primary"
                  onClick={() => {
                    close();
                    if (mode !== 'playing') start(false);
                  }}
                >
                  Back to adventure
                  <Icon name="arrow" size={16} />
                </button>
              </>
            )}
            {panel === 'profile' && (
              <>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  tabIndex={-1}
                  aria-label="Import SqueekQuest save"
                  onChange={(e) => void importSave(e.target.files?.[0])}
                />

                <div className="profile-summary">
                  <Hamster face />
                  <div>
                    <strong>Level {currentLevel} explorer</strong>
                    <p>
                      {save.xp} total XP · {Math.floor(save.playSeconds / 60)} minutes exploring
                    </p>
                  </div>
                </div>
                <form
                  className="rename-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = String(new FormData(e.currentTarget).get('name') ?? '').trim();
                    if (!name) {
                      setMessage('Enter an explorer name between 1 and 24 characters.');
                      return;
                    }
                    setSetting({ name: name.slice(0, 24) });
                    setMessage('Explorer name saved.');
                  }}
                >
                  <label htmlFor="explorer-name">Explorer name</label>
                  <div>
                    <input
                      id="explorer-name"
                      name="name"
                      autoComplete="nickname"
                      required
                      minLength={1}
                      maxLength={24}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                    />
                    <button className="sq-button" type="submit">
                      Save name
                    </button>
                  </div>
                </form>
                <div className="save-actions">
                  <button className="sq-button" onClick={exportSave}>
                    <Icon name="download" size={17} />
                    Export save
                  </button>
                  <button className="sq-button" onClick={() => importRef.current?.click()}>
                    Import save
                  </button>
                </div>
                <PanelNote>
                  Import replaces this browser’s adventure after the file is validated. Export first
                  if you want to keep both. Previous version profiles are also supported.
                </PanelNote>
                {save.legacyAchievements.length > 0 && (
                  <p className="legacy-note">
                    Your {save.legacyAchievements.length} legacy discovery achievements are
                    preserved in your save.
                  </p>
                )}
                <div className="section-divider">
                  <h3>Your foraging records</h3>
                  <span>{save.runs.length} / 50 saved</span>
                </div>
                {save.runs.length ? (
                  <ol className="run-list">
                    {[...save.runs]
                      .sort((a, b) => a.seconds - b.seconds)
                      .slice(0, 10)
                      .map((r, i) => (
                        <li key={r.id}>
                          <span>{i + 1}</span>
                          <strong>{r.name}</strong>
                          <span>
                            {r.seeds} seeds · {r.seconds}s
                          </span>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <p className="panel-note">
                    Finish Sunflower scramble to save your first run here.
                  </p>
                )}
                <button className="sq-text-button danger-link" onClick={() => open('new-game')}>
                  Start a new game
                  <Icon name="refresh" size={15} />
                </button>
              </>
            )}
            {panel === 'minigame' && (
              <>
                <PanelNote>
                  Collect at least five sunflower seeds and return to the burrow. Seeds go into your
                  satchel if there is room; daily XP is claimed in your journal.
                </PanelNote>
                <GameMap
                  key={miniKey}
                  active={panel === 'minigame'}
                  onStart={() => {
                    if (!saveEnabled.current) {
                      saveEnabled.current = true;
                      setHasSave(true);
                    }
                    if (save.sound) wakeAudio();
                  }}
                  onSound={sound}
                  onFinish={(seeds, seconds) => {
                    act((s) => recordRun(s, seeds, seconds));
                    setMiniNote(`Home with ${seeds} seeds in ${seconds} seconds. Run saved.`);
                  }}
                  onStation={(station) =>
                    setMiniNote(
                      station === 'blocks'
                        ? 'The old wheel creaks in the breeze. More seeds await.'
                        : station === 'events'
                          ? 'Birdsong carries across the valley. Keep foraging.'
                          : 'A quiet grove. A good place to fill your cheeks.',
                    )
                  }
                />
                <p className="mini-status" role="status">
                  {miniNote}
                </p>
                <button className="sq-text-button" onClick={() => open('quests')}>
                  See daily foraging quest
                  <Icon name="arrow" size={15} />
                </button>
              </>
            )}
            {panel === 'new-game' && (
              <>
                <p className="new-game-copy">
                  This replaces the adventure saved in this browser, including your inventory,
                  buildings, quests and XP. Export your save first if you want to keep it.
                </p>
                <div className="save-actions">
                  <button className="sq-button" onClick={exportSave}>
                    Export current save
                    <Icon name="download" size={16} />
                  </button>
                  <button className="sq-button" onClick={close}>
                    Keep playing
                  </button>
                  <button className="sq-button sq-danger" onClick={() => start(true)}>
                    Start new game
                  </button>
                </div>
              </>
            )}
            <p className="panel-feedback" role="status">
              {message}
            </p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
