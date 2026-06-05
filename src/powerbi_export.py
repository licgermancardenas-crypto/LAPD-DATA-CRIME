"""
Phase 4A -- Power BI Data Export
Generates a star-schema set of CSV tables optimised for Power BI Desktop import.

Star schema:
  fact_crimes.csv         Main fact table (~1M rows, lean columns)
  dim_date.csv            Date dimension (full time intelligence)
  dim_area.csv            LAPD area / division dimension
  dim_crime_cat.csv       Crime category dimension
  agg_monthly.csv         Monthly KPI aggregates (crimes, clearance, unemployment)
  agg_daily.csv           Daily aggregates + weather (for scatter / trend visuals)
  agg_hourly_dow.csv      Hour x Day-of-week heatmap data
  agg_division_cat.csv    Division x Category matrix
  agg_victim.csv          Victim profile aggregates by category
  agg_clearance.csv       Clearance rate by division + category

Run: python src/powerbi_export.py
"""

from pathlib import Path
import pandas as pd
import numpy as np

ROOT   = Path(__file__).parent.parent
PROC   = ROOT / "data" / "processed"
EXT    = ROOT / "data" / "external"
PBI    = ROOT / "data" / "powerbi"
PBI.mkdir(parents=True, exist_ok=True)


def load() -> pd.DataFrame:
    print("Loading lapd_enriched.parquet...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet")
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    print(f"  {len(df):,} rows x {df.shape[1]} cols")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# DIMENSION TABLES
# ══════════════════════════════════════════════════════════════════════════════

SEASON_ORDER   = ["Winter", "Spring", "Summer", "Fall"]
TOD_ORDER      = ["Night", "Morning", "Afternoon", "Evening"]
MONTH_NAMES    = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"]
DAY_NAMES_ABBR = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]


def build_dim_date(df: pd.DataFrame) -> pd.DataFrame:
    print("Building dim_date...")
    dates = pd.date_range("2020-01-01", "2024-12-31", freq="D")
    d = pd.DataFrame({"date": dates})
    d["date_key"]      = d["date"].dt.strftime("%Y%m%d").astype(int)
    d["year"]          = d["date"].dt.year
    d["quarter"]       = d["date"].dt.quarter
    d["quarter_label"] = "Q" + d["quarter"].astype(str)
    d["month"]         = d["date"].dt.month
    d["month_name"]    = d["month"].map(lambda m: MONTH_NAMES[m-1])
    d["month_label"]   = d["year"].astype(str) + "-" + d["month"].astype(str).str.zfill(2)
    d["week_of_year"]  = d["date"].dt.isocalendar().week.astype(int)
    d["day_of_week"]   = d["date"].dt.dayofweek          # 0=Mon
    d["day_name"]      = d["date"].dt.day_name()
    d["day_name_abbr"] = d["day_of_week"].map(lambda x: DAY_NAMES_ABBR[x])
    d["is_weekend"]    = (d["day_of_week"] >= 5).astype(int)
    d["season"]        = d["month"].map({12:"Winter",1:"Winter",2:"Winter",
                                         3:"Spring",4:"Spring",5:"Spring",
                                         6:"Summer",7:"Summer",8:"Summer",
                                         9:"Fall",10:"Fall",11:"Fall"})
    d["season_sort"]   = d["season"].map({s:i for i,s in enumerate(SEASON_ORDER)})
    d["date_str"]      = d["date"].dt.strftime("%Y-%m-%d")
    return d


def build_dim_area(df: pd.DataFrame) -> pd.DataFrame:
    print("Building dim_area...")
    area = (df[["AREA", "AREA NAME"]]
            .drop_duplicates()
            .sort_values("AREA")
            .rename(columns={"AREA": "area_code", "AREA NAME": "area_name"})
            .reset_index(drop=True))
    area["area_id"] = area.index + 1
    return area[["area_id", "area_code", "area_name"]]


def build_dim_crime_cat(df: pd.DataFrame) -> pd.DataFrame:
    print("Building dim_crime_cat...")
    cat = (df[["crime_category", "part_label", "is_violent", "is_property"]]
           .drop_duplicates(subset=["crime_category"])
           .sort_values("crime_category")
           .reset_index(drop=True))
    cat["cat_id"] = cat.index + 1
    cat["is_violent"]  = cat["is_violent"].astype(int)
    cat["is_property"] = cat["is_property"].astype(int)
    return cat[["cat_id", "crime_category", "part_label", "is_violent", "is_property"]]


