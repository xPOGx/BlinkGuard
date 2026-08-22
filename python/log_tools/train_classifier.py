#!/usr/bin/env python3
"""
Train Stage-4 logistic credit vote on harvested corpus candidates.

Default: fit on complete (gates_ok) rows only — that is the veto surface.
sklearn is optional (venv-only). Fallback is numpy L2 logistic.
Writes domain/classifier_weights.json. Sidecar inference stays math.exp.

Usage (from python/):
  venv\\Scripts\\python.exe log_tools\\train_classifier.py
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np

_TOOLS = Path(__file__).resolve().parent
_PYTHON = _TOOLS.parent
if str(_TOOLS) not in sys.path:
	sys.path.insert(0, str(_TOOLS))
if str(_PYTHON) not in sys.path:
	sys.path.insert(0, str(_PYTHON))

from blink_detector_package.domain import classifier as classifier_mod  # noqa: E402
from blink_detector_package.domain.classifier import (  # noqa: E402
	FEATURE_NAMES,
	clear_weights_cache,
	set_cached_weights,
)
from harvest_candidates import harvest_dir  # noqa: E402
from metrics import DEFAULT_MATCH_WINDOW_S, evaluate_dir  # noqa: E402
from paths import domain_package_dir, fixtures_sessions_dir  # noqa: E402

DEFAULT_OUT = domain_package_dir() / "classifier_weights.json"
THRESHOLDS = tuple(round(x, 2) for x in np.arange(0.25, 0.61, 0.05))
PROTECTED = ("frontal_calm", "chat_look_down")
F1_FLOOR = 0.90
PROTECTED_SLACK = 0.02


def _try_sklearn():
	try:
		from sklearn.linear_model import LogisticRegression

		return LogisticRegression
	except ImportError:
		return None


def _standardize(
	X: np.ndarray,
	mean: np.ndarray | None = None,
	std: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
	if mean is None:
		mean = X.mean(axis=0)
	if std is None:
		std = X.std(axis=0)
	std = np.where(std < 1e-8, 1.0, std)
	return (X - mean) / std, mean, std


def _fit_numpy(
	X: np.ndarray,
	y: np.ndarray,
	*,
	l2: float = 1.0,
	steps: int = 800,
	lr: float = 0.4,
) -> tuple[np.ndarray, float]:
	n, d = X.shape
	w = np.zeros(d, dtype=float)
	b = 0.0
	n_pos = float(y.sum())
	n_neg = float(n - n_pos)
	if n_pos > 0 and n_neg > 0:
		sample_w = np.where(y == 1.0, n / (2.0 * n_pos), n / (2.0 * n_neg))
	else:
		sample_w = np.ones(n)
	sw_sum = float(sample_w.sum())
	for _ in range(steps):
		z = np.clip(X @ w + b, -40.0, 40.0)
		p = 1.0 / (1.0 + np.exp(-z))
		err = (p - y) * sample_w
		grad_w = (X.T @ err) / sw_sum + (l2 * w) / max(n, 1)
		grad_b = float(err.sum()) / sw_sum
		w -= lr * grad_w
		b -= lr * grad_b
	return w, float(b)


def _fit(
	X: np.ndarray,
	y: np.ndarray,
	*,
	l2: float = 1.0,
) -> tuple[np.ndarray, float, str]:
	LogisticRegression = _try_sklearn()
	if LogisticRegression is not None:
		clf = LogisticRegression(
			C=1.0 / l2 if l2 > 0 else 1e6,
			penalty="l2",
			solver="lbfgs",
			max_iter=400,
			class_weight="balanced",
		)
		clf.fit(X, y)
		return clf.coef_.ravel().astype(float), float(clf.intercept_[0]), "sklearn"
	w, b = _fit_numpy(X, y, l2=l2)
	return w, b, "numpy"


def _payload(
	*,
	mean: np.ndarray,
	std: np.ndarray,
	weights: np.ndarray,
	bias: float,
	threshold: float,
	note: str,
) -> dict[str, Any]:
	return {
		"version": 2,
		"features": list(FEATURE_NAMES),
		"mean": [float(v) for v in mean],
		"std": [float(v) for v in std],
		"weights": [float(v) for v in weights],
		"bias": float(bias),
		"threshold": float(threshold),
		"note": note,
	}


def _per_trace_f1(result: dict[str, Any], name: str) -> float | None:
	for row in result.get("per_trace") or []:
		scenario = row.get("scenario") or Path(row["trace"]).stem
		if scenario == name or Path(row["trace"]).stem == name:
			return float(row["f1"])
	return None


def _evaluate_with(
	payload: dict[str, Any],
	directory: Path,
	match_window_s: float,
	*,
	kind: str = "primary",
):
	set_cached_weights(payload)
	try:
		return evaluate_dir(
			directory,
			match_window_s=match_window_s,
			kind=kind,
		)
	finally:
		clear_weights_cache()


def _leave_one_out(
	rows: list[dict[str, Any]],
	X: np.ndarray,
	y: np.ndarray,
	l2: float,
) -> list[dict[str, Any]]:
	sessions = sorted({row["session"] for row in rows})
	reports: list[dict[str, Any]] = []
	for held in sessions:
		train_idx = [i for i, row in enumerate(rows) if row["session"] != held]
		test_idx = [i for i, row in enumerate(rows) if row["session"] == held]
		if not train_idx or not test_idx:
			continue
		X_tr, m, s = _standardize(X[train_idx])
		w, b, backend = _fit(X_tr, y[train_idx], l2=l2)
		test_y = y[test_idx]
		X_te = (X[test_idx] - m) / s
		z = np.clip(X_te @ w + b, -40.0, 40.0)
		p = 1.0 / (1.0 + np.exp(-z))
		pred = (p >= 0.5).astype(float)
		tp = float(((pred == 1) & (test_y == 1)).sum())
		fp = float(((pred == 1) & (test_y == 0)).sum())
		fn = float(((pred == 0) & (test_y == 1)).sum())
		precision = tp / (tp + fp) if (tp + fp) else 0.0
		recall = tp / (tp + fn) if (tp + fn) else 0.0
		f1 = (
			2.0 * precision * recall / (precision + recall)
			if (precision + recall)
			else 0.0
		)
		reports.append(
			{
				"held_out": held,
				"backend": backend,
				"precision": precision,
				"recall": recall,
				"f1": f1,
				"n": len(test_idx),
			}
		)
	return reports


def main(argv: list[str] | None = None) -> int:
	parser = argparse.ArgumentParser(
		description="Train logistic credit-vote weights from the corpus",
	)
	parser.add_argument("--dir", type=Path, default=None)
	parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
	parser.add_argument("--l2", type=float, default=2.0)
	parser.add_argument(
		"--match-window",
		type=float,
		default=DEFAULT_MATCH_WINDOW_S,
	)
	parser.add_argument(
		"--all-phases",
		action="store_true",
		help="Train on reject_* rows too (default: completes / gates_ok only)",
	)
	parser.add_argument(
		"--joined",
		action="store_true",
		help="Harvest/eval *.joined.ndjson (aperture/OCEC populated)",
	)
	args = parser.parse_args(argv)
	directory = args.dir or fixtures_sessions_dir()
	harvested = harvest_dir(
		directory,
		match_window_s=args.match_window,
		kind="joined" if args.joined else "primary",
	)
	if args.joined:
		# Mix baked EAR (aperture_missing=1) so the logistic cannot
		# learn "no confirm fields ⇒ reject" (joined-only fit: F1 0.589).
		primary_rows = harvest_dir(
			directory,
			match_window_s=args.match_window,
			kind="primary",
		)
		harvested = list(harvested) + list(primary_rows)
	if not harvested:
		if args.joined:
			print(
				"SKIP: no joined traces to harvest; "
				"not fitting v2 on EAR-only completes",
				file=sys.stderr,
			)
		else:
			print("No harvested rows", file=sys.stderr)
		return 1

	if args.all_phases:
		rows = harvested
	else:
		rows = [row for row in harvested if row["phase"] == "complete"]
	if not rows:
		print("No complete rows to train on", file=sys.stderr)
		return 1

	X = np.array([row["features"] for row in rows], dtype=float)
	y = np.array([row["y"] for row in rows], dtype=float)
	n_pos = int(y.sum())
	n_neg = int(len(y) - n_pos)
	X_n, mean, std = _standardize(X)
	w, b, backend = _fit(X_n, y, l2=args.l2)

	previous_enabled = classifier_mod.CLASSIFIER_ENABLED
	classifier_mod.CLASSIFIER_ENABLED = False
	clear_weights_cache()
	try:
		baseline = evaluate_dir(
			directory,
			match_window_s=args.match_window,
			kind="primary",
		)
	finally:
		classifier_mod.CLASSIFIER_ENABLED = previous_enabled
		clear_weights_cache()

	protected_base = {
		name: _per_trace_f1(baseline, name) for name in PROTECTED
	}

	classifier_mod.CLASSIFIER_ENABLED = True
	candidates: list[tuple[float, dict[str, Any]]] = []
	for threshold in THRESHOLDS:
		payload = _payload(
			mean=mean,
			std=std,
			weights=w,
			bias=b,
			threshold=threshold,
			note="sweep",
		)
		result = _evaluate_with(
			payload,
			directory,
			args.match_window,
			kind="primary",
		)
		ok_floor = result["f1"] + 1e-9 >= F1_FLOOR
		ok_protected = True
		for name, base in protected_base.items():
			if base is None:
				continue
			got = _per_trace_f1(result, name)
			if got is None or got + 1e-9 < base - PROTECTED_SLACK:
				ok_protected = False
				break
		candidates.append((threshold, result))
		print(
			f"  t={threshold:.2f} P={result['precision']:.3f} "
			f"R={result['recall']:.3f} F1={result['f1']:.3f} "
			f"{'OK' if ok_floor and ok_protected else 'skip'}"
		)
		result["_ok"] = ok_floor and ok_protected

	viable = [(t, r) for t, r in candidates if r.get("_ok")]
	high_recall = [
		(t, r) for t, r in viable if r["recall"] + 1e-9 >= 0.90
	]
	pool = high_recall or viable or candidates
	# Prefer F1, then precision. Recall floor applied via high_recall.
	best_t, best = max(
		pool,
		key=lambda item: (item[1]["f1"], item[1]["precision"]),
	)
	if not viable:
		print(
			"warning: no threshold met F1 floor + protected slack; "
			"keeping best precision anyway",
			file=sys.stderr,
		)

	payload = _payload(
		mean=mean,
		std=std,
		weights=w,
		bias=b,
		threshold=best_t,
		note=(
			f"stage4 {backend} l2={args.l2} n={len(rows)} "
			f"pos={n_pos} neg={n_neg} completes_only={not args.all_phases}"
			f"{' mixed_primary+joined' if args.joined else ''}"
		),
	)
	args.out.parent.mkdir(parents=True, exist_ok=True)
	args.out.write_text(json.dumps(payload, indent="\t") + "\n", encoding="utf-8")
	clear_weights_cache()

	loo = _leave_one_out(rows, X, y, args.l2)
	print(
		f"backend={backend} train_rows={len(rows)} "
		f"pos={n_pos} neg={n_neg} (harvest={len(harvested)})"
	)
	print(
		f"threshold={best_t:.2f} overall "
		f"P={best['precision']:.3f} R={best['recall']:.3f} "
		f"F1={best['f1']:.3f} tp={best['tp']} fp={best['fp']} fn={best['fn']}"
	)
	print(
		f"baseline (clf off) P={baseline['precision']:.3f} "
		f"R={baseline['recall']:.3f} F1={baseline['f1']:.3f}"
	)
	print(f"wrote {args.out}")
	if loo:
		print("leave-one-session-out (completes, t=0.50):")
		for row in loo:
			print(
				f"  {row['held_out']}: F1={row['f1']:.3f} "
				f"P={row['precision']:.3f} R={row['recall']:.3f} n={row['n']}"
			)
	for row in best["per_trace"]:
		name = row.get("scenario") or Path(row["trace"]).name
		print(
			f"  {name}: P={row['precision']:.3f} R={row['recall']:.3f} "
			f"F1={row['f1']:.3f}"
		)
	if args.joined:
		joined = _evaluate_with(
			payload,
			directory,
			args.match_window,
			kind="joined",
		)
		print(
			f"joined-eval P={joined['precision']:.3f} "
			f"R={joined['recall']:.3f} F1={joined['f1']:.3f}"
		)
	return 0 if best["f1"] + 1e-9 >= F1_FLOOR else 1


if __name__ == "__main__":
	raise SystemExit(main())
