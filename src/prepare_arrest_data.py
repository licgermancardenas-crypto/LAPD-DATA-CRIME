"""
Arrest Data — Cleaning & Aggregation
LAPD Arrest Data from 2020 to Present (Socrata amvf-fr72)

Loads the raw CSV, applies cleaning/feature-engineering consistent with
src/prepare_data.py (crime data), and exports a clean parquet plus the
aggregate JSONs the dashboard consumes.

Run:  python src/prepare_arrest_data.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import warnings
warnings.filterwarnings("ignore")

ROOT     = Path(__file__).parent.parent
RAW_CSV  = ROOT / "datasets" / "arrest_data_raw.csv"
PROC_DIR = ROOT / "data" / "processed"
OUT_DIR  = ROOT / "dashboard" / "public" / "data"
PROC_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Reuse the same demographic lookup tables as the crime dataset for consistency
DESCENT_MAP = {
    "A": "Other Asian",            "B": "Black",
    "C": "Chinese",                "D": "Cambodian",
    "F": "Filipino",               "G": "Guamanian",
    "H": "Hispanic/Latino",        "I": "American Indian/Alaska Native",
    "J": "Japanese",               "K": "Korean",
    "L": "Laotian",                "O": "Other",
    "P": "Pacific Islander",       "S": "Samoan",
    "U": "Hawaiian",               "V": "Vietnamese",
    "W": "White",                  "X": "Unknown",
    "Z": "Asian Indian",
}
SEX_MAP = {"M": "Male", "F": "Female", "X": "Unknown", "H": "Unknown", "-": "Unknown"}
DESCENT_GROUP_MAP = {
    "Hispanic/Latino": "Hispanic/Latino", "White": "White", "Black": "Black",
    "Other Asian": "Asian", "Chinese": "Asian", "Korean": "Asian",
    "Filipino": "Asian", "Japanese": "Asian", "Vietnamese": "Asian",
    "Cambodian": "Asian", "Asian Indian": "Asian", "Laotian": "Asian",
    "Pacific Islander": "Pacific Islander", "Samoan": "Pacific Islander",
    "Hawaiian": "Pacific Islander", "Guamanian": "Pacific Islander",
    "American Indian/Alaska Native": "Other",
    "Other": "Other", "Unknown": "Unknown",
}
ARST_TYPE_MAP = {"F": "Felony", "M": "Misdemeanor", "I": "Infraction", "O": "Other"}

LA_LAT = (33.70, 34.40)
LA_LON = (-118.70, -117.90)


def load_raw(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False, dtype={
        "rpt_id": "str", "area": "str", "rd": "str",
        "chrg_grp_cd": "str", "charge": "str",
    })


def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    df["arst_date"] = pd.to_datetime(df["arst_date"], errors="coerce")
    df["year"]    = df["arst_date"].dt.year.astype("Int16")
    df["month"]   = df["arst_date"].dt.month.astype("Int8")
    df["quarter"] = df["arst_date"].dt.quarter.astype("Int8")
    df["day_of_week"] = df["arst_date"].dt.dayofweek.astype("Int8")
    df["day_name"]    = df["arst_date"].dt.day_name()

    season_map = {12: "Winter", 1: "Winter", 2: "Winter",
                  3: "Spring", 4: "Spring", 5: "Spring",
                  6: "Summer", 7: "Summer", 8: "Summer",
                  9: "Fall", 10: "Fall", 11: "Fall"}
    df["season"] = df["month"].map(season_map)

    # time is HHMM, sometimes missing leading zeros (e.g. "1330", "915")
    time_num = pd.to_numeric(df["time"], errors="coerce").fillna(0).astype(int)
    df["hour"] = (time_num // 100).clip(0, 23).astype("Int8")
    return df


def clean_geo(df: pd.DataFrame) -> pd.DataFrame:
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
    valid = df["lat"].between(*LA_LAT) & df["lon"].between(*LA_LON)
    df["valid_geo"] = valid
    df.loc[~valid, ["lat", "lon"]] = np.nan
    return df


def clean_demographics(df: pd.DataFrame) -> pd.DataFrame:
    df["age"] = pd.to_numeric(df["age"], errors="coerce").replace(0, np.nan)
    bins   = [0, 17, 24, 34, 49, 64, 120]
    labels = ["Juvenile (<18)", "Young Adult (18-24)", "Adult (25-34)",
              "Adult (35-49)", "Middle-Aged (50-64)", "Senior (65+)"]
    df["age_group"] = pd.cut(df["age"], bins=bins, labels=labels)

    df["sex"]           = df["sex_cd"].map(SEX_MAP).fillna("Unknown")
    df["descent"]       = df["descent_cd"].map(DESCENT_MAP).fillna("Unknown")
    df["descent_group"] = df["descent"].map(DESCENT_GROUP_MAP).fillna("Unknown")
    df["arrest_type"]   = df["arst_typ_cd"].map(ARST_TYPE_MAP).fillna("Other")
    return df


def clean(path: Path = RAW_CSV) -> pd.DataFrame:
    print("\n" + "=" * 60)
    print("  LAPD Arrest Data — Cleaning")
    print("=" * 60)

    df = load_raw(path)
    print(f"  Raw: {df.shape[0]:,} rows x {df.shape[1]} cols")

    dupes = df["rpt_id"].duplicated().sum()
    print(f"  Duplicate rpt_id: {dupes}")

    df = parse_dates(df)
    df = clean_geo(df)
    invalid_geo = (~df["valid_geo"]).sum()
    print(f"  Invalid coordinates flagged: {invalid_geo:,} ({invalid_geo/len(df)*100:.2f}%)")

    df = clean_demographics(df)
    df["area_desc"] = df["area_desc"].str.strip()
    df["grp_description"] = df["grp_description"].str.strip()

    print(f"  Clean: {df.shape[0]:,} rows x {df.shape[1]} cols")
    print("=" * 60)
    return df


# ══════════════════════════════════════════════════════════════════════════════
# JSON EXPORT
# ══════════════════════════════════════════════════════════════════════════════

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _save(name: str, obj) -> None:
    path = OUT_DIR / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"), allow_nan=False)
    size = path.stat().st_size / 1024
    print(f"  {name}.json  {size:,.0f} KB")


def _load_division_addresses() -> dict:
    """active_addresses per LAPD division, from lapd_divisions_addresses.geojson."""
    path = OUT_DIR / "lapd_divisions_addresses.geojson"
    if not path.exists():
        return {}
    with open(path, encoding="utf-8") as f:
        gj = json.load(f)
    out = {}
    for feat in gj["features"]:
        p = feat["properties"]
        name = p.get("area name") or p.get("name")
        if name and "active_addresses" in p:
            out[name] = p["active_addresses"]
    return out


def build_summary(df: pd.DataFrame) -> dict:
    total = len(df)
    felony = int((df["arrest_type"] == "Felony").sum())
    misd   = int((df["arrest_type"] == "Misdemeanor").sum())

    by_year = (df.groupby("year", observed=True)
               .size().reset_index(name="arrests")
               .sort_values("year"))
    by_year = by_year[by_year["year"].notna()]

    # The Socrata feed lags behind "present" (e.g. snapshot cuts off mid-year),
    # so the most recent year on file is usually a partial year. Comparing it
    # against a full prior year would produce a misleading YoY drop, so YoY
    # uses the latest two years that each have a December (full 12 months).
    months_per_year = df.dropna(subset=["year", "month"]).groupby("year", observed=True)["month"].max()
    full_years = sorted(int(y) for y, m in months_per_year.items() if m == 12)

    y_max = int(by_year["year"].max())
    is_partial_latest = y_max not in full_years
    ytd_year    = y_max if is_partial_latest else None
    ytd_arrests = int(by_year[by_year["year"] == y_max]["arrests"].sum()) if is_partial_latest else None
    ytd_through_month = int(months_per_year.get(y_max)) if is_partial_latest else None

    if len(full_years) >= 2:
        y_latest, y_prev = full_years[-1], full_years[-2]
    elif len(full_years) == 1:
        y_latest, y_prev = full_years[0], full_years[0] - 1
    else:
        y_latest, y_prev = y_max, y_max - 1

    arrests_latest = int(by_year[by_year["year"] == y_latest]["arrests"].sum())
    arrests_prev   = int(by_year[by_year["year"] == y_prev]["arrests"].sum())
    yoy_pct = round((arrests_latest - arrests_prev) / arrests_prev * 100, 1) if arrests_prev else None

    return {
        "total_arrests"      : total,
        "felony_pct"         : round(felony / total * 100, 1),
        "misdemeanor_pct"    : round(misd / total * 100, 1),
        "latest_full_year"   : y_latest,
        "arrests_latest_year": arrests_latest,
        "arrests_prev_year"  : arrests_prev,
        "yoy_pct"            : yoy_pct,
        "ytd_year"           : ytd_year,
        "ytd_arrests"        : ytd_arrests,
        "ytd_through_month"  : ytd_through_month,
        "by_year": [
            {"year": int(r.year), "arrests": int(r.arrests)}
            for r in by_year.itertuples()
        ],
    }


def build_monthly(df: pd.DataFrame) -> list:
    g = (df.dropna(subset=["year", "month"])
         .groupby(["year", "month"], observed=True)
         .size().reset_index(name="arrests")
         .sort_values(["year", "month"]))
    rows = []
    for r in g.itertuples():
        rows.append({
            "period"    : f"{int(r.year)}-{int(r.month):02d}",
            "year"      : int(r.year),
            "month"     : int(r.month),
            "month_name": MONTH_NAMES[int(r.month) - 1],
            "arrests"   : int(r.arrests),
        })
    arrests = [r["arrests"] for r in rows]
    for i, r in enumerate(rows):
        window = arrests[max(0, i - 2):i + 1]
        r["rolling3"] = round(sum(window) / len(window))
    return rows


def build_division(df: pd.DataFrame) -> list:
    addr_by_div = _load_division_addresses()
    g = (df.groupby("area_desc", observed=True)
         .size().reset_index(name="arrests")
         .sort_values("arrests", ascending=False))
    rows = []
    for r in g.itertuples():
        active_addr = addr_by_div.get(r.area_desc)
        rows.append({
            "name"   : str(r.area_desc),
            "arrests": int(r.arrests),
            "active_addresses": active_addr,
            "arrests_per_1k_addr": round(r.arrests / active_addr * 1000, 1) if active_addr else None,
        })
    return rows


def build_demographics(df: pd.DataFrame) -> dict:
    def _counts(col):
        g = df.groupby(col, observed=True).size().sort_values(ascending=False)
        return [{"label": str(k), "arrests": int(v)} for k, v in g.items() if str(k) != "nan"]

    return {
        "by_sex"           : _counts("sex"),
        "by_descent_group" : _counts("descent_group"),
        "by_age_group"     : _counts("age_group"),
        "by_arrest_type"   : _counts("arrest_type"),
    }


def build_categories(df: pd.DataFrame) -> list:
    total = len(df)
    g = (df.groupby("grp_description", observed=True)
         .size().reset_index(name="arrests")
         .sort_values("arrests", ascending=False)
         .head(20))
    return [
        {
            "category" : str(r.grp_description),
            "arrests"  : int(r.arrests),
            "share_pct": round(r.arrests / total * 100, 1),
        }
        for r in g.itertuples()
    ]


def main():
    df = clean()

    out = PROC_DIR / "arrests_clean.parquet"
    print(f"\nSaving parquet -> {out}")
    df.to_parquet(out, index=False, engine="pyarrow", compression="snappy")
    print(f"  File size: {out.stat().st_size / 1e6:.1f} MB")

    print("\nBuilding JSON payloads...")
    summary_j     = build_summary(df)
    monthly_j     = build_monthly(df)
    division_j    = build_division(df)
    demographics_j= build_demographics(df)
    categories_j  = build_categories(df)

    print("\nSaving JSON files...")
    _save("arrests_summary",      summary_j)
    _save("arrests_monthly",      monthly_j)
    _save("arrests_division",     division_j)
    _save("arrests_demographics", demographics_j)
    _save("arrests_categories",   categories_j)

    print(f"\nAll JSON files -> {OUT_DIR}")


if __name__ == "__main__":
    main()
