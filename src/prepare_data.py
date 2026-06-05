"""
Phase 1 — Data Preparation
LAPD Crime Data 2020-2024

Loads the raw CSV, applies all cleaning and feature-engineering steps,
and exports to Parquet for downstream analysis.

Run:  python src/prepare_data.py
"""

import pandas as pd
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent
RAW_CSV = Path(r"C:\Users\corra\Desktop\POWER BI Proyectos\Crime_Data_from_2020_to_2024.csv")
OUT_DIR = ROOT / "data" / "processed"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Lookup tables ──────────────────────────────────────────────────────────────
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

SEX_MAP = {
    "M": "Male", "F": "Female", "X": "Unknown", "H": "Unknown", "-": "Unknown",
}

DESCENT_GROUP_MAP = {
    "Hispanic/Latino": "Hispanic/Latino",
    "White":           "White",
    "Black":           "Black",
    "Other Asian":     "Asian", "Chinese": "Asian", "Korean":    "Asian",
    "Filipino":        "Asian", "Japanese": "Asian", "Vietnamese": "Asian",
    "Cambodian":       "Asian", "Asian Indian": "Asian", "Laotian": "Asian",
    "Pacific Islander": "Pacific Islander", "Samoan":   "Pacific Islander",
    "Hawaiian":         "Pacific Islander", "Guamanian": "Pacific Islander",
    "American Indian/Alaska Native": "Other",
    "Other": "Other", "Unknown": "Unknown",
}

CLEARED_STATUSES = {"AA", "AO", "JA", "JO"}
ARREST_STATUSES  = {"AA", "JA"}

# Bounding box for valid LA coordinates
LA_LAT = (33.70, 34.40)
LA_LON = (-118.70, -117.90)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — LOAD
# ══════════════════════════════════════════════════════════════════════════════

def load_raw(path: Path) -> pd.DataFrame:
    """Load CSV with optimal dtypes to minimize memory usage from the start."""
    dtypes = {
        "DR_NO":          "int32",
        "AREA":           "int8",
        "Rpt Dist No":    "int16",
        "Part 1-2":       "int8",
        "Crm Cd":         "int16",
        "TIME OCC":       "int16",
        "Vict Age":       "int8",
        "Premis Cd":      "float32",
        "Weapon Used Cd": "float32",
        "Crm Cd 1":       "float32",
        "Crm Cd 2":       "float32",
        "Crm Cd 3":       "float32",
        "Crm Cd 4":       "float32",
        "LAT":            "float32",
        "LON":            "float32",
    }
    return pd.read_csv(path, dtype=dtypes, low_memory=False)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — DATES & TIME
# ══════════════════════════════════════════════════════════════════════════════

def parse_dates(df: pd.DataFrame) -> pd.DataFrame:
    fmt = "%m/%d/%Y %I:%M:%S %p"
    df["date_occ"]  = pd.to_datetime(df["DATE OCC"],   format=fmt, errors="coerce")
    df["date_rptd"] = pd.to_datetime(df["Date Rptd"],  format=fmt, errors="coerce")
    return df


