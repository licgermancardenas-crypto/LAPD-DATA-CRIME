"""
Computes active/inactive address counts and vacancy_pct from the City of LA
address parquet, by Council District and by LAPD Division.

CD aggregation (council_districts.geojson) reproduces the active_addresses /
total_addresses / inactive_addresses / vacancy_pct fields already present in
that file (CNCL_DIST is a direct column on the source data).

LAPD division aggregation has no source column, so it spatial-joins each
address point against lapd_divisions.geojson and writes the same four fields
into a new lapd_divisions_addresses.geojson, to use as an arrest-rate
denominator.
"""
import json
import numpy as np
import pandas as pd
import shapely
from shapely import STRtree
from shapely.geometry import shape

PARQUET_PATH = r'C:\Users\corra\LAPD-DATA-CRIME\datasets\Addresses_in_the_City_of_Los_Angeles_20260613.parquet'
CD_GEOJSON = r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\council_districts.geojson'
LAPD_GEOJSON = r'C:\Users\corra\LAPD-DATA-CRIME\data\external\lapd_divisions.geojson'
LAPD_OUT = r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\lapd_divisions_addresses.geojson'

df = pd.read_parquet(PARQUET_PATH)
df['is_active'] = df['ASGN_STTS_IND'] == 'A'
print(f'Loaded {len(df):,} addresses')

# ── Council District aggregation ──────────────────────────────────────────
cd_df = df.dropna(subset=['CNCL_DIST']).copy()
cd_df['CNCL_DIST'] = cd_df['CNCL_DIST'].astype(int)

cd_agg = cd_df.groupby('CNCL_DIST').agg(
    total_addresses=('is_active', 'size'),
    active_addresses=('is_active', 'sum'),
).reset_index()
cd_agg['inactive_addresses'] = cd_agg['total_addresses'] - cd_agg['active_addresses']
cd_agg['vacancy_pct'] = (cd_agg['inactive_addresses'] / cd_agg['total_addresses'] * 100).round(1)

cd_stats = {int(r.CNCL_DIST): r for _, r in cd_agg.iterrows()}

with open(CD_GEOJSON, encoding='utf-8') as f:
    cd_gj = json.load(f)

for feat in cd_gj['features']:
    district = feat['properties']['District']
    r = cd_stats.get(district)
    if r is None:
        continue
    feat['properties']['total_addresses'] = int(r.total_addresses)
    feat['properties']['active_addresses'] = int(r.active_addresses)
    feat['properties']['inactive_addresses'] = int(r.inactive_addresses)
    feat['properties']['vacancy_pct'] = float(r.vacancy_pct)
    print(f"  CD{district:02d}: total={int(r.total_addresses):6,d}  active={int(r.active_addresses):6,d}  vacancy={r.vacancy_pct}%")

with open(CD_GEOJSON, 'w', encoding='utf-8') as f:
    json.dump(cd_gj, f, separators=(',', ':'))
print(f'Saved {CD_GEOJSON}')

del cd_df, cd_agg, cd_gj  # free RAM before the spatial join (low-memory box)

# ── LAPD Division aggregation (spatial join via STRtree, low-RAM) ───────
print('\nSpatial join against LAPD divisions...')
with open(LAPD_GEOJSON, encoding='utf-8') as f:
    lapd_gj = json.load(f)

name_col = 'area name' if 'area name' in lapd_gj['features'][0]['properties'] else 'name'
div_names = [feat['properties'][name_col] for feat in lapd_gj['features']]
div_polys = [shape(feat['geometry']) for feat in lapd_gj['features']]
tree = STRtree(div_polys)

# Division boundaries are convex-hull approximations (see geojson 'source'
# property) and overlap each other. "within" containment alone double-counts
# points caught in an overlap, so each point is resolved to exactly one
# division: the nearest centroid among its containing matches, or — for
# points outside every hull — the nearest centroid overall.
centroids = np.array([[p.centroid.x, p.centroid.y] for p in div_polys])

is_active = df['is_active'].to_numpy()
total_addresses = np.zeros(len(div_polys), dtype=np.int64)
active_addresses = np.zeros(len(div_polys), dtype=np.int64)
unmatched = 0

CHUNK = 100_000
lon = df['LON'].to_numpy()
lat = df['LAT'].to_numpy()
for start in range(0, len(df), CHUNK):
    end = min(start + CHUNK, len(df))
    n = end - start
    chunk_lon, chunk_lat = lon[start:end], lat[start:end]
    pts = shapely.points(chunk_lon, chunk_lat)
    pt_idx, poly_idx = tree.query(pts, predicate='within')

    assigned = np.full(n, -1, dtype=np.int64)
    if len(pt_idx) > 0:
        dist2 = (centroids[poly_idx, 0] - chunk_lon[pt_idx]) ** 2 + (centroids[poly_idx, 1] - chunk_lat[pt_idx]) ** 2
        order = np.lexsort((dist2, pt_idx))  # group by pt_idx, nearest first
        pt_sorted, poly_sorted = pt_idx[order], poly_idx[order]
        first_of_group = np.empty(len(pt_sorted), dtype=bool)
        first_of_group[0] = True
        first_of_group[1:] = pt_sorted[1:] != pt_sorted[:-1]
        assigned[pt_sorted[first_of_group]] = poly_sorted[first_of_group]

    no_match = assigned == -1
    unmatched += int(no_match.sum())
    if no_match.any():
        d2 = (centroids[None, :, 0] - chunk_lon[no_match, None]) ** 2 + (centroids[None, :, 1] - chunk_lat[no_match, None]) ** 2
        assigned[no_match] = d2.argmin(axis=1)

    np.add.at(total_addresses, assigned, 1)
    np.add.at(active_addresses, assigned, is_active[start:end])
    print(f'  {end:,}/{len(df):,}...')

inactive_addresses = total_addresses - active_addresses
vacancy_pct = np.divide(inactive_addresses, total_addresses, out=np.zeros_like(total_addresses, dtype=float), where=total_addresses > 0) * 100

print(f'Points outside every division hull (assigned to nearest centroid): {unmatched:,} ({unmatched/len(df)*100:.1f}%)')

for i, feat in enumerate(lapd_gj['features']):
    feat['properties']['total_addresses'] = int(total_addresses[i])
    feat['properties']['active_addresses'] = int(active_addresses[i])
    feat['properties']['inactive_addresses'] = int(inactive_addresses[i])
    feat['properties']['vacancy_pct'] = round(float(vacancy_pct[i]), 1)
    print(f"  {div_names[i]:25s}: total={int(total_addresses[i]):6,d}  active={int(active_addresses[i]):6,d}  vacancy={round(float(vacancy_pct[i]),1)}%")

with open(LAPD_OUT, 'w', encoding='utf-8') as f:
    json.dump(lapd_gj, f, separators=(',', ':'))
print(f'Saved {LAPD_OUT}')
