#!/usr/bin/env python3
"""Prisma AIRS Configuration Audit - standalone entry point."""

import sys
from pathlib import Path

# For plugin distribution: try installed package first, fall back to relative path
try:
    from prisma_airs_skill.audit import main  # type: ignore[import-not-found]
except ImportError:
    # Development/direct execution: add src to path
    plugin_root = Path(__file__).parent.parent.parent.parent
    sys.path.insert(0, str(plugin_root / "src"))
    from prisma_airs_skill.audit import main  # noqa: E402

if __name__ == "__main__":
    main()
