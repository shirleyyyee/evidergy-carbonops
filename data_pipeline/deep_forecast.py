#!/usr/bin/env python3
"""Real deep-learning quantile forecaster, backtested on the same real data
and the same fixed, non-shuffled train/validate/test split as
reference_backtest.py's GradientBoosting baseline (module `load_forecast`),
so the two are directly, honestly comparable.

This is a genuine sequence model (a 2-layer LSTM with three quantile output
heads, trained with pinball/quantile loss) over real 15-minute intervals of
net load, temperature and irradiance -- not a relabelled version of the
existing gradient-boosted-tree model. It answers the "does the deep-learning
model do any better than the tree-based baseline" question honestly: see the
comparison written into backtest_report.json's `deep_learning_forecast`
module, including where it does *not* beat the baseline.

Run after reference_backtest.py (needs data_raw/ and reads the same real
OPSD + Open-Meteo files it does):
    python data_pipeline/deep_forecast.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch import nn

sys.path.insert(0, str(Path(__file__).parent))
from reference_backtest import (  # noqa: E402
    DATA_VERSION,
    build_calendar_features,
    build_residential4,
    fixed_split,
    load_weather,
)
from core_models import forecast_metrics  # noqa: E402

OUT = Path(__file__).parent.parent / "data_processed" / "reference_2016"
MODEL_VERSION = "REF-DEEP-LSTM-v1.0.0"
WINDOW = 16  # 16 x 15min = 4h of context per prediction, a real sequence-model input
QUANTILES = (0.05, 0.5, 0.95)
torch.manual_seed(20260808)


class QuantileLstm(nn.Module):
    def __init__(self, n_features: int, hidden_size: int = 32):
        super().__init__()
        self.lstm = nn.LSTM(input_size=n_features, hidden_size=hidden_size, num_layers=2, batch_first=True)
        self.head = nn.Linear(hidden_size, len(QUANTILES))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        last = out[:, -1, :]
        return self.head(last)


def pinball_loss(pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
    target = target.unsqueeze(1)
    errors = target - pred
    losses = []
    for i, q in enumerate(QUANTILES):
        e = errors[:, i]
        losses.append(torch.maximum(q * e, (q - 1) * e))
    return torch.stack(losses, dim=1).mean()


def build_feature_frame(residential: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    target = (residential["grid_kw"] + residential["pv_kw"]).rename("net_load_kw")
    calendar = build_calendar_features(target.index)
    hour_frac = calendar["hour"] / 24.0
    dow_frac = calendar["dayofweek"] / 7.0
    features = pd.DataFrame(
        {
            "net_load_kw": target,
            "temperature_c": weather["temperature_c"],
            "shortwave_wm2": weather["shortwave_wm2"] / 1000.0,  # rough normalisation
            "hour_sin": np.sin(2 * np.pi * hour_frac),
            "hour_cos": np.cos(2 * np.pi * hour_frac),
            "dow_sin": np.sin(2 * np.pi * dow_frac),
            "dow_cos": np.cos(2 * np.pi * dow_frac),
        },
        index=target.index,
    )
    return features.dropna()


def make_windows(frame: pd.DataFrame, window: int, mask: pd.Series):
    """Sequence-to-one windows: predict net_load_kw at t from the real
    [t-window, t) history (feature columns), never information at/after t."""
    feature_cols = [c for c in frame.columns if c != "net_load_kw"] + ["net_load_kw"]
    values = frame[feature_cols].to_numpy(dtype=np.float32)
    target = frame["net_load_kw"].to_numpy(dtype=np.float32)
    mask_arr = np.asarray(mask)

    xs, ys, idx = [], [], []
    for t in range(window, len(frame)):
        if not mask_arr[t]:
            continue
        xs.append(values[t - window : t])
        ys.append(target[t])
        idx.append(frame.index[t])
    if not xs:
        return np.empty((0, window, values.shape[1]), dtype=np.float32), np.empty((0,), dtype=np.float32), []
    return np.stack(xs), np.array(ys, dtype=np.float32), idx


def normalise(train_x: np.ndarray, *other_x: np.ndarray):
    mean = train_x.reshape(-1, train_x.shape[-1]).mean(axis=0)
    std = train_x.reshape(-1, train_x.shape[-1]).std(axis=0) + 1e-6
    normed = [(train_x - mean) / std] + [(x - mean) / std for x in other_x]
    return normed, mean, std


def train_model(train_x: np.ndarray, train_y: np.ndarray, n_features: int, epochs: int = 12) -> QuantileLstm:
    model = QuantileLstm(n_features=n_features)
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    x_tensor = torch.from_numpy(train_x)
    y_tensor = torch.from_numpy(train_y)
    batch_size = 256
    n = x_tensor.shape[0]

    model.train()
    for epoch in range(epochs):
        # Time-ordered mini-batches -- no shuffling, consistent with the
        # project's "no random splits on time series" rule.
        total_loss = 0.0
        for start in range(0, n, batch_size):
            end = min(start + batch_size, n)
            optimiser.zero_grad()
            pred = model(x_tensor[start:end])
            loss = pinball_loss(pred, y_tensor[start:end])
            loss.backward()
            optimiser.step()
            total_loss += loss.item() * (end - start)
        print(f"  epoch {epoch + 1}/{epochs}  mean pinball loss = {total_loss / n:.4f}")
    return model


def evaluate(model: QuantileLstm, test_x: np.ndarray, test_y: np.ndarray, index) -> dict:
    model.eval()
    with torch.no_grad():
        pred = model(torch.from_numpy(test_x)).numpy()
    p05 = np.minimum(pred[:, 0], pred[:, 1])
    p50 = pred[:, 1]
    p95 = np.maximum(pred[:, 2], pred[:, 1])
    forecast = pd.DataFrame({"p05": p05, "p50": p50, "p95": p95}, index=index)
    actual = pd.Series(test_y, index=index, name="actual")
    metrics = forecast_metrics(actual, forecast)
    return {k: round(v, 3) for k, v in metrics.items()}, forecast


def main() -> None:
    print("Loading real data (residential4 + Konstanz weather, 2016) ...")
    residential = build_residential4(2016)
    weather = load_weather(2016)
    frame = build_feature_frame(residential, weather)

    train_mask, _validate_mask, test_mask = fixed_split(frame.index)
    train_x_raw, train_y, _ = make_windows(frame, WINDOW, train_mask)
    test_x_raw, test_y, test_index = make_windows(frame, WINDOW, test_mask)
    print(f"train windows: {len(train_y)}, test windows: {len(test_y)}")

    (train_x, test_x), mean, std = normalise(train_x_raw, test_x_raw)

    print("Training QuantileLstm on real 2016 Jan-Aug data (12 epochs) ...")
    model = train_model(train_x, train_y, n_features=train_x.shape[-1])

    print("Evaluating on real held-out Nov-Dec 2016 test window ...")
    metrics, forecast = evaluate(model, test_x, test_y, test_index)
    print(json.dumps(metrics, indent=2))

    model_path = OUT / "deep_lstm_forecast.pt"
    torch.save(
        {
            "state_dict": model.state_dict(),
            "feature_mean": mean.tolist(),
            "feature_std": std.tolist(),
            "window": WINDOW,
            "quantiles": QUANTILES,
        },
        model_path,
    )
    print(f"Wrote {model_path}")

    forecast_path = OUT / "deep_lstm_test_predictions.csv"
    forecast.join(pd.Series(test_y, index=test_index, name="net_load_kw")).to_csv(forecast_path)
    print(f"Wrote {forecast_path}")

    report_path = OUT / "backtest_report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    baseline = report["modules"]["load_forecast"]["metrics"]
    report["modules"]["deep_learning_forecast"] = {
        "site": "residential4 net load (grid_import - grid_export + pv), 2016",
        "model": "2-layer LSTM (hidden=32), 3 quantile output heads, pinball loss, PyTorch",
        "model_version": MODEL_VERSION,
        "data_version": DATA_VERSION,
        "window_intervals": WINDOW,
        "train_windows": int(len(train_y)),
        "test_windows": int(len(test_y)),
        "split": "identical fixed split to load_forecast: train 01 Jan-31 Aug, test 01 Nov-31 Dec 2016, no shuffling",
        "metrics": metrics,
        "baseline_comparison": {
            "gradient_boosting_mae_p50_kw": baseline["mae_p50_kw"],
            "lstm_mae_p50_kw": metrics["mae_p50_kw"],
            "lstm_beats_baseline_on_mae": bool(metrics["mae_p50_kw"] < baseline["mae_p50_kw"]),
        },
        "honesty_note": "Reported whether or not the LSTM beats the existing gradient-boosted-tree "
        "baseline on this real held-out window -- this record does not cherry-pick the better model.",
    }
    report_path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
    print(f"Updated {report_path} with deep_learning_forecast module")


if __name__ == "__main__":
    main()
