import fs from "node:fs";
import proj4 from "proj4";
export const civilDate = (date = new Date()) =>
  date.toLocaleDateString("en-CA", { timeZone: "America/Manaus" });
export const parameters = {
  version: "AM-1.0",
  cellMeters: 250,
  windowDays: 90,
  floodWeight: 0.7,
  wasteWeight: 0.3,
  normalizer: 5,
  projection: "EPSG:32721",
  origin: [0, 0],
};
const boundary = JSON.parse(
  fs.readFileSync(new URL("./manaus.geojson", import.meta.url)),
);
function ring(p, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    let a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
function polygon(p, r) {
  return ring(p, r[0]) && !r.slice(1).some((x) => ring(p, x));
}
export function inManaus(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return boundary.features.some((f) =>
    f.geometry.type === "Polygon"
      ? polygon([lng, lat], f.geometry.coordinates)
      : f.geometry.coordinates.some((r) => polygon([lng, lat], r)),
  );
}
export function cell(lat, lng) {
  const [x, y] = proj4(
    "EPSG:4326",
    "+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs",
    [lng, lat],
  );
  return `${Math.floor(x / 250)}:${Math.floor(y / 250)}`;
}
export function calculate(rows, now = new Date()) {
  const end = civilDate(now),
    start = civilDate(new Date(now.getTime() - 89 * 86400000));
  const groups = new Map();
  for (const r of rows) {
    if (r.moderation !== "approved" || r.date < start || r.date > end) continue;
    const key = cell(r.lat, r.lng);
    if (!groups.has(key))
      groups.set(key, {
        id: key,
        a: 0,
        r: 0,
        dates: new Set(),
        lat: r.lat,
        lng: r.lng,
      });
    const g = groups.get(key);
    if (r.type === "alagamento") {
      g.a++;
      g.dates.add(r.date);
    } else g.r++;
  }
  return [...groups.values()].map((g) => {
    const score = Math.round(
      100 * (0.7 * Math.min(g.a / 5, 1) + 0.3 * Math.min(g.r / 5, 1)),
    );
    const [x, y] = g.id.split(":").map(Number);
    const coordinates = [
      [x * 250, y * 250],
      [(x + 1) * 250, y * 250],
      [(x + 1) * 250, (y + 1) * 250],
      [x * 250, (y + 1) * 250],
      [x * 250, y * 250],
    ].map((p) =>
      proj4(
        "+proj=utm +zone=21 +south +datum=WGS84 +units=m +no_defs",
        "EPSG:4326",
        p,
      ),
    );
    return {
      ...g,
      dates: undefined,
      score,
      criticality: score < 30 ? "baixo" : score < 60 ? "medio" : "alto",
      recurring: g.dates.size >= 2,
      geometry: { type: "Polygon", coordinates: [coordinates] },
    };
  });
}
export function validateOccurrence(b) {
  for (const [k, min, max] of [
    ["title", 3, 160],
    ["neighborhood", 2, 100],
    ["description", 10, 2000],
  ])
    if (
      typeof b[k] !== "string" ||
      b[k].trim().length < min ||
      b[k].length > max
    )
      throw Object.assign(
        new Error(`Campo ${k}: informe de ${min} a ${max} caracteres.`),
        { status: 400 },
      );
  if (!["alagamento", "residuo"].includes(b.type))
    throw Object.assign(new Error("Tipo inválido."), { status: 400 });
  if (!inManaus(b.lat, b.lng))
    throw Object.assign(new Error("Localização fora do município de Manaus."), {
      status: 400,
    });
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ||
    isNaN(Date.parse(b.date)) ||
    new Date(b.date).toISOString().slice(0, 10) !== b.date ||
    b.date > civilDate()
  )
    throw Object.assign(new Error("Data inválida ou futura."), { status: 400 });
  if (
    b.contact != null &&
    (typeof b.contact !== "string" || b.contact.length > 150)
  )
    throw Object.assign(new Error("Contato inválido."), { status: 400 });
}
export function publicRow(r, areas) {
  const a = areas.find((g) => g.id === cell(r.lat, r.lng));
  const { owner, contact, reason, ...safe } = r;
  return {
    ...safe,
    cell: cell(r.lat, r.lng),
    score: a?.score ?? null,
    criticality: a?.criticality ?? "sem_dados",
    recurring: a?.recurring ?? false,
  };
}
