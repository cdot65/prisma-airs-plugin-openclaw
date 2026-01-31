#!/usr/bin/env python3
"""
Prisma AIRS Scanner - AI Runtime Security Integration

Uses the official Palo Alto Networks pan-aisecurity SDK to scan
prompts and responses for security threats including prompt injection,
data leakage, malicious URLs, and PII detection.
"""

import json
import logging
import os
import sys
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Optional

import aisecurity
from aisecurity.generated_openapi_client.models.ai_profile import AiProfile
from aisecurity.generated_openapi_client.models.metadata import Metadata
from aisecurity.scan.inline.scanner import Scanner
from aisecurity.scan.models.content import Content


class Severity(Enum):
    SAFE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class Action(Enum):
    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"


@dataclass
class ScanResult:
    """Result from Prisma AIRS scan."""

    action: Action
    severity: Severity
    categories: list[str]
    scan_id: str
    report_id: str
    profile_name: str
    prompt_detected: dict[str, Any] = field(default_factory=dict)
    response_detected: dict[str, Any] = field(default_factory=dict)
    raw_response: dict[str, Any] = field(default_factory=dict)
    latency_ms: int = 0
    error: Optional[str] = None
    tr_id: Optional[str] = None
    session_id: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["action"] = self.action.value
        d["severity"] = self.severity.name
        return d


