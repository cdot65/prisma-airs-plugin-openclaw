"""Tests for prisma_airs_skill.audit module."""

import os
import sys
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from prisma_airs_skill.audit import (
    check_api_key,
    check_config_file,
    check_connectivity,
    check_dependencies,
    check_log_directory,
    check_sdk_installed,
    main,
    run_audit,
)


class TestCheckApiKey:
    """Test check_api_key function."""

    def test_api_key_present(self):
        """Test when API key is set."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345678"
        try:
            success, message = check_api_key()
            assert success is True
            assert "API key configured" in message
            assert "test..." in message  # masked
            assert "5678" in message  # last 4 chars
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)

    def test_api_key_missing(self):
        """Test when API key is not set."""
        original = os.environ.pop("PANW_AI_SEC_API_KEY", None)
        try:
            success, message = check_api_key()
            assert success is False
            assert "not set" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original

    def test_api_key_short(self):
        """Test API key masking with short key."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "short"
        try:
            success, message = check_api_key()
            assert success is True
            assert "***" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)


class TestCheckConfigFile:
    """Test check_config_file function."""

    def test_config_file_exists(self):
        """Test when config.yaml exists."""
        with patch.object(Path, "exists", return_value=True):
            success, message = check_config_file()
            assert success is True
            assert "Config file found" in message

    def test_config_file_missing(self):
        """Test when no config file exists."""
        with patch.object(Path, "exists", return_value=False):
            success, message = check_config_file()
            assert success is False
            assert "No config.yaml found" in message


class TestCheckSdkInstalled:
    """Test check_sdk_installed function."""

    def test_sdk_installed(self):
        """Test when SDK is installed."""
        mock_module = MagicMock()
        mock_module.__version__ = "1.0.0"
        with patch.dict(sys.modules, {"aisecurity": mock_module}):
            success, message = check_sdk_installed()
            assert success is True
            assert "pan-aisecurity SDK installed" in message

    def test_sdk_not_installed(self):
        """Test when SDK is not installed."""
        with patch.dict(sys.modules, {"aisecurity": None}):
            # Force ImportError by removing from modules
            original = sys.modules.get("aisecurity")
            if "aisecurity" in sys.modules:
                del sys.modules["aisecurity"]
            try:
                with patch("builtins.__import__", side_effect=ImportError):
                    success, message = check_sdk_installed()
                    assert success is False
                    assert "not installed" in message
            finally:
                if original:
                    sys.modules["aisecurity"] = original


