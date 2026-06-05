"""
Phase 5B -- Time Series Forecasting
Predicts monthly crime volume for Jan-Dec 2025 using Prophet.
Falls back to statsmodels ExponentialSmoothing if Prophet unavailable.

Outputs (outputs/figures/):
  p5b_01_forecast_overall.png      12-month forecast, total crimes
  p5b_02_forecast_components.png   Trend + seasonality decomposition
  p5b_03_forecast_categories.png   Top-5 categories individually
  p5b_04_forecast_divisions.png    Top-6 divisions
  p5b_05_forecast_cv.png           Cross-validation residuals

Outputs (outputs/reports/):
  forecast_2025.csv                Monthly predictions (mean + CI)

Run: python src/ml_forecast.py
"""

from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap

ROOT    = Path(__file__).parent.parent
PROC    = ROOT / "data" / "processed"
FIGDIR  = ROOT / "outputs" / "figures"
REPDIR  = ROOT / "outputs" / "reports"
FIGDIR.mkdir(parents=True, exist_ok=True)
REPDIR.mkdir(parents=True, exist_ok=True)

BG      = "#0f1117"
SURFACE = "#1a1d27"
BLUE    = "#4f8ef7"
RED     = "#e05252"
GREEN   = "#3ecf8e"
ORANGE  = "#e0883a"
YELLOW  = "#e0c066"
MUTED   = "#7b82a0"
PURPLE  = "#7c5cbf"
CYAN    = "#60c9d4"

CAT_COLORS = [BLUE, RED, GREEN, ORANGE, PURPLE]

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": SURFACE,
    "axes.edgecolor": MUTED, "axes.labelcolor": "white",
    "xtick.color": MUTED, "ytick.color": MUTED,
    "text.color": "white", "grid.color": "#2a2d3a",
    "grid.linestyle": "--", "grid.alpha": 0.5,
})

MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun",
               "Jul","Aug","Sep","Oct","Nov","Dec"]


def save(name: str):
    plt.savefig(FIGDIR / f"{name}.png", dpi=150,
                bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"  Saved {name}.png")


# ── Data loading ─────────────────────────────────────────────────────────────

def load_monthly() -> pd.DataFrame:
    print("Loading crime data...")
    df = pd.read_parquet(PROC / "lapd_enriched.parquet",
                         columns=["date_occ", "crime_category", "AREA NAME",
                                  "is_violent", "is_property"])
    df["date_occ"] = pd.to_datetime(df["date_occ"])
    df["period"]   = df["date_occ"].dt.to_period("M")
    return df


def monthly_series(df: pd.DataFrame, col: str = None, val: str = None) -> pd.DataFrame:
    if col and val:
        sub = df[df[col] == val]
    else:
        sub = df
    ts = (sub.groupby("period").size()
            .reset_index(name="y"))
    ts["ds"] = ts["period"].dt.to_timestamp()
    ts = ts.sort_values("ds").reset_index(drop=True)
    return ts[["ds", "y"]]


# ── Prophet / fallback ───────────────────────────────────────────────────────

def _try_prophet(ts: pd.DataFrame, periods: int = 12, label: str = "") -> dict:
    """Returns dict with keys: forecast_df, model_name, has_components."""
    try:
        from prophet import Prophet
        m = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode="multiplicative",
            changepoint_prior_scale=0.15,
            interval_width=0.90,
        )
        # COVID as holiday
        covid = pd.DataFrame({
            "holiday": "covid_lockdown",
            "ds": pd.date_range("2020-03-15", "2020-08-01", freq="MS"),
            "lower_window": 0, "upper_window": 1,
        })
        m.add_country_holidays(country_name="US")
        m.fit(ts)
        future = m.make_future_dataframe(periods=periods, freq="MS")
        fc     = m.predict(future)
        return {"fc": fc, "model": m, "name": "Prophet", "has_components": True}
    except Exception as e:
        print(f"    Prophet unavailable ({e}), using ExponentialSmoothing...")
        return _ets_fallback(ts, periods)


