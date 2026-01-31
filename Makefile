.PHONY: all format lint mypy test clean help

# Run all checks in order
all: format lint mypy test

# Format code with ruff
format:
	uv run ruff format src/
	uv run ruff check --fix src/

# Lint with ruff and flake8
lint:
	uv run ruff check src/
	uv run flake8 src/

# Type check with mypy
mypy:
	uv run mypy src/

# Run tests
test:
	uv run pytest

# Clean build artifacts
clean:
	rm -rf .mypy_cache .pytest_cache .ruff_cache
	rm -rf dist build *.egg-info
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Show help
help:
	@echo "Available targets:"
	@echo "  all     - Run format, lint, mypy, test (in order)"
	@echo "  format  - Format code with ruff"
	@echo "  lint    - Lint with ruff and flake8"
	@echo "  mypy    - Type check with mypy"
	@echo "  test    - Run pytest"
	@echo "  clean   - Remove build artifacts"
