"""
Phase 2 -- Exploratory Data Analysis
Generates all EDA figures and saves them to outputs/figures/
Run: python src/eda_plots.py
"""
import sys
import warnings
from calendar import month_abbr
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd
import seaborn as sns

warnings.filterwarnings("ignore")

ROOT    = Path(__file__).parent.parent
PARQUET = ROOT / "data" / "processed" / "lapd_clean.parquet"
FIGDIR  = ROOT / "outputs" / "figures"
FIGDIR.mkdir(parents=True, exist_ok=True)

# ── Style ──────────────────────────────────────────────────────────────────────
BG      = "#0f1117"
SURFACE = "#1a1d27"

plt.rcParams.update({
    "figure.facecolor": BG,
    "axes.facecolor":   SURFACE,
    "axes.edgecolor":   "#2e334d",
    "axes.labelcolor":  "#e4e6f0",
    "xtick.color":      "#7b82a0",
    "ytick.color":      "#7b82a0",
    "text.color":       "#e4e6f0",
    "grid.color":       "#2e334d",
    "grid.alpha":       0.5,
    "font.size":        10,
})

BLUE   = "#4f8ef7"
RED    = "#e05252"
GREEN  = "#3ecf8e"
ORANGE = "#e0883a"
PURPLE = "#7c5cbf"
YELLOW = "#e0c066"
CYAN   = "#60c9d4"
MUTED  = "#7b82a0"

MONTHS = list(month_abbr)[1:]
DAYS   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def save(name: str) -> None:
    plt.tight_layout()
    plt.savefig(FIGDIR / f"{name}.png", dpi=150, bbox_inches="tight",
                facecolor=BG, edgecolor="none")
    plt.close("all")
    print(f"  + {name}.png")


def fmt_yk(ax) -> None:
    ax.yaxis.set_major_formatter(
        mticker.FuncFormatter(lambda x, _: f"{x/1e3:.0f}k" if x >= 1000 else str(int(x)))
    )


def fmt_xk(ax) -> None:
    ax.xaxis.set_major_formatter(
        mticker.FuncFormatter(lambda x, _: f"{x/1e3:.0f}k" if x >= 1000 else str(int(x)))
    )


# ══════════════════════════════════════════════════════════════════════════════
# LOAD
# ══════════════════════════════════════════════════════════════════════════════

def load() -> pd.DataFrame:
    print("Loading parquet...")
    df = pd.read_parquet(PARQUET)
    df["date_occ"]  = pd.to_datetime(df["date_occ"])
    df["date_rptd"] = pd.to_datetime(df["date_rptd"])
    print(f"  {df.shape[0]:,} rows x {df.shape[1]} cols")
    return df


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — TEMPORAL
# ══════════════════════════════════════════════════════════════════════════════

def plot_annual_trend(df: pd.DataFrame) -> None:
    annual = df.groupby("year").size().reset_index(name="n")
    annual["yoy"] = annual["n"].pct_change() * 100

    fig, ax = plt.subplots(figsize=(10, 5))
    colors = [BLUE] * len(annual)
    bars = ax.bar(annual["year"].astype(str), annual["n"],
                  color=colors, alpha=0.85, width=0.6)

    for bar, row in zip(bars, annual.itertuples()):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 1800,
                f"{row.n:,}", ha="center", va="bottom", fontsize=11, fontweight="bold")
        if not np.isnan(row.yoy):
            c = GREEN if row.yoy < 0 else RED
            ax.text(bar.get_x() + bar.get_width() / 2,
                    bar.get_height() / 2,
                    f"{row.yoy:+.1f}%", ha="center", va="center",
                    fontsize=11, fontweight="bold", color=c)

    ax.set_title("LAPD Crime Incidents by Year (2020-2024)",
                 fontsize=14, fontweight="bold", pad=15)
    ax.set_xlabel("Year", fontsize=11)
    ax.set_ylabel("Incidents", fontsize=11)
    fmt_yk(ax)
    ax.set_ylim(0, annual["n"].max() * 1.2)
    ax.grid(axis="y", alpha=0.3)
    ax.set_axisbelow(True)
    save("p2_01_annual_trend")