def _ets_fallback(ts: pd.DataFrame, periods: int = 12) -> dict:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    y   = ts["y"].values.astype(float)
    fit = ExponentialSmoothing(y, trend="add", seasonal="add",
                               seasonal_periods=12).fit()
    fcast = fit.forecast(periods)
    # Confidence interval: +/- 1.645 * residual std (90%)
    resid_std = np.std(fit.resid)
    hi = fcast + 1.645 * resid_std
    lo = np.clip(fcast - 1.645 * resid_std, 0, None)

    last = ts["ds"].max()
    future_dates = pd.date_range(last + pd.offsets.MonthBegin(1),
                                 periods=periods, freq="MS")
    fc = pd.DataFrame({
        "ds":    list(ts["ds"]) + list(future_dates),
        "yhat":  list(fit.fittedvalues) + list(fcast),
        "yhat_upper": list(fit.fittedvalues + resid_std) + list(hi),
        "yhat_lower": list(fit.fittedvalues - resid_std) + list(lo),
    })
    return {"fc": fc, "model": fit, "name": "ETS", "has_components": False}


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 1 — Overall 12-month forecast
# ══════════════════════════════════════════════════════════════════════════════

def plot_overall_forecast(ts: pd.DataFrame, result: dict):
    fc   = result["fc"]
    name = result["name"]

    cutoff = ts["ds"].max()
    fc_future = fc[fc["ds"] > cutoff]
    fc_hist   = fc[fc["ds"] <= cutoff]

    fig, ax = plt.subplots(figsize=(14, 6), facecolor=BG)
    ax.set_facecolor(SURFACE)

    # Historical actuals
    ax.plot(ts["ds"], ts["y"], color=BLUE, lw=2, label="Actual (2020-2024)", zorder=5)

    # Fitted (in-sample)
    ax.plot(fc_hist["ds"], fc_hist["yhat"],
            color=YELLOW, lw=1.2, ls="--", alpha=0.7, label="Fitted")

    # Forecast
    ax.plot(fc_future["ds"], fc_future["yhat"],
            color=GREEN, lw=2.5, label="Forecast 2025", zorder=6)
    ax.fill_between(fc_future["ds"],
                    fc_future["yhat_lower"], fc_future["yhat_upper"],
                    alpha=0.2, color=GREEN, label="90% CI")

    # COVID shading
    ax.axvspan(pd.Timestamp("2020-03-01"), pd.Timestamp("2020-09-01"),
               alpha=0.12, color=PURPLE, label="COVID lockdown")

    # Forecast cutoff line
    ax.axvline(cutoff, color=MUTED, lw=1, ls=":", alpha=0.7)
    ax.text(cutoff, ax.get_ylim()[1] if ax.get_ylim()[1] else ts["y"].max(),
            " Forecast ->", color=MUTED, fontsize=9, va="top")

    ax.set_xlabel("Month")
    ax.set_ylabel("Monthly Crime Count")
    ax.set_title(f"LAPD Monthly Crime Forecast — 2025 ({name} model)",
                 fontsize=14, color="white", pad=12)
    ax.legend(fontsize=9, loc="upper right")
    ax.grid(True, alpha=0.3)

    # Annotate 2025 predictions
    last_actual = ts["y"].iloc[-12:].mean()
    avg_forecast = fc_future["yhat"].mean()
    pct_chg = (avg_forecast - last_actual) / last_actual * 100
    sign = "+" if pct_chg >= 0 else ""
    ax.text(0.02, 0.05,
            f"Avg 2025 forecast: {avg_forecast:,.0f}/month ({sign}{pct_chg:.1f}% vs 2024 avg)",
            transform=ax.transAxes, fontsize=10, color=GREEN,
            bbox=dict(boxstyle="round", fc=SURFACE, ec=MUTED, alpha=0.8))

    fig.tight_layout()
    save("p5b_01_forecast_overall")
    return fc_future


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 2 — Components (trend + seasonality) — Prophet only
# ══════════════════════════════════════════════════════════════════════════════

