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
	docker build --platform $(PLATFORM) -t $(IMAGE):$(TAG) $(TALOS_DIR)

docker-push:          ## Push production image to ghcr.io
	docker push $(IMAGE):$(TAG)

docker-build-push:    ## Build + push production image
	$(MAKE) docker-build docker-push

docker-run:           ## Run base image locally (port 18789)
	docker run -d --name openclaw-dev -p 18789:18789 openclaw-base

docker-stop:          ## Stop and remove local container
	docker rm -f openclaw-dev 2>/dev/null || true

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
