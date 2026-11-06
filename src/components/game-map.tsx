import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  bound,
  COLS,
  HOME,
  near,
  Point,
  ROWS,
  samePoint,
  SEEDS,
  Station,
  STATIONS,
  stepToward,
} from '../lib/game';
import { Hamster, Icon } from './icons';

export type GameStatus = 'ready' | 'playing' | 'paused' | 'complete';
export function GameMap({
  onFinish,
  onStation,
  onSound,
  onStart,
  active,
}: {
  onFinish: (seeds: number, seconds: number) => void;
  onStation: (station: Station) => void;
  onSound: () => void;
  onStart: () => void;
  active: boolean;
}) {
  const [status, setStatus] = useState<GameStatus>('ready');
  const [position, setPosition] = useState<Point>(HOME);
  const [target, setTarget] = useState<Point | null>(null);
  const [collected, setCollected] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState('A pocket-sized adventure awaits.');
  const board = useRef<HTMLDivElement>(null);
  const collectedRef = useRef<number[]>([]);
  const running = useRef(false);
  const pendingStation = useRef<Station | null>(null);
  const xy = (p: Point) => ({
    left: `${(p.x / (COLS - 1)) * 100}%`,
    top: `${(p.y / (ROWS - 1)) * 100}%`,
  });

  useEffect(() => {
    if (!active) setStatus((s) => (s === 'playing' ? 'paused' : s));
  }, [active]);

  useEffect(() => {
    if (status !== 'playing') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => {
    if (status !== 'playing' || !target) return;
    const t = setTimeout(() => {
      if (samePoint(position, target)) setTarget(null);
      else setPosition((p) => stepToward(p, target));
    }, 120);
    return () => clearTimeout(t);
  }, [target, position, status]);
  useEffect(() => {
    if (status !== 'playing') return;
    const found = SEEDS.findIndex(
      (s, i) => samePoint(position, s) && !collectedRef.current.includes(i),
    );
    if (found >= 0) {
      const next = [...collectedRef.current, found];
      collectedRef.current = next;
      setCollected(next);
      setMessage(
        next.length >= 5
          ? 'Cheeks full! Head back to the burrow.'
          : `A seed for the stash. ${next.length} of 5 collected.`,
      );
      onSound();
    }
    if (pendingStation.current && near(position, STATIONS[pendingStation.current])) {
      const station = pendingStation.current;
      pendingStation.current = null;
      setTarget(null);
      onStation(station);
    }
    if (near(position, HOME) && collectedRef.current.length >= 5 && running.current) {
      running.current = false;
      setStatus('complete');
      setTarget(null);
      setMessage('Home sweet burrow. Your run is saved.');
      onFinish(collectedRef.current.length, seconds);
    }
  }, [position, status, onFinish, onStation, onSound, seconds]);
  useEffect(() => {
    const pause = () => {
      if (document.visibilityState === 'hidden') setStatus((s) => (s === 'playing' ? 'paused' : s));
    };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);

  function start() {
    onStart();
    collectedRef.current = [];
    running.current = true;
    pendingStation.current = null;
    setCollected([]);
    setSeconds(0);
    setPosition(HOME);
    setTarget(null);
    setStatus('playing');
    setMessage('Find 5 sunflower seeds, then return to the burrow.');
    setTimeout(() => board.current?.focus(), 0);
  }
  function move(dx: number, dy: number) {
    if (status !== 'playing') return;
    setTarget(null);
    pendingStation.current = null;
    setPosition((p) => bound({ x: p.x + dx, y: p.y + dy }));
  }
  function key(e: KeyboardEvent) {
    const keys: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      w: [0, -1],
      W: [0, -1],
      ArrowDown: [0, 1],
      s: [0, 1],
      S: [0, 1],
      ArrowLeft: [-1, 0],
      a: [-1, 0],
      A: [-1, 0],
      ArrowRight: [1, 0],
      d: [1, 0],
      D: [1, 0],
    };
    if (keys[e.key]) {
      e.preventDefault();
      move(...keys[e.key]);
    }
    if (e.key === 'Escape' && status === 'playing') setStatus('paused');
    if ((e.key === 'Enter' || e.key === ' ') && (status === 'ready' || status === 'complete')) {
      e.preventDefault();
      start();
    }
  }
  function visit(station: Station) {
    if (status !== 'playing') return;
    if (near(position, STATIONS[station])) onStation(station);
    else {
      pendingStation.current = station;
      setTarget(STATIONS[station]);
      setMessage(`On the way to ${STATIONS[station].name.toLowerCase()}.`);
    }
  }

  return (
    <section className="game-shell" aria-label="Squeek valley adventure">
      <div className="game-topline">
        <span className="location">
          <Icon name="compass" size={18} />
          Squeek valley <span className="location-dot" />{' '}
          <span className="muted">Open exploration</span>
        </span>
        <span className="game-clock">
          <Icon name="clock" size={16} />
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div
        ref={board}
        className={`game-map ${status === 'playing' ? 'is-playing' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="Adventure map. Use arrow keys or W A S D to move. Collect five seeds and return to the burrow."
        onKeyDown={key}
        onPointerDown={(e) => {
          if (status !== 'playing' || (e.target as HTMLElement).closest('button')) return;
          const r = e.currentTarget.getBoundingClientRect();
          pendingStation.current = null;
          setTarget(
            bound({
              x: ((e.clientX - r.left) / r.width) * (COLS - 1),
              y: ((e.clientY - r.top) / r.height) * (ROWS - 1),
            }),
          );
          board.current?.focus();
        }}
      >
        <img src="./art/valley.svg" className="valley-art" alt="" draggable={false} />
        <button
          className="map-label home-label"
          style={{ ...xy(HOME), top: '85%' }}
          onClick={() => {
            if (status === 'playing') {
              setTarget(HOME);
              pendingStation.current = null;
            }
          }}
          disabled={status !== 'playing'}
        >
          <Icon name="home" size={15} />
          The burrow
        </button>
        {(Object.entries(STATIONS) as [Station, (typeof STATIONS)[Station]][]).map(([key, s]) => (
          <button
            key={key}
            className={`station-label station-${key}`}
            style={xy({ x: s.x, y: s.y + (key === 'nft' ? 0.6 : 1.35) })}
            onClick={() => visit(key)}
            disabled={status !== 'playing'}
            aria-label={`Visit ${s.name}`}
          >
            <span className="station-marker">
              <Icon name={s.icon} size={15} />
            </span>
            {s.name}
            <Icon name="chevron" size={12} />
          </button>
        ))}
        {SEEDS.map(
          (s, i) =>
            !collected.includes(i) && (
              <button
                key={i}
                className="map-seed"
                style={xy(s)}
                disabled={status !== 'playing'}
                aria-label={`Collect seed ${i + 1}`}
                onClick={() => {
                  pendingStation.current = null;
                  setTarget(s);
                }}
              >
                <Icon name="seed" size={22} />
              </button>
            ),
        )}
        {target && status === 'playing' && (
          <span className="move-target" style={xy(target)} aria-hidden="true" />
        )}
        <div
          className={`player ${status === 'playing' && target ? 'player-moving' : ''}`}
          style={xy(position)}
          data-testid="hamster"
          data-x={position.x}
          data-y={position.y}
        >
          <span className="player-name">You</span>
          <Hamster />
        </div>
        {status === 'paused' && (
          <div className="game-overlay">
            <div className="pause-content">
              <Icon name="pause" size={32} />
              <h3>A little breather</h3>
              <button
                className="button primary"
                onClick={() => {
                  setStatus('playing');
                  board.current?.focus();
                }}
              >
                Resume adventure <Icon name="play" size={16} />
              </button>
            </div>
          </div>
        )}
        {(status === 'ready' || status === 'complete') && (
          <div className="map-welcome">
            <span className="welcome-pin">
              <Icon name={status === 'complete' ? 'check' : 'flag'} size={18} />
            </span>
            <strong>
              {status === 'complete' ? 'A lovely little haul.' : 'Your next adventure starts here.'}
            </strong>
            <span>
              {status === 'complete'
                ? `${collected.length} seeds tucked away`
                : 'Find seeds. Follow signals. Make discoveries.'}
            </span>
          </div>
        )}
      </div>
      <div className="game-actionbar">
        <div className="seed-progress">
          <span className="seed-emblem">
            <Icon name="seed" />
          </span>
          <div>
            <strong>
              {collected.length} <span className="muted">/ 5 seeds</span>
            </strong>
            <span className="small muted">
              {collected.length >= 5 ? 'Return to the burrow' : 'Collect & bring them home'}
            </span>
          </div>
        </div>
        {status === 'ready' || status === 'complete' ? (
          <button className="button primary" onClick={start}>
            {status === 'complete' ? 'Play again' : 'Start adventure'}
            <Icon name="arrow" size={18} />
          </button>
        ) : (
          <button
            className="button secondary"
            onClick={() => {
              if (status === 'paused') {
                setStatus('playing');
                board.current?.focus();
              } else setStatus('paused');
            }}
          >
            <Icon name={status === 'paused' ? 'play' : 'pause'} size={16} />
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>
      <div className="game-instructions">
        <p>
          <Icon name="compass" size={16} />
          <span>
            Click the map to move{' '}
            <span className="desktop-only">
              or use <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd>
            </span>
            .
          </span>
        </p>
        <span className="small muted">Local game · no wallet needed</span>
      </div>
      {status === 'playing' && (
        <div className="dpad" aria-label="Movement controls">
          <button aria-label="Move up" onClick={() => move(0, -1)}>
            <Icon name="up" />
          </button>
          <div>
            <button aria-label="Move left" onClick={() => move(-1, 0)}>
              <Icon name="left" />
            </button>
            <button aria-label="Move down" onClick={() => move(0, 1)}>
              <Icon name="down" />
            </button>
            <button aria-label="Move right" onClick={() => move(1, 0)}>
              <Icon name="right" />
            </button>
          </div>
        </div>
      )}
      <p className="sr-only" role="status">
        {message}
      </p>
    </section>
  );
}
