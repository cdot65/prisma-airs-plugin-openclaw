#!/usr/bin/env python3
"""
Prisma AIRS Configuration Audit

Validates configuration and connectivity for Prisma AIRS integration.
"""

import os
import sys
from pathlib import Path
from typing import List, Tuple

try:
    import requests
except ImportError:
    requests = None


def check_api_key() -> Tuple[bool, str]:
    """Check if API key is configured."""
    api_key = os.environ.get("PRISMA_AIRS_API_KEY", "")
    if api_key:
        masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
        return True, f"API key configured: {masked}"
    return False, "PRISMA_AIRS_API_KEY environment variable not set"


def check_config_file() -> Tuple[bool, str]:
    """Check if config file exists."""
    for path in ["config.yaml", "config.yml"]:
        if Path(path).exists():
            return True, f"Config file found: {path}"
    return False, "No config.yaml found (using defaults)"


def check_connectivity() -> Tuple[bool, str]:
    """Check API connectivity."""
    if not requests:
        return False, "requests library not installed"

    api_key = os.environ.get("PRISMA_AIRS_API_KEY", "")
    if not api_key:
        return False, "Cannot test connectivity without API key"

    try:
        url = "https://service.api.aisecurity.paloaltonetworks.com/v1/scan/health"
        headers = {"x-pan-token": api_key}
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code == 200:
            return True, "API connectivity OK"
        elif resp.status_code == 401:
            return False, "API key invalid or expired"
        else:
            return False, f"API returned status {resp.status_code}"
    except requests.exceptions.Timeout:
        return False, "API request timed out"
    except requests.exceptions.ConnectionError:
        return False, "Cannot connect to API endpoint"
    except Exception as e:
        return False, f"Connectivity check failed: {e}"


def check_log_directory() -> Tuple[bool, str]:
    """Check if log directory is writable."""
    log_path = Path("logs")
    try:
        log_path.mkdir(parents=True, exist_ok=True)
        test_file = log_path / ".audit_test"
        test_file.write_text("test")
        test_file.unlink()
        return True, "Log directory writable: logs/"
    except Exception as e:
        return False, f"Cannot write to log directory: {e}"


def check_dependencies() -> Tuple[bool, str]:
    """Check required dependencies."""
    missing = []

    if not requests:
        missing.append("requests")

    try:
        import yaml
    except ImportError:
        missing.append("pyyaml")

    if missing:
        return False, f"Missing dependencies: {', '.join(missing)}"
    return True, "All dependencies installed"


def run_audit(verbose: bool = False, fix: bool = False) -> int:
    """Run all audit checks."""
    print("=" * 60)
    print("PRISMA AIRS CONFIGURATION AUDIT")
    print("=" * 60)
    print()

    checks = [
        ("API Key", check_api_key),
        ("Config File", check_config_file),
        ("Dependencies", check_dependencies),
        ("Log Directory", check_log_directory),
        ("API Connectivity", check_connectivity),
    ]

    passed = []
    failed = []

    for name, check_fn in checks:
        try:
            success, message = check_fn()
            if success:
                passed.append((name, message))
                if verbose:
                    print(f"[OK] {name}: {message}")
            else:
                failed.append((name, message))
                if verbose:
                    print(f"[FAIL] {name}: {message}")
        except Exception as e:
            failed.append((name, str(e)))
            if verbose:
                print(f"[ERR] {name}: {e}")

    print()
    print("-" * 60)

    if passed:
        print(f"\nPASSED ({len(passed)})")
        for name, msg in passed:
            print(f"  [OK] {name}")

    if failed:
        print(f"\nFAILED ({len(failed)})")
        for name, msg in failed:
            print(f"  [X] {name}: {msg}")

    print()
    print("=" * 60)
    if not failed:
        print(f"All {len(passed)} checks passed!")
    else:
        print(f"{len(passed)} passed, {len(failed)} failed")
    print("=" * 60)

    return 0 if not failed else 1


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Prisma AIRS Configuration Audit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix issues")
    parser.add_argument("--quick", action="store_true", help="Quick check (skip connectivity)")

    args = parser.parse_args()

    sys.exit(run_audit(verbose=args.verbose, fix=args.fix))


if __name__ == "__main__":
    main()
