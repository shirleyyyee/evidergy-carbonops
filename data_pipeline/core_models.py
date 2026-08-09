"""Offline analytics reference implementation for the MVP batch pipeline."""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor


def energy_balance(frame: pd.DataFrame, tolerance_pct: float = 0.03) -> pd.DataFrame:
    result = frame.copy()
    result["balance_residual_kw"] = result["grid_kw"] + result["pv_kw"] + result["bess_kw"] - result["load_kw"]
    result["balance_residual_pct"] = result["balance_residual_kw"] / result["load_kw"].abs().clip(lower=1)
    result["balance_pass"] = result["balance_residual_pct"].abs() <= tolerance_pct
    return result


def quality_flags(series: pd.Series, expected_frequency: str = "5min") -> pd.DataFrame:
    values = series.sort_index()
    expected = pd.date_range(values.index.min(), values.index.max(), freq=expected_frequency, tz=values.index.tz)
    aligned = values.reindex(expected)
    return pd.DataFrame({"missing": aligned.isna(), "frozen": aligned.eq(aligned.shift()).rolling(6, min_periods=6).sum().eq(6), "jump": aligned.diff().abs().gt(aligned.diff().abs().quantile(0.999))}, index=expected)


@dataclass
class QuantileForecast:
    quantiles: tuple[float, ...] = (0.05, 0.5, 0.95)
    models: dict[float, GradientBoostingRegressor] | None = None

    def fit(self, features: pd.DataFrame, target: pd.Series) -> "QuantileForecast":
        self.models = {}
        for q in self.quantiles:
            model = GradientBoostingRegressor(loss="quantile", alpha=q, n_estimators=250, max_depth=3, learning_rate=0.035, random_state=42)
            model.fit(features, target)
            self.models[q] = model
        return self

    def predict(self, features: pd.DataFrame) -> pd.DataFrame:
        if not self.models: raise RuntimeError("fit must be called before predict")
        predictions = {f"p{int(q*100):02d}": model.predict(features) for q, model in self.models.items()}
        result = pd.DataFrame(predictions, index=features.index)
        result["p05"], result["p50"], result["p95"] = np.minimum(result["p05"], result["p50"]), result["p50"], np.maximum(result["p95"], result["p50"])
        return result


def forecast_metrics(actual: pd.Series, forecast: pd.DataFrame) -> dict[str, float]:
    aligned = pd.concat([actual.rename("actual"), forecast], axis=1).dropna()
    return {"mae_p50_kw": float((aligned.actual - aligned.p50).abs().mean()), "p90_coverage": float(((aligned.actual >= aligned.p05) & (aligned.actual <= aligned.p95)).mean()), "mean_interval_width_kw": float((aligned.p95 - aligned.p05).mean()), "median_bias_kw": float((aligned.p50 - aligned.actual).median())}


def pv_underperformance(actual_kw: pd.Series, expected_p50_kw: pd.Series, expected_p05_kw: pd.Series, interval_hours: float = 1/12, persistence: int = 6) -> pd.DataFrame:
    candidate = actual_kw < expected_p05_kw
    persistent = candidate.rolling(persistence, min_periods=persistence).sum().eq(persistence)
    lost_kwh = (expected_p50_kw - actual_kw).clip(lower=0) * interval_hours
    return pd.DataFrame({"candidate": candidate, "persistent": persistent, "estimated_lost_kwh": lost_kwh})


def bess_consistency(power_kw: pd.Series, soc_pct: pd.Series, deadband_kw: float = 2) -> pd.DataFrame:
    delta_soc = soc_pct.diff()
    expected_soc_direction = np.where(power_kw > deadband_kw, -1, np.where(power_kw < -deadband_kw, 1, 0))
    mismatch = (expected_soc_direction != 0) & (np.sign(delta_soc) != expected_soc_direction)
    return pd.DataFrame({"soc_delta_pct": delta_soc, "expected_direction": expected_soc_direction, "direction_mismatch": mismatch})


def scope2_ledger(grid_import_kwh: pd.Series, factor_kg_co2e_per_kwh: float, factor_version: str, data_version: str) -> pd.DataFrame:
    result = pd.DataFrame({"grid_import_kwh": grid_import_kwh.clip(lower=0)})
    result["emissions_kg_co2e"] = result.grid_import_kwh * factor_kg_co2e_per_kwh
    result["factor_kg_co2e_per_kwh"] = factor_kg_co2e_per_kwh
    result["factor_version"] = factor_version
    result["data_version"] = data_version
    result["calculation_version"] = "CARB-CALC-v1.1"
    return result
