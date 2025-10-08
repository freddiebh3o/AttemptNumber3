# Makefile for BMAD workflow targets
# Usage: make <target>

.PHONY: help bmad-plan bmad-test-api bmad-test-web bmad-build-all bmad-typecheck bmad-accept-api bmad-accept-web bmad-accept-all

# Default target
help:
	@echo "BMAD Workflow Targets:"
	@echo "  bmad-plan        - Validate BMAD docs exist and are non-empty"
	@echo "  bmad-test-api    - Run API server build + typecheck"
	@echo "  bmad-test-web    - Run admin-web build + typecheck + lint"
	@echo "  bmad-build-all   - Build both workspaces"
	@echo "  bmad-typecheck   - Type check both workspaces"
	@echo "  bmad-accept-api  - Run API acceptance tests (Jest)"
	@echo "  bmad-accept-web  - Run web E2E acceptance tests (Playwright)"
	@echo "  bmad-accept-all  - Run all acceptance tests"
	@echo ""
	@echo "Development:"
	@echo "  dev-api          - Start API server in watch mode"
	@echo "  dev-web          - Start Vite dev server"
	@echo "  db-migrate       - Create and apply Prisma migration"
	@echo "  db-seed          - Seed database with test data"

# BMAD Plan validation
bmad-plan:
	@echo "==> Validating BMAD documentation..."
	@test -f docs/bmad/PRD.md || (echo "❌ docs/bmad/PRD.md missing" && exit 1)
	@test -f docs/bmad/ARCH.md || (echo "❌ docs/bmad/ARCH.md missing" && exit 1)
	@test -f docs/bmad/QA.md || (echo "❌ docs/bmad/QA.md missing" && exit 1)
	@test -s docs/bmad/PRD.md || (echo "❌ PRD.md is empty" && exit 1)
	@test -s docs/bmad/ARCH.md || (echo "❌ ARCH.md is empty" && exit 1)
	@test -s docs/bmad/QA.md || (echo "❌ QA.md is empty" && exit 1)
	@echo "✅ BMAD docs validated"

# API Server tests
bmad-test-api:
	@echo "==> Testing API Server..."
	cd api-server && npm run typecheck
	cd api-server && npm run build
	@echo "✅ API server tests passed"

# Admin Web tests
bmad-test-web:
	@echo "==> Testing Admin Web..."
	cd admin-web && npm run typecheck
	cd admin-web && npm run lint
	cd admin-web && npm run build
	@echo "✅ Admin web tests passed"

# API Acceptance tests
bmad-accept-api:
	@echo "==> Running API acceptance tests..."
	cd api-server && npm run test:accept
	@echo "✅ API acceptance tests passed"

# Web E2E Acceptance tests
bmad-accept-web:
	@echo "==> Running web E2E acceptance tests..."
	cd admin-web && npm run test:accept
	@echo "✅ Web E2E acceptance tests passed"

# All acceptance tests
bmad-accept-all: bmad-accept-api bmad-accept-web
	@echo "✅ All acceptance tests passed"

# Build all workspaces
bmad-build-all: bmad-test-api bmad-test-web
	@echo "✅ All workspaces built successfully"

# Type check all
bmad-typecheck:
	@echo "==> Type checking all workspaces..."
	cd api-server && npm run typecheck
	cd admin-web && npm run typecheck
	@echo "✅ Type checks passed"

# Development helpers
dev-api:
	cd api-server && npm run dev

dev-web:
	cd admin-web && npm run dev

db-migrate:
	cd api-server && npm run db:migrate

db-seed:
	cd api-server && npm run db:seed

# Install dependencies
install:
	cd api-server && npm install
	cd admin-web && npm install
	@echo "✅ Dependencies installed"
