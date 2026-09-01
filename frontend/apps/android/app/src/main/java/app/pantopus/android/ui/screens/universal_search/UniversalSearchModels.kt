@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.universal_search

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * S2 — Universal search. The tab set, the unified row projection, and
 * the per-kind presentation (icon + accent + section label) shared by
 * the view-model and the screen.
 *
 * Mirrors RN `src/app/discover.tsx` (`SearchTab`, `UnifiedResult`,
 * `SEARCH_RESULT_TYPE_CONFIG`) and iOS
 * `Features/UniversalSearch/UniversalSearchModels.swift`.
 */

/**
 * The six universal-search tabs. [All] fans out concurrently across
 * every source; the rest hit exactly one.
 */
enum class UniversalSearchTab(
    val key: String,
    val title: String,
    val kind: UniversalSearchKind?,
) {
    All("all", "All", null),
    Tasks("tasks", "Tasks", UniversalSearchKind.Task),
    People("people", "People", UniversalSearchKind.Person),
    Beacons("beacons", "Beacons", UniversalSearchKind.Beacon),
    Businesses("businesses", "Businesses", UniversalSearchKind.Business),
    Homes("homes", "Homes", UniversalSearchKind.Home),
}

/**
 * One searchable entity kind. Declaration order matches the section
 * order RN renders in the "All" tab (`src/app/discover.tsx:298`).
 *
 * @param key Stable slug used in test tags and route mapping.
 * @param sectionTitle Plural section header used in the "All" tab.
 * @param icon Row / section glyph.
 * @param accent Glyph, section header, and trailing-meta color.
 * @param accentBackground Soft fill behind the glyph when a row has no avatar.
 * @param failureNotice Copy for the "this source failed" inline notice.
 */
enum class UniversalSearchKind(
    val key: String,
    val sectionTitle: String,
    val icon: PantopusIcon,
    val accent: Color,
    val accentBackground: Color,
    val failureNotice: String,
) {
    Task(
        key = "task",
        sectionTitle = "Tasks",
        icon = PantopusIcon.Hammer,
        accent = PantopusColors.warmAmber,
        accentBackground = PantopusColors.warmAmberBg,
        failureNotice = "Tasks couldn't be searched.",
    ),
    Person(
        key = "person",
        sectionTitle = "People",
        icon = PantopusIcon.User,
        accent = PantopusColors.personal,
        accentBackground = PantopusColors.personalBg,
        failureNotice = "People couldn't be searched.",
    ),
    Beacon(
        key = "beacon",
        sectionTitle = "Beacons",
        icon = PantopusIcon.Radio,
        accent = PantopusColors.magic,
        accentBackground = PantopusColors.magicBg,
        failureNotice = "Beacons couldn't be searched.",
    ),
    Business(
        key = "business",
        sectionTitle = "Businesses",
        icon = PantopusIcon.Building2,
        accent = PantopusColors.business,
        accentBackground = PantopusColors.businessBg,
        failureNotice = "Businesses couldn't be searched.",
    ),
    Home(
        key = "home",
        sectionTitle = "Homes",
        icon = PantopusIcon.Home,
        accent = PantopusColors.home,
        accentBackground = PantopusColors.homeBg,
        failureNotice = "Homes couldn't be searched.",
    ),
}

/**
 * Where a tapped result navigates. The host maps this onto a
 * `ChildRoutes` string in `RootTabScreen.kt`.
 */
sealed interface UniversalSearchDestination {
    data class Task(
        val gigId: String,
    ) : UniversalSearchDestination

    data class Person(
        val userId: String,
    ) : UniversalSearchDestination

    data class Beacon(
        val handle: String,
    ) : UniversalSearchDestination

    data class Business(
        val businessId: String,
    ) : UniversalSearchDestination

    data class Home(
        val homeId: String,
    ) : UniversalSearchDestination
}

/** One unified search row — the native mirror of RN's `UnifiedResult`. */
data class UniversalSearchResult(
    val id: String,
    val kind: UniversalSearchKind,
    val title: String,
    val subtitle: String? = null,
    /** Trailing accent text — price for tasks, locality for everyone else. */
    val meta: String? = null,
    val imageUrl: String? = null,
    val destination: UniversalSearchDestination,
)

/**
 * A rendered group of rows. The "All" tab emits one per non-empty kind
 * and shows the header; single-kind tabs emit one headerless section.
 */
data class UniversalSearchSection(
    val kind: UniversalSearchKind,
    val results: List<UniversalSearchResult>,
)
