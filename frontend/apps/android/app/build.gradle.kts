import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    alias(libs.plugins.paparazzi)
    alias(libs.plugins.play.publisher)
    // Processes `app/google-services.json` and emits the Firebase init
    // config used by FirebaseMessaging. The committed JSON is a clearly-
    // marked placeholder — see the TODO at the top of that file.
    alias(libs.plugins.google.services)
    // Retries flaky JVM unit tests on CI (intermittent kotlinx-coroutines
    // inter-test leaks surface as UncaughtExceptionsBeforeTest on whichever
    // test runs next). Deterministic failures still fail; flakes pass on retry.
    id("org.gradle.test-retry") version "1.6.2"
}

// Load local env from .env (not committed). Falls back to sensible defaults.
val envFile = rootProject.file(".env")
val localEnv =
    Properties().apply {
        if (envFile.exists()) {
            envFile.inputStream().use { load(it) }
        }
    }

fun envOr(
    key: String,
    default: String,
): String = (localEnv.getProperty(key) ?: System.getenv(key) ?: default).trim()

// Config values baked into BuildConfig. Resolved once so the release guard
// below can validate the exact strings the release variant will ship.
val apiBaseUrl = envOr("PANTOPUS_API_BASE_URL", "http://10.0.2.2:8000")
val socketUrl = envOr("PANTOPUS_SOCKET_URL", "http://10.0.2.2:8000")
val stripeKey = envOr("STRIPE_PUBLISHABLE_KEY", "pk_test_REPLACE_ME")
val sentryDsn = envOr("SENTRY_DSN", "")
// PANTOPUS_ENV tags Sentry + tunes trace sampling. Debug defaults to `local`,
// release to `production`; an explicit value (e.g. `staging`) overrides both.
val pantopusEnvDebug = envOr("PANTOPUS_ENV", "local")
val pantopusEnvRelease = envOr("PANTOPUS_ENV", "production")

