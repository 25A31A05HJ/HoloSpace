import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY, applyOp, normalize } from './state.js';
import { createTransport } from './transports.js';

/**
 * Connects to a room and keeps the shared document in React state.
 * send(op) applies the change locally right away and broadcasts it;
 * send(op, { local: false }) only broadcasts (cursors, live strokes).
 */
export function useRoom(roomId, name) {
  const [state, setState] = useState(EMPTY);
  const [live, setLive] = useState({});
  const [peers, setPeers] = useState({});
  const [you, setYou] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [status, setStatus] = useState('connecting');
  const transport = useRef(null);

  useEffect(() => {
    const onMessage = (m) => {
      switch (m.type) {
        case 'welcome':
          setYou(m.you);
          setRoomName(m.room.name);
          setState(normalize(m.state));
          setPeers(Object.fromEntries((m.peers || []).map((p) => [p.id, p])));
          setLive({});
          break;
        case 'peer.join':
          setPeers((p) => ({ ...p, [m.peer.id]: m.peer }));
          break;
        case 'peer.leave':
          setPeers((p) => {
            const n = { ...p };
            delete n[m.id];
            return n;
          });
          break;
        case 'cursor':
          setPeers((p) =>
            p[m.from] ? { ...p, [m.from]: { ...p[m.from], cursor: { x: m.x, y: m.y } } } : p
          );
          break;
        case 'stroke.live':
          setLive((l) => {
            const cur = l[m.id];
            return {
              ...l,
              [m.id]: {
                id: m.id,
                color: m.color,
                width: m.width,
                points: (cur ? cur.points : []).concat(m.points),
              },
            };
          });
          break;
        default:
          if (m.type === 'stroke.add') {
            setLive((l) => {
              if (!l[m.stroke.id]) return l;
              const n = { ...l };
              delete n[m.stroke.id];
              return n;
            });
          }
          setState((s) => applyOp(s, m));
      }
    };

    const t = createTransport({ roomId, name, onMessage, onStatus: setStatus });
    transport.current = t;
    return () => {
      t.close();
      transport.current = null;
    };
  }, [roomId, name]);

  const send = useCallback((op, opts) => {
    if (!opts || opts.local !== false) setState((s) => applyOp(s, op));
    if (transport.current) transport.current.send(op);
  }, []);

  return { state, live, peers, you, roomName, status, send };
}
