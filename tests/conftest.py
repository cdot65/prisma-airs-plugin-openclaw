"""Pytest configuration and fixtures."""

import os
from pathlib import Path

import pytest

# Capture API key at module load time (before any tests run)
_ORIGINAL_API_KEY = os.environ.get("PANW_AI_SEC_API_KEY")


@pytest.fixture(scope="session")
def api_key_from_env():
    """Get API key captured at session start."""
    return _ORIGINAL_API_KEY


@pytest.fixture
def live_api(api_key_from_env):
    """Fixture for tests requiring live API access.

    Skips if API key not available. Restores API key before test runs
    in case earlier tests modified the environment.
    """
    if not api_key_from_env:
        pytest.skip("PANW_AI_SEC_API_KEY not set at session start")
    # Ensure the API key is in the environment
    os.environ["PANW_AI_SEC_API_KEY"] = api_key_from_env
    yield api_key_from_env


@pytest.fixture
def live_api_with_config(live_api):
    """Fixture for tests requiring live API AND config.yaml."""
    if not Path("config.yaml").exists():
        pytest.skip("config.yaml not present")
    yield live_api