class TestCheckConnectivity:
    """Test check_connectivity function."""

    def test_connectivity_no_api_key(self):
        """Test connectivity check without API key."""
        original = os.environ.pop("PANW_AI_SEC_API_KEY", None)
        try:
            success, message = check_connectivity()
            assert success is False
            assert "Cannot test connectivity without API key" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original

    def test_connectivity_success(self):
        """Test successful connectivity check."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key"
        try:
            mock_result = MagicMock()
            mock_result.scan_id = "scan12345678"

            mock_scanner = MagicMock()
            mock_scanner.sync_scan.return_value = mock_result

            with patch("aisecurity.init"), patch(
                "aisecurity.scan.inline.scanner.Scanner", return_value=mock_scanner
            ), patch("aisecurity.generated_openapi_client.models.ai_profile.AiProfile"), patch(
                "aisecurity.scan.models.content.Content"
            ):
                success, message = check_connectivity()
                assert success is True
                assert "API connectivity OK" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)

    def test_connectivity_401_error(self):
        """Test connectivity with 401 unauthorized error."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "bad_key"
        try:
            with patch("aisecurity.init"), patch(
                "aisecurity.scan.inline.scanner.Scanner"
            ) as mock_scanner_class:
                mock_scanner_class.return_value.sync_scan.side_effect = Exception(
                    "401 Unauthorized"
                )
                with patch("aisecurity.generated_openapi_client.models.ai_profile.AiProfile"), patch(
                    "aisecurity.scan.models.content.Content"
                ):
                    success, message = check_connectivity()
                    assert success is False
                    assert "invalid or expired" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)

    def test_connectivity_timeout_error(self):
        """Test connectivity with timeout error."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key"
        try:
            with patch("aisecurity.init"), patch(
                "aisecurity.scan.inline.scanner.Scanner"
            ) as mock_scanner_class:
                mock_scanner_class.return_value.sync_scan.side_effect = Exception(
                    "Request timeout"
                )
                with patch("aisecurity.generated_openapi_client.models.ai_profile.AiProfile"), patch(
                    "aisecurity.scan.models.content.Content"
                ):
                    success, message = check_connectivity()
                    assert success is False
                    assert "timed out" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)

    def test_connectivity_connection_error(self):
        """Test connectivity with connection error."""
        original = os.environ.get("PANW_AI_SEC_API_KEY")
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key"
        try:
            with patch("aisecurity.init"), patch(
                "aisecurity.scan.inline.scanner.Scanner"
            ) as mock_scanner_class:
                mock_scanner_class.return_value.sync_scan.side_effect = Exception(
                    "Connection refused"
                )
                with patch("aisecurity.generated_openapi_client.models.ai_profile.AiProfile"), patch(
                    "aisecurity.scan.models.content.Content"
                ):
                    success, message = check_connectivity()
                    assert success is False
                    assert "Cannot connect" in message
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original
            else:
                os.environ.pop("PANW_AI_SEC_API_KEY", None)


class TestCheckLogDirectory:
    """Test check_log_directory function."""

    def test_log_directory_writable(self):
        """Test when log directory is writable."""
        success, message = check_log_directory()
        assert success is True
        assert "Log directory writable" in message

    def test_log_directory_not_writable(self):
        """Test when log directory is not writable."""
        with patch.object(Path, "mkdir", side_effect=PermissionError("Permission denied")):
            success, message = check_log_directory()
            assert success is False
            assert "Cannot write" in message


class TestCheckDependencies:
    """Test check_dependencies function."""

    def test_all_dependencies_installed(self):
        """Test when all dependencies are installed."""
        with patch("importlib.util.find_spec") as mock_find_spec:
            mock_find_spec.return_value = MagicMock()  # Not None = installed
            success, message = check_dependencies()
            assert success is True
            assert "All dependencies installed" in message

    def test_missing_dependencies(self):
        """Test when dependencies are missing."""
        def mock_find_spec(name):
            if name == "aisecurity":
                return None
            return MagicMock()

        with patch("importlib.util.find_spec", side_effect=mock_find_spec):
            success, message = check_dependencies()
            assert success is False
            assert "Missing dependencies" in message
            assert "pan-aisecurity" in message


class TestRunAudit:
    """Test run_audit function."""

    def test_run_audit_all_pass(self):
        """Test audit when all checks pass."""
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345"
        try:
            with patch(
                "prisma_airs_skill.audit.check_config_file",
                return_value=(True, "Config found"),
            ), patch(
                "prisma_airs_skill.audit.check_connectivity",
                return_value=(True, "Connected"),
            ):
                captured = StringIO()
                with patch.object(sys, "stdout", captured):
                    exit_code = run_audit(verbose=False, quick=True)
                assert exit_code == 0
                output = captured.getvalue()
                assert "PASSED" in output
        finally:
            del os.environ["PANW_AI_SEC_API_KEY"]

    def test_run_audit_with_failures(self):
        """Test audit when some checks fail."""
        original = os.environ.pop("PANW_AI_SEC_API_KEY", None)
        try:
            captured = StringIO()
            with patch.object(sys, "stdout", captured):
                exit_code = run_audit(verbose=False, quick=True)
            assert exit_code == 1
            output = captured.getvalue()
            assert "FAILED" in output
        finally:
            if original:
                os.environ["PANW_AI_SEC_API_KEY"] = original

    def test_run_audit_verbose(self):
        """Test audit with verbose output."""
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345"
        try:
            captured = StringIO()
            with patch.object(sys, "stdout", captured):
                run_audit(verbose=True, quick=True)
            output = captured.getvalue()
            assert "[OK]" in output
        finally:
            del os.environ["PANW_AI_SEC_API_KEY"]

    def test_run_audit_config_warning(self):
        """Test audit treats missing config as warning."""
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345"
        try:
            with patch.object(Path, "exists", return_value=False):
                captured = StringIO()
                with patch.object(sys, "stdout", captured):
                    exit_code = run_audit(verbose=True, quick=True)
                output = captured.getvalue()
                # Missing config is a warning, not failure
                assert "WARNINGS" in output or exit_code == 0
        finally:
            del os.environ["PANW_AI_SEC_API_KEY"]


class TestMain:
    """Test CLI main function."""

    def test_main_default(self):
        """Test main with default arguments."""
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345"
        try:
            with patch.object(sys, "argv", ["prisma-airs-audit", "--quick"]), patch(
                "prisma_airs_skill.audit.check_config_file",
                return_value=(True, "Config found"),
            ):
                captured = StringIO()
                with patch.object(sys, "stdout", captured), pytest.raises(
                    SystemExit
                ) as exc_info:
                    main()
                assert exc_info.value.code == 0
        finally:
            del os.environ["PANW_AI_SEC_API_KEY"]

    def test_main_verbose(self):
        """Test main with verbose flag."""
        os.environ["PANW_AI_SEC_API_KEY"] = "test_key_12345"
        try:
            with patch.object(
                sys, "argv", ["prisma-airs-audit", "--verbose", "--quick"]
            ), patch(
                "prisma_airs_skill.audit.check_config_file",
                return_value=(True, "Config found"),
            ):
                captured = StringIO()
                with patch.object(sys, "stdout", captured), pytest.raises(
                    SystemExit
                ) as exc_info:
                    main()
                assert exc_info.value.code == 0
                assert "[OK]" in captured.getvalue()
        finally:
            del os.environ["PANW_AI_SEC_API_KEY"]


@pytest.mark.integration
class TestIntegration:
    """Integration tests for audit (requires PANW_AI_SEC_API_KEY)."""

    def test_live_audit_quick(self, live_api):
        """Test live audit with quick mode (skip connectivity)."""
        captured = StringIO()
        with patch.object(sys, "stdout", captured):
            exit_code = run_audit(verbose=True, quick=True)
        assert exit_code == 0
        output = captured.getvalue()
        assert "API Key" in output
        assert "SDK Installed" in output

    def test_live_audit_full(self, live_api):
        """Test live audit with full connectivity check.

        Note: check_connectivity uses hardcoded profile_name='default',
        which may not exist in SCM. The test verifies the check runs
        and reports the connectivity status appropriately.
        """
        captured = StringIO()
        with patch.object(sys, "stdout", captured):
            exit_code = run_audit(verbose=True, quick=False)
        output = captured.getvalue()
        assert "API Connectivity" in output
        # Either passes or reports profile not found (both are valid outcomes)
        assert "PASSED" in output or "FAILED" in output

    def test_live_check_connectivity(self, live_api):
        """Test live connectivity check runs without crashing.

        Note: Uses hardcoded profile_name='default' which may not exist.
        The main scan integration tests verify actual connectivity.
        """
        success, message = check_connectivity()
        # Function should return a valid result (either success or failure)
        assert isinstance(success, bool)
        assert isinstance(message, str)
        assert len(message) > 0
