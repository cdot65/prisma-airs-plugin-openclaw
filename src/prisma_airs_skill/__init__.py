"""Prisma AIRS Skill - OpenClaw plugin for AI Runtime Security."""

__version__ = "0.1.0"

from .scan import PrismaAIRS, ScanResult

__all__ = ["PrismaAIRS", "ScanResult"]
