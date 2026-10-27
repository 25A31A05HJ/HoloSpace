import { useEffect, useRef, useState } from 'react';
import Scene3D, { SHAPES } from './Scene3D.jsx';
import Whiteboard from './Whiteboard.jsx';
import { useRoom } from './useRoom.js';
import { DEMO, shareUrl } from './api.js';

const PALETTE = ['#ff7a3d', '#7ff0c8', '#ffd166', '#ff8fb8', '#b9a7ff', '#f5f7ff'];
const uid = () => Math.random().toString(36).slice(2, 10);
const STATUS = {
  connecting: 'Connecting…',
  online: 'Live',
  reconnecting: 'Reconnecting…',
  notfound: 'Not found',
};

export default function Room({ roomId, name, onLeave }) {
  const { state, live, peers, you, roomName, status, send } = useRoom(roomId, name);
  const [selectedId, setSelectedId] = useState(null);
  const [copied, setCopied] = useState(false);
  const selectedRef = useRef(null);
  selectedRef.current = selectedId;

  const selected = selectedId ? state.objects[selectedId] : null;
  const people = Object.values(peers);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRef.current) {
        send({ type: 'obj.remove', id: selectedRef.current });
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [send]);

  const addShape = (kind) => {
    const shape = SHAPES[kind];
    const obj = {
      id: uid(),
      kind,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      pos: [(Math.random() - 0.5) * 6, shape.half, (Math.random() - 0.5) * 6],
      rotY: 0,
      scale: 1,
      by: you ? you.name : name,
    };
    send({ type: 'obj.upsert', obj });
    setSelectedId(obj.id);
  };

  const update = (patch) => send({ type: 'obj.upsert', obj: { ...selected, ...patch } });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(roomId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      window.prompt('Copy this invite link:', shareUrl(roomId));
    }
  };

  if (status === 'notfound') {
    return (
      <div className="center">
        <div className="card">
          <h2>This room doesn’t exist</h2>
          <p className="muted">
            The code <code>{roomId}</code> doesn’t match any room on this server. Check the link, or start a new room.
          </p>
          <button className="primary" onClick={onLeave}>Back to rooms</button>
        </div>
      </div>
    );
  }

  const deg = selected ? (((Math.round((selected.rotY * 180) / Math.PI) % 360) + 360) % 360) : 0;

  return (
    <div className="room">
      <header className="topbar">
        <button className="ghost" onClick={onLeave}>Rooms</button>
        <div className="title">
          <span className="dot" data-status={status} title={STATUS[status]} />
          <strong>{roomName || 'Opening room…'}</strong>
          <code>{roomId}</code>
          <span className="muted small">{STATUS[status]}</span>
        </div>
        <div className="peers" aria-label="People in this room">
          {you && (
            <span className="avatar" style={{ background: you.color }} title={`${you.name} (you)`}>
              {you.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          {people.map((p) => (
            <span key={p.id} className="avatar" style={{ background: p.color }} title={p.name}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
        </div>
        <button className="primary" onClick={copyLink}>{copied ? 'Link copied' : 'Copy invite link'}</button>
      </header>

      {DEMO && (
        <div className="banner">
          Demo mode: this room syncs between tabs of this browser only. Set <code>VITE_API_URL</code> to your Spring Boot
          server to collaborate across devices.
        </div>
      )}
      {!DEMO && status === 'connecting' && (
        <div className="banner">
          Connecting to the server. Free hosting can take up to a minute to wake up after a quiet spell.
        </div>
      )}

      <main className="split">
        <section className="pane">
          <div className="pane-head">
            <strong className="pane-title">3D stage</strong>
            {Object.keys(SHAPES).map((k) => (
              <button key={k} className="tool" onClick={() => addShape(k)}>
                Add {SHAPES[k].label.toLowerCase()}
              </button>
            ))}
          </div>
          <div className="viewport">
            <Scene3D
              objects={state.objects}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(obj) => send({ type: 'obj.upsert', obj })}
            />
            {!Object.keys(state.objects).length && (
              <p className="empty">Add a shape to start building. Drag objects to move them; drag empty space to orbit.</p>
            )}
            {selected && (
              <div className="inspector">
                <div className="insp-row">
                  <strong>{(SHAPES[selected.kind] || SHAPES.cube).label}</strong>
                  <span className="muted small">added by {selected.by}</span>
                </div>
                <label>
                  Colour
                  <input type="color" value={selected.color} onChange={(e) => update({ color: e.target.value })} />
                </label>
                <label>
                  Size
                  <input
                    type="range"
                    min="0.3"
                    max="3"
                    step="0.05"
                    value={selected.scale}
                    onChange={(e) => {
                      const s = +e.target.value;
                      update({ scale: s, pos: [selected.pos[0], (SHAPES[selected.kind] || SHAPES.cube).half * s, selected.pos[2]] });
                    }}
                  />
                </label>
                <label>
                  Turn
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={deg}
                    onChange={(e) => update({ rotY: (+e.target.value * Math.PI) / 180 })}
                  />
                </label>
                <button
                  className="danger"
                  onClick={() => {
                    send({ type: 'obj.remove', id: selected.id });
                    setSelectedId(null);
                  }}
                >
                  Delete object
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="pane">
          <Whiteboard
            strokes={state.strokes}
            live={live}
            notes={state.notes}
            peers={peers}
            you={you}
            send={send}
          />
        </section>
      </main>
    </div>
  );
}
