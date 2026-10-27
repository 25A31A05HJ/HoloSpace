// Backend URL. When VITE_API_URL is empty the app runs in demo mode:
// everything works, but rooms only sync between tabs of the same browser.
export const API = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const DEMO = API === '';

const rid = () => Math.random().toString(36).slice(2, 10);

export const shareUrl = (id) =>
  `${window.location.origin}${window.location.pathname}#/room/${id}`;

export async function createRoom(name) {
  const clean = (name || '').trim() || 'Untitled room';
  if (DEMO) {
    const id = rid();
    try {
      localStorage.setItem(`holospace:room:${id}`, JSON.stringify({ id, name: clean, state: null }));
    } catch (_) {
      /* storage unavailable: the room still works for this session */
    }
    return { id, name: clean };
  }
  const res = await fetch(`${API}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: clean }),
  });
  if (!res.ok) throw new Error('create failed');
  return res.json();
}

export async function roomExists(id) {
  if (DEMO) return true;
  try {
    const res = await fetch(`${API}/api/rooms/${encodeURIComponent(id)}`);
    return res.ok;
  } catch (_) {
    return false;
  }
}
