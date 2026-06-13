import json
from shapely.geometry import shape

with open(r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\lapd_divisions_crimes.geojson') as f:
    lapd_gj = json.load(f)

with open(r'C:\Users\corra\LAPD-DATA-CRIME\dashboard\public\data\council_districts.geojson') as f:
    cd_gj = json.load(f)

lapd_shapes = []
for feat in lapd_gj['features']:
    try:
        geom = shape(feat['geometry'])
        lapd_shapes.append({'name': feat['properties']['name'], 'geom': geom})
    except Exception as e:
        print(f"Skip LAPD {feat['properties'].get('name')}: {e}")

cd_shapes = []
for feat in cd_gj['features']:
    try:
        geom = shape(feat['geometry'])
        centroid = geom.centroid
        cd_shapes.append({
            'district': feat['properties']['District'],
            'geom': geom,
            'centroid': centroid,
        })
    except Exception as e:
        print(f"Skip CD {feat['properties'].get('District')}: {e}")

# For each LAPD division, find which CDs have centroid inside OR >10% overlap
mapping = {}
for lapd in lapd_shapes:
    matched_cds = []
    for cd in cd_shapes:
        try:
            if lapd['geom'].contains(cd['centroid']):
                matched_cds.append(cd['district'])
            elif lapd['geom'].intersects(cd['geom']):
                inter = lapd['geom'].intersection(cd['geom'])
                pct = inter.area / cd['geom'].area * 100
                if pct > 15:
                    matched_cds.append(cd['district'])
        except Exception:
            pass
    mapping[lapd['name']] = sorted(matched_cds)
    print(f"{lapd['name']:25s}: CD{matched_cds}")

print('\nJSON mapping:')
print(json.dumps(mapping, indent=2))
