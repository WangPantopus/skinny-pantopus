// Top-level build file — plugin declarations only.
// Actual config per-module lives in each module's build.gradle.kts.

plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.detekt)
    alias(libs.plugins.ktlint)
    // P16: declare Play Publisher at the root so the :app module can
    // apply it. Configuration lives in `app/build.gradle.kts` under
    // the `play { … }` block.
    alias(libs.plugins.play.publisher) apply false
    // FCM: google-services processes `app/google-services.json` and emits
    // the Firebase init config. Applied by `:app`.
    alias(libs.plugins.google.services) apply false
}

// Apply detekt + ktlint to every subproject.
subprojects {
    apply(plugin = rootProject.libs.plugins.detekt.get().pluginId)
    apply(plugin = rootProject.libs.plugins.ktlint.get().pluginId)

    detekt {
        config.setFrom(files("$rootDir/config/detekt.yml"))
        buildUponDefaultConfig = true
        allRules = false
        autoCorrect = false
        // Per-module baseline for pre-existing issues. Added when P1 (design
        // tokens) landed — snapshots issues that predate the design-system
        // work so those files can be cleaned up separately.
        val baselineFile = file("$projectDir/detekt-baseline.xml")
        if (baselineFile.exists()) {
            baseline = baselineFile
        }
    }

    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        android.set(true)
        ignoreFailures.set(false)
        reporters {
            reporter(org.jlleitschuh.gradle.ktlint.reporter.ReporterType.PLAIN)
            reporter(org.jlleitschuh.gradle.ktlint.reporter.ReporterType.CHECKSTYLE)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
