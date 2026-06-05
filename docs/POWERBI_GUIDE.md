# LAPD Crime Dashboard — Power BI Desktop Guide

**Dataset:** 1,004,894 crimes · 2020-2024 · Los Angeles  
**Data files:** `data/powerbi/` (10 CSV tables + DAX reference)  
**Theme:** Dark mode (`#0f1117` background — set via View > Themes > Customize)

---

## 1. Import Data

**Home → Get Data → Text/CSV** — import each file in `data/powerbi/`:

| File | Type | Rows |
|------|------|------|
| `fact_crimes.csv` | Fact table | 1,004,894 |
| `dim_date.csv` | Date dimension | 1,827 |
| `dim_area.csv` | Area dimension | 21 |
| `dim_crime_cat.csv` | Crime category dimension | 18 |
| `agg_monthly.csv` | Monthly KPIs | 60 |
| `agg_daily.csv` | Daily aggregates | 1,826 |
| `agg_hourly_dow.csv` | Hour × Day heatmap | 168 |
| `agg_division_cat.csv` | Division × Category | 362 |
| `agg_victim.csv` | Victim profile | 1,433 |
| `agg_clearance.csv` | Clearance by division | 1,763 |

> **Encoding:** All CSVs are UTF-8 BOM (Power BI autodetects). Delimiter: comma.

---

## 2. Data Model — Relationships

Go to **Model** view and create these relationships:

| From (Many side) | To (One side) | Cardinality | Active |
|---|---|---|---|
| `fact_crimes[date_key]` | `dim_date[date_key]` | Many:1 | Yes |
| `fact_crimes[area_id]` | `dim_area[area_id]` | Many:1 | Yes |
| `fact_crimes[cat_id]` | `dim_crime_cat[cat_id]` | Many:1 | Yes |

> The aggregate tables (`agg_*`) are **standalone** — no relationships needed. Use them directly in visuals that don't need drill-through from the fact table.

**Mark `dim_date` as Date Table:**  
Right-click `dim_date` → Mark as date table → column: `date`  
This enables all time intelligence DAX functions (YoY, rolling avg, etc.).

---

## 3. DAX Measures

Open `data/powerbi/dax_measures.txt` and create each measure in Power BI:

**Home → New Measure** (or right-click a table → New measure)

Paste each block from the file. Key measures:

| Measure | Description |
|---------|-------------|
| `Total Crimes` | COUNTROWS(fact_crimes) |
| `Clearance Rate %` | cleared / total × 100 |
| `Violent Crime %` | violent / total × 100 |
| `Crimes YoY %` | vs same period last year |
| `Crimes 3M Rolling Avg` | 3-month rolling window |
| `Hot Day Crime Rate` | crimes/day on hot days |
| `Clearance Rate Color` | conditional hex color |
| `YoY Crime Color` | red if ↑, green if ↓ |

---

## 4. Report Pages — Specifications

### Theme Setup

View → Themes → Customize current theme:

```json
{
  "name": "LAPD Dark",
  "background": "#0f1117",
  "foreground": "#e8eaf0",
  "tableAccent": "#4f8ef7",
  "dataColors": ["#4f8ef7","#e05252","#3ecf8e","#e0883a","#7c5cbf","#e0c066","#60c9d4","#7b82a0"]
}
```

---

### Page 1 — Executive Summary

**Layout:** 4 KPI cards (top) + 2 charts (bottom left/right) + map (bottom center)

| Visual | Type | Data |
|--------|------|------|
| Total Crimes 2020-2024 | Card | `[Total Crimes]` |
| Clearance Rate | Card | `[Clearance Rate %]` + color rule |
| Violent Crime % | Card | `[Violent Crime %]` |
| YoY Change | Card | `[Crimes YoY %]` + color rule |
| Monthly Crime Trend | Line chart | X=`agg_monthly[period]` Y=`agg_monthly[crimes]` |
| Top 10 Crime Categories | Bar chart (horiz.) | `dim_crime_cat[crime_category]` + `[Total Crimes]` |
| Crime Density Map | ArcGIS / Bing map | `fact_crimes[LAT]`, `fact_crimes[LON]` — filter `valid_geo=1` |

**Slicers:** Year (dim_date[year]), Crime Category (dim_crime_cat[crime_category])

---

### Page 2 — Geographic Analysis

| Visual | Type | Data |
|--------|------|------|
| Crimes by Division | Bar chart | `dim_area[area_name]` + `[Total Crimes]`, sorted desc |
| Division × Category Matrix | Matrix | Rows=`dim_area[area_name]` Cols=`dim_crime_cat[crime_category]` Values=`[Total Crimes]` |
| Clearance Rate by Division | Bar chart | `dim_area[area_name]` + `[Clearance Rate %]`, color-coded |
| Map | Filled map | `agg_division_cat[AREA NAME]` + `agg_division_cat[crimes]` |