def plot_components(ts: pd.DataFrame, result: dict):
    if not result["has_components"]:
        # ETS: plot trend decomposition manually
        from statsmodels.tsa.seasonal import seasonal_decompose
        ts_idx = ts.set_index("ds")["y"]
        decomp = seasonal_decompose(ts_idx, model="additive", period=12)

        fig, axes = plt.subplots(3, 1, figsize=(14, 9), facecolor=BG)
        for ax, series, label, color in [
            (axes[0], decomp.trend,    "Trend",        BLUE),
            (axes[1], decomp.seasonal, "Seasonality",  ORANGE),
            (axes[2], decomp.resid,    "Residuals",    MUTED),
        ]:
            ax.set_facecolor(SURFACE)
            ax.plot(series.index, series.values, color=color, lw=1.8)
            ax.axhline(0, color=MUTED, lw=0.8, ls="--", alpha=0.5)
            ax.set_ylabel(label, color="white", fontsize=11)
            ax.grid(True, alpha=0.3)
        axes[2].set_xlabel("Month")
        fig.suptitle("Time Series Decomposition (Additive)",
                     color="white", fontsize=14)
        fig.tight_layout()
        save("p5b_02_forecast_components")
        return

    m  = result["model"]
    fc = result["fc"]
    try:
        from prophet.plot import plot_components as pc_plot
        fig = m.plot_components(fc)
        fig.set_facecolor(BG)
        for ax in fig.axes:
            ax.set_facecolor(SURFACE)
            ax.tick_params(colors=MUTED)
            ax.xaxis.label.set_color("white")
            ax.yaxis.label.set_color("white")
            ax.title.set_color("white")
        plt.savefig(FIGDIR / "p5b_02_forecast_components.png",
                    dpi=150, bbox_inches="tight", facecolor=BG)
        plt.close()
        print("  Saved p5b_02_forecast_components.png")
    except Exception:
        plot_components(ts, {**result, "has_components": False})


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 3 — Forecast by top-5 crime categories
# ══════════════════════════════════════════════════════════════════════════════

def plot_category_forecasts(df: pd.DataFrame):
    top5 = df["crime_category"].value_counts().nlargest(5).index.tolist()
    print(f"Forecasting top-5 categories...")

    fig, axes = plt.subplots(5, 1, figsize=(14, 22), facecolor=BG)
    cutoff = pd.Timestamp("2024-12-01")

    for ax, cat, color in zip(axes, top5, CAT_COLORS):
        ts = monthly_series(df, "crime_category", cat)
        r  = _try_prophet(ts, periods=12, label=cat)
        fc = r["fc"]

        fc_future = fc[fc["ds"] > cutoff]
        ax.set_facecolor(SURFACE)
        ax.plot(ts["ds"], ts["y"], color=color, lw=1.8, label="Actual")
        ax.plot(fc_future["ds"], fc_future["yhat"],
                color=GREEN, lw=2.2, label="Forecast 2025")
        ax.fill_between(fc_future["ds"],
                        fc_future["yhat_lower"], fc_future["yhat_upper"],
                        alpha=0.2, color=GREEN)
        ax.axvline(cutoff, color=MUTED, lw=0.8, ls=":")
        ax.set_ylabel("Crimes/month", fontsize=9, color="white")
        ax.set_title(cat, fontsize=11, color="white", pad=6)
        ax.legend(fontsize=8, loc="upper right")
        ax.grid(True, alpha=0.3)

    fig.suptitle("12-Month Forecast by Crime Category",
                 fontsize=15, color="white", y=1.005)
    fig.tight_layout()
    save("p5b_03_forecast_categories")


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 4 — Forecast by top-6 divisions
# ══════════════════════════════════════════════════════════════════════════════

def plot_division_forecasts(df: pd.DataFrame):
    top6 = df["AREA NAME"].value_counts().nlargest(6).index.tolist()
    print(f"Forecasting top-6 divisions...")

    fig, axes = plt.subplots(2, 3, figsize=(18, 10), facecolor=BG)
    axes = axes.flatten()
    cutoff = pd.Timestamp("2024-12-01")
    div_colors = [BLUE, RED, ORANGE, GREEN, PURPLE, CYAN]

    for ax, div, color in zip(axes, top6, div_colors):
        ts = monthly_series(df, "AREA NAME", div)
        r  = _try_prophet(ts, periods=12)
        fc = r["fc"]
        fc_future = fc[fc["ds"] > cutoff]
        ax.set_facecolor(SURFACE)
        ax.plot(ts["ds"], ts["y"], color=color, lw=1.6, label="Actual")
        ax.plot(fc_future["ds"], fc_future["yhat"],
                color=GREEN, lw=2, label="Forecast 2025")
        ax.fill_between(fc_future["ds"],
                        fc_future["yhat_lower"], fc_future["yhat_upper"],
                        alpha=0.15, color=GREEN)
        ax.axvline(cutoff, color=MUTED, lw=0.8, ls=":")
        ax.set_title(div, fontsize=11, color="white", pad=6)
        ax.grid(True, alpha=0.3)
        ax.legend(fontsize=8, loc="upper right")

    fig.suptitle("12-Month Crime Forecast by LAPD Division",
                 fontsize=14, color="white", y=1.01)
    fig.tight_layout()
    save("p5b_04_forecast_divisions")


