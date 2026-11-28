// Readable share links for tasks: internal.ocraft.id/t/BuatNIB (title in PascalCase). When two tasks would get the
// same name, the link gets the first 4 characters of the id: /t/BuatNIB-3f9a. Used by the app and by /t/[slug].

/** "Buat NIB" → "BuatNIB", "Vendor 3D · Remeh & Keychain" → "Vendor3DRemehKeychain". */
export function slugOf(title: string): string {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const s = words.map((w) => w[0].toUpperCase() + w.slice(1)).join("");
  return (s || "Task").slice(0, 60);
}

type Row = { id: string; title: string; updated_at?: string };

/** The share path of a task, unique among `all`. */
export function taskPath(t: Row, all: Row[]): string {
  const s = slugOf(t.title);
  const clash = all.some((x) => x.id !== t.id && slugOf(x.title) === s);
  return `/t/${clash ? `${s}-${t.id.slice(0, 4)}` : s}`;
}

/** Finds the task a slug points to (newest first when a name is shared and no id suffix is given). */
export function resolveSlug<T extends Row>(slug: string, all: T[]): T | null {
  const raw = decodeURIComponent(slug);
  const m = /^(.*)-([0-9a-f]{4})$/.exec(raw);
  if (m) {
    const hit = all.find((t) => t.id.startsWith(m[2]) && slugOf(t.title) === m[1]);
    if (hit) return hit;
  }
  const same = all.filter((t) => slugOf(t.title) === raw);
  if (!same.length) {
    const loose = all.filter((t) => slugOf(t.title).toLowerCase() === raw.toLowerCase());
    if (!loose.length) return null;
    same.push(...loose);
  }
  return same.sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0];
}
