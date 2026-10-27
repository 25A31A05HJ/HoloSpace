import { useEffect, useRef, useState } from 'react';

const INK = ['#f5f7ff', '#ff7a3d', '#7ff0c8', '#ffd166', '#ff8fb8', '#b9a7ff'];
const PAPER = ['#ffe29a', '#b8f5dd', '#c4e0ff', '#ffd0e0', '#dcd2ff'];
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function drawStroke(ctx, s, w, h, dpr) {
  const pts = s.points;
  if (!pts || !pts.length) return;
  ctx.strokeStyle = s.color;
  ctx.shadowColor = s.color;
  ctx.shadowBlur = 5 * dpr;
  ctx.lineWidth = (s.width || 3) * dpr;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
  if (pts.length === 1) ctx.lineTo(pts[0][0] * w + 0.01, pts[0][1] * h);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * w, pts[i][1] * h);
  ctx.stroke();
}

function Note({ note, boardRef, send }) {
  const drag = useRef(null);

  const onDown = (e) => {
    e.preventDefault();
    const box = e.currentTarget.parentElement.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, t: 0, pos: null };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const r = boardRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - r.left - d.dx) / r.width, 0, 0.85);
    const y = clamp((e.clientY - r.top - d.dy) / r.height, 0, 0.8);
    d.pos = { x, y };
    const now = performance.now();
    if (now - d.t > 40) {
      d.t = now;
      send({ type: 'note.upsert', note: { ...note, x, y } });
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && d.pos) send({ type: 'note.upsert', note: { ...note, x: d.pos.x, y: d.pos.y } });
  };

  return (
    <div className="note" style={{ left: `${note.x * 100}%`, top: `${note.y * 100}%`, background: note.color }}>
      <div className="note-h" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <span>{note.by || 'note'}</span>
        <button
          className="note-x"
          aria-label="Delete note"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => send({ type: 'note.remove', id: note.id })}
        >
          ×
        </button>
      </div>
      <textarea
        value={note.text}
        placeholder="Write a comment…"
        onChange={(e) => send({ type: 'note.upsert', note: { ...note, text: e.target.value.slice(0, 500) } })}
      />
    </div>
  );
}

export default function Whiteboard({ strokes, live, notes, peers, you, send }) {
  const boardRef = useRef(null);
  const canvasRef = useRef(null);
  const drawing = useRef(null);
  const lastCursor = useRef(0);
  const paintRef = useRef(() => {});
  const [color, setColor] = useState(INK[1]);
  const [width, setWidth] = useState(3);
  const [tool, setTool] = useState('pen');

  paintRef.current = () => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) drawStroke(ctx, s, w, h, dpr);
    for (const s of Object.values(live)) drawStroke(ctx, s, w, h, dpr);
    if (drawing.current) drawStroke(ctx, drawing.current, w, h, dpr);
  };

  useEffect(() => {
    paintRef.current();
  }, [strokes, live]);

  useEffect(() => {
    const ro = new ResizeObserver(() => paintRef.current());
    ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, []);

  const point = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [
      +clamp((e.clientX - r.left) / r.width, 0, 1).toFixed(4),
      +clamp((e.clientY - r.top) / r.height, 0, 1).toFixed(4),
    ];
  };

  const flushLive = (force) => {
    const d = drawing.current;
    if (!d || d.points.length <= d.sent) return;
    const now = performance.now();
    if (!force && now - d.t < 60) return;
    d.t = now;
    send(
      { type: 'stroke.live', id: d.id, color: d.color, width: d.width, points: d.points.slice(Math.max(0, d.sent - 1)) },
      { local: false }
    );
    d.sent = d.points.length;
  };

  const onDown = (e) => {
    if (tool === 'note') {
      const [x, y] = point(e);
      send({
        type: 'note.upsert',
        note: { id: uid(), x: Math.min(x, 0.8), y: Math.min(y, 0.75), text: '', color: PAPER[Math.floor(Math.random() * PAPER.length)], by: you ? you.name : '' },
      });
      setTool('pen');
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { id: uid(), color, width, points: [point(e)], sent: 0, t: 0, by: you ? you.id : '' };
    paintRef.current();
    flushLive(true);
  };

  const onMove = (e) => {
    const p = point(e);
    const now = performance.now();
    if (now - lastCursor.current > 50) {
      lastCursor.current = now;
      send({ type: 'cursor', x: p[0], y: p[1] }, { local: false });
    }
    const d = drawing.current;
    if (!d || d.points.length >= 3000) return;
    const last = d.points[d.points.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
    d.points.push(p);
    paintRef.current();
    flushLive(false);
  };

  const onUp = () => {
    const d = drawing.current;
    if (!d) return;
    drawing.current = null;
    send({ type: 'stroke.add', stroke: { id: d.id, color: d.color, width: d.width, points: d.points, by: d.by } });
  };

  const undo = () => {
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (you && strokes[i].by === you.id) {
        send({ type: 'stroke.remove', id: strokes[i].id });
        return;
      }
    }
  };

  const clear = () => {
    if (window.confirm('Clear the whole whiteboard for everyone?')) send({ type: 'stroke.clear' });
  };

  return (
    <>
      <div className="pane-head">
        <strong className="pane-title">Whiteboard</strong>
        <button className={`tool ${tool === 'pen' ? 'on' : ''}`} onClick={() => setTool('pen')}>Pen</button>
        <button className={`tool ${tool === 'note' ? 'on' : ''}`} onClick={() => setTool('note')}>Sticky note</button>
        <span className="swatches">
          {INK.map((c) => (
            <button
              key={c}
              aria-label={`Ink ${c}`}
              className={`sw ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => { setColor(c); setTool('pen'); }}
            />
          ))}
        </span>
        <input
          type="range"
          min="1"
          max="12"
          value={width}
          aria-label="Pen width"
          onChange={(e) => setWidth(+e.target.value)}
        />
        <span className="spacer" />
        <button className="tool" onClick={undo}>Undo mine</button>
        <button className="tool" onClick={clear}>Clear</button>
      </div>
      <div className="wb-scroll">
        <div className="board" ref={boardRef}>
          <canvas
            ref={canvasRef}
            className={tool === 'note' ? 'place' : ''}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <div className="overlay">
            {Object.values(notes).map((n) => (
              <Note key={n.id} note={n} boardRef={boardRef} send={send} />
            ))}
            {Object.values(peers)
              .filter((p) => p.cursor)
              .map((p) => (
                <div key={p.id} className="cursor" style={{ left: `${p.cursor.x * 100}%`, top: `${p.cursor.y * 100}%` }}>
                  <i style={{ background: p.color }} />
                  <span style={{ background: p.color }}>{p.name}</span>
                </div>
              ))}
          </div>
          {!strokes.length && !Object.keys(notes).length && !Object.keys(live).length && (
            <p className="empty">Draw anywhere, or pick Sticky note and click the board to leave a comment.</p>
          )}
        </div>
      </div>
    </>
  );
}
