import { API, DEMO } from './api.js';
import { applyOp, normalize } from './state.js';

const COLORS = ['#ff7a3d', '#7ff0c8', '#ffd166', '#ff8fb8', '#b9a7ff', '#8fd3ff', '#ffffff', '#c5f06a'];
const rid = () => Math.random().toString(36).slice(2, 8);

/* ------------------------------------------------------------------ */
/* Real-time transport: WebSocket to the Spring Boot server            */
/* ------------------------------------------------------------------ */
export function createWsTransport({ roomId, name, onMessage, onStatus }) {
  let ws = null;
  let closed = false;
  let tries = 0;
  let retryTimer = null;
  let pingTimer = null;
  const base = API.replace(/^http/, 'ws');

  function connect() {
    onStatus(tries ? 'reconnecting' : 'connecting');
    ws = new WebSocket(
      `${base}/ws?room=${encodeURIComponent(roomId)}&name=${encodeURIComponent(name)}`
    );
    ws.onopen = () => {
      tries = 0;
      onStatus('online');
    };
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch (_) {
        /* ignore malformed frames */
      }
    };
    ws.onclose = (e) => {
      if (closed) return;
      if (e.code === 4404) {
        onStatus('notfound');
        return;
      }
      onStatus('reconnecting');
      tries += 1;
      retryTimer = setTimeout(connect, Math.min(1000 * 2 ** tries, 10000));
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch (_) {
        /* already closed */
      }
    };
  }

  connect();
  // Keeps the connection alive through proxies that drop idle sockets.
  pingTimer = setInterval(() => {
    if (ws && ws.readyState === 1) ws.send('{"type":"ping"}');
  }, 25000);

  return {
    send(op) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(op));
    },
    close() {
      closed = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      try {
        if (ws) ws.close();
      } catch (_) {
        /* already closed */
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Demo transport: BroadcastChannel + localStorage (same browser only) */
/* ------------------------------------------------------------------ */
const storeKey = (id) => `holospace:room:${id}`;

function load(id) {
  try {
    return JSON.parse(localStorage.getItem(storeKey(id)));
  } catch (_) {
    return null;
  }
}

function save(id, rec) {
  try {
    localStorage.setItem(storeKey(id), JSON.stringify(rec));
  } catch (_) {
    /* storage unavailable */
  }
}

export function createLocalTransport({ roomId, name, onMessage, onStatus }) {
  const rec = load(roomId) || { id: roomId, name: 'Shared room', state: null };
  let state = normalize(rec.state);
  const me = { id: 'p' + rid(), name, color: COLORS[Math.floor(Math.random() * COLORS.length)] };
  const ch =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('holospace:' + roomId)
      : { postMessage() {}, close() {}, onmessage: null };

  const persist = () => save(roomId, { ...rec, state });

  ch.onmessage = (e) => {
    const m = e.data;
    if (!m || m.from === me.id) return;
    if (m.type === 'peer.join') {
      onMessage(m);
      ch.postMessage({ type: 'peer.here', peer: me, to: m.peer.id, from: me.id });
      return;
    }
    if (m.type === 'peer.here') {
      if (m.to === me.id) onMessage({ type: 'peer.join', peer: m.peer });
      return;
    }
    const next = applyOp(state, m);
    if (next !== state) {
      state = next;
      persist();
    }
    onMessage(m);
  };

  const bye = () => ch.postMessage({ type: 'peer.leave', id: me.id, from: me.id });
  window.addEventListener('beforeunload', bye);

  const t = setTimeout(() => {
    onStatus('online');
    onMessage({ type: 'welcome', you: me, room: { id: roomId, name: rec.name }, state, peers: [] });
    ch.postMessage({ type: 'peer.join', peer: me, from: me.id });
  }, 0);

  return {
    send(op) {
      const next = applyOp(state, op);
      if (next !== state) {
        state = next;
        persist();
      }
      ch.postMessage({ ...op, from: me.id });
    },
    close() {
      clearTimeout(t);
      window.removeEventListener('beforeunload', bye);
      try {
        bye();
        ch.close();
      } catch (_) {
        /* channel already closed */
      }
    },
  };
}

export function createTransport(opts) {
  return DEMO ? createLocalTransport(opts) : createWsTransport(opts);
}
