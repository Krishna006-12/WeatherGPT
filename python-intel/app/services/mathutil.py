"""Shared numeric helpers — pure, deterministic."""
from __future__ import annotations

from typing import Iterable, List, Optional, Sequence, Tuple


def num(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return n


def round_n(v, d: int = 1) -> Optional[float]:
    n = num(v)
    if n is None:
        return None
    f = 10**d
    return round(n * f) / f


def clamp(n: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, n))


def finite_list(arr: Optional[Iterable]) -> List[float]:
    out: List[float] = []
    for v in arr or []:
        n = num(v)
        if n is not None:
            out.append(n)
    return out


def spread_of(values: Optional[Iterable]) -> Optional[float]:
    a = finite_list(values)
    if len(a) < 2:
        return None
    return round_n(max(a) - min(a), 2)


def mean_of(values: Optional[Iterable]) -> Optional[float]:
    a = finite_list(values)
    if not a:
        return None
    return round_n(sum(a) / len(a), 2)


def score_from_spread(
    spread: Optional[float],
    thresholds: Sequence[Tuple[float, int]],
    *,
    missing_score: Optional[int] = None,
) -> Optional[int]:
    if spread is None:
        return missing_score
    for max_s, sc in thresholds:
        if spread <= max_s:
            return sc
    return thresholds[-1][1] if thresholds else missing_score


def unique_floats(values: Iterable[Optional[float]], ndigits: int = 2) -> List[float]:
    seen = set()
    out: List[float] = []
    for v in values:
        n = num(v)
        if n is None:
            continue
        r = round(n, ndigits)
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out
