#!/usr/bin/env python3
"""Prisma AIRS Scanner - standalone entry point for ClawHub."""
import sys
from pathlib import Path

# Add src to path for direct execution
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from prisma_airs_skill.scan import main

if __name__ == "__main__":
    main()