def plot_monthly_seasonality(df: pd.DataFrame) -> None:
    monthly = df.groupby("month").size().reset_index(name="n")
    monthly["month_name"] = [MONTHS[i - 1] for i in monthly["month"]]

    fig, ax = plt.subplots(figsize=(11, 5))
    colors = [RED if i in [5, 6, 7, 8] else BLUE for i in monthly["month"]]
    bars = ax.bar(monthly["month_name"], monthly["n"], color=colors, alpha=0.85)

    for bar, val in zip(bars, monthly["n"]):
        ax.text(bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 300,
                f"{val:,}", ha="center", va="bottom", fontsize=8.5)

    ax.set_title("Crime Incidents by Month - Seasonality (2020-2024 combined)",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Month")
    ax.set_ylabel("Incidents")
    fmt_yk(ax)
    ax.grid(axis="y", alpha=0.3)
    ax.set_axisbelow(True)
    ax.annotate("Peak: summer\n(May-Aug)", xy=(4.5, monthly.loc[monthly["month"]==7, "n"].values[0]),
                xytext=(7.5, monthly["n"].max() * 1.03),
                fontsize=9, color=RED, ha="center",
                arrowprops=dict(arrowstyle="->", color=RED, lw=1.2))
    save("p2_02_monthly_seasonality")


def plot_hour_day_heatmap(df: pd.DataFrame) -> None:
    pivot = (df.groupby(["day_of_week", "hour"])
               .size()
               .unstack(fill_value=0))
    pivot_norm = pivot.div(pivot.sum(axis=1), axis=0) * 100

    fig, axes = plt.subplots(1, 2, figsize=(16, 5))

    sns.heatmap(pivot / 1000, ax=axes[0], cmap="Blues",
                xticklabels=range(24), yticklabels=DAYS,
                linewidths=0.3, linecolor=BG,
                cbar_kws={"label": "Incidents (thousands)"})
    axes[0].set_title("Crime Volume: Hour x Day of Week", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Hour of Day")
    axes[0].set_ylabel("")

    sns.heatmap(pivot_norm, ax=axes[1], cmap="Reds",
                xticklabels=range(24), yticklabels=DAYS,
                linewidths=0.3, linecolor=BG,
                cbar_kws={"label": "% of day total"})
    axes[1].set_title("Relative Intensity: When Does Each Day Peak?", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Hour of Day")
    axes[1].set_ylabel("")

    save("p2_03_hour_day_heatmap")


def plot_category_trends(df: pd.DataFrame) -> None:
    top_cats = df["crime_category"].value_counts().head(8).index.tolist()
    df_top = df[df["crime_category"].isin(top_cats)].copy()
    df_top["ym"] = df_top["date_occ"].dt.to_period("M")

    trend = (df_top.groupby(["ym", "crime_category"], observed=True)
                   .size()
                   .reset_index(name="n"))
    trend["dt"] = trend["ym"].dt.to_timestamp()

    palette = [BLUE, RED, GREEN, ORANGE, PURPLE, YELLOW, CYAN, "#f076b4"]

    fig, ax = plt.subplots(figsize=(14, 6))

    for i, cat in enumerate(top_cats):
        sub = trend[trend["crime_category"] == cat].sort_values("dt")
        # Smooth with 3-month rolling
        sub = sub.copy()
        sub["n_smooth"] = sub["n"].rolling(3, min_periods=1, center=True).mean()
        ax.plot(sub["dt"], sub["n_smooth"],
                label=cat, color=palette[i % len(palette)],
                linewidth=2, alpha=0.9)
        last = sub.iloc[-1]
        short = cat.replace("Violent - ", "").replace("Property - ", "").replace(" Crime", "")[:18]
        ax.text(last["dt"], last["n_smooth"] + 30,
                f"  {short}", fontsize=7.5, va="bottom",
                color=palette[i % len(palette)])

    ax.axvspan(pd.Timestamp("2020-03-15"), pd.Timestamp("2020-06-15"),
               alpha=0.08, color=YELLOW, label="COVID lockdown")

    ax.set_title("Monthly Crime Trends by Category — Top 8 (3-month rolling avg)",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Month")
    ax.set_ylabel("Incidents")
    fmt_yk(ax)
    ax.grid(alpha=0.25)
    ax.set_axisbelow(True)
    ax.legend(loc="upper right", fontsize=7.5, ncol=2, framealpha=0.3)
    save("p2_04_category_trends")


def plot_reporting_lag(df: pd.DataFrame) -> None:
    top_cats = df["crime_category"].value_counts().head(10).index.tolist()
    sub = df[df["crime_category"].isin(top_cats) & df["days_to_report"].notna()].copy()
    sub = sub[sub["days_to_report"].between(0, 365)]

    order = (sub.groupby("crime_category", observed=True)["days_to_report"]
                .median()
                .sort_values(ascending=False)
                .index.tolist())

    fig, ax = plt.subplots(figsize=(12, 7))
    sns.boxplot(data=sub, y="crime_category", x="days_to_report",
                order=order, ax=ax, color=BLUE,
                flierprops=dict(marker=".", markerfacecolor=MUTED, markersize=1.5, alpha=0.2),
                medianprops=dict(color=ORANGE, linewidth=2.5))

    ax.set_title("Reporting Lag (Days Between Occurrence and Report)\nby Crime Category (capped at 365 days)",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Days to Report")
    ax.set_ylabel("")
    ax.grid(axis="x", alpha=0.3)
    ax.set_axisbelow(True)

    # Add median labels
    for i, cat in enumerate(order):
        med = sub[sub["crime_category"] == cat]["days_to_report"].median()
        ax.text(med + 2, i, f" {med:.0f}d", va="center", fontsize=8.5, color=ORANGE)

    save("p2_05_reporting_lag")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — GEOGRAPHIC
# ══════════════════════════════════════════════════════════════════════════════

def plot_area_ranking(df: pd.DataFrame) -> None:
    area = df.groupby("AREA NAME", observed=True).agg(
        total   =("DR_NO", "count"),
        cleared =("cleared", "mean"),
        violent =("is_violent", "mean"),
    ).sort_values("total")

    avg_clr = df["cleared"].mean()
    fig, axes = plt.subplots(1, 3, figsize=(17, 8))

    # Total
    c_total = [RED if v > area["total"].quantile(0.75) else
               ORANGE if v > area["total"].median() else BLUE
               for v in area["total"]]
    axes[0].barh(area.index, area["total"], color=c_total, alpha=0.85)
    fmt_xk(axes[0])
    axes[0].set_title("Total Crimes", fontweight="bold", fontsize=11)
    for i, (idx, row) in enumerate(area.iterrows()):
        axes[0].text(row["total"] + 300, i, f"{row['total']:,}", va="center", fontsize=7.5)

    # Clearance
    c_clr = [GREEN if v > avg_clr else RED for v in area["cleared"]]
    axes[1].barh(area.index, area["cleared"] * 100, color=c_clr, alpha=0.85)
    axes[1].axvline(avg_clr * 100, color=YELLOW, linestyle="--", linewidth=1.5,
                    label=f"Avg {avg_clr*100:.1f}%")
    axes[1].set_title("Clearance Rate (%)", fontweight="bold", fontsize=11)
    axes[1].legend(fontsize=8.5)
    for i, (idx, row) in enumerate(area.iterrows()):
        axes[1].text(row["cleared"] * 100 + 0.2, i,
                     f"{row['cleared']*100:.1f}%", va="center", fontsize=7.5)

    # Violent %
    axes[2].barh(area.index, area["violent"] * 100, color=PURPLE, alpha=0.85)
    axes[2].set_title("Violent Crime Share (%)", fontweight="bold", fontsize=11)
    for i, (idx, row) in enumerate(area.iterrows()):
        axes[2].text(row["violent"] * 100 + 0.2, i,
                     f"{row['violent']*100:.1f}%", va="center", fontsize=7.5)

    for ax in axes:
        ax.set_axisbelow(True)
        ax.grid(axis="x", alpha=0.3)
        ax.tick_params(axis="y", labelsize=9)

    fig.suptitle("LAPD Division Profile: Volume, Clearance & Violence Rate",
                 fontsize=14, fontweight="bold", y=1.01)
    save("p2_06_area_ranking")


def plot_density_map(df: pd.DataFrame) -> None:
    valid = df[df["valid_geo"] & df["LAT"].notna() & df["LON"].notna()]
    plot_all = valid if len(valid) <= 300_000 else valid.sample(300_000, random_state=42)
    violent  = valid[valid["is_violent"]]

    fig, axes = plt.subplots(1, 2, figsize=(15, 7))

    hb1 = axes[0].hexbin(plot_all["LON"], plot_all["LAT"],
                          gridsize=80, cmap="YlOrRd", mincnt=1, bins="log",
                          linewidths=0)
    plt.colorbar(hb1, ax=axes[0], label="log(incidents)")
    axes[0].set_title("All Crimes - Spatial Density", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Longitude")
    axes[0].set_ylabel("Latitude")

    hb2 = axes[1].hexbin(violent["LON"], violent["LAT"],
                          gridsize=80, cmap="Reds", mincnt=1, bins="log",
                          linewidths=0)
    plt.colorbar(hb2, ax=axes[1], label="log(violent incidents)")
    axes[1].set_title("Violent Crimes Only - Spatial Density", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Longitude")
    axes[1].set_ylabel("Latitude")

    save("p2_07_density_map")


def plot_area_category_heatmap(df: pd.DataFrame) -> None:
    top_areas = df["AREA NAME"].value_counts().head(12).index.tolist()
    top_cats  = df["crime_category"].value_counts().head(10).index.tolist()

    sub = df[df["AREA NAME"].isin(top_areas) & df["crime_category"].isin(top_cats)]
    pivot = (sub.groupby(["AREA NAME", "crime_category"], observed=True)
                .size()
                .unstack(fill_value=0))
    pivot_pct = pivot.div(pivot.sum(axis=1), axis=0) * 100

    fig, ax = plt.subplots(figsize=(15, 8))
    sns.heatmap(pivot_pct, ax=ax, cmap="Blues",
                linewidths=0.4, linecolor=BG,
                annot=True, fmt=".1f", annot_kws={"size": 8},
                cbar_kws={"label": "% of area crimes"})
    ax.set_title("Crime Category Mix by LAPD Division (% share of each division's total)",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("")
    ax.set_ylabel("")
    ax.tick_params(axis="x", rotation=30, labelsize=9)
    save("p2_08_area_category_heatmap")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — CRIME TYPES
# ══════════════════════════════════════════════════════════════════════════════

def plot_category_overview(df: pd.DataFrame) -> None:
    cat = df.groupby("crime_category", observed=True).agg(
        n       =("DR_NO",    "count"),
        cleared =("cleared",  "mean"),
        violent =("is_violent","first"),
    ).sort_values("n", ascending=True)

    colors = [RED if v else BLUE for v in cat["violent"]]

    fig, ax = plt.subplots(figsize=(12, 9))
    bars = ax.barh(cat.index, cat["n"], color=colors, alpha=0.85)

    ax.set_xlim(0, cat["n"].max() * 1.4)
    for bar, (_, row) in zip(bars, cat.iterrows()):
        ax.text(row["n"] + 800, bar.get_y() + bar.get_height() / 2,
                f"{row['n']:,}  ({row['cleared']*100:.0f}% cleared)",
                va="center", fontsize=8.5)

    ax.set_title("Crime Category Distribution - LAPD 2020-2024\n(red = violent  |  blue = property / other  |  label shows clearance rate)",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Number of Incidents")
    fmt_xk(ax)
    ax.grid(axis="x", alpha=0.3)
    ax.set_axisbelow(True)
    save("p2_09_category_overview")


def plot_top20_crimes(df: pd.DataFrame) -> None:
    top20 = df["Crm Cd Desc"].value_counts().head(20)

    fig, ax = plt.subplots(figsize=(12, 9))
    colors = [RED if i < 4 else ORANGE if i < 10 else BLUE for i in range(20)]
    bars = ax.barh(top20.index[::-1], top20.values[::-1],
                   color=colors[::-1], alpha=0.85)

    ax.set_xlim(0, top20.max() * 1.22)
    for bar, val in zip(bars, top20.values[::-1]):
        ax.text(val + 400, bar.get_y() + bar.get_height() / 2,
                f"{val:,}", va="center", fontsize=8.5)

    ax.set_title("Top 20 Specific Crime Types - LAPD 2020-2024",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Incidents")
    fmt_xk(ax)
    ax.tick_params(axis="y", labelsize=8.5)
    ax.grid(axis="x", alpha=0.3)
    ax.set_axisbelow(True)
    save("p2_10_top20_crimes")


def plot_violent_property_trend(df: pd.DataFrame) -> None:
    df2 = df.copy()
    df2["crime_type"] = "Other"
    df2.loc[df2["is_violent"],                            "crime_type"] = "Violent"
    df2.loc[df2["is_property"],                           "crime_type"] = "Property"
    df2.loc[df2["crime_category"] == "Vehicle Crime",     "crime_type"] = "Vehicle"
    df2.loc[df2["crime_category"] == "Identity / Fraud",  "crime_type"] = "Fraud/Identity"

    trend = (df2.groupby(["year", "crime_type"])
                .size()
                .unstack(fill_value=0)
                .reset_index())

    type_c = {"Violent": RED, "Property": BLUE, "Vehicle": GREEN,
               "Fraud/Identity": YELLOW, "Other": MUTED}
    type_order = [t for t in type_c if t in trend.columns]

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    for col in type_order:
        axes[0].plot(trend["year"], trend[col],
                     label=col, color=type_c[col],
                     linewidth=2.5, marker="o", markersize=7)
    axes[0].set_title("Crime Volume by Type - Year over Year", fontsize=12, fontweight="bold")
    axes[0].set_ylabel("Incidents")
    axes[0].legend(fontsize=9)
    axes[0].grid(alpha=0.3)
    fmt_yk(axes[0])

    axes[1].stackplot(trend["year"],
                      [trend[t] for t in type_order],
                      labels=type_order,
                      colors=[type_c[t] for t in type_order],
                      alpha=0.8)
    axes[1].set_title("Crime Composition - Stacked Area", fontsize=12, fontweight="bold")
    axes[1].set_ylabel("Incidents")
    axes[1].legend(loc="upper left", fontsize=9)
    axes[1].grid(alpha=0.3)
    fmt_yk(axes[1])

    save("p2_11_violent_property_trend")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — VICTIM DEMOGRAPHICS
# ══════════════════════════════════════════════════════════════════════════════

def plot_victim_age_category(df: pd.DataFrame) -> None:
    top_cats = df["crime_category"].value_counts().head(10).index.tolist()
    sub = df[df["crime_category"].isin(top_cats) &
             df["vict_age"].notna() &
             df["vict_age"].between(1, 99)].copy()

    order = (sub.groupby("crime_category", observed=True)["vict_age"]
                .median()
                .sort_values()
                .index.tolist())

    fig, ax = plt.subplots(figsize=(13, 7))
    sns.violinplot(data=sub, x="vict_age", y="crime_category",
                   order=order, ax=ax, inner="quartile",
                   palette=[BLUE] * len(order))

    overall_med = sub["vict_age"].median()
    ax.axvline(overall_med, color=ORANGE, linestyle="--", linewidth=1.8,
               label=f"Overall median: {overall_med:.0f} yrs")
    ax.set_title("Victim Age Distribution by Crime Category",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Victim Age")
    ax.set_ylabel("")
    ax.legend(fontsize=9)
    ax.grid(axis="x", alpha=0.3)
    save("p2_12_victim_age_category")


def plot_victim_demographics(df: pd.DataFrame) -> None:
    fig, axes = plt.subplots(1, 3, figsize=(16, 6))

    # Sex x violent
    sex_v = (df[df["vict_sex"].isin(["Male", "Female"])]
             .groupby(["vict_sex", "is_violent"])
             .size()
             .unstack(fill_value=0))
    sex_v.columns = ["Non-Violent", "Violent"]
    sex_v.plot(kind="bar", ax=axes[0], color=[BLUE, RED], alpha=0.85, rot=0)
    axes[0].set_title("Victim Sex x Crime Type", fontweight="bold")
    axes[0].legend(fontsize=9)
    fmt_yk(axes[0])

    # Descent group
    descent = (df[df["descent_group"] != "Unknown"]["descent_group"]
               .value_counts()
               .sort_values())
    palette_d = [PURPLE, CYAN, ORANGE, RED, GREEN, BLUE, YELLOW]
    axes[1].barh(descent.index, descent.values,
                 color=palette_d[:len(descent)], alpha=0.85)
    axes[1].set_title("Victim Descent Group\n(excl. Unknown)", fontweight="bold")
    fmt_xk(axes[1])
    for i, (idx, val) in enumerate(descent.items()):
        axes[1].text(val + 500, i, f"{val:,}", va="center", fontsize=8)

    # Age group
    ag_order = ["Juvenile (<18)", "Young Adult (18-24)", "Adult (25-34)",
                "Adult (35-49)", "Middle-Aged (50-64)", "Senior (65+)"]
    age_g = df["age_group"].dropna().value_counts().reindex(ag_order, fill_value=0)
    axes[2].bar(range(len(age_g)), age_g.values,
                color=[PURPLE, BLUE, GREEN, ORANGE, RED, YELLOW], alpha=0.85)
    axes[2].set_xticks(range(len(age_g)))
    axes[2].set_xticklabels(["<18", "18-24", "25-34", "35-49", "50-64", "65+"], fontsize=9)
    axes[2].set_title("Victim Age Group", fontweight="bold")
    fmt_yk(axes[2])
    for i, val in enumerate(age_g.values):
        axes[2].text(i, val + 500, f"{val:,}", ha="center", fontsize=8)

    for ax in axes:
        ax.set_axisbelow(True)

    fig.suptitle("Victim Demographics Profile - LAPD 2020-2024",
                 fontsize=14, fontweight="bold", y=1.02)
    save("p2_13_victim_demographics")


def plot_domestic_violence(df: pd.DataFrame) -> None:
    dv = df[df["crime_category"] == "Domestic Violence"].copy()

    fig, axes = plt.subplots(2, 2, figsize=(13, 9))

    # By year
    dv_yr = dv.groupby("year").size().reset_index(name="n")
    axes[0, 0].bar(dv_yr["year"].astype(str), dv_yr["n"], color=RED, alpha=0.85)
    for bar, val in zip(axes[0, 0].patches, dv_yr["n"]):
        axes[0, 0].text(bar.get_x() + bar.get_width() / 2,
                        bar.get_height() + 80,
                        f"{val:,}", ha="center", fontsize=9, fontweight="bold")
    axes[0, 0].set_title("Domestic Violence Incidents by Year", fontweight="bold")
    fmt_yk(axes[0, 0])

    # By day of week
    day_ord = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    dv_day = dv.groupby("day_name", observed=True).size().reindex(day_ord, fill_value=0)
    c_day  = [RED if d in ["Friday","Saturday","Sunday"] else BLUE for d in dv_day.index]
    axes[0, 1].bar([d[:3] for d in dv_day.index], dv_day.values, color=c_day, alpha=0.85)
    axes[0, 1].set_title("Domestic Violence by Day of Week\n(weekends highlighted)", fontweight="bold")
    fmt_yk(axes[0, 1])

    # By hour
    dv_hr = dv.groupby("hour").size()
    axes[1, 0].fill_between(dv_hr.index, dv_hr.values, alpha=0.6, color=RED)
    axes[1, 0].plot(dv_hr.index, dv_hr.values, color=RED, linewidth=2)
    axes[1, 0].set_title("Domestic Violence by Hour of Day", fontweight="bold")
    axes[1, 0].set_xlabel("Hour (0-23)")
    fmt_yk(axes[1, 0])

    # Clearance: DV vs top 5 categories
    top5 = df["crime_category"].value_counts().head(5).index.tolist()
    compare = list(dict.fromkeys(["Domestic Violence"] + top5))[:7]
    clr = (df[df["crime_category"].isin(compare)]
           .groupby("crime_category", observed=True)["cleared"]
           .mean() * 100)
    c_clr = [RED if c == "Domestic Violence" else BLUE for c in clr.index]
    axes[1, 1].bar(range(len(clr)), clr.values, color=c_clr, alpha=0.85)
    axes[1, 1].set_xticks(range(len(clr)))
    axes[1, 1].set_xticklabels(
        [c.replace("Violent - ", "").replace("Property - ", "")[:14] for c in clr.index],
        rotation=20, fontsize=8.5)
    axes[1, 1].axhline(df["cleared"].mean() * 100, color=YELLOW, linestyle="--",
                        linewidth=1.5, label=f"Overall avg: {df['cleared'].mean()*100:.1f}%")
    axes[1, 1].set_title("Clearance Rate: DV vs Other Categories", fontweight="bold")
    axes[1, 1].set_ylabel("Clearance Rate (%)")
    axes[1, 1].legend(fontsize=9)

    for ax in axes.flat:
        ax.set_axisbelow(True)
        ax.grid(alpha=0.3)

    fig.suptitle("Domestic Violence Deep Dive - LAPD 2020-2024",
                 fontsize=14, fontweight="bold", y=1.01)
    save("p2_14_domestic_violence")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — CASE RESOLUTION
# ══════════════════════════════════════════════════════════════════════════════

def plot_clearance_trend(df: pd.DataFrame) -> None:
    yr = df.groupby("year").agg(
        total   =("DR_NO",    "count"),
        cleared =("cleared",  "sum"),
        arrested=("arrested", "sum"),
    ).reset_index()
    yr["clr_pct"] = yr["cleared"]   / yr["total"] * 100
    yr["arr_pct"] = yr["arrested"]  / yr["total"] * 100

    top5 = df["crime_category"].value_counts().head(5).index.tolist()
    clr_cat = (df.groupby(["year", "crime_category"], observed=True)["cleared"]
                 .mean()
                 .unstack() * 100)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    axes[0].plot(yr["year"], yr["clr_pct"],
                 color=GREEN, linewidth=2.5, marker="o", markersize=8, label="Clearance rate")
    axes[0].plot(yr["year"], yr["arr_pct"],
                 color=BLUE, linewidth=2, marker="s", markersize=7, label="Arrest rate")
    for _, row in yr.iterrows():
        axes[0].text(row["year"], row["clr_pct"] + 0.5,
                     f"{row['clr_pct']:.1f}%", ha="center", fontsize=9, color=GREEN)
    axes[0].set_title("Overall Clearance & Arrest Rate by Year", fontsize=12, fontweight="bold")
    axes[0].set_ylabel("%")
    axes[0].set_ylim(0, yr["clr_pct"].max() * 1.4)
    axes[0].legend(fontsize=9)
    axes[0].grid(alpha=0.3)

    palette = [RED, BLUE, GREEN, ORANGE, PURPLE]
    for i, cat in enumerate(top5):
        if cat in clr_cat.columns:
            axes[1].plot(clr_cat.index, clr_cat[cat],
                         label=cat.replace("Violent - ", "V-").replace("Property - ", "P-")[:20],
                         color=palette[i], linewidth=2, marker="o", markersize=6)
    axes[1].set_title("Clearance Rate by Top 5 Crime Categories", fontsize=12, fontweight="bold")
    axes[1].set_ylabel("Clearance Rate (%)")
    axes[1].legend(fontsize=8.5)
    axes[1].grid(alpha=0.3)

    save("p2_15_clearance_trend")


def plot_clearance_heatmap(df: pd.DataFrame) -> None:
    pivot = (df.groupby(["day_of_week", "hour"])["cleared"]
               .mean()
               .unstack() * 100)

    fig, ax = plt.subplots(figsize=(14, 5))
    sns.heatmap(pivot, ax=ax, cmap="RdYlGn",
                xticklabels=range(24), yticklabels=DAYS,
                linewidths=0.3, linecolor=BG,
                vmin=12, vmax=32,
                cbar_kws={"label": "Clearance Rate (%)"})
    ax.set_title("Case Clearance Rate (%) by Hour and Day of Week",
                 fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Hour of Day")
    ax.set_ylabel("")
    save("p2_16_clearance_heatmap")


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — PREMISES & WEAPONS
# ══════════════════════════════════════════════════════════════════════════════

def plot_premises_weapon(df: pd.DataFrame) -> None:
    prem = df.groupby("premises_group", observed=True).agg(
        n  =("DR_NO",   "count"),
        clr=("cleared", "mean"),
    ).sort_values("n", ascending=True)

    weap = df.groupby("weapon_category", observed=True).agg(
        n  =("DR_NO",   "count"),
        clr=("cleared", "mean"),
    ).sort_values("n", ascending=True)

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))

    c_prem = [BLUE, GREEN, ORANGE, PURPLE, RED][:len(prem)]
    axes[0].barh(prem.index, prem["n"], color=c_prem, alpha=0.85)
    axes[0].set_xlim(0, prem["n"].max() * 1.45)
    axes[0].set_title("Crimes by Premises Type\n(label = clearance rate)", fontweight="bold")
    fmt_xk(axes[0])
    for i, (idx, row) in enumerate(prem.iterrows()):
        axes[0].text(row["n"] + 500, i,
                     f"{row['n']:,}  ({row['clr']*100:.0f}% clr)",
                     va="center", fontsize=8.5)

    c_weap = [MUTED, ORANGE, RED, PURPLE, BLUE][:len(weap)]
    axes[1].barh(weap.index, weap["n"], color=c_weap, alpha=0.85)
    axes[1].set_xlim(0, weap["n"].max() * 1.45)
    axes[1].set_title("Crimes by Weapon Category\n(label = clearance rate)", fontweight="bold")
    fmt_xk(axes[1])
    for i, (idx, row) in enumerate(weap.iterrows()):
        axes[1].text(row["n"] + 300, i,
                     f"{row['n']:,}  ({row['clr']*100:.0f}% clr)",
                     va="center", fontsize=8.5)

    for ax in axes:
        ax.set_axisbelow(True)
        ax.grid(axis="x", alpha=0.3)
        ax.tick_params(axis="y", labelsize=9)

    fig.suptitle("Premises & Weapon Analysis - LAPD 2020-2024",
                 fontsize=14, fontweight="bold", y=1.02)
    save("p2_17_premises_weapon")


def plot_weapon_trend(df: pd.DataFrame) -> None:
    weap_yr = (df.groupby(["year", "weapon_category"], observed=True)
                 .size()
                 .unstack(fill_value=0))
    weap_pct = weap_yr.div(weap_yr.sum(axis=1), axis=0) * 100

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    if "Firearm" in weap_pct.columns:
        axes[0].bar(weap_pct.index.astype(str), weap_pct["Firearm"],
                    color=RED, alpha=0.85)
        for i, (yr, val) in enumerate(weap_pct["Firearm"].items()):
            axes[0].text(i, val + 0.1, f"{val:.1f}%",
                         ha="center", fontsize=10, fontweight="bold")
        axes[0].set_title("Firearm Involvement Rate by Year (% of all crimes)",
                           fontweight="bold")
        axes[0].set_ylabel("%")
        axes[0].grid(axis="y", alpha=0.3)
        axes[0].set_ylim(0, weap_pct["Firearm"].max() * 1.35)

    weap_v = (df.groupby(["weapon_category", "is_violent"], observed=True)
                .size()
                .unstack(fill_value=0))
    weap_v.columns = ["Non-Violent", "Violent"]
    weap_v = weap_v.sort_values("Violent", ascending=True)
    weap_v.plot(kind="barh", ax=axes[1], color=[BLUE, RED], alpha=0.85)
    axes[1].set_title("Weapon Use: Violent vs Non-Violent", fontweight="bold")
    axes[1].set_xlabel("Incidents")
    fmt_xk(axes[1])
    axes[1].grid(axis="x", alpha=0.3)
    axes[1].set_axisbelow(True)

    save("p2_18_weapon_trend")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("\n" + "=" * 60)
    print("  Phase 2 - EDA: Generating all figures")
    print("=" * 60 + "\n")

    df = load()

    print("\n[1/6] Temporal analysis...")
    plot_annual_trend(df)
    plot_monthly_seasonality(df)
    plot_hour_day_heatmap(df)
    plot_category_trends(df)
    plot_reporting_lag(df)

    print("\n[2/6] Geographic analysis...")
    plot_area_ranking(df)
    plot_density_map(df)
    plot_area_category_heatmap(df)

    print("\n[3/6] Crime type analysis...")
    plot_category_overview(df)
    plot_top20_crimes(df)
    plot_violent_property_trend(df)

    print("\n[4/6] Victim demographics...")
    plot_victim_age_category(df)
    plot_victim_demographics(df)
    plot_domestic_violence(df)

    print("\n[5/6] Case resolution...")
    plot_clearance_trend(df)
    plot_clearance_heatmap(df)

    print("\n[6/6] Premises & weapons...")
    plot_premises_weapon(df)
    plot_weapon_trend(df)

    print(f"\n18 figures saved to {FIGDIR}")
    print("Phase 2 EDA complete.")


if __name__ == "__main__":
    main()