def engineer_temporal(df: pd.DataFrame) -> pd.DataFrame:
    d = df["date_occ"]

    df["year"]         = d.dt.year.astype("int16")
    df["month"]        = d.dt.month.astype("int8")
    df["quarter"]      = d.dt.quarter.astype("int8")
    df["week_of_year"] = d.dt.isocalendar().week.astype("int8")
    df["day_of_week"]  = d.dt.dayofweek.astype("int8")  # 0=Mon … 6=Sun
    df["day_name"]     = d.dt.day_name()
    df["is_weekend"]   = d.dt.dayofweek.isin([5, 6])

    # Hour from HHMM integer (e.g. 1845 -> 18)
    df["hour"] = (df["TIME OCC"] // 100).clip(0, 23).astype("int8")

    # Time-of-day buckets
    bins   = [-1, 5, 11, 17, 23]
    labels = ["Late Night (00-05)", "Morning (06-11)", "Afternoon (12-17)", "Evening (18-23)"]
    df["time_of_day"] = pd.cut(df["hour"], bins=bins, labels=labels)

    # Season (meteorological)
    season_map = {
        12: "Winter", 1: "Winter",  2: "Winter",
        3:  "Spring", 4: "Spring",  5: "Spring",
        6:  "Summer", 7: "Summer",  8: "Summer",
        9:  "Fall",   10: "Fall",   11: "Fall",
    }
    df["season"] = df["month"].map(season_map)

    # Reporting lag
    df["days_to_report"]    = (df["date_rptd"] - df["date_occ"]).dt.days.clip(lower=0)
    df["reported_same_day"] = df["days_to_report"] == 0

    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — GEOGRAPHY
# ══════════════════════════════════════════════════════════════════════════════

def clean_geo(df: pd.DataFrame) -> pd.DataFrame:
    valid = df["LAT"].between(*LA_LAT) & df["LON"].between(*LA_LON)
    df["valid_geo"] = valid
    df.loc[~valid, "LAT"] = np.nan
    df.loc[~valid, "LON"] = np.nan

    df["LOCATION"]     = df["LOCATION"].str.strip()
    df["Cross Street"] = df["Cross Street"].str.strip()
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — VICTIM DEMOGRAPHICS
# ══════════════════════════════════════════════════════════════════════════════

def clean_victim(df: pd.DataFrame) -> pd.DataFrame:
    # Age: 0 is LAPD placeholder for unknown
    df["vict_age"] = df["Vict Age"].replace(0, np.nan).astype("float32")

    bins   = [0, 17, 24, 34, 49, 64, 120]
    labels = [
        "Juvenile (<18)", "Young Adult (18-24)", "Adult (25-34)",
        "Adult (35-49)", "Middle-Aged (50-64)", "Senior (65+)",
    ]
    df["age_group"] = pd.cut(df["vict_age"], bins=bins, labels=labels)

    df["vict_sex"]      = df["Vict Sex"].map(SEX_MAP).fillna("Unknown")
    df["vict_descent"]  = df["Vict Descent"].map(DESCENT_MAP).fillna("Unknown")
    df["descent_group"] = df["vict_descent"].map(DESCENT_GROUP_MAP).fillna("Unknown")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — CRIME CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════════════

def _classify_crime(desc: str) -> str:
    d = str(desc).upper()
    if any(x in d for x in ["HOMICIDE", "MANSLAUGHTER", "MURDER"]):
        return "Violent – Homicide"
    if any(x in d for x in ["RAPE", "SEXUAL PENETRATION"]):
        return "Violent – Sexual Assault"
    if "ROBBERY" in d:
        return "Violent – Robbery"
    if "INTIMATE PARTNER" in d:
        return "Domestic Violence"
    if any(x in d for x in ["ASSAULT WITH DEADLY", "AGGRAVATED ASSAULT"]):
        return "Violent – Aggravated Assault"
    if any(x in d for x in ["BATTERY", "SIMPLE ASSAULT", "ASSAULT"]):
        return "Violent – Assault & Battery"
    if "KIDNAP" in d:
        return "Violent – Kidnapping"
    if any(x in d for x in ["CHILD ABUSE", "CHILD NEGLECT", "CRUELTY TO CHILD"]):
        return "Crimes Against Children"
    if any(x in d for x in ["LEWD", "INDECENT", "SEX OFFEND", "PEEPING TOM"]):
        return "Sex Offense"
    if "HUMAN TRAFFICKING" in d:
        return "Human Trafficking"
    if any(x in d for x in ["VEHICLE - STOLEN", "THEFT FROM MOTOR VEHICLE", "VEHICLE,STOLEN"]):
        return "Vehicle Crime"
    if "THEFT OF IDENTITY" in d:
        return "Identity / Fraud"
    if any(x in d for x in ["FRAUD", "BUNCO", "FORGERY", "COUNTERFEIT", "EMBEZZLE"]):
        return "Identity / Fraud"
    if "BURGLARY" in d:
        return "Property – Burglary"
    if any(x in d for x in ["THEFT", "SHOPLIFTING", "PICKPOCKET", "PURSE SNATCH", "LARCENY"]):
        return "Property – Theft"
    if "VANDALISM" in d:
        return "Property – Vandalism"
    if "ARSON" in d:
        return "Property – Arson"
    if any(x in d for x in ["DRUG", "NARCOTIC"]):
        return "Drug Offense"
    if any(x in d for x in ["DUI", "DRUNK DRIVING"]):
        return "Traffic / DUI"
    return "Other"


VIOLENT_CATS = {
    "Violent – Homicide", "Violent – Sexual Assault", "Violent – Robbery",
    "Violent – Aggravated Assault", "Violent – Assault & Battery",
    "Domestic Violence", "Violent – Kidnapping", "Human Trafficking",
    "Crimes Against Children", "Sex Offense",
}


def classify_crimes(df: pd.DataFrame) -> pd.DataFrame:
    df["crime_category"] = df["Crm Cd Desc"].apply(_classify_crime)
    df["is_violent"]     = df["crime_category"].isin(VIOLENT_CATS)
    df["is_property"]    = df["crime_category"].str.startswith("Property")
    df["part_label"]     = df["Part 1-2"].map({1: "Part 1 – Serious", 2: "Part 2 – Other"})
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — PREMISES & WEAPON
# ══════════════════════════════════════════════════════════════════════════════

def _classify_premises(desc: str) -> str:
    d = str(desc).upper()
    if any(x in d for x in [
        "DWELLING", "HOUSE", "APARTMENT", "CONDO", "GARAGE",
        "YARD", "DRIVEWAY", "PORCH", "RESIDENCE",
    ]):
        return "Residential"
    if any(x in d for x in [
        "STORE", "SHOP", "MARKET", "RETAIL", "BANK", "OFFICE",
        "RESTAURANT", "BAR", "HOTEL", "MOTEL", "MALL",
        "GAS STATION", "SUPERMARKET", "BUSINESS", "LAUNDRY",
    ]):
        return "Commercial"
    if any(x in d for x in [
        "VEHICLE", "PASSENGER", "BUS", "TRAIN", "TAXI", "TRUCK", "TRAILER",
    ]):
        return "Vehicle"
    if any(x in d for x in [
        "PARK", "STREET", "SIDEWALK", "ALLEY", "FREEWAY", "HIGHWAY",
        "PARKING", "PUBLIC", "TRANSIT", "SCHOOL", "HOSPITAL",
        "CHURCH", "LIBRARY",
    ]):
        return "Public / Open Space"
    return "Other"


def _classify_weapon(desc) -> str:
    if pd.isna(desc):
        return "No Weapon"
    d = str(desc).upper()
    if any(x in d for x in [
        "GUN", "PISTOL", "RIFLE", "SHOTGUN", "REVOLVER",
        "FIREARM", "SEMI-AUTO", "AIR PISTOL",
    ]):
        return "Firearm"
    if any(x in d for x in [
        "KNIFE", "BLADE", "MACHETE", "SWORD", "CUTTING", "DIRK", "STILETTO",
    ]):
        return "Knife / Blade"
    if any(x in d for x in [
        "STRONG-ARM", "HANDS", "FIST", "FEET", "BODILY FORCE",
    ]):
        return "Physical Force"
    if any(x in d for x in [
        "CLUB", "BAT", "PIPE", "ROCK", "BLUNT", "HAMMER", "STICK",
    ]):
        return "Blunt Object"
    return "Unknown / Other Weapon"


def clean_premises_weapon(df: pd.DataFrame) -> pd.DataFrame:
    df["premises_group"]  = df["Premis Desc"].apply(_classify_premises)
    df["weapon_category"] = df["Weapon Desc"].apply(_classify_weapon)
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — CASE STATUS
# ══════════════════════════════════════════════════════════════════════════════

def add_status_flags(df: pd.DataFrame) -> pd.DataFrame:
    df["cleared"]  = df["Status"].isin(CLEARED_STATUSES)
    df["arrested"] = df["Status"].isin(ARREST_STATUSES)
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — MOCODES
# ══════════════════════════════════════════════════════════════════════════════

def parse_mocodes(df: pd.DataFrame) -> pd.DataFrame:
    df["mocode_list"]  = df["Mocodes"].fillna("").str.strip().str.split()
    df["mocode_count"] = df["mocode_list"].str.len()
    return df


# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — TYPE OPTIMIZATION
# ══════════════════════════════════════════════════════════════════════════════

CAT_COLS = [
    "AREA NAME", "Crm Cd Desc", "Status", "Status Desc",
    "Premis Desc", "Weapon Desc", "Vict Sex", "Vict Descent",
    "crime_category", "part_label", "time_of_day", "season",
    "day_name", "age_group", "vict_sex", "vict_descent",
    "descent_group", "premises_group", "weapon_category",
]


def optimize_types(df: pd.DataFrame) -> pd.DataFrame:
    for col in CAT_COLS:
        if col in df.columns:
            df[col] = df[col].astype("category")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════════════════════

def clean(path: Path = RAW_CSV) -> pd.DataFrame:
    """Full cleaning pipeline. Returns enriched DataFrame."""

    def _log(msg):
        print(f"  {msg}")

    print("\n" + "=" * 60)
    print("  LAPD Crime Data — Phase 1: Data Preparation")
    print("=" * 60)

    _log("Loading raw CSV...")
    df = load_raw(path)
    raw_mem = df.memory_usage(deep=True).sum() / 1e6
    _log(f"Raw: {df.shape[0]:,} rows × {df.shape[1]} cols | {raw_mem:.0f} MB")

    _log("Checking duplicates...")
    dupes = df["DR_NO"].duplicated().sum()
    _log(f"Duplicate DR_NO: {dupes}")

    _log("Parsing dates...")
    df = parse_dates(df)

    _log("Engineering temporal features...")
    df = engineer_temporal(df)

    _log("Cleaning geographic fields...")
    df = clean_geo(df)
    invalid_geo = (~df["valid_geo"]).sum()
    _log(f"Invalid coordinates flagged: {invalid_geo:,} ({invalid_geo/len(df)*100:.2f}%)")

    _log("Cleaning victim demographics...")
    df = clean_victim(df)

    _log("Classifying crimes...")
    df = classify_crimes(df)

    _log("Cleaning premises & weapon fields...")
    df = clean_premises_weapon(df)

    _log("Adding case status flags...")
    df = add_status_flags(df)
    cleared_rate = df["cleared"].mean() * 100
    _log(f"Overall clearance rate: {cleared_rate:.1f}%")

    _log("Parsing Mocodes...")
    df = parse_mocodes(df)

    _log("Optimizing data types...")
    df = optimize_types(df)

    clean_mem = df.memory_usage(deep=True).sum() / 1e6
    _log(f"Clean: {df.shape[0]:,} rows × {df.shape[1]} cols | {clean_mem:.0f} MB")
    _log(f"Memory change: {raw_mem:.0f} MB -> {clean_mem:.0f} MB ({(clean_mem-raw_mem)/raw_mem*100:+.0f}%)")

    print("=" * 60)
    return df


def main() -> pd.DataFrame:
    df = clean()

    # Full dataset
    out = OUT_DIR / "lapd_clean.parquet"
    print(f"\nSaving parquet -> {out}")
    df.to_parquet(out, index=False, engine="pyarrow", compression="snappy")
    print(f"File size: {out.stat().st_size / 1e6:.1f} MB")

    # 5% sample for Power BI prototyping
    sample_out = OUT_DIR / "lapd_sample_5pct.parquet"
    df.sample(frac=0.05, random_state=42).to_parquet(sample_out, index=False, engine="pyarrow")
    print(f"5% sample -> {sample_out.stat().st_size / 1e6:.1f} MB")

    return df


if __name__ == "__main__":
    df = main()
