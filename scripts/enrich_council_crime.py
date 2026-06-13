import json
from shapely.geometry import shape, Point

with open(r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\crime_points_hourly.json') as f:
    crime_data = json.load(f)

with open(r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\council_districts.geojson') as f:
    cd_gj = json.load(f)

# Build district shapes
districts = []
for feat in cd_gj['features']:
    geom = shape(feat['geometry'])
    props = feat['properties']
    districts.append({
        'geom': geom,
        'district': props['District'],
        'name': props['NAME'],
        'active_addresses': props.get('active_addresses', 0),
        'vacancy_pct': props.get('vacancy_pct', 0),
    })

# Flatten all crime points from all 24 hours
all_points = []
for hour_pts in crime_data['hours']:
    all_points.extend(hour_pts)

total_actual = crime_data.get('total', len(all_points))
scale = total_actual / len(all_points)
print(f'Sample: {len(all_points)}  Actual: {total_actual}  Scale: {scale:.4f}')

# Count crimes per district
crime_counts = {d['district']: 0 for d in districts}
unassigned = 0

for i, pt in enumerate(all_points):
    lat, lng = pt[0], pt[1]
    p = Point(lng, lat)
    matched = False
    for d in districts:
        if d['geom'].contains(p):
            crime_counts[d['district']] += 1
            matched = True
            break
    if not matched:
        unassigned += 1
    if i % 20000 == 0:
        print(f'  {i}/{len(all_points)}...')

print(f'Unassigned: {unassigned} ({unassigned/len(all_points)*100:.1f}%)')

# Enrich GeoJSON features
results = []
for d in sorted(districts, key=lambda x: x['district']):
    cd = d['district']
    sample_count = crime_counts[cd]
    estimated = int(sample_count * scale)
    active_addr = d['active_addresses']
    ratio = round(estimated / active_addr * 1000, 1) if active_addr > 0 else 0
    results.append({
        'district': cd,
        'name': d['name'],
        'crime_sample': sample_count,
        'crime_estimated': estimated,
        'active_addresses': active_addr,
        'crimes_per_1k_addr': ratio,
    })
    print(f"  CD{cd:02d} {d['name'][:20]:20s}: est={estimated:7d}  addr={active_addr:6d}  c/1k={ratio}")

# Write enriched GeoJSON
for feat in cd_gj['features']:
    district_num = feat['properties']['District']
    for r in results:
        if r['district'] == district_num:
            feat['properties']['crime_estimated'] = r['crime_estimated']
            feat['properties']['crimes_per_1k_addr'] = r['crimes_per_1k_addr']
            break

out_path = r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\council_districts.geojson'
with open(out_path, 'w') as f:
    json.dump(cd_gj, f, separators=(',', ':'))

print(f'\nSaved enriched GeoJSON to {out_path}')
