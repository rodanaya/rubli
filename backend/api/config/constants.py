"""
Centralized constants for the RUBLI backend.

These values were previously duplicated across 9+ files.
Import from here instead of redefining.
"""

# Amount validation thresholds (from data-validation.md)
MAX_CONTRACT_VALUE = 100_000_000_000  # 100B MXN - reject above this
FLAG_THRESHOLD = 10_000_000_000       # 10B MXN - flag for review

# Risk level thresholds (v3.3) — weighted checklist model
RISK_THRESHOLDS = {
    'critical': 0.50,
    'high': 0.35,
    'medium': 0.20,
    'low': 0.0,
}

# Risk level thresholds — statistical risk indicators (NOT probabilities)
# Scores measure similarity to patterns from labelled cases.
# A score of 0.60 does NOT mean "60% probability of corruption."
# v4.0/v5.1 thresholds (preserved for backward compatibility)
RISK_THRESHOLDS_V4 = {
    'critical': 0.50,   # v4.0/v5.1 thresholds
    'high': 0.30,
    'medium': 0.10,
    'low': 0.0,
}

# v0.8.5 thresholds — recalibrated for PU-corrected scores (c_pu=0.32)
# PU correction: Elkan & Noto floor c=0.32
# HR=11.0% (inside the 2-15% calibration target)
# AUC: forward-holdout 0.656 (vendors added after training), in-sample 0.733;
# the originally reported test AUC 0.785 could not be reproduced
RISK_THRESHOLDS_V6 = {
    'critical': 0.60,   # Strongest similarity to known corruption patterns
    'high': 0.40,       # Strong similarity
    'medium': 0.25,     # Moderate similarity
    'low': 0.0,         # Low similarity
}

# Active thresholds for current model
RISK_THRESHOLDS_V5 = RISK_THRESHOLDS_V6

# Active model version
# v0.8.5: ElasticNet, 18 features, c_pu=0.32, forward-holdout AUC 0.656, HR=11.0%, trained 2026-05-02
CURRENT_MODEL_VERSION = 'v0.8.5'

# Reported AUC for v0.8.5. model_calibration.test_auc stores 0.785 from a
# vendor-stratified split that was not saved and cannot be reproduced; the
# API reports the reproducible forward-holdout figure instead.
MODEL_AUC_FORWARD_HOLDOUT = 0.656


def get_risk_level(score: float, model_version: str = None) -> str:
    """Return risk level string for a given score.

    Args:
        score: Risk score (0-1)
        model_version: 'v3.3' or 'v4.0'. If None, uses CURRENT_MODEL_VERSION.
    """
    version = model_version or CURRENT_MODEL_VERSION
    if version >= 'v6.0':
        thresholds = RISK_THRESHOLDS_V6
    elif version >= 'v4.0':
        thresholds = RISK_THRESHOLDS_V4
    else:
        thresholds = RISK_THRESHOLDS

    if score >= thresholds['critical']:
        return 'critical'
    if score >= thresholds['high']:
        return 'high'
    if score >= thresholds['medium']:
        return 'medium'
    return 'low'
