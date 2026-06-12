/**
 * geoAnalytics.js — Geospatial analytics engine (zero dependencies)
 *
 * Uses ray-casting point-in-polygon with bbox pre-filter spatial index.
 * Throughput: ~5 000 pts × 114 polygons ≈ 2–4 ms on a mid-range laptop.
 */

// ── Sector definitions ────────────────────────────────────────────────────────
export const NIGHTLIFE_SECTORS = [
  { key: 'biz_entertainment',      label: 'Entretenimiento',   weight: 1.0 },
  { key: 'biz_food_restaurants',   label: 'Restaurantes/Bares', weight: 0.7 },
  { key: 'biz_retail',             label: 'Retail / Licorerías', weight: 0.5 },
  { key: 'biz_personal_services',  label: 'Servicios Personales', weight: 0.4 },
];

// Composite nightlife density score for a neighborhood properties object
export function nightlifeScore(props) {
  return NIGHTLIFE_SECTORS.reduce((sum, s) => sum + (props[s.key] || 0) * s.weight, 0);
}

// ── Spatial index ─────────────────────────────────────────────────────────────

/**
 * Builds a lightweight spatial index from GeoJSON Polygon/MultiPolygon features.
 * Each entry stores: the feature, its outer-ring coordinates, and its bbox.
 * @param {object[]} features GeoJSON feature array
 * @returns {SpatialEntry[]}
 */
export function buildSpatialIndex(features) {
  const index = [];

  for (const feat of features) {
    if (!feat.geometry) continue;
    const { type, coordinates } = feat.geometry;

    // Collect all outer rings (handle both Polygon and MultiPolygon)
    const rings = type === 'Polygon'
      ? [coordinates[0]]
      : coordinates.map(p => p[0]);        // MultiPolygon → first ring of each part

    for (const ring of rings) {
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;

      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }

      index.push({ feat, ring, minLat, maxLat, minLng, maxLng });
    }
  }

  return index;
}

// ── Ray-casting PiP ───────────────────────────────────────────────────────────
// ring is [[lng, lat], ...] (GeoJSON standard)
function pipRayCast(lat, lng, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i]; // xi = lng, yi = lat
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Returns the first feature whose polygon contains [lat, lng].
 * Uses bbox as a fast reject before running full PiP.
 */
export function findFeatureForPoint(lat, lng, spatialIndex) {
  for (const entry of spatialIndex) {
    if (lat < entry.minLat || lat > entry.maxLat ||
        lng < entry.minLng || lng > entry.maxLng) continue;
    if (pipRayCast(lat, lng, entry.ring)) return entry.feat;
  }
  return null;
}

// ── Main analytics function ───────────────────────────────────────────────────

/**
 * Compute commercial-crime correlation for one hour's crime points.
 *
 * @param {[number,number][]} hourPoints  Array of [lat, lng] pairs (up to ~5 000)
 * @param {object[]}          spatialIndex  Output of buildSpatialIndex()
 * @param {number}            [nlThreshold=3]  Min nightlife score to flag a neighborhood
 * @returns {CorrelationResult}
 */
export function computeCommercialCorrelation(hourPoints, spatialIndex, nlThreshold = 3) {
  const empty = { correlationIndex: 0, topSectors: [], inZone: 0, totalSampled: 0, nlThreshold };
  if (!hourPoints?.length || !spatialIndex?.length) return empty;

  // Sample at most 1 500 evenly-spaced points to keep runtime < 5 ms
  const MAX_SAMPLE = 1500;
  const step   = hourPoints.length > MAX_SAMPLE ? Math.ceil(hourPoints.length / MAX_SAMPLE) : 1;
  const sample = step === 1 ? hourPoints : hourPoints.filter((_, i) => i % step === 0);

  let inZone = 0;
  // sectorHits[key] = how many "in-zone" crimes fell in neighborhoods with that sector present
  const sectorHits = {};
  for (const s of NIGHTLIFE_SECTORS) sectorHits[s.key] = 0;

  for (const [lat, lng] of sample) {
    const feat = findFeatureForPoint(lat, lng, spatialIndex);
    if (!feat) continue;
    const p   = feat.properties;
    const score = nightlifeScore(p);
    if (score < nlThreshold) continue;

    inZone++;
    for (const s of NIGHTLIFE_SECTORS) {
      if ((p[s.key] || 0) > 0) sectorHits[s.key]++;
    }
  }

  const correlationIndex = sample.length > 0
    ? parseFloat(((inZone / sample.length) * 100).toFixed(1))
    : 0;

  // Build sector ranking sorted by hit count descending
  const topSectors = NIGHTLIFE_SECTORS
    .map(s => ({
      key:   s.key,
      label: s.label,
      hits:  sectorHits[s.key],
      pct:   inZone > 0 ? parseFloat(((sectorHits[s.key] / inZone) * 100).toFixed(1)) : 0,
    }))
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return { correlationIndex, topSectors, inZone, totalSampled: sample.length, nlThreshold };
}

/**
 * Pre-compute the nightlife threshold from the index features
 * (75th percentile of nightlife scores — neighborhoods with high density).
 */
export function computeNlThreshold(features) {
  const scores = features
    .map(f => nightlifeScore(f.properties))
    .filter(s => s > 0)
    .sort((a, b) => a - b);
  if (!scores.length) return 3;
  // 70th percentile
  const idx = Math.floor(scores.length * 0.70);
  return scores[idx] ?? 3;
}
