"""Tests for prisma_airs_skill.scan module."""

from prisma_airs_skill import PrismaAIRS, ScanResult
from prisma_airs_skill.scan import Action, Severity


def test_imports():
    """Verify module imports work."""
    assert PrismaAIRS is not None
    assert ScanResult is not None


def test_severity_enum():
    """Test Severity enum values."""
    assert Severity.SAFE.value == 0
    assert Severity.CRITICAL.value == 4


def test_action_enum():
    """Test Action enum values."""
    assert Action.ALLOW.value == "allow"
    assert Action.BLOCK.value == "block"
