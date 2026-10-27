// The room document. Every client and the server apply the same operations,
// so everyone converges on the same scene.
export const EMPTY = { objects: {}, notes: {}, strokes: [] };

export function normalize(s) {
  return {
    objects: (s && s.objects) || {},
    notes: (s && s.notes) || {},
    strokes: Array.isArray(s && s.strokes) ? s.strokes : [],
  };
}

export function applyOp(s, op) {
  switch (op.type) {
    case 'obj.upsert':
      return { ...s, objects: { ...s.objects, [op.obj.id]: op.obj } };
    case 'obj.remove': {
      if (!(op.id in s.objects)) return s;
      const objects = { ...s.objects };
      delete objects[op.id];
      return { ...s, objects };
    }
    case 'note.upsert':
      return { ...s, notes: { ...s.notes, [op.note.id]: op.note } };
    case 'note.remove': {
      if (!(op.id in s.notes)) return s;
      const notes = { ...s.notes };
      delete notes[op.id];
      return { ...s, notes };
    }
    case 'stroke.add':
      if (s.strokes.some((x) => x.id === op.stroke.id)) return s;
      return { ...s, strokes: [...s.strokes, op.stroke] };
    case 'stroke.remove':
      return { ...s, strokes: s.strokes.filter((x) => x.id !== op.id) };
    case 'stroke.clear':
      return s.strokes.length ? { ...s, strokes: [] } : s;
    default:
      return s;
  }
}
