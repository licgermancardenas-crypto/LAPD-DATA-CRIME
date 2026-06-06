// Pure client-side filter computation — no imports needed

const AGE_ORDER = [
  'Juvenile (<18)', 'Young Adult (18-24)', 'Adult (25-34)',
  'Adult (35-49)', 'Middle-Aged (50-64)', 'Senior (65+)',
];

// Group an array of objects, summing numeric fields per key
function groupSum(arr, keyFn, fields) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, Object.fromEntries(fields.map(f => [f, 0])));
    const b = map.get(k);
    for (const f of fields) b[f] = (b[f] || 0) + (item[f] || 0);
  }
  return Array.from(map.entries()).map(([k, b]) => ({ _k: k, ...b }));
}

function pct(n, d) { return d ? parseFloat((n / d * 100).toFixed(1)) : 0; }

// ── Category list filtered by area (and activePart) ───────────────────────
export function computeCategories(crossDivCat, baseCats, filters, activePart) {
  // If no area filter and no part filter, use pre-computed base categories
  if (!filters.area && activePart === 'all') return baseCats;

  let d = crossDivCat;
  if (activePart !== 'all') d = d.filter(r => r.part === activePart);
  if (filters.area) d = d.filter(r => r.area === filters.area);

  // Meta: part + is_violent from base categories
  const meta = Object.fromEntries(
    baseCats.map(c => [c.category, { part: c.part, is_violent: c.is_violent, part_label: c.part_label }])
  );

  const groups = groupSum(d, r => r.category, ['crimes', 'cleared', 'violent']);
  const total  = groups.reduce((s, g) => s + g.crimes, 0);

  return groups.map(g => ({
    category:       g._k,
    crimes:         g.crimes,
    cleared:        g.cleared,
    violent:        g.violent,
    share_pct:      pct(g.crimes, total),
    clearance_rate: pct(g.cleared, g.crimes),
    ...(meta[g._k] ?? { part: 'p2', is_violent: false, part_label: 'Part 2' }),
  })).sort((a, b) => b.crimes - a.crimes);
}

// ── Division list filtered by category (and activePart) ───────────────────
export function computeDivisions(crossDivCat, filters, activePart) {
  // If no category filter and no part filter, caller should use base division data
  if (!filters.category && activePart === 'all') return null; // signal: use base

  let d = crossDivCat;
  if (activePart !== 'all') d = d.filter(r => r.part === activePart);
  if (filters.category) d = d.filter(r => r.category === filters.category);

  const groups = groupSum(d, r => r.area, ['crimes', 'cleared', 'violent']);

  return groups.map(g => {
    // P1/P2 splits: filter full cross data (no part filter, but with category filter)
    let sub = crossDivCat.filter(r => r.area === g._k);
    if (filters.category) sub = sub.filter(r => r.category === filters.category);
    const p1  = sub.filter(r => r.part === 'p1');
    const p2  = sub.filter(r => r.part === 'p2');
    const c1  = p1.reduce((s, r) => s + r.crimes,  0);
    const c2  = p2.reduce((s, r) => s + r.crimes,  0);
    const cl1 = p1.reduce((s, r) => s + r.cleared, 0);
    const cl2 = p2.reduce((s, r) => s + r.cleared, 0);

    return {
      name:              g._k,
      crimes:            g.crimes,
      clearance_rate:    pct(g.cleared, g.crimes),
      violent_pct:       pct(g.violent, g.crimes),
      crimes_p1:         c1,
      clearance_rate_p1: pct(cl1, c1),
      crimes_p2:         c2,
      clearance_rate_p2: pct(cl2, c2),
    };
  }).sort((a, b) => b.crimes - a.crimes);
}

// ── Victim stats filtered by category and/or age group ────────────────────
export function computeVictims(rawCross, baseVictims, filters) {
  const activeFilters = filters.category || filters.ageGroup;
  if (!activeFilters) return baseVictims;

  let d = rawCross;
  if (filters.category) d = d.filter(r => r.cat === filters.category);
  if (filters.ageGroup) d = d.filter(r => r.age === filters.ageGroup);

  const totalV = d.reduce((s, r) => s + r.c, 0);
  if (totalV === 0) return baseVictims; // no data for this combination

  const buildGroup = (keyFn, labelKey) => {
    const groups = groupSum(d, keyFn, ['c', 'v']);
    return groups
      .map(g => ({
        [labelKey]: g._k,
        crimes:      g.c,
        violent:     g.v,
        share_pct:   pct(g.c, totalV),
        violent_pct: pct(g.v, g.c),
      }))
      .filter(g => g[labelKey] && g[labelKey] !== 'nan' && g[labelKey] !== 'Unknown')
      .sort((a, b) => b.crimes - a.crimes);
  };

  const by_age_raw = buildGroup(r => r.age, 'age');
  by_age_raw.sort((a, b) => (AGE_ORDER.indexOf(a.age) ?? 99) - (AGE_ORDER.indexOf(b.age) ?? 99));

  const by_sex = buildGroup(r => r.sex, 'sex').filter(g => g.sex !== 'Unknown');

  // by_cat_sex filtered to this category only
  const filteredCatSex = filters.category
    ? (baseVictims.by_cat_sex ?? []).filter(c => c.category === filters.category)
    : baseVictims.by_cat_sex;

  return {
    ...baseVictims,
    by_sex,
    by_age: by_age_raw,
    by_descent: buildGroup(r => r.des, 'descent'),
    by_cat_sex: filteredCatSex,
    _filtered: true,
    _filter_total: totalV,
  };
}
