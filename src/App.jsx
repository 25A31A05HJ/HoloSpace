import { useEffect, useState } from 'react';
import Home from './Home.jsx';
import Room from './Room.jsx';

function parseHash() {
  const m = window.location.hash.match(/^#\/room\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function readName() {
  try {
    return localStorage.getItem('holospace:name') || '';
  } catch (_) {
    return '';
  }
}

export default function App() {
  const [roomId, setRoomId] = useState(parseHash());
  const [name, setName] = useState(readName());

  useEffect(() => {
    const onHash = () => setRoomId(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const saveName = (n) => {
    setName(n);
    try {
      localStorage.setItem('holospace:name', n);
    } catch (_) {
      /* storage unavailable */
    }
  };

  const go = (id) => {
    window.location.hash = id ? `#/room/${id}` : '';
  };

  if (roomId && name) {
    return <Room key={roomId} roomId={roomId} name={name} onLeave={() => go(null)} />;
  }
  return <Home roomId={roomId} name={name} onName={saveName} onGo={go} />;
}