# ══════════════════════════════════════════════════════════════════════════════
# FACT TABLE
# ══════════════════════════════════════════════════════════════════════════════

def build_fact_crimes(df: pd.DataFrame,
                      dim_date: pd.DataFrame,
                      dim_area: pd.DataFrame,
                      dim_cat:  pd.DataFrame) -> pd.DataFrame:
    print("Building fact_crimes...")

    fact = df.copy()

    # FK: date_key
    fact["date_key"] = fact["date_occ"].dt.strftime("%Y%m%d").astype(int)

    # FK: area_id
    area_map = dim_area.set_index("area_code")["area_id"].to_dict()
    fact["area_id"] = fact["AREA"].map(area_map)

    # FK: cat_id
    cat_map = dim_cat.set_index("crime_category")["cat_id"].to_dict()
    fact["cat_id"] = fact["crime_category"].map(cat_map)

    # Boolean -> int for Power BI
    for col in ["is_violent", "is_property", "cleared", "arrested",
                "is_hot_day", "is_rainy", "is_weekend", "reported_same_day"]:
        if col in fact.columns:
            fact[col] = fact[col].fillna(0).astype(int)

    # Select lean columns for the fact table
    cols = [
        "DR_NO",
        "date_key",
        "area_id",
        "cat_id",
        "hour",
        "time_of_day",
        "is_violent",
        "is_property",
        "cleared",
        "arrested",
        "is_weekend",
        "vict_age",
        "age_group",
        "vict_sex",
        "descent_group",
        "premises_group",
        "weapon_category",
        "days_to_report",
        "reported_same_day",
        "LAT",
        "LON",
        "valid_geo",
        "temp_avg_f",
        "is_hot_day",
        "precip_in",
        "is_rainy",
        "unemp_rate_pct",
        "GEOID",
    ]
    cols = [c for c in cols if c in fact.columns]
    fact = fact[cols].copy()

    # Clean up booleans
    fact["valid_geo"] = fact["valid_geo"].fillna(False).astype(int)
    fact["reported_same_day"] = fact["reported_same_day"].fillna(0).astype(int)

    # Null LAT/LON -> 0 (Power BI map requires numeric)
    fact["LAT"] = fact["LAT"].fillna(0).round(6)
    fact["LON"] = fact["LON"].fillna(0).round(6)

    print(f"  Fact table: {len(fact):,} rows x {len(cols)} cols")
    return fact


# ══════════════════════════════════════════════════════════════════════════════
# AGGREGATE TABLES
# ══════════════════════════════════════════════════════════════════════════════

