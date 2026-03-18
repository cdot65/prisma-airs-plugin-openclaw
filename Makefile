# -- Config ----------------------------------------------------------------
PLUGIN_DIR   := prisma-airs-plugin
TALOS_DIR    := $(HOME)/talos-cluster/openclaw
IMAGE        := ghcr.io/cdot65/openclaw
TAG          ?= latest
PLATFORM     := linux/amd64
NS           := openclaw
DEPLOY       := openclaw

# -- Plugin Development ----------------------------------------------------
.PHONY: check test test-watch test-coverage lint lint-fix format typecheck install

check:                ## Run full validation (typecheck + lint + format + test)
	cd $(PLUGIN_DIR) && npm run check

test:                 ## Run tests
	cd $(PLUGIN_DIR) && npm test

test-watch:           ## Run tests in watch mode
	cd $(PLUGIN_DIR) && npm run test:watch

test-coverage:        ## Run tests with coverage report
	cd $(PLUGIN_DIR) && npm run test:coverage

lint:                 ## Check linting
	cd $(PLUGIN_DIR) && npm run lint

lint-fix:             ## Auto-fix lint issues
	cd $(PLUGIN_DIR) && npm run lint:fix

format:               ## Format code
	cd $(PLUGIN_DIR) && npm run format

typecheck:            ## Type check without emitting
	cd $(PLUGIN_DIR) && npm run typecheck

install:              ## Install plugin dependencies
	cd $(PLUGIN_DIR) && npm ci

# -- Docker ----------------------------------------------------------------
.PHONY: docker-build-base docker-build docker-push docker-build-push docker-run docker-stop

docker-build-base:    ## Build local dev base image from docker/
	docker build --platform $(PLATFORM) -t openclaw-base docker/

docker-build:         ## Build production image (amd64) from talos-cluster
	docker build --no-cache --platform $(PLATFORM) -t $(IMAGE):$(TAG) $(TALOS_DIR)

docker-push:          ## Push production image to ghcr.io
	docker push $(IMAGE):$(TAG)

docker-build-push:    ## Build + push production image
	$(MAKE) docker-build docker-push

docker-run:           ## Run base image locally (port 18789)
	docker run -d --name openclaw-dev -p 18789:18789 openclaw-base

docker-stop:          ## Stop and remove local container
	docker rm -f openclaw-dev 2>/dev/null || true

# -- E2E Testing (Docker Compose) -----------------------------------------
.PHONY: e2e-build e2e-up e2e-down e2e-test e2e-logs e2e-shell e2e

e2e-build:            ## Build E2E image (no cache)
	docker compose build --no-cache

e2e-up:               ## Start gateway (requires PANW_AI_SEC_API_KEY + PANW_AI_SEC_PROFILE)
	docker compose up -d
	@echo ""
	@echo "OpenClaw gateway starting on http://localhost:18789"
	@echo "Run: make e2e-test"

e2e-down:             ## Stop E2E environment (data persists in volume)
	docker compose down

e2e-clean:            ## Stop E2E and delete persistent volume
	docker compose down -v

e2e-test:             ## Run E2E smoke tests against running gateway
	docker compose exec gateway bash /home/node/e2e/smoke-test.sh

e2e-scan:             ## Run a manual scan (usage: make e2e-scan MSG="hello")
	docker compose exec gateway openclaw prisma-airs-scan "$(MSG)" --json

e2e-status:           ## Check plugin status via RPC (fast)
	docker compose exec gateway openclaw gateway call prisma-airs.status --token e2e-dev-token --json

e2e-health:           ## Check gateway health
	docker compose exec gateway openclaw gateway health

e2e-logs:             ## Tail E2E gateway logs
	docker compose logs -f gateway

e2e-shell:            ## Shell into E2E gateway container
	docker compose exec gateway bash

e2e: e2e-build e2e-up ## Build and start E2E environment

# -- Kubernetes (Talos) ----------------------------------------------------
.PHONY: k8s-apply k8s-restart k8s-status k8s-logs k8s-shell k8s-deploy

K8S_MANIFESTS := namespace.yaml certificate.yaml configmap.yaml secrets.yaml pvc.yaml deployment.yaml service.yaml ingressroute.yaml

k8s-apply:            ## Apply all k8s manifests
	cd $(TALOS_DIR) && kubectl apply $(addprefix -f ,$(K8S_MANIFESTS))

k8s-restart:          ## Rollout restart and wait for ready
	kubectl rollout restart deployment/$(DEPLOY) -n $(NS)
	kubectl rollout status deployment/$(DEPLOY) -n $(NS) --timeout=300s

k8s-status:           ## Show pod status
	kubectl get pods -n $(NS)

k8s-logs:             ## Tail deployment logs
	kubectl logs -n $(NS) deployment/$(DEPLOY) -f

k8s-shell:            ## Exec into running pod
	kubectl exec -it -n $(NS) deployment/$(DEPLOY) -- /bin/bash

k8s-deploy:           ## Build, push, restart (full deploy)
	$(MAKE) docker-build-push k8s-restart

# -- Release ---------------------------------------------------------------
.PHONY: version-check

version-check:        ## Show current version across all files
	@echo "package.json:         $$(cd $(PLUGIN_DIR) && node -p "require('./package.json').version")"
	@echo "openclaw.plugin.json: $$(cd $(PLUGIN_DIR) && node -p "require('./openclaw.plugin.json').version")"
	@echo "index.ts:             $$(grep 'export const version' $(PLUGIN_DIR)/index.ts | head -1)"

# -- Documentation ---------------------------------------------------------
.PHONY: docs docs-build

docs:                 ## Serve docs locally (hot reload)
	mkdocs serve

docs-build:           ## Build static docs site
	mkdocs build

# -- Help ------------------------------------------------------------------
.PHONY: help
help:                 ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
