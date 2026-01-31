#!/usr/bin/env python3
"""
Prisma AIRS Configuration Audit

Validates configuration and connectivity for Prisma AIRS integration.
"""

import os
import sys
from pathlib import Path
from typing import Tuple


def check_api_key() -> Tuple[bool, str]:
    """Check if API key is configured."""
    api_key = os.environ.get("PANW_AI_SEC_API_KEY", "")
    if api_key:
        masked = api_key[:4] + "..." + api_key[-4:] if len(api_key) > 8 else "***"
        return True, f"API key configured: {masked}"
    return False, "PANW_AI_SEC_API_KEY environment variable not set"


def check_config_file() -> Tuple[bool, str]:
    """Check if config file exists."""
    for path in ["config.yaml", "config.yml"]:
        if Path(path).exists():
            return True, f"Config file found: {path}"
    return False, "No config.yaml found (using defaults)"


def check_sdk_installed() -> Tuple[bool, str]:
    """Check if pan-aisecurity SDK is installed."""
    try:
        import aisecurity
        version = getattr(aisecurity, "__version__", "unknown")
        return True, f"pan-aisecurity SDK installed: v{version}"
    except ImportError:
        return False, "pan-aisecurity SDK not installed"


def check_connectivity() -> Tuple[bool, str]:
    """Check API connectivity with a test scan."""
    api_key = os.environ.get("PANW_AI_SEC_API_KEY", "")
    if not api_key:
        return False, "Cannot test connectivity without API key"

    try:
        import aisecurity
        from aisecurity.generated_openapi_client.models.ai_profile import AiProfile
        from aisecurity.scan.inline.scanner import Scanner
        from aisecurity.scan.models.content import Content

        aisecurity.init(api_key=api_key)
        scanner = Scanner()

        # Try a simple scan
        profile = AiProfile(profile_name="default")
        content = Content(prompt="test", response="")

        result = scanner.sync_scan(ai_profile=profile, content=content)

        if hasattr(result, "scan_id"):
            return True, f"API connectivity OK (scan_id: {result.scan_id[:8]}...)"
        return True, "API connectivity OK"

    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "unauthorized" in error_msg.lower():
            return False, "API key invalid or expired"
        elif "timeout" in error_msg.lower():
            return False, "API request timed out"
        elif "connection" in error_msg.lower():
            return False, "Cannot connect to API endpoint"
        return False, f"Connectivity check failed: {error_msg[:100]}"


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

    try:
        import aisecurity
    except ImportError:
        missing.append("pan-aisecurity")

    try:
        import yaml
    except ImportError:
        missing.append("pyyaml")

    if missing:
        return False, f"Missing dependencies: {', '.join(missing)}"
    return True, "All dependencies installed"


def run_audit(verbose: bool = False, quick: bool = False) -> int:
    """Run all audit checks."""
    print("=" * 60)
    print("PRISMA AIRS CONFIGURATION AUDIT")
    print("=" * 60)
    print()

    checks = [
        ("API Key", check_api_key),
        ("Config File", check_config_file),
        ("SDK Installed", check_sdk_installed),
        ("Dependencies", check_dependencies),
        ("Log Directory", check_log_directory),
    ]

    if not quick:
        checks.append(("API Connectivity", check_connectivity))

    passed = []
    failed = []
    warnings = []

    for name, check_fn in checks:
        try:
            success, message = check_fn()
            if success:
                passed.append((name, message))
                if verbose:
                    print(f"[OK] {name}: {message}")
            else:
                # Some failures are warnings
                if name == "Config File":
                    warnings.append((name, message))
                    if verbose:
                        print(f"[WARN] {name}: {message}")
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

    if warnings:
        print(f"\nWARNINGS ({len(warnings)})")
        for name, msg in warnings:
            print(f"  [!] {name}: {msg}")

    if failed:
        print(f"\nFAILED ({len(failed)})")
        for name, msg in failed:
            print(f"  [X] {name}: {msg}")

    print()
    print("=" * 60)
    if not failed:
        total = len(passed) + len(warnings)
        print(f"All {len(passed)} critical checks passed!")
        if warnings:
            print(f"({len(warnings)} warnings)")
    else:
        print(f"{len(passed)} passed, {len(failed)} failed")
    print("=" * 60)

    return 0 if not failed else 1


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Prisma AIRS Configuration Audit")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--quick", action="store_true", help="Skip connectivity test")

    args = parser.parse_args()

    sys.exit(run_audit(verbose=args.verbose, quick=args.quick))


if __name__ == "__main__":
    main()
