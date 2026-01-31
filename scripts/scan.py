#!/usr/bin/env python3
"""
Prisma AIRS Scanner - AI Runtime Security Integration

Scans prompts and responses through Palo Alto Networks Prisma AIRS
for security threats including prompt injection, data leakage,
malicious content, and PII detection.
"""

import os
import sys
import json
import time
import hashlib
import logging
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional, Dict, List, Any
from enum import Enum

try:
    import requests
except ImportError:
    print("Error: requests required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)


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
    action: Action
    severity: Severity
    categories: List[str]
    details: Dict[str, Any]
    prompt_detected: Dict[str, Any]
    response_detected: Dict[str, Any]
    scan_id: str
    latency_ms: int

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["action"] = self.action.value
        d["severity"] = self.severity.name
        return d


class PrismaAIRS:
    """Prisma AIRS API client for AI security scanning."""

    def __init__(self, config: Optional[Dict] = None, config_path: Optional[str] = None):
        self.config = self._load_config(config, config_path)
        self.api_url = self.config.get("api_url", "https://service.api.aisecurity.paloaltonetworks.com")
        self.api_key = self._resolve_env(self.config.get("api_key", ""))
        self.profile_name = self.config.get("profile_name", "default")
        self.ai_model = self.config.get("ai_model", "openclaw-agent")
        self.app_name = self.config.get("app_name", "openclaw")
        self.timeout = self.config.get("timeout", 30)
        self.owner_ids = set(str(x) for x in self.config.get("owner_ids", []))
        self.rate_limits: Dict[str, List[float]] = {}

        self._setup_logging()

    def _load_config(self, config: Optional[Dict], config_path: Optional[str]) -> Dict:
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

    def _load_yaml(self, path: str, default: Dict) -> Dict:
        """Load YAML config file."""
        try:
            import yaml
            with open(path) as f:
                file_config = yaml.safe_load(f) or {}
                # Handle nested prisma_airs key
                if "prisma_airs" in file_config:
                    file_config = file_config["prisma_airs"]
                return self._deep_merge(default, file_config)
        except ImportError:
            print("Warning: PyYAML not installed, using defaults", file=sys.stderr)
            return default
        except Exception as e:
            print(f"Warning: Failed to load config: {e}", file=sys.stderr)
            return default

    @staticmethod
    def _deep_merge(base: Dict, override: Dict) -> Dict:
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
        if value.startswith("${") and value.endswith("}"):
            env_var = value[2:-1]
            return os.environ.get(env_var, "")
        return value

    def _default_config(self) -> Dict:
        return {
            "api_url": "https://service.api.aisecurity.paloaltonetworks.com",
            "api_key": "${PRISMA_AIRS_API_KEY}",
            "profile_name": "default",
            "ai_model": "openclaw-agent",
            "app_name": "openclaw",
            "timeout": 30,
            "owner_ids": [],
            "actions": {
                "prompt_injection": "block",
                "data_leakage": "block",
                "malicious_content": "block",
                "pii_detected": "warn",
                "url_filtering": "warn",
                "safe": "allow",
            },
            "logging": {
                "enabled": True,
                "path": "logs/prisma-airs.log",
                "include_prompt": False,
                "include_response": False,
            },
            "rate_limit": {
                "enabled": True,
                "max_requests": 100,
                "window_seconds": 60,
            },
            "retry": {
                "max_attempts": 3,
                "backoff_seconds": 1,
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

        handler = logging.FileHandler(log_path)
        handler.setFormatter(logging.Formatter(
            "%(asctime)s | %(levelname)s | %(message)s"
        ))
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

        # Clean old entries
        self.rate_limits[user_id] = [
            t for t in self.rate_limits[user_id] if now - t < window
        ]

        if len(self.rate_limits[user_id]) >= max_requests:
            return True

        self.rate_limits[user_id].append(now)
        return False

    def scan(
        self,
        prompt: Optional[str] = None,
        response: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> ScanResult:
        """
        Scan prompt and/or response through Prisma AIRS.

        Args:
            prompt: User prompt to scan
            response: AI response to scan (optional)
            context: Additional context (user_id, is_group, etc.)

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
                details={"error": "Rate limit exceeded"},
                prompt_detected={},
                response_detected={},
                scan_id=self._generate_scan_id(prompt or response or ""),
                latency_ms=0,
            )

        # Validate API key
        if not self.api_key:
            self.logger.error("No API key configured")
            return ScanResult(
                action=Action.WARN,
                severity=Severity.LOW,
                categories=["configuration_error"],
                details={"error": "No API key configured"},
                prompt_detected={},
                response_detected={},
                scan_id=self._generate_scan_id(prompt or response or ""),
                latency_ms=0,
            )

        # Build request payload
        payload = self._build_payload(prompt, response, context)

        # Make API request with retry
        result = self._make_request(payload)
        latency_ms = int((time.time() - start_time) * 1000)

        # Parse response
        scan_result = self._parse_response(result, prompt, response, latency_ms)

        # Log result
        self._log_scan(scan_result, user_id, context)

        return scan_result

    def _build_payload(
        self,
        prompt: Optional[str],
        response: Optional[str],
        context: Dict
    ) -> Dict:
        """Build API request payload."""
        payload = {
            "ai_model": self.ai_model,
            "app_name": self.app_name,
            "tr_id": self._generate_scan_id(prompt or response or ""),
        }

        # Add contents array
        contents = []
        if prompt:
            contents.append({
                "prompt": prompt
            })
        if response:
            contents.append({
                "response": response
            })
        payload["contents"] = contents

        # Add metadata
        if context:
            payload["metadata"] = {
                "user_id": str(context.get("user_id", "unknown")),
                "is_group": context.get("is_group", False),
                "chat_name": context.get("chat_name", ""),
            }

        return payload

    def _make_request(self, payload: Dict) -> Dict:
        """Make API request with retry logic."""
        retry_config = self.config.get("retry", {})
        max_attempts = retry_config.get("max_attempts", 3)
        backoff = retry_config.get("backoff_seconds", 1)

        headers = {
            "Content-Type": "application/json",
            "x-pan-token": self.api_key,
        }

        url = f"{self.api_url}/v1/scan/sync/request"

        for attempt in range(max_attempts):
            try:
                resp = requests.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout,
                )
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as e:
                self.logger.warning(f"API request failed (attempt {attempt + 1}): {e}")
                if attempt < max_attempts - 1:
                    time.sleep(backoff * (attempt + 1))
                else:
                    return {"error": str(e)}

        return {"error": "Max retries exceeded"}

    def _parse_response(
        self,
        result: Dict,
        prompt: Optional[str],
        response: Optional[str],
        latency_ms: int
    ) -> ScanResult:
        """Parse API response into ScanResult."""
        if "error" in result:
            return ScanResult(
                action=Action.WARN,
                severity=Severity.LOW,
                categories=["api_error"],
                details=result,
                prompt_detected={},
                response_detected={},
                scan_id=self._generate_scan_id(prompt or response or ""),
                latency_ms=latency_ms,
            )

        # Extract detection results
        categories = []
        max_severity = Severity.SAFE
        prompt_detected = {}
        response_detected = {}
        action_config = self.config.get("actions", {})

        # Parse prompt scan results
        prompt_result = result.get("prompt_detected", {})
        if prompt_result:
            prompt_detected = prompt_result
            if prompt_result.get("injection_detected"):
                categories.append("prompt_injection")
                max_severity = Severity.CRITICAL
            if prompt_result.get("jailbreak_detected"):
                categories.append("jailbreak_attempt")
                max_severity = Severity.CRITICAL
            if prompt_result.get("pii_detected"):
                categories.append("pii_detected")
                if max_severity.value < Severity.MEDIUM.value:
                    max_severity = Severity.MEDIUM

        # Parse response scan results
        response_result = result.get("response_detected", {})
        if response_result:
            response_detected = response_result
            if response_result.get("dlp_detected"):
                categories.append("data_leakage")
                max_severity = Severity.CRITICAL
            if response_result.get("malicious_detected"):
                categories.append("malicious_content")
                max_severity = Severity.HIGH
            if response_result.get("pii_detected"):
                categories.append("pii_detected")
                if max_severity.value < Severity.MEDIUM.value:
                    max_severity = Severity.MEDIUM

        # Determine action based on categories
        action = Action.ALLOW
        if categories:
            for cat in categories:
                cat_action = action_config.get(cat, "warn")
                if cat_action == "block" and action != Action.BLOCK:
                    action = Action.BLOCK
                elif cat_action == "warn" and action == Action.ALLOW:
                    action = Action.WARN

        if not categories:
            categories = ["safe"]

        return ScanResult(
            action=action,
            severity=max_severity,
            categories=categories,
            details=result,
            prompt_detected=prompt_detected,
            response_detected=response_detected,
            scan_id=result.get("tr_id", self._generate_scan_id(prompt or response or "")),
            latency_ms=latency_ms,
        )

    def _generate_scan_id(self, content: str) -> str:
        """Generate unique scan ID."""
        timestamp = datetime.now().isoformat()
        return hashlib.sha256(f"{timestamp}:{content[:100]}".encode()).hexdigest()[:16]

    def _log_scan(self, result: ScanResult, user_id: str, context: Dict):
        """Log scan result."""
        log_config = self.config.get("logging", {})
        if not log_config.get("enabled", True):
            return

        log_entry = {
            "scan_id": result.scan_id,
            "user_id": user_id,
            "action": result.action.value,
            "severity": result.severity.name,
            "categories": result.categories,
            "latency_ms": result.latency_ms,
            "is_group": context.get("is_group", False),
        }

        self.logger.info(json.dumps(log_entry))


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Prisma AIRS Scanner")
    parser.add_argument("message", nargs="?", help="Message to scan")
    parser.add_argument("--prompt", type=str, help="Prompt to scan")
    parser.add_argument("--response", type=str, help="Response to scan")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--config", type=str, help="Path to config YAML")
    parser.add_argument("--profile", type=str, help="Prisma AIRS profile name")
    parser.add_argument("--context", type=str, help="Context as JSON string")

    args = parser.parse_args()

    # Determine what to scan
    prompt = args.prompt or args.message
    response = args.response

    if not prompt and not response:
        # Read from stdin
        prompt = sys.stdin.read().strip()

    if not prompt and not response:
        parser.print_help()
        sys.exit(1)

    # Load config
    config = {}
    if args.config:
        config["config_path"] = args.config
    if args.profile:
        config["profile_name"] = args.profile

    # Parse context
    context = {}
    if args.context:
        context = json.loads(args.context)

    # Scan
    scanner = PrismaAIRS(config_path=args.config)
    result = scanner.scan(prompt=prompt, response=response, context=context)

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
        print(f"Latency: {result.latency_ms}ms")
        print(f"Scan ID: {result.scan_id}")


if __name__ == "__main__":
    main()