**Drill-through:** from division bar → Page 5 (Division Detail)

---

### Page 3 — Temporal Patterns

| Visual | Type | Data |
|--------|------|------|
| Hour × Day Heatmap | Matrix | Rows=`agg_hourly_dow[day_name]` Cols=`agg_hourly_dow[hour]` Values=`agg_hourly_dow[crimes]` — apply diverging color scale |
| Monthly Seasonality | Line chart | X=`dim_date[month_name]` Y=`[Total Crimes]` Legend=`dim_date[year]` |
| Time of Day Donut | Donut | `fact_crimes[time_of_day]` + `[Total Crimes]` |
| Weekend vs Weekday | Clustered bar | `dim_date[is_weekend]` + `[Total Crimes]`, `[Clearance Rate %]` |
| YoY Crime Trend | Line chart | `agg_monthly[period]` + `agg_monthly[crimes]`, `agg_monthly[violent]` |

---

### Page 4 — Victim Profile

| Visual | Type | Data |
|--------|------|------|
| Victim Age Distribution | Histogram / Bar | `agg_victim[age_group]` + `agg_victim[crimes]` |
| Sex Breakdown | Donut | `fact_crimes[vict_sex]` + `[Total Crimes]` |
| Descent/Ethnicity | Bar (horiz.) | `fact_crimes[descent_group]` + `[Total Crimes]` |
| Crime Category × Age Group | Matrix | `agg_victim[crime_category]` × `agg_victim[age_group]` + crimes |
| Avg Victim Age by Category | Bar | `dim_crime_cat[crime_category]` + `[Avg Victim Age]` |
| Female Victims % by Category | Bar | sorted desc |

---

### Page 5 — Weather & Economy

| Visual | Type | Data |
|--------|------|------|
| Monthly Crimes + Unemployment | Line + Column combo | `agg_monthly[period]` + crimes (column) + unemp_rate (line, second Y axis) |
| Temp vs Daily Crimes | Scatter | `agg_daily[temp_avg_f]` (X) + `agg_daily[crimes]` (Y) + `agg_daily[year]` (color) |
| Hot vs Normal Day Card | Card pair | `[Hot Day Crime Rate]` vs `[Normal Day Crime Rate]` |
| Rainy vs Dry Day | Card pair | crimes on rainy vs dry days |
| Unemployment Timeline | Area chart | `agg_monthly[period]` + `agg_monthly[unemp_rate]` |
| Crime Category vs Temp | Scatter | category-level avg temp + crimes |

---

### Page 6 — Clearance & Enforcement

| Visual | Type | Data |
|--------|------|------|
| Clearance Rate Trend | Line | `agg_monthly[period]` + `agg_monthly[clearance_rate_pct]` — reference line at 15% |
| Clearance by Division × Year | Matrix | `agg_clearance[AREA NAME]` × `agg_clearance[year]` + clearance_rate_pct — diverging color |
| Clearance by Crime Category | Bar | `agg_clearance[crime_category]` + `agg_clearance[clearance_rate_pct]` — threshold color |
| Reporting Lag | KPI card | `[Avg Days to Report]` |
| Same-Day Reports % | KPI card | `[Same-Day Reports %]` |
| Arrest Rate Trend | Line | `agg_monthly[period]` + arrested/crimes |

---

## 5. Slicer Panel (all pages)

Add a vertical slicer pane visible on all pages via **Sync Slicers**:

- **Year:** `dim_date[year]` — dropdown or tile
- **Crime Category:** `dim_crime_cat[crime_category]` — list
- **LAPD Division:** `dim_area[area_name]` — list
- **Violent Only toggle:** `dim_crime_cat[is_violent]` — toggle (0/1)

Use **View → Sync Slicers** to propagate across pages.

---

## 6. Publishing

1. **File → Publish → Power BI Service** (requires Power BI account)
2. Or **File → Export → PDF** for a static snapshot
3. Share the `.pbix` file — all data is embedded (no live connection needed)

---

## 7. Refresh / Update

When new LAPD data is available:

1. Run `python src/prepare_data.py` → new `lapd_clean.parquet`
2. Run `python src/external_data.py` → new `lapd_enriched.parquet`
3. Run `python src/powerbi_export.py` → refreshed CSVs in `data/powerbi/`
4. In Power BI Desktop → **Refresh** (Home tab)

---

*Generated by LAPD Crime Analysis Pipeline — Phase 4A*
