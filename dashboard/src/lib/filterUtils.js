// Pure client-side filter computation — no imports needed

const AGE_ORDER = [
  'Juvenile (<18)', 'Young Adult (18-24)', 'Adult (25-34)',
  'Adult (35-49)', 'Middle-Aged (50-64)', 'Senior (65+)',
];

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

// ── monthly_cross helpers (year-aware path) ──────────────────────────────────

/**
 * Filter monthly_cross rows by all active dimensions.
 * Pass skipArea=true for division bar (shows all areas even when area filter is set).
 */
export function filterCrossRows(mc, filters, activePart, { skipArea = false } = {}) {
  let rows = mc;
  if (filters.years?.length)      rows = rows.filter(r => filters.years.includes(r.year));
  if (filters.months?.length)     rows = rows.filter(r => filters.months.includes(r.month));
  if (!skipArea && filters.area)  rows = rows.filter(r => r.area  === filters.area);
  if (filters.category)           rows = rows.filter(r => r.category === filters.category);
  if (activePart !== 'all')       rows = rows.filter(r => r.part  === activePart);
  return rows;
}

export function aggregateSummary(rows) {
  const total   = rows.reduce((s, r) => s + r.crimes,  0);
  const cleared = rows.reduce((s, r) => s + r.cleared, 0);
  const violent = rows.reduce((s, r) => s + r.violent, 0);
  return {
    total_crimes:   total,
    clearance_rate: pct(cleared, total),
    violent_pct:    pct(violent, total),
    violent_crimes: violent,
  };
}

export function aggregateDivisions(rows) {
  const areaMap = new Map();
  for (const r of rows) {
    if (!areaMap.has(r.area)) {
      areaMap.set(r.area, { name: r.area, crimes: 0, cleared: 0, violent: 0,
                            p1: 0, p1_cl: 0, p2: 0, p2_cl: 0 });
    }
    const a = areaMap.get(r.area);
    a.crimes  += r.crimes;
    a.cleared += r.cleared;
    a.violent += r.violent;
    if (r.part === 'p1') { a.p1 += r.crimes; a.p1_cl += r.cleared; }
    else                  { a.p2 += r.crimes; a.p2_cl += r.cleared; }
  }
  return Array.from(areaMap.values()).map(a => ({
    name:              a.name,
    crimes:            a.crimes,
    clearance_rate:    pct(a.cleared, a.crimes),
    violent_pct:       pct(a.violent, a.crimes),
    crimes_p1:         a.p1,
    clearance_rate_p1: pct(a.p1_cl, a.p1),
    crimes_p2:         a.p2,
    clearance_rate_p2: pct(a.p2_cl, a.p2),
  })).sort((a, b) => b.crimes - a.crimes);
}

export function aggregateCategories(rows, baseCats) {
  const catMap = new Map();
  for (const r of rows) {
    if (!catMap.has(r.category)) {
      catMap.set(r.category, { category: r.category, crimes: 0, cleared: 0, violent: 0 });
    }
    const c = catMap.get(r.category);
    c.crimes  += r.crimes;
    c.cleared += r.cleared;
    c.violent += r.violent;
  }
  const meta = Object.fromEntries(baseCats.map(c => [c.category, c]));
  const total = Array.from(catMap.values()).reduce((s, c) => s + c.crimes, 0);
  return Array.from(catMap.values()).map(c => ({
    ...c,
    share_pct:      pct(c.crimes, total),
    clearance_rate: pct(c.cleared, c.crimes),
    ...(meta[c.category] ?? { part: 'p2', is_violent: false, part_label: 'Part 2' }),
  })).sort((a, b) => b.crimes - a.crimes);
}

export function aggregateByYear(rows) {
  const yearMap = new Map();
  for (const r of rows) {
    if (!yearMap.has(r.year)) yearMap.set(r.year, { year: r.year, crimes: 0, cleared: 0, violent: 0 });
    const y = yearMap.get(r.year);
    y.crimes  += r.crimes;
    y.cleared += r.cleared;
    y.violent += r.violent;
  }
  return Array.from(yearMap.values()).map(y => ({
    year:           y.year,
    crimes:         y.crimes,
    clearance_rate: pct(y.cleared, y.crimes),
    violent_pct:    pct(y.violent, y.crimes),
  })).sort((a, b) => a.year - b.year);
}

export function aggregateMonthly(rows) {
  const periodMap = new Map();
  for (const r of rows) {
    if (!periodMap.has(r.period)) {
      periodMap.set(r.period, { period: r.period, year: r.year, month: r.month,
                                crimes: 0, cleared: 0, violent: 0 });
    }
    const p = periodMap.get(r.period);
    p.crimes  += r.crimes;
    p.cleared += r.cleared;
    p.violent += r.violent;
  }
  const sorted = Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));
  sorted.forEach(r => {
    const days = new Date(r.year, r.month, 0).getDate();
    r.daily_avg     = parseFloat((r.crimes  / days).toFixed(1));
    r.daily_violent = parseFloat((r.violent / days).toFixed(1));
  });
  for (let i = 0; i < sorted.length; i++) {
    const w = sorted.slice(Math.max(0, i - 2), i + 1);
    sorted[i].rolling3_daily = parseFloat((w.reduce((s, x) => s + x.daily_avg, 0) / w.length).toFixed(1));
  }
  return sorted;
}

// ── cross_div_cat legacy helpers (no year support — fallback) ────────────────

export function computeCategories(crossDivCat, baseCats, filters, activePart) {
  if (!filters.area && activePart === 'all') return baseCats;
  let d = crossDivCat;
  if (activePart !== 'all') d = d.filter(r => r.part === activePart);
  if (filters.area) d = d.filter(r => r.area === filters.area);
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

export function computeDivisions(crossDivCat, filters, activePart) {
  if (!filters.category && activePart === 'all') return null;
  let d = crossDivCat;
  if (activePart !== 'all') d = d.filter(r => r.part === activePart);
  if (filters.category) d = d.filter(r => r.category === filters.category);
  const groups = groupSum(d, r => r.area, ['crimes', 'cleared', 'violent']);
  return groups.map(g => {
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

export function computeFilteredSummary(crossDivCat, filters, activePart) {
  const hasFilter = filters.area || filters.category || activePart !== 'all';
  if (!hasFilter) return null;
  let d = crossDivCat;
  if (activePart !== 'all') d = d.filter(r => r.part === activePart);
  if (filters.area)         d = d.filter(r => r.area === filters.area);
  if (filters.category)     d = d.filter(r => r.category === filters.category);
  const total   = d.reduce((s, r) => s + r.crimes,  0);
  const cleared = d.reduce((s, r) => s + r.cleared, 0);
  const violent = d.reduce((s, r) => s + r.violent, 0);
  return {
    total_crimes:   total,
    clearance_rate: pct(cleared, total),
    violent_pct:    pct(violent, total),
    violent_crimes: violent,
  };
}

export function computeVictims(rawCross, baseVictims, filters) {
  const activeFilters = filters.category || filters.ageGroup;
  if (!activeFilters) return baseVictims;
  let d = rawCross;
  if (filters.category) d = d.filter(r => r.cat === filters.category);
  if (filters.ageGroup) d = d.filter(r => r.age === filters.ageGroup);
  const totalV = d.reduce((s, r) => s + r.c, 0);
  if (totalV === 0) return baseVictims;
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