android {
    namespace = "app.pantopus.android"
    // compileSdk bumped to 35 to satisfy transitive androidx.core 1.15 AAR
    // metadata. targetSdk stays at 34 per the P1 platform spec.
    compileSdk = 35

    defaultConfig {
        applicationId = "app.pantopus.android"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true

        // Inject config into BuildConfig — read via BuildConfig.PANTOPUS_API_BASE_URL etc.
        // These are the defaultConfig values; the release buildType overrides
        // PANTOPUS_ENV to production below.
        buildConfigField("String", "PANTOPUS_API_BASE_URL", "\"$apiBaseUrl\"")
        buildConfigField("String", "PANTOPUS_SOCKET_URL", "\"$socketUrl\"")
        buildConfigField("String", "STRIPE_PUBLISHABLE_KEY", "\"$stripeKey\"")
        buildConfigField("String", "SENTRY_DSN", "\"$sentryDsn\"")
        buildConfigField("String", "PANTOPUS_ENV", "\"$pantopusEnvDebug\"")

        // PostHog product analytics — matches iOS. Empty key disables the
        // vendor (analytics no-ops in dev / CI); host defaults to EU Cloud.
        buildConfigField("String", "POSTHOG_API_KEY", "\"${envOr("POSTHOG_API_KEY", "")}\"")
        buildConfigField("String", "POSTHOG_HOST", "\"${envOr("POSTHOG_HOST", "https://eu.i.posthog.com")}\"")

        // Google Maps API key — read from gradle.properties, ~/.gradle/gradle.properties,
        // or the env. Never hard-code a real key here.
        manifestPlaceholders["MAPS_API_KEY"] = envOr("MAPS_API_KEY", "")
    }

    // Release signing: read from .env / ~/.gradle/gradle.properties / env vars.
    // Falls back to the debug keystore so assembleRelease still works for
    // smoke tests — but a real release must override these.
    val keystoreFile = envOr("PANTOPUS_KEYSTORE_FILE", "")
    signingConfigs {
        if (keystoreFile.isNotEmpty() && file(keystoreFile).exists()) {
            create("release") {
                storeFile = file(keystoreFile)
                storePassword = envOr("PANTOPUS_KEYSTORE_PASSWORD", "")
                keyAlias = envOr("PANTOPUS_KEY_ALIAS", "")
                keyPassword = envOr("PANTOPUS_KEY_PASSWORD", "")
                enableV1Signing = true
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isDebuggable = true
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            // Production environment tag: drives Sentry's environment + the
            // 0.1 trace sample rate (vs 1.0 in dev). Overrides the local
            // default from defaultConfig.
            buildConfigField("String", "PANTOPUS_ENV", "\"$pantopusEnvRelease\"")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs +=
            listOf(
                "-opt-in=kotlin.RequiresOptIn",
                "-opt-in=kotlinx.coroutines.ExperimentalCoroutinesApi",
            )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    // P13 perf: opt into Compose compiler stability + recomposition
    // reports when invoked with `-PcomposeCompilerReports=true`. Off by
    // default so day-to-day builds stay fast.
    if (project.findProperty("composeCompilerReports") == "true") {
        composeCompiler {
            reportsDestination =
                layout.buildDirectory.dir("compose_compiler_reports")
            metricsDestination =
                layout.buildDirectory.dir("compose_compiler_reports")
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "META-INF/LICENSE*"
            excludes += "META-INF/NOTICE*"
        }
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

// kotlinx-coroutines' "fast" Main-dispatcher service loader has a lazy-init
// race that intermittently throws "Module with the Main dispatcher had failed
// to initialize" in large JVM unit-test runs — it flaked
// MeViewModelTest in :app:testReleaseUnitTest on CI even though every VM test
// uses Dispatchers.setMain. Forcing the standard ServiceLoader makes the Main
// dispatcher resolve deterministically. Test-only; no app behaviour change.
tasks.withType<Test>().configureEach {
    systemProperty("kotlinx.coroutines.fast.service.loader", "false")
    retry {
        maxRetries.set(2)
        // If lots of tests fail it's a real breakage, not a flake — don't retry.
        maxFailures.set(20)
        failOnPassedAfterRetry.set(false)
    }
}

// ── Release config guard ───────────────────────────────────────────────
// A release build must point at a real https:// production backend and ship
// a LIVE Stripe key. By default we only warn (so `./gradlew assembleRelease`
// still works for local smoke tests against the debug keystore). When
// `-Ppantopus.requireProdConfig=true` (or PANTOPUS_REQUIRE_PROD_CONFIG=true)
// is set — as the fastlane release lane / CI do — a placeholder or localhost
// value fails the build so test keys can never reach the Play Store.
val requireProdProp = project.findProperty("pantopus.requireProdConfig") as String?
val requireProdEnv = System.getenv("PANTOPUS_REQUIRE_PROD_CONFIG")
val requireProdConfig = (requireProdProp ?: requireProdEnv)?.toBoolean() ?: false

val buildingRelease =
    gradle.startParameter.taskNames.any { name ->
        val task = name.substringAfterLast(':')
        task.endsWith("Release", ignoreCase = true) || task.startsWith("publish")
    }

if (buildingRelease) {
    val apiIsLocal = apiBaseUrl.contains("localhost") || apiBaseUrl.contains("10.0.2.2")
    val apiOk = apiBaseUrl.startsWith("https://") && !apiIsLocal
    val problems = mutableListOf<String>()
    if (!apiOk) {
        problems += "PANTOPUS_API_BASE_URL must be an https:// production URL (got \"$apiBaseUrl\")"
    }
    if (!stripeKey.startsWith("pk_live_")) {
        problems += "STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_…) for release (got \"${stripeKey.take(8)}…\")"
    }
    if (problems.isNotEmpty()) {
        val detail = problems.joinToString("\n  - ", prefix = "\n  - ")
        val message =
            "Release build is using non-production config:$detail" +
                "\nSupply PANTOPUS_API_BASE_URL / STRIPE_PUBLISHABLE_KEY via .env or CI secrets."
        if (requireProdConfig) {
            throw GradleException(message)
        } else {
            logger.warn("⚠️  $message")
        }
    }
}

dependencies {
    // Core + lifecycle
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // Compose
    implementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(platform(libs.androidx.compose.bom))
    implementation(libs.bundles.compose)
    // Material 1 pulled in for PullRefreshIndicator (not yet in Material 3 stable).
    implementation(libs.androidx.compose.material)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    // On-device QR decoding for the Add-Home wizard's "Scan WiFi QR".
    implementation(libs.mlkit.barcode.scanning)
    // EXIF orientation read for Snap & Sell photo normalization.
    implementation(libs.androidx.exifinterface)
    implementation(libs.androidx.browser)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    // DataStore (legacy auth-token store — kept for one-shot v1 → v2 migration)
    implementation(libs.androidx.datastore.preferences)

    // EncryptedSharedPreferences + MasterKey (Android Keystore-backed)
    implementation(libs.androidx.security.crypto)

    // Biometric prompt — A13.4 Transfer ownership BiometricConfirmSheet.
    implementation(libs.androidx.biometric)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)

    // Networking
    implementation(libs.bundles.networking)
    ksp(libs.moshi.kotlin.codegen)

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Image loading
    implementation(libs.coil.compose)

    // Media playback (Pulse video + Live Photo tiles)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)

    // QR encoding (ShareLinkSheet booking-link QR)
    implementation(libs.zxing.core)

    // Realtime
    implementation(libs.socketio.client)

    // Payments
    implementation(libs.stripe.android)

    // Maps
    implementation(libs.maps.compose)
    implementation(libs.play.services.maps)
    implementation(libs.play.services.location)

    // Block Store — persistent login across delete + reinstall (account hint
    // + single-use resume grant; see data/auth/AccountHintStore.kt). No-op
    // on GMS-less devices.
    implementation(libs.play.services.auth.blockstore)

    // Firebase Cloud Messaging — declared via BoM so the messaging
    // artifact picks up a compatible version automatically. Adding more
    // firebase-* deps in the future should NOT carry a version.
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    // `FirebaseMessaging.getInstance().token` returns a Task<String>;
    // kotlinx-coroutines-play-services already in the catalog adapts it
    // into a suspend `.await()`.
    implementation(libs.kotlinx.coroutines.play.services)

    // Logging + crash reporting
    implementation(libs.timber)
    implementation(libs.sentry.android)
    implementation(libs.sentry.android.timber)
    implementation(libs.sentry.android.okhttp)

    // Product analytics (PostHog) — same vendor + event names as iOS.
    implementation(libs.posthog.android)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.turbine)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.mockwebserver)

    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.test.rules)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.mockk.android)
    androidTestImplementation(libs.turbine)
    androidTestImplementation(libs.kotlinx.coroutines.test)

    // Snapshot testing (applied via the Paparazzi Gradle plugin above).
    testImplementation(libs.paparazzi)
}

// Fail the build if feature code reaches for a Material icon or a
// `ic_lucide_*` drawable directly — icons must route through
// [PantopusIconImage] so we can swap the renderer in one place.
//
// Written with a typed Gradle task class so the configuration cache can
// serialize it. The file collection and root directory are wired up at
// configuration time via providers.
abstract class VerifyPantopusIconsTask : DefaultTask() {
    @get:InputFiles
    abstract val sources: ConfigurableFileCollection

    @get:Internal
    abstract val rootDirectory: DirectoryProperty

    @TaskAction
    fun verify() {
        val banned =
            listOf(
                Regex("""androidx\.compose\.material\.icons\."""),
                Regex("""painterResource\([^)]*R\.drawable\.ic_lucide_"""),
            )
        val root = rootDirectory.get().asFile.toPath()
        val violations = mutableListOf<String>()
        sources.forEach { file ->
            file.readLines().forEachIndexed { index, line ->
                banned.forEach { pattern ->
                    if (pattern.containsMatchIn(line)) {
                        violations += "${root.relativize(file.toPath())}:${index + 1}: ${line.trim()}"
                    }
                }
            }
        }
        if (violations.isNotEmpty()) {
            throw GradleException(
                "verifyPantopusIcons failed — feature code must use PantopusIconImage, not " +
                    "Material icons or ic_lucide_* drawables directly:\n" +
                    violations.joinToString("\n"),
            )
        }
        logger.lifecycle("✓ verifyPantopusIcons: no stray icon usage in feature code.")
    }
}

tasks.register<VerifyPantopusIconsTask>("verifyPantopusIcons") {
    group = "verification"
    description = "Reject direct Material-icon or ic_lucide_* usage outside ui/theme/Icons.kt."
    sources.from(
        fileTree("src/main/java/app/pantopus/android") {
            include("**/*.kt")
            exclude("ui/theme/Icons.kt")
            exclude("ui/screens/_internal/**")
        },
    )
    rootDirectory.set(rootProject.layout.projectDirectory)
}
tasks.named("check") { dependsOn("verifyPantopusIcons") }

/**
 * Fail the build when feature code uses an untokenised literal that has
 * a design-system equivalent — catches the three regression categories
 * the P7.* audits cleaned up:
 *
 *   1. Hex `Color(0x…)` in `ui/screens/` or `ui/components/`, except in
 *      palette modules (per docs/token-drift-color.md DESIGN REVIEW list).
 *   2. On-scale `.padding(N.dp)`, `<edge> = N.dp`, `Arrangement.spacedBy(N.dp)`,
 *      and `Spacer(Modifier.height|width(N.dp))` where Spacing.s<N> exists
 *      (N ∈ 0/4/8/12/16/20/24/32/40/48/64).
 *   3. On-scale `RoundedCornerShape(N.dp)`, per-corner `<corner> = N.dp`,
 *      and custom `cornerRadius = N.dp` where Radii.<name> exists
 *      (N ∈ 4/6/8/12/16/20/24/999/9999).
 *
 * Off-scale literals are NOT flagged — those are intentional design
 * decisions tracked in docs/token-drift-{color,spacing,radii}.md.
 */
abstract class VerifyPantopusTokensTask : DefaultTask() {
    @get:InputFiles
    abstract val sources: ConfigurableFileCollection

    @get:Internal
    abstract val rootDirectory: DirectoryProperty

    @TaskAction
    fun verify() {
        // Palette modules whose entire purpose is centralising a bespoke
        // per-category swatch. Keep this list short — every addition is
        // a hex-literal escape hatch.
        val hexExempt =
            setOf(
                "ui/components/Shimmer.kt",
                "ui/screens/ceremonial_mail_open/CeremonialMailOpenContent.kt",
                "ui/screens/ceremonial_mail_open/CeremonialMailOpenScreen.kt",
                "ui/screens/compose/listing/ListingComposeWizardScreen.kt",
                "ui/screens/gigs/GigsContent.kt",
                "ui/screens/homes/accesscodes/AccessCategoryPalette.kt",
                "ui/screens/homes/bills/UtilityCategoryPalette.kt",
                "ui/screens/homes/calendar/CalendarEventCategory.kt",
                "ui/screens/homes/documents/DocumentCategoryPalette.kt",
                "ui/screens/homes/documents/DocumentFileTypePalette.kt",
                "ui/screens/homes/emergency/EmergencyCategoryPalette.kt",
                "ui/screens/homes/maintenance/MaintenanceCategoryPalette.kt",
                "ui/screens/homes/packages/CourierPalette.kt",
                "ui/screens/homes/polls/PollKindPalette.kt",
                "ui/screens/homes/tasks/HouseholdTaskCategoryPalette.kt",
                "ui/screens/identity_center/IdentityCenterContent.kt",
                "ui/screens/mailbox/mail_day/components/MailboxEmptyHero.kt",
                "ui/screens/mailbox/mail_day/components/UndoCountdown.kt",
                "ui/screens/mailbox/mail_day/components/UnreviewedItem.kt",
                "ui/screens/mailbox/mail_detail/components/CertifiedComponents.kt",
                "ui/screens/mailbox/mailbox_map/MailboxSpotKind.kt",
                "ui/screens/marketplace/MarketplaceContent.kt",
                "ui/screens/membership/MembershipDetailContent.kt",
                "ui/screens/shared/mail_item_detail/MailItemDetailShell.kt",
                "ui/screens/shared/map_list_hybrid/MapListHybridPreview.kt",
                "ui/screens/wallet/components/WalletPalette.kt",
            )

        val hexPattern = Regex("""Color\(0x[0-9A-Fa-f]+\)""")

        val spacingVals = "(0|4|8|12|16|20|24|32|40|48|64)"
        val spacingPatterns =
            listOf(
                Regex("""\.padding\($spacingVals\.dp\)"""),
                Regex("""\b(horizontal|vertical|top|bottom|start|end)\s*=\s*$spacingVals\.dp"""),
                Regex("""Arrangement\.spacedBy\($spacingVals\.dp\)"""),
                Regex("""Spacer\((?:modifier\s*=\s*)?Modifier\.(?:height|width)\($spacingVals\.dp\)\)"""),
            )

        val radiiVals = "(4|6|8|12|16|20|24|999|9999)"
        val radiiPatterns =
            listOf(
                Regex("""RoundedCornerShape\($radiiVals\.dp\)"""),
                Regex("""\b(topStart|topEnd|bottomStart|bottomEnd|size)\s*=\s*$radiiVals\.dp"""),
                Regex("""\bcornerRadius\s*=\s*$radiiVals\.dp"""),
            )

        val root = rootDirectory.get().asFile.toPath()
        val themeRel = "ui/theme/" // never flag the token-defining files themselves

        val hexViolations = mutableListOf<String>()
        val spacingViolations = mutableListOf<String>()
        val radiiViolations = mutableListOf<String>()

        sources.forEach { file ->
            val rel = root.relativize(file.toPath()).toString().replace('\\', '/')
            val relInsideAndroid = rel.substringAfter("app/src/main/java/app/pantopus/android/", rel)
            if (relInsideAndroid.startsWith(themeRel)) return@forEach
            val exemptFromHex = hexExempt.any { relInsideAndroid.endsWith(it) }
            file.readLines().forEachIndexed { index, line ->
                val location = "$rel:${index + 1}"
                if (!exemptFromHex && hexPattern.containsMatchIn(line)) {
                    hexViolations += "$location: ${line.trim()}"
                }
                spacingPatterns.forEach { pat ->
                    if (pat.containsMatchIn(line)) {
                        spacingViolations += "$location: ${line.trim()}"
                    }
                }
                radiiPatterns.forEach { pat ->
                    if (pat.containsMatchIn(line)) {
                        radiiViolations += "$location: ${line.trim()}"
                    }
                }
            }
        }

        val messages = mutableListOf<String>()
        if (hexViolations.isNotEmpty()) {
            messages +=
                "feature code must use PantopusColors.<token> instead of a hex literal:\n" +
                hexViolations.joinToString("\n") +
                "\n\n  If this is a new bespoke palette module, add it to hexExempt in " +
                "app/build.gradle.kts and surface to design review."
        }
        if (spacingViolations.isNotEmpty()) {
            messages +=
                "feature code must use Spacing.s<N> for on-scale layout spacing " +
                "(0→s0  4→s1  8→s2  12→s3  16→s4  20→s5  24→s6  32→s8  40→s10  48→s12  64→s16):\n" +
                spacingViolations.joinToString("\n")
        }
        if (radiiViolations.isNotEmpty()) {
            messages +=
                "feature code must use Radii.<name> for on-scale corner radii " +
                "(4→xs  6→sm  8→md  12→lg  16→xl  20→xl2  24→xl3  9999→pill):\n" +
                radiiViolations.joinToString("\n")
        }

        if (messages.isNotEmpty()) {
            throw GradleException(
                "verifyPantopusTokens failed:\n\n" + messages.joinToString("\n\n"),
            )
        }
        logger.lifecycle("✓ verifyPantopusTokens: no untokenised on-scale literals in feature code.")
    }
}

tasks.register<VerifyPantopusTokensTask>("verifyPantopusTokens") {
    group = "verification"
    description = "Reject untokenised hex colors and on-scale spacing/radii literals in feature code."
    sources.from(
        fileTree("src/main/java/app/pantopus/android") {
            include("**/*.kt")
            // Token definitions and the design-system module themselves are exempt;
            // _internal galleries demonstrate raw tokens for the design team.
            exclude("ui/theme/**")
            exclude("ui/screens/_internal/**")
        },
    )
    rootDirectory.set(rootProject.layout.projectDirectory)
}
tasks.named("check") { dependsOn("verifyPantopusTokens") }

// Convenience alias so CI and the README can reference a single task name
// regardless of which build variants exist. Delegates to the Paparazzi
// plugin's per-variant verify task.
tasks.register("paparazziVerify") {
    group = "verification"
    description = "Verify Paparazzi snapshots for the debug variant."
    dependsOn("verifyPaparazziDebug")
}
tasks.register("paparazziRecord") {
    group = "verification"
    description = "Record new Paparazzi snapshot baselines for the debug variant."
    dependsOn("recordPaparazziDebug")
}

// P16: Gradle Play Publisher.
//
// Reads the service-account JSON path + track from
// `~/.gradle/gradle.properties` (never committed) so a real release
// looks like:
//
//   ./gradlew publishReleaseBundle --dry-run        # smoke check
//   ./gradlew publishReleaseBundle                  # ship
//
// Fall through gracefully when the credentials aren't set so day-to-day
// builds (and CI without secrets) still succeed.
play {
    val keyPath =
        providers
            .gradleProperty("PANTOPUS_PLAY_SERVICE_ACCOUNT_JSON")
            .orElse(providers.environmentVariable("PANTOPUS_PLAY_SERVICE_ACCOUNT_JSON"))
            .getOrElse("")
    if (keyPath.isNotEmpty() && file(keyPath).exists()) {
        serviceAccountCredentials.set(file(keyPath))
        track.set("internal")
        defaultToAppBundles.set(true)
        // `draft` keeps reviews paused until a human flips status to
        // `completed` in the Play Console — safer for first-time
        // automation.
        releaseStatus.set(com.github.triplet.gradle.androidpublisher.ReleaseStatus.DRAFT)
        // Read changelog from `fastlane/metadata/android/<lang>/changelogs/<versionCode>.txt`.
        // Mirror the path as a Play resolution strategy.
        resolutionStrategy.set(com.github.triplet.gradle.androidpublisher.ResolutionStrategy.AUTO)
    } else {
        // No credentials → mark the publisher disabled so the plugin's
        // tasks are no-ops. `--dry-run` still works.
        enabled.set(false)
    }
}

// P16: convenience task to drive `StoreScreenshotsTest` on a connected
// device/emulator and pull the resulting PNGs into the fastlane metadata
// folder. Runs the existing instrumented test class then `adb pull`s
// the artifacts.
tasks.register("captureStoreScreenshots") {
    group = "publishing"
    description = "Capture the 6 hero screenshots into fastlane metadata."
    dependsOn(":app:connectedDebugAndroidTest")
    doLast {
        val pkg = android.namespace
        val src = "/sdcard/Android/data/$pkg/files/Pictures/store_screenshots"
        val dst =
            file("fastlane/metadata/android/en-US/images/phoneScreenshots").apply {
                mkdirs()
            }
        exec {
            commandLine("adb", "pull", src, dst.absolutePath)
            isIgnoreExitValue = true
        }
        logger.lifecycle("✓ Screenshots pulled to $dst")
    }
}