def build_agg_monthly(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_monthly...")
    g = df.groupby(["year", "month"]).agg(
        crimes      = ("DR_NO",           "count"),
        violent     = ("is_violent",       "sum"),
        property_c  = ("is_property",      "sum"),
        cleared     = ("cleared",          "sum"),
        arrested    = ("arrested",         "sum"),
        unemp_rate  = ("unemp_rate_pct",   "first"),
        temp_avg    = ("temp_avg_f",        "mean"),
        precip_sum  = ("precip_in",         "sum"),
        hot_days    = ("is_hot_day",        "sum"),
        rainy_days  = ("is_rainy",          "sum"),
    ).reset_index()
    g["clearance_rate_pct"] = (g["cleared"] / g["crimes"] * 100).round(2)
    g["violent_pct"]        = (g["violent"] / g["crimes"] * 100).round(2)
    g["property_pct"]       = (g["property_c"] / g["crimes"] * 100).round(2)
    g["period"]             = (g["year"].astype(str) + "-"
                               + g["month"].astype(str).str.zfill(2))
    g["month_name"]         = g["month"].map(lambda m: MONTH_NAMES[m-1])
    return g


def build_agg_daily(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_daily...")
    df["date_str"] = df["date_occ"].dt.strftime("%Y-%m-%d")
    g = df.groupby("date_str").agg(
        crimes     = ("DR_NO",         "count"),
        violent    = ("is_violent",     "sum"),
        cleared    = ("cleared",        "sum"),
        temp_avg_f = ("temp_avg_f",     "first"),
        temp_max_f = ("temp_max_f",     "first"),
        precip_in  = ("precip_in",      "first"),
        is_hot_day = ("is_hot_day",     "first"),
        is_rainy   = ("is_rainy",       "first"),
    ).reset_index()
    g["date"]     = pd.to_datetime(g["date_str"])
    g["year"]     = g["date"].dt.year
    g["month"]    = g["date"].dt.month
    g["day_of_week"]  = g["date"].dt.dayofweek
    g["day_name"]     = g["date"].dt.day_name()
    g["is_weekend"]   = (g["day_of_week"] >= 5).astype(int)
    g["clearance_rate_pct"] = (g["cleared"] / g["crimes"] * 100).round(2)
    return g.drop(columns=["date"])


def build_agg_hourly_dow(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_hourly_dow...")
    g = df.groupby(["day_of_week", "hour"]).agg(
        crimes  = ("DR_NO", "count"),
        violent = ("is_violent", "sum"),
    ).reset_index()
    g["day_name"]     = g["day_of_week"].map(lambda x: DAY_NAMES_ABBR[x])
    g["violent_pct"]  = (g["violent"] / g["crimes"] * 100).round(2)
    return g


def build_agg_division_cat(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_division_cat...")
    g = df.groupby(["AREA NAME", "crime_category"]).agg(
        crimes   = ("DR_NO",    "count"),
        violent  = ("is_violent", "sum"),
        cleared  = ("cleared",    "sum"),
    ).reset_index()
    g["clearance_rate_pct"] = (g["cleared"] / g["crimes"] * 100).round(2)
    return g


def build_agg_victim(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_victim...")
    g = df.groupby(["crime_category", "age_group", "vict_sex", "descent_group"]).agg(
        crimes  = ("DR_NO",    "count"),
        violent = ("is_violent", "sum"),
    ).reset_index()
    return g


def build_agg_clearance(df: pd.DataFrame) -> pd.DataFrame:
    print("Building agg_clearance...")
    g = df.groupby(["AREA NAME", "crime_category", "year"]).agg(
        crimes  = ("DR_NO",    "count"),
        cleared = ("cleared",  "sum"),
        arrested= ("arrested", "sum"),
    ).reset_index()
    g["clearance_rate_pct"] = (g["cleared"] / g["crimes"] * 100).round(2)
    g["arrest_rate_pct"]    = (g["arrested"] / g["crimes"] * 100).round(2)
    return g


# ══════════════════════════════════════════════════════════════════════════════
# WRITE DAX MEASURES REFERENCE FILE
# ══════════════════════════════════════════════════════════════════════════════

DAX_MEASURES = """
// ============================================================
// LAPD Crime Dashboard — DAX Measures Reference
// Paste each measure into Power BI Desktop -> New Measure
// ============================================================

// ── CORE KPIs ────────────────────────────────────────────────

Total Crimes =
    COUNTROWS(fact_crimes)

Violent Crimes =
    CALCULATE([Total Crimes], fact_crimes[is_violent] = 1)

Property Crimes =
    CALCULATE([Total Crimes], fact_crimes[is_property] = 1)

Cleared Cases =
    CALCULATE([Total Crimes], fact_crimes[cleared] = 1)

Arrested Cases =
    CALCULATE([Total Crimes], fact_crimes[arrested] = 1)

Clearance Rate % =
    DIVIDE([Cleared Cases], [Total Crimes], 0) * 100

Arrest Rate % =
    DIVIDE([Arrested Cases], [Total Crimes], 0) * 100

Violent Crime % =
    DIVIDE([Violent Crimes], [Total Crimes], 0) * 100

Property Crime % =
    DIVIDE([Property Crimes], [Total Crimes], 0) * 100


// ── YEAR-OVER-YEAR ───────────────────────────────────────────

Crimes PY =
    CALCULATE([Total Crimes], SAMEPERIODLASTYEAR(dim_date[date]))

Crimes YoY % =
    DIVIDE([Total Crimes] - [Crimes PY], [Crimes PY], BLANK()) * 100

Clearance Rate PY =
    CALCULATE([Clearance Rate %], SAMEPERIODLASTYEAR(dim_date[date]))

Clearance YoY pp =
    [Clearance Rate %] - [Clearance Rate PY]


// ── ROLLING AVERAGES ─────────────────────────────────────────

Crimes 3M Rolling Avg =
    AVERAGEX(
        DATESINPERIOD(dim_date[date], LASTDATE(dim_date[date]), -3, MONTH),
        [Total Crimes]
    )

Crimes 12M Rolling Avg =
    AVERAGEX(
        DATESINPERIOD(dim_date[date], LASTDATE(dim_date[date]), -12, MONTH),
        [Total Crimes]
    )


// ── WEATHER KPIs ─────────────────────────────────────────────

Avg Temperature F =
    AVERAGE(fact_crimes[temp_avg_f])

Hot Day Crimes =
    CALCULATE([Total Crimes], fact_crimes[is_hot_day] = 1)

Rainy Day Crimes =
    CALCULATE([Total Crimes], fact_crimes[is_rainy] = 1)

Hot Day Crime Rate =
    DIVIDE(
        [Hot Day Crimes],
        CALCULATE(DISTINCTCOUNT(fact_crimes[date_key]), fact_crimes[is_hot_day] = 1),
        0
    )

Normal Day Crime Rate =
    DIVIDE(
        CALCULATE([Total Crimes], fact_crimes[is_hot_day] = 0),
        CALCULATE(DISTINCTCOUNT(fact_crimes[date_key]), fact_crimes[is_hot_day] = 0),
        0
    )


// ── VICTIM METRICS ───────────────────────────────────────────

Avg Victim Age =
    AVERAGE(fact_crimes[vict_age])

Female Victims % =
    DIVIDE(
        CALCULATE([Total Crimes], fact_crimes[vict_sex] = "Female"),
        [Total Crimes], 0
    ) * 100

Domestic Violence Crimes =
    CALCULATE([Total Crimes], RELATED(dim_crime_cat[crime_category]) = "Domestic Violence")


// ── REPORTING LAG ────────────────────────────────────────────

Avg Days to Report =
    AVERAGEX(
        FILTER(fact_crimes, fact_crimes[days_to_report] >= 0),
        fact_crimes[days_to_report]
    )

Same-Day Reports % =
    DIVIDE(
        CALCULATE([Total Crimes], fact_crimes[reported_same_day] = 1),
        [Total Crimes], 0
    ) * 100


// ── CONDITIONAL FORMAT HELPERS ───────────────────────────────

Clearance Rate Color =
    SWITCH(
        TRUE(),
        [Clearance Rate %] >= 20, "#3ecf8e",   // green
        [Clearance Rate %] >= 10, "#e0c066",   // yellow
        "#e05252"                               // red
    )

YoY Crime Color =
    IF([Crimes YoY %] > 0, "#e05252", "#3ecf8e")
"""


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 4A - Power BI Data Export")
    print("=" * 60 + "\n")

    df = load()

    # Dimensions
    dim_date = build_dim_date(df)
    dim_area = build_dim_area(df)
    dim_cat  = build_dim_crime_cat(df)

    # Fact
    fact = build_fact_crimes(df, dim_date, dim_area, dim_cat)

    # Aggregates
    agg_monthly     = build_agg_monthly(df)
    agg_daily       = build_agg_daily(df)
    agg_hourly_dow  = build_agg_hourly_dow(df)
    agg_div_cat     = build_agg_division_cat(df)
    agg_victim      = build_agg_victim(df)
    agg_clearance   = build_agg_clearance(df)

    # ── Save all tables ──────────────────────────────────────────────────────
    print("\nSaving CSV tables...")
    tables = {
        "fact_crimes"        : fact,
        "dim_date"           : dim_date,
        "dim_area"           : dim_area,
        "dim_crime_cat"      : dim_cat,
        "agg_monthly"        : agg_monthly,
        "agg_daily"          : agg_daily,
        "agg_hourly_dow"     : agg_hourly_dow,
        "agg_division_cat"   : agg_div_cat,
        "agg_victim"         : agg_victim,
        "agg_clearance"      : agg_clearance,
    }
    for name, tbl in tables.items():
        path = PBI / f"{name}.csv"
        tbl.to_csv(path, index=False, encoding="utf-8-sig")
        size_kb = path.stat().st_size / 1024
        print(f"  {name:<28} {len(tbl):>8,} rows  {size_kb:>8,.0f} KB")

    # DAX measures reference
    dax_path = PBI / "dax_measures.txt"
    dax_path.write_text(DAX_MEASURES, encoding="utf-8")
    print(f"  {'dax_measures.txt':<28} (DAX reference)")

    print("\n" + "=" * 60)
    print(f"  Output folder: {PBI}")
    print("=" * 60)
    print("""
NEXT STEPS IN POWER BI DESKTOP:
  1. Home -> Get Data -> Text/CSV
     Import ALL files in data/powerbi/ as separate tables

  2. Model view -> create relationships:
     fact_crimes[date_key]       -> dim_date[date_key]    (Many:1)
     fact_crimes[area_id]        -> dim_area[area_id]     (Many:1)
     fact_crimes[cat_id]         -> dim_crime_cat[cat_id] (Many:1)

  3. Open dax_measures.txt -> create each measure via
     Home -> New Measure (paste DAX)

  4. Build report pages (see docs/POWERBI_GUIDE.md)
""")


if __name__ == "__main__":
    main()