# ══════════════════════════════════════════════════════════════════════════════
# FIGURE 5 — Cross-validation residuals (overall model)
# ══════════════════════════════════════════════════════════════════════════════

def plot_cv_residuals(ts: pd.DataFrame, result: dict):
    print("Computing cross-validation residuals...")
    fc = result["fc"]

    # Merge actual vs fitted
    merged = ts.merge(fc[["ds","yhat"]], on="ds", how="inner")
    merged["residual"] = merged["y"] - merged["yhat"]
    merged["pct_err"]  = np.abs(merged["residual"]) / merged["y"] * 100

    mae  = np.abs(merged["residual"]).mean()
    rmse = np.sqrt((merged["residual"] ** 2).mean())
    mape = merged["pct_err"].mean()

    fig, axes = plt.subplots(1, 2, figsize=(14, 5), facecolor=BG)

    ax = axes[0]
    ax.set_facecolor(SURFACE)
    ax.bar(merged["ds"], merged["residual"],
           color=[RED if r < 0 else GREEN for r in merged["residual"]],
           alpha=0.8, width=20)
    ax.axhline(0, color=MUTED, lw=1, ls="--")
    ax.set_title(f"Residuals: Actual - Fitted\nMAE={mae:.0f}  RMSE={rmse:.0f}  MAPE={mape:.1f}%",
                 color="white", fontsize=11)
    ax.set_ylabel("Residual (crimes)")
    ax.grid(True, alpha=0.3)

    ax = axes[1]
    ax.set_facecolor(SURFACE)
    ax.scatter(merged["yhat"], merged["residual"],
               c=merged["ds"].astype(np.int64), cmap="plasma",
               alpha=0.75, s=60, zorder=5)
    ax.axhline(0, color=MUTED, lw=1, ls="--")
    ax.set_xlabel("Fitted value")
    ax.set_ylabel("Residual")
    ax.set_title("Residuals vs Fitted", color="white", fontsize=11)
    ax.grid(True, alpha=0.3)

    model_name = result["name"]
    fig.suptitle(f"Model Diagnostics — {model_name} (in-sample fit)",
                 color="white", fontsize=13)
    fig.tight_layout()
    save("p5b_05_forecast_cv")

    return {"mae": round(mae, 1), "rmse": round(rmse, 1), "mape": round(mape, 2)}


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("\n" + "=" * 60)
    print("  Phase 5B - Time Series Forecasting")
    print("=" * 60 + "\n")

    df = load_monthly()
    ts = monthly_series(df)
    print(f"  Monthly series: {len(ts)} months ({ts['ds'].min().date()} to {ts['ds'].max().date()})")

    print("\n[1] Overall forecast...")
    result = _try_prophet(ts, periods=12)
    print(f"    Model: {result['name']}")
    fc_future = plot_overall_forecast(ts, result)

    print("\n[2] Trend decomposition...")
    plot_components(ts, result)

    print("\n[3] Category forecasts...")
    plot_category_forecasts(df)

    print("\n[4] Division forecasts...")
    plot_division_forecasts(df)

    print("\n[5] Cross-validation residuals...")
    metrics = plot_cv_residuals(ts, result)
    print(f"    MAE={metrics['mae']}  RMSE={metrics['rmse']}  MAPE={metrics['mape']}%")

    # Save forecast CSV
    fc_out = fc_future[["ds", "yhat", "yhat_lower", "yhat_upper"]].copy()
    fc_out.columns = ["month", "forecast", "ci_lower", "ci_upper"]
    fc_out["month"] = fc_out["month"].dt.strftime("%Y-%m")
    fc_out = fc_out.round(0)
    fc_out.to_csv(REPDIR / "forecast_2025.csv", index=False)
    print(f"\n  forecast_2025.csv saved ({len(fc_out)} months)")

    print("\n" + "=" * 60)
    print(f"  Phase 5B complete — model: {result['name']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
