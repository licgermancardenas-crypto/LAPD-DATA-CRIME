"""
Phase 5-A -- Crime Hotspot Analysis (KDE)
Kernel Density Estimation over a spatial grid of LA.

Outputs (outputs/figures/):
  p5a_01_hotspot_overall.png       LA-wide KDE heatmap 2020-2024
  p5a_02_hotspot_by_year.png       Year-by-year evolution (5 panels)
  p5a_03_hotspot_by_category.png   Top-6 crime categories
  p5a_04_hotspot_violent.png       Violent vs property crimes side-by-side
  p5a_05_risk_grid.png             Discretised risk-tier map

Outputs (outputs/reports/):
  hotspot_grid.parquet             Grid cells with risk scores (for dashboard)

Run: python src/ml_hotspot.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.colors import LinearSegmentedColormap
from scipy.stats import gaussian_kde

ROOT    = Path(__file__).parent.parent
PROC    = ROOT / "data" / "processed"
EXT     = ROOT / "data" / "external"
FIGDIR  = ROOT / "outputs" / "figures"
REPDIR  = ROOT / "outputs" / "reports"
FIGDIR.mkdir(parents=True, exist_ok=True)
REPDIR.mkdir(parents=True, exist_ok=True)

# ── Style ──────────────────────────────────────────────────────────────────
BG      = "#0f1117"
SURFACE = "#1a1d27"
MUTED   = "#7b82a0"

HOT_CMAP = LinearSegmentedColormap.from_list(
    "lapd_hot",
    [(0, "#0f1117"), (0.25, "#1e2d6e"), (0.55, "#7c2d8e"),
     (0.80, "#e05252"), (1.0,  "#fff176")],
)

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": BG,
    "text.color": "white", "axes.titlepad": 10,
})

# LA bounding box
LAT_MIN, LAT_MAX = 33.70, 34.40
LON_MIN, LON_MAX = -118.70, -117.90
GRID = 250          # grid resolution (250x250 = 62 500 cells)
BW   = 0.018        # KDE bandwidth in degrees (~2 km)


def save(name: str):
    plt.savefig(FIGDIR / f"{name}.png", dpi=150, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  Saved {name}.png")


def load_crime() -> pd.DataFrame:
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                         columns=["LAT", "LON", "valid_geo", "date_occ",
                                  "crime_category", "is_violent", "is_property",
                                  "year", "AREA NAME"])
    df = df[df["valid_geo"] == True].copy()
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    print(f"  {len(df):,} records with valid coordinates")
    return df


def make_grid():
    lon_vec = np.linspace(LON_MIN, LON_MAX, GRID)
    lat_vec = np.linspace(LAT_MIN, LAT_MAX, GRID)
    XX, YY  = np.meshgrid(lon_vec, lat_vec)
    return XX, YY, lon_vec, lat_vec


def kde_density(lons: np.ndarray, lats: np.ndarray,
                XX: np.ndarray, YY: np.ndarray,
                bw: float = BW) -> np.ndarray:
    coords = np.vstack([lons, lats])
    kde    = gaussian_kde(coords, bw_method=bw)
    pos    = np.vstack([XX.ravel(), YY.ravel()])
    Z      = kde(pos).reshape(GRID, GRID)
    return Z


def add_division_overlay(ax, alpha: float = 0.25):
    try:
        divs = gpd.read_file(EXT / "lapd_divisions.geojson")
        divs.plot(ax=ax, facecolor="none", edgecolor="white",
                  linewidth=0.6, alpha=alpha)
    except Exception:
        pass


def add_tract_overlay(ax, alpha: float = 0.08):
    try:
        tracts = gpd.read_file(EXT / "census_tracts_la.geojson")
        tracts.plot(ax=ax, facecolor="none", edgecolor=MUTED,
                    linewidth=0.15, alpha=alpha)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 1 — Overall hotspot 2020-2024
# ══════════════════════════════════════════════════════════════════════════════

def plot_overall(df: pd.DataFrame, XX, YY):
    print("Computing overall KDE (1M points)...")
    Z = kde_density(df["LON"].values, df["LAT"].values, XX, YY)

    fig, ax = plt.subplots(figsize=(12, 10), facecolor=BG)
    ax.set_facecolor(BG)

    im = ax.pcolormesh(XX, YY, Z, cmap=HOT_CMAP, shading="gouraud")
    add_tract_overlay(ax, alpha=0.06)
    add_division_overlay(ax, alpha=0.35)

    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("Probability Density", color="white", fontsize=10)
    cbar.ax.yaxis.set_tick_params(color="white")
    plt.setp(cbar.ax.yaxis.get_ticklabels(), color="white")
    cbar.ax.set_facecolor(BG)
    cbar.set_ticks([])

    ax.set_xlim(LON_MIN, LON_MAX)
    ax.set_ylim(LAT_MIN, LAT_MAX)
    ax.set_xlabel("Longitude", color=MUTED, fontsize=10)
    ax.set_ylabel("Latitude",  color=MUTED, fontsize=10)
    ax.tick_params(colors=MUTED, labelsize=8)
    ax.set_title(f"LAPD Crime Hotspot Map — 2020-2024\n"
                 f"({len(df):,} incidents, KDE bandwidth ~2 km)",
                 color="white", fontsize=14, pad=12)

    fig.tight_layout()
    save("p5a_01_hotspot_overall")
    return Z


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 2 — Year-by-year evolution
# ══════════════════════════════════════════════════════════════════════════════

def plot_by_year(df: pd.DataFrame, XX, YY):
    years = sorted(df["year"].unique())
    print(f"Computing year-by-year KDE ({len(years)} years)...")

    fig, axes = plt.subplots(1, 5, figsize=(24, 6), facecolor=BG)
    Z_global = None
    Z_all    = []

    for yr in years:
        sub = df[df["year"] == yr]
        Z   = kde_density(sub["LON"].values, sub["LAT"].values, XX, YY)
        Z_all.append(Z)

    vmax = max(z.max() for z in Z_all)

    for ax, yr, Z in zip(axes, years, Z_all):
        ax.set_facecolor(BG)
        ax.pcolormesh(XX, YY, Z, cmap=HOT_CMAP, shading="gouraud",
                      vmin=0, vmax=vmax)
        add_division_overlay(ax, alpha=0.3)
        ax.set_xlim(LON_MIN, LON_MAX)
        ax.set_ylim(LAT_MIN, LAT_MAX)
        ax.set_title(str(yr), color="white", fontsize=13, pad=8)
        ax.set_xticks([]); ax.set_yticks([])
        n = (df["year"] == yr).sum()
        ax.text(0.5, 0.02, f"{n:,} crimes", transform=ax.transAxes,
                ha="center", color=MUTED, fontsize=9)

    fig.suptitle("Crime Hotspot Evolution — Year by Year",
                 color="white", fontsize=15, y=1.01)
    fig.tight_layout()
    save("p5a_02_hotspot_by_year")


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 3 — Top-6 crime categories
# ══════════════════════════════════════════════════════════════════════════════

def plot_by_category(df: pd.DataFrame, XX, YY):
    top6 = df["crime_category"].value_counts().nlargest(6).index.tolist()
    print(f"Computing KDE for top-6 categories...")

    fig, axes = plt.subplots(2, 3, figsize=(18, 10), facecolor=BG)
    axes = axes.flatten()

    for ax, cat in zip(axes, top6):
        sub = df[df["crime_category"] == cat]
        if len(sub) < 100:
            ax.set_visible(False)
            continue
        Z = kde_density(sub["LON"].values, sub["LAT"].values, XX, YY)
        ax.set_facecolor(BG)
        ax.pcolormesh(XX, YY, Z, cmap=HOT_CMAP, shading="gouraud")
        add_division_overlay(ax, alpha=0.25)
        ax.set_xlim(LON_MIN, LON_MAX)
        ax.set_ylim(LAT_MIN, LAT_MAX)
        ax.set_title(cat, color="white", fontsize=11, pad=6)
        ax.set_xticks([]); ax.set_yticks([])
        ax.text(0.5, 0.02, f"{len(sub):,} incidents",
                transform=ax.transAxes, ha="center", color=MUTED, fontsize=9)

    fig.suptitle("Crime Hotspots by Category", color="white", fontsize=15, y=1.01)
    fig.tight_layout()
    save("p5a_03_hotspot_by_category")


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 4 — Violent vs Property
# ══════════════════════════════════════════════════════════════════════════════

def plot_violent_vs_property(df: pd.DataFrame, XX, YY):
    print("Computing violent vs property KDE...")
    vio  = df[df["is_violent"]  == True]
    prop = df[df["is_property"] == True]

    fig, axes = plt.subplots(1, 2, figsize=(18, 8), facecolor=BG)

    for ax, sub, title, cmap_name in [
        (axes[0], vio,  f"Violent Crimes ({len(vio):,})",  "YlOrRd"),
        (axes[1], prop, f"Property Crimes ({len(prop):,})", "YlOrBr"),
    ]:
        Z = kde_density(sub["LON"].values, sub["LAT"].values, XX, YY)
        ax.set_facecolor(BG)
        ax.pcolormesh(XX, YY, Z, cmap=cmap_name, shading="gouraud")
        add_division_overlay(ax, alpha=0.3)
        ax.set_xlim(LON_MIN, LON_MAX)
        ax.set_ylim(LAT_MIN, LAT_MAX)
        ax.set_title(title, color="white", fontsize=13, pad=8)
        ax.set_xticks([]); ax.set_yticks([])

    fig.suptitle("Violent vs Property Crime Spatial Distribution",
                 color="white", fontsize=14, y=1.01)
    fig.tight_layout()
    save("p5a_04_hotspot_violent")


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 5 — Discretised risk grid + export
# ══════════════════════════════════════════════════════════════════════════════

def plot_risk_grid(df: pd.DataFrame, XX, YY, lon_vec, lat_vec, Z_overall):
    print("Building discretised risk grid...")

    # Percentile-based risk tiers
    valid = Z_overall[Z_overall > Z_overall.mean() * 0.05]
    p33   = np.percentile(valid, 33)
    p66   = np.percentile(valid, 66)
    p90   = np.percentile(valid, 90)

    tiers = np.zeros_like(Z_overall, dtype=int)
    tiers[Z_overall > 0]   = 1   # Very Low
    tiers[Z_overall > p33] = 2   # Low
    tiers[Z_overall > p66] = 3   # Medium
    tiers[Z_overall > p90] = 4   # High

    tier_cmap = mcolors.ListedColormap(
        [BG, "#1e3a5f", "#e0883a", "#e05252"]
    )

    fig, ax = plt.subplots(figsize=(12, 10), facecolor=BG)
    ax.set_facecolor(BG)

    im = ax.pcolormesh(XX, YY, tiers, cmap=tier_cmap,
                       vmin=0, vmax=4, shading="auto")
    add_tract_overlay(ax, alpha=0.05)
    add_division_overlay(ax, alpha=0.45)

    from matplotlib.patches import Patch
    legend_els = [
        Patch(facecolor="#1e3a5f", label="Low risk"),
        Patch(facecolor="#e0883a", label="Medium risk"),
        Patch(facecolor="#e05252", label="High risk (top 10%)"),
    ]
    ax.legend(handles=legend_els, loc="lower right",
              facecolor=SURFACE, labelcolor="white", fontsize=9,
              framealpha=0.8, edgecolor=MUTED)

    ax.set_xlim(LON_MIN, LON_MAX)
    ax.set_ylim(LAT_MIN, LAT_MAX)
    ax.set_xlabel("Longitude", color=MUTED, fontsize=10)
    ax.set_ylabel("Latitude",  color=MUTED, fontsize=10)
    ax.tick_params(colors=MUTED, labelsize=8)
    ax.set_title("Crime Risk Tier Map — Los Angeles 2020-2024",
                 color="white", fontsize=14, pad=12)

    fig.tight_layout()
    save("p5a_05_risk_grid")

    # Export grid as parquet
    rows = []
    for i, lat in enumerate(lat_vec):
        for j, lon in enumerate(lon_vec):
            if tiers[i, j] > 0:
                rows.append({
                    "lat":      round(float(lat), 6),
                    "lon":      round(float(lon), 6),
                    "density":  round(float(Z_overall[i, j]), 8),
                    "risk_tier": int(tiers[i, j]),
                })
    grid_df = pd.DataFrame(rows)
    grid_df.to_parquet(REPDIR / "hotspot_grid.parquet", index=False)
    print(f"  Risk grid saved: {len(grid_df):,} non-zero cells")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5A - Crime Hotspot Analysis (KDE)")
    print("=" * 60 + "\n")

    df = load_crime()
    XX, YY, lon_vec, lat_vec = make_grid()

    Z_overall = plot_overall(df, XX, YY)
    plot_by_year(df, XX, YY)
    plot_by_category(df, XX, YY)
    plot_violent_vs_property(df, XX, YY)
    plot_risk_grid(df, XX, YY, lon_vec, lat_vec, Z_overall)

    print("\n" + "=" * 60)
    print("  Phase 5A complete — 5 figures + risk grid saved")
    print("=" * 60)


if __name__ == "__main__":
    main()
