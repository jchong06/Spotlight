// ============================================================
//  Lightweight "elastic" fuzzy search over loaded events.
//  Typo-tolerant (Levenshtein), token-based, ranked by score —
//  matches Elasticsearch-style behavior without a backend.
// ============================================================

const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ");

// Levenshtein edit distance (small strings only)
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

// best score of one query token against any word in the field
function tokenScore(qt, words) {
  let best = 0;
  for (const w of words) {
    if (!w) continue;
    if (w === qt) best = Math.max(best, 1);
    else if (w.startsWith(qt)) best = Math.max(best, 0.92);
    else if (w.includes(qt)) best = Math.max(best, 0.72);
    else if (qt.length >= 4) {
      const d = editDistance(qt, w); // typo tolerance
      if (d <= 2) best = Math.max(best, 0.66 - (d - 1) * 0.18);
    }
    if (best === 1) break;
  }
  return best;
}

export function searchEvents(query, events = [], limit = 6) {
  const q = norm(query).trim();
  if (q.length < 2) return [];
  const qts = q.split(/\s+/).filter(Boolean);

  return events
    .map((e) => {
      const hay = norm(`${e.title} ${e.host} ${e.venue} ${e.genre}`);
      const words = hay.split(/\s+/);
      let score = 0;
      for (const qt of qts) score += tokenScore(qt, words);
      if (hay.includes(q)) score += 0.6; // phrase boost
      return { e, score: score / qts.length };
    })
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.e);
}
