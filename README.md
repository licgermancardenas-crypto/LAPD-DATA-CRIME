# LAPD Crime Data Analysis 2020–2024

End-to-end data science project analyzing 1 million+ crime incidents reported to the **Los Angeles Police Department (LAPD)** between January 2020 and December 2024.

## Project Overview

| Item | Detail |
|---|---|
| **Dataset** | LAPD Crime Data 2020–2024 (data.lacity.org) |
| **Records** | 1,004,894 incidents |
| **Period** | Jan 1, 2020 → Dec 30, 2024 |
| **Geography** | City of Los Angeles — 21 LAPD divisions |

## Deliverables

- **Data Dictionary** — Field-level reference for all 28 columns (`docs/`)
- **EDA Report** — Temporal, geographic, demographic, and crime-type analysis (`notebooks/`)
- **Interactive Dashboard** — Power BI + Web App deployed to Vercel (`dashboard/`)
- **ML Models** — Hotspot prediction · Time-series forecasting · Crime classifier (`notebooks/`)

## Project Phases

```
Phase 0  ✅  Data Dictionary
Phase 1  🔄  Data Cleaning & Preparation → Parquet
Phase 2  ⬜  Exploratory Data Analysis (EDA)
Phase 3  ⬜  External Data Enrichment (Census, Weather, GeoJSON)
Phase 4A ⬜  Power BI Dashboard
Phase 4B ⬜  Web App (Vercel)
Phase 5  ⬜  Machine Learning (Hotspot → Forecast → Classifier)
```

## Repository Structure

```
lapd-crime-analysis/
├── data/
│   ├── raw/          ← Source CSV (not in git — add locally)
│   ├── processed/    ← Cleaned Parquet (not in git)
│   └── external/     ← GeoJSON, Census, Weather data
├── notebooks/
│   ├── 01_data_preparation.ipynb
│   ├── 02_eda.ipynb
│   ├── 03_external_data.ipynb
│   ├── 04_ml_hotspot.ipynb
│   ├── 05_ml_forecast.ipynb
│   └── 06_ml_classifier.ipynb
├── src/
│   ├── clean.py      ← Data cleaning utilities
│   ├── geo.py        ← Geospatial helpers
│   └── features.py   ← Feature engineering
├── dashboard/        ← Web app source (React / Plotly Dash)
├── outputs/
│   ├── figures/      ← Saved plots
│   ├── reports/      ← EDA HTML reports
│   └── models/       ← Trained model files (not in git)
└── docs/
    └── 00_data_dictionary.html
```

## Setup

```bash
# Clone repo
git clone https://github.com/licgermancardenas-crypto/LAPD-DATA-CRIME.git
cd LAPD-DATA-CRIME

# Install Python dependencies
pip install -r requirements.txt

# Add raw data (not in git — download from data.lacity.org)
# Place CSV at: data/raw/Crime_Data_from_2020_to_2024.csv
```

## Data Source

- **LAPD Open Data Portal:** [data.lacity.org](https://data.lacity.org/Public-Safety/Crime-Data-from-2020-to-Present/2nrs-mtv8)
- **Reporting Standard:** FBI Uniform Crime Reporting (UCR)
- **License:** City of Los Angeles Open Data

## Tech Stack

| Layer | Tools |
|---|---|
| Data prep | Python · pandas · geopandas |
| Visualization | matplotlib · seaborn · folium · plotly |
| Geospatial | geopandas · contextily · osmnx |
| ML | scikit-learn · xgboost · prophet |
| Dashboard | Plotly Dash / React + Recharts |
| Deploy | Vercel (frontend) · Render (API) |
| Formats | Parquet · GeoJSON · HTML |

---

*Data source: Los Angeles Police Department via data.lacity.org*
