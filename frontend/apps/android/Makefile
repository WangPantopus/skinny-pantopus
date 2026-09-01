# Pantopus Android — Makefile
# Thin wrapper over Gradle / Fastlane for day-to-day tasks.

GRADLE := ./gradlew
ENV_FILE := .env

.PHONY: help bootstrap validate-env build test instrumented lint format clean install beta release

help:
	@echo "Pantopus Android — available targets:"
	@echo ""
	@echo "  bootstrap      Download the Gradle wrapper"
	@echo "  validate-env   Check .env has the keys the build needs"
	@echo "  build          Assemble debug APK"
	@echo "  install        Install debug APK on the connected device/emulator"
	@echo "  test           Run unit tests"
	@echo "  instrumented   Run Compose UI / instrumented tests"
	@echo "  lint           ktlint + detekt + Android Lint"
	@echo "  format         ktlint auto-format"
	@echo "  clean          Gradle clean"
	@echo "  beta           Fastlane: upload AAB to Play Internal"
	@echo "  release        Fastlane: promote Internal → Production"

bootstrap:
	$(GRADLE) --version

validate-env:
	@if [ ! -f $(ENV_FILE) ]; then \
		echo "✗ $(ENV_FILE) not found. Run: cp .env.example .env"; exit 1; \
	fi; \
	missing=""; \
	for key in PANTOPUS_API_BASE_URL STRIPE_PUBLISHABLE_KEY; do \
		if ! grep -q "^$$key=..*" $(ENV_FILE); then missing="$$missing $$key"; fi; \
	done; \
	if [ -n "$$missing" ]; then \
		echo "✗ Missing or empty in $(ENV_FILE):$$missing"; exit 1; \
	fi; \
	echo "✓ $(ENV_FILE) has required keys. Optional: SENTRY_DSN, MAPS_API_KEY, PANTOPUS_KEYSTORE_*."

build:
	$(GRADLE) assembleDebug

install:
	$(GRADLE) installDebug

test:
	$(GRADLE) test

instrumented:
	$(GRADLE) connectedDebugAndroidTest

lint:
	$(GRADLE) ktlintCheck detekt :app:lintDebug

format:
	$(GRADLE) ktlintFormat

clean:
	$(GRADLE) clean

beta:
	bundle exec fastlane beta

release:
	bundle exec fastlane release
