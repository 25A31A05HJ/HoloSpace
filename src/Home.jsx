import { useState } from 'react';
import { DEMO, createRoom, roomExists } from './api.js';

export default function Home({ roomId, name, onName, onGo }) {
  const [nick, setNick] = useState(name);
  const [roomName, setRoomName] = useState('Smart City Design');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const takeName = () => {
    const n = nick.trim();
    if (!n) {
      setErr('Enter a display name so teammates know who you are.');
      return null;
    }
    onName(n);
    return n;
  };

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    if (!takeName()) return;
    setBusy(true);
    try {
      const r = await createRoom(roomName);
      onGo(r.id);
    } catch (_) {
      setErr('The server did not respond. On free hosting it can take up to a minute to wake up, so try again shortly.');
    } finally {
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setErr('');
    if (!takeName()) return;
    const code = joinCode.trim().split('?')[0].split('/').filter(Boolean).pop() || '';
    if (!/^[A-Za-z0-9_-]+$/.test(code)) {
      setErr('Paste an invite link or a room code like a1b2c3d4.');
      return;
    }
    setBusy(true);
    const ok = await roomExists(code);
    setBusy(false);
    if (!ok) {
      setErr('No room found with that code.');
      return;
    }
    onGo(code);
  };

  const enterInvite = (e) => {
    e.preventDefault();
    takeName(); // App switches to the room as soon as a name is saved
  };

  return (
    <div className="home">
      <section className="hero">
        <div className="cube-wrap" aria-hidden="true">
          <div className="cube"><i /><i /><i /><i /><i /><i /></div>
        </div>
        <h1>Meet inside the thing you’re making.</h1>
        <p className="lede">
          HoloSpace is a shared room in your browser. Place 3D objects, sketch on a whiteboard and leave sticky notes while
          your team watches every change land as it happens.
        </p>
        <ul className="points">
          <li>Move a building and everyone sees it slide into place.</li>
          <li>Draw roads on the whiteboard while a teammate is still drawing.</li>
          <li>Close the tab, come back tomorrow, and the room is as you left it.</li>
        </ul>
      </section>

      <section className="card">
        {roomId ? (
          <form onSubmit={enterInvite}>
            <h2>You’ve been invited</h2>
            <p className="muted">Room code <code>{roomId}</code></p>
            <label>
              Your display name
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Priya" maxLength={24} autoFocus />
            </label>
            <button className="primary wide" type="submit">Enter room</button>
            {err && <p className="err">{err}</p>}
          </form>
        ) : (
          <>
            <label>
              Your display name
              <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="e.g. Priya" maxLength={24} />
            </label>

            <form onSubmit={create}>
              <h2>Start a room</h2>
              <label>
                Room name
                <input value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={80} />
              </label>
              <button className="primary wide" type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create room'}
              </button>
            </form>

            <form onSubmit={join} className="join">
              <h2>Join a room</h2>
              <label>
                Invite link or room code
                <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Paste it here" />
              </label>
              <button className="ghost wide" type="submit" disabled={busy}>Join room</button>
            </form>
            {err && <p className="err">{err}</p>}
          </>
        )}
        {DEMO && (
          <p className="muted small">
            Demo mode is on: rooms sync between tabs of this browser. Connect the Spring Boot server to collaborate across devices.
          </p>
        )}
      </section>
    </div>
  );
}
