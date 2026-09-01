.PHONY: dev dev-all staging prod build-staging build-prod down logs clean \
        ios-bootstrap ios-open ios-build ios-test ios-lint ios-validate-env \
        android-bootstrap android-build android-test android-install \
        android-lint android-instrumented android-validate-env

## Development -----------------------------------------------------------------

# Backend in Docker (hot reload), web on host (recommended for dev)
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up backend --build -d
	@echo ""
	@echo "Backend running at http://localhost:8000"
	@echo "Run 'pnpm dev:web' in another terminal to start the web app"

# All services in Docker (dev mode)
dev-all:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.dev up --build -d
	@echo ""
	@echo "Backend: http://localhost:8000"
	@echo "Web:     http://localhost:3000"

## iOS (Swift / SwiftUI) -------------------------------------------------------

ios-bootstrap:
	cd frontend/apps/ios && make bootstrap

ios-open:
	cd frontend/apps/ios && make open

ios-build:
	cd frontend/apps/ios && make build

ios-test:
	cd frontend/apps/ios && make test

ios-lint:
	cd frontend/apps/ios && make lint

ios-validate-env:
	cd frontend/apps/ios && make validate-env

## Android (Kotlin / Jetpack Compose) ------------------------------------------

android-bootstrap:
	cd frontend/apps/android && make bootstrap

android-build:
	cd frontend/apps/android && make build

android-test:
	cd frontend/apps/android && make test

android-instrumented:
	cd frontend/apps/android && make instrumented

android-lint:
	cd frontend/apps/android && make lint

android-install:
	cd frontend/apps/android && make install

android-validate-env:
	cd frontend/apps/android && make validate-env

## Staging / Production --------------------------------------------------------

staging:
	docker compose --env-file .env.staging up --build -d
	@echo ""
	@echo "Staging running at http://localhost:3000"

prod:
	docker compose --env-file .env.prod up --build -d
	@echo ""
	@echo "Production running at http://localhost:3000"

build-staging:
	docker compose --env-file .env.staging build

build-prod:
	docker compose --env-file .env.prod build

## Utilities -------------------------------------------------------------------

down:
	docker compose down

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-web:
	docker compose logs -f web

clean:
	docker compose down -v --rmi local

ps:
	docker compose ps