class PrismaAIRS:
    """Prisma AIRS API client using official SDK."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        profile_name: Optional[str] = None,
        config: Optional[dict] = None,
        config_path: Optional[str] = None,
    ):
        self.config = self._load_config(config, config_path)

        # API key from param, config, or env
        self.api_key = api_key or self._resolve_env(
            self.config.get("api_key", "${PANW_AI_SEC_API_KEY}")
        )

        # Profile name from param or config
        self.profile_name = profile_name or self.config.get("profile_name", "default")

        # Initialize SDK
        if self.api_key:
            aisecurity.init(api_key=self.api_key)
        else:
            aisecurity.init()  # Uses PANW_AI_SEC_API_KEY env var

        # Create scanner and profile
        self._scanner = Scanner()
        self._ai_profile = AiProfile(profile_name=self.profile_name)

        # Rate limiting
        self.rate_limits: dict[str, list[float]] = {}

        self._setup_logging()

    def _load_config(self, config: Optional[dict], config_path: Optional[str]) -> dict:
        """Load configuration from dict or file."""
        default = self._default_config()

        if config:
            return self._deep_merge(default, config)

        if config_path:
            return self._load_yaml(config_path, default)

        # Try default locations
        for path in ["config.yaml", "config.yml"]:
            if Path(path).exists():
                return self._load_yaml(path, default)

        return default

    def _load_yaml(self, path: str, default: dict) -> dict:
        """Load YAML config file."""
        try:
            import yaml

            with open(path) as f:
                file_config = yaml.safe_load(f) or {}
                if "prisma_airs" in file_config:
                    file_config = file_config["prisma_airs"]
                return self._deep_merge(default, file_config)
        except Exception as e:
            print(f"Warning: Failed to load config: {e}", file=sys.stderr)
            return default

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> dict:
        """Deep merge two dictionaries."""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = PrismaAIRS._deep_merge(result[key], value)
            else:
                result[key] = value
        return result

    @staticmethod
    def _resolve_env(value: str) -> str:
        """Resolve ${ENV_VAR} patterns in config values."""
        if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
            env_var = value[2:-1]
            return os.environ.get(env_var, "")
        return value

    def _default_config(self) -> dict:
        return {
            "api_key": "${PANW_AI_SEC_API_KEY}",
            "profile_name": "default",
            "actions": {
                "injection": "block",
                "dlp": "block",
                "url_cats": "block",
                "malicious": "block",
                "benign": "allow",
            },
            "logging": {
                "enabled": True,
                "path": "logs/prisma-airs.log",
                "include_prompt": False,
            },
            "rate_limit": {
                "enabled": True,
                "max_requests": 100,
                "window_seconds": 60,
            },
            "metadata": {
                "app_name": "openclaw",
                "app_user": None,
                "ai_model": None,
            },
        }

    def _setup_logging(self):
        """Configure logging."""
        log_config = self.config.get("logging", {})
        if not log_config.get("enabled", True):
            self.logger = logging.getLogger("prisma_airs")
            self.logger.addHandler(logging.NullHandler())
            return

        log_path = Path(log_config.get("path", "logs/prisma-airs.log"))
        log_path.parent.mkdir(parents=True, exist_ok=True)

        self.logger = logging.getLogger("prisma_airs")
        self.logger.setLevel(logging.INFO)

        if not self.logger.handlers:
            handler = logging.FileHandler(log_path)
            handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
            self.logger.addHandler(handler)

    def _check_rate_limit(self, user_id: str) -> bool:
        """Check if user has exceeded rate limit."""
        rate_config = self.config.get("rate_limit", {})
        if not rate_config.get("enabled", False):
            return False

        now = time.time()
        window = rate_config.get("window_seconds", 60)
        max_requests = rate_config.get("max_requests", 100)

        if user_id not in self.rate_limits:
            self.rate_limits[user_id] = []

        self.rate_limits[user_id] = [t for t in self.rate_limits[user_id] if now - t < window]

        if len(self.rate_limits[user_id]) >= max_requests:
            return True

        self.rate_limits[user_id].append(now)
        return False

    def scan(
        self,
        prompt: Optional[str] = None,
        response: Optional[str] = None,
        context: Optional[dict] = None,
        session_id: Optional[str] = None,
        tr_id: Optional[str] = None,
        app_name: Optional[str] = None,
        app_user: Optional[str] = None,
        ai_model: Optional[str] = None,
    ) -> ScanResult:
        """
        Synchronously scan prompt and/or response through Prisma AIRS.

        Args:
            prompt: User prompt to scan
            response: AI response to scan (optional)
            context: Additional context (user_id, etc.)
            session_id: Session ID for grouping related scans
            tr_id: Transaction ID for prompt/response correlation
            app_name: Application name for metadata
            app_user: Application user for metadata
            ai_model: AI model name for metadata

        Returns:
            ScanResult with action, severity, and details
        """
        context = context or {}
        user_id = str(context.get("user_id", "unknown"))
        start_time = time.time()

        # Rate limit check
        if self._check_rate_limit(user_id):
            return ScanResult(
                action=Action.BLOCK,
                severity=Severity.HIGH,
                categories=["rate_limit_exceeded"],
                scan_id="",
                report_id="",
                profile_name=self.profile_name,
                error="Rate limit exceeded",
            )

        try:
            # Build content object
            content = Content(
                prompt=prompt or "",
                response=response or "",
            )

            # Build metadata - use config defaults if params not provided
            metadata_config = self.config.get("metadata", {})
            effective_app_name = app_name or metadata_config.get("app_name", "openclaw")
            effective_app_user = app_user or metadata_config.get("app_user")
            effective_ai_model = ai_model or metadata_config.get("ai_model")

            metadata = None
            if effective_app_name or effective_app_user or effective_ai_model:
                metadata = Metadata(
                    app_name=effective_app_name,
                    app_user=effective_app_user,
                    ai_model=effective_ai_model,
                )

            # Perform sync scan
            scan_response = self._scanner.sync_scan(
                ai_profile=self._ai_profile,
                content=content,
                session_id=session_id,
                tr_id=tr_id,
                metadata=metadata,
            )

            latency_ms = int((time.time() - start_time) * 1000)

            # Parse response
            result = self._parse_response(
                scan_response, latency_ms, session_id=session_id, tr_id=tr_id
            )

            # Log
            self._log_scan(result, user_id, context)

            return result

        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            self.logger.error(f"Scan failed: {e}")
            return ScanResult(
                action=Action.WARN,
                severity=Severity.LOW,
                categories=["api_error"],
                scan_id="",
                report_id="",
                profile_name=self.profile_name,
                latency_ms=latency_ms,
                error=str(e),
            )

    def _parse_response(
        self,
        resp: Any,
        latency_ms: int,
        session_id: Optional[str] = None,
        tr_id: Optional[str] = None,
    ) -> ScanResult:
        """Parse SDK response into ScanResult."""
        # Extract fields from response
        raw = resp.to_dict() if hasattr(resp, "to_dict") else {}

        scan_id = getattr(resp, "scan_id", "") or ""
        report_id = getattr(resp, "report_id", "") or ""
        profile_name = getattr(resp, "profile_name", self.profile_name) or self.profile_name
        category = getattr(resp, "category", "benign") or "benign"
        action_str = getattr(resp, "action", "allow") or "allow"

        # Get detection flags
        prompt_detected = {}
        response_detected = {}

        if hasattr(resp, "prompt_detected") and resp.prompt_detected:
            pd = resp.prompt_detected
            prompt_detected = {
                "injection": getattr(pd, "injection", False) or False,
                "dlp": getattr(pd, "dlp", False) or False,
                "url_cats": getattr(pd, "url_cats", False) or False,
            }

        if hasattr(resp, "response_detected") and resp.response_detected:
            rd = resp.response_detected
            response_detected = {
                "dlp": getattr(rd, "dlp", False) or False,
                "url_cats": getattr(rd, "url_cats", False) or False,
            }

        # Build categories list
        categories = []
        if prompt_detected.get("injection"):
            categories.append("prompt_injection")
        if prompt_detected.get("dlp"):
            categories.append("dlp_prompt")
        if prompt_detected.get("url_cats"):
            categories.append("url_filtering_prompt")
        if response_detected.get("dlp"):
            categories.append("dlp_response")
        if response_detected.get("url_cats"):
            categories.append("url_filtering_response")

        if not categories:
            categories = ["safe"] if category == "benign" else [category]

        # Determine severity
        if category == "malicious" or action_str == "block":
            severity = Severity.CRITICAL
        elif category == "suspicious":
            severity = Severity.HIGH
        elif any(prompt_detected.values()) or any(response_detected.values()):
            severity = Severity.MEDIUM
        else:
            severity = Severity.SAFE

        # Map action
        if action_str == "block":
            action = Action.BLOCK
        elif action_str == "alert":
            action = Action.WARN
        else:
            action = Action.ALLOW

        # Extract tr_id from response if returned (may override input)
        resp_tr_id = getattr(resp, "tr_id", None)
        if resp_tr_id:
            tr_id = resp_tr_id

        return ScanResult(
            action=action,
            severity=severity,
            categories=categories,
            scan_id=scan_id,
            report_id=report_id,
            profile_name=profile_name,
            prompt_detected=prompt_detected,
            response_detected=response_detected,
            raw_response=raw,
            latency_ms=latency_ms,
            tr_id=tr_id,
            session_id=session_id,
        )

    def _log_scan(self, result: ScanResult, user_id: str, context: dict):
        """Log scan result."""
        log_config = self.config.get("logging", {})
        if not log_config.get("enabled", True):
            return

        log_entry = {
            "scan_id": result.scan_id,
            "report_id": result.report_id,
            "user_id": user_id,
            "action": result.action.value,
            "severity": result.severity.name,
            "categories": result.categories,
            "latency_ms": result.latency_ms,
        }

        self.logger.info(json.dumps(log_entry))

    def close(self):
        """Close scanner connection."""
        if hasattr(self, "_scanner"):
            # SDK close is async, but we handle sync case
            pass


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Prisma AIRS Scanner - AI Runtime Security")
    parser.add_argument("message", nargs="?", help="Message to scan")
    parser.add_argument("--prompt", type=str, help="Prompt to scan")
    parser.add_argument("--response", type=str, help="Response to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--config", type=str, help="Path to config YAML")
    parser.add_argument("--profile", type=str, help="Prisma AIRS profile name")
    parser.add_argument("--context", type=str, help="Context as JSON string")
    parser.add_argument("--session-id", type=str, help="Session ID for grouping scans")
    parser.add_argument("--tr-id", type=str, help="Transaction ID for correlation")
    parser.add_argument("--app-name", type=str, help="Application name for metadata")
    parser.add_argument("--app-user", type=str, help="Application user for metadata")
    parser.add_argument("--ai-model", type=str, help="AI model name for metadata")

    args = parser.parse_args()

    # Determine what to scan
    prompt = args.prompt or args.message
    response = args.response

    if not prompt and not response:
        if not sys.stdin.isatty():
            prompt = sys.stdin.read().strip()

    if not prompt and not response:
        parser.print_help()
        sys.exit(1)

    # Parse context
    context = {}
    if args.context:
        context = json.loads(args.context)

    # Create scanner
    scanner = PrismaAIRS(
        config_path=args.config,
        profile_name=args.profile,
    )

    # Scan
    result = scanner.scan(
        prompt=prompt,
        response=response,
        context=context,
        session_id=args.session_id,
        tr_id=args.tr_id,
        app_name=args.app_name,
        app_user=args.app_user,
        ai_model=args.ai_model,
    )

    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        emoji = {
            "SAFE": "OK",
            "LOW": "--",
            "MEDIUM": "!",
            "HIGH": "!!",
            "CRITICAL": "!!!",
        }
        print(f"[{emoji.get(result.severity.name, '?')}] {result.severity.name}")
        print(f"Action: {result.action.value}")
        if result.categories:
            print(f"Categories: {', '.join(result.categories)}")
        if result.scan_id:
            print(f"Scan ID: {result.scan_id}")
        if result.report_id:
            print(f"Report ID: {result.report_id}")
        if result.session_id:
            print(f"Session ID: {result.session_id}")
        if result.tr_id:
            print(f"Transaction ID: {result.tr_id}")
        print(f"Profile: {result.profile_name}")
        print(f"Latency: {result.latency_ms}ms")
        if result.error:
            print(f"Error: {result.error}")


if __name__ == "__main__":
    main()
