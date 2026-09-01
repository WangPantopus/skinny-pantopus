@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "LongMethod",
    "LongParameterList",
    "ComplexMethod",
    "CyclomaticComplexMethod",
    "TooManyFunctions",
)

package app.pantopus.android.ui.screens.shared.search_list

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/** Test tag on the shell root. */
const val SEARCH_LIST_SHELL_TAG = "searchListShell"

/** Test tag on the cancel (back) button. */
const val SEARCH_LIST_CANCEL_TAG = "searchListCancel"

/** Test tag on the search field. */
const val SEARCH_LIST_FIELD_TAG = "searchListField"

/** Test tag on the clear (X) button — rendered only when the query is non-empty. */
const val SEARCH_LIST_CLEAR_TAG = "searchListClear"

/** Test tag on the recent-queries section. */
const val SEARCH_LIST_RECENT_SECTION_TAG = "searchListRecentSection"

/** Test tag on the typing-shimmer skeleton. */
const val SEARCH_LIST_SHIMMER_TAG = "searchListShimmer"

/** Test tag on the populated results list. */
const val SEARCH_LIST_RESULTS_TAG = "searchListResults"

/** Test tag on the empty state. */
const val SEARCH_LIST_EMPTY_TAG = "searchListEmpty"

/**
 * Empty-state payload for [SearchListShell]. Mirrors the [EmptyState]
 * component's props (icon + headline + subcopy). No CTA — the canonical
 * empty-search outcome is "no results for this query", which the user
 * resolves by changing the query, not by tapping a button.
 */
data class EmptyStateContent(
    val icon: PantopusIcon,
    val headline: String,
    val subcopy: String,
)

/**
 * Reusable search-list scaffold. Owns the search bar, 250ms debounce,
 * recent-queries section, and the four lifecycle states (recent /
 * typing-shimmer / results / empty). Concrete screens hand in their
 * fetched results + an empty-state payload and a row builder.
 *
 * The shell is fully decoupled from any specific data source — callers
 * drive `query` via [onQueryChange], pass [results] + [isLoading], and
 * wire [RecentQueriesStore] separately if they want persistence.
 *
 * @param placeholder Hint string in the search field.
 * @param query Current query — caller-owned state.
 * @param onQueryChange Invoked when the user types into the field.
 * @param results Search results — drives the [SearchListPhase.Results] phase.
 * @param isLoading Whether the caller has a fetch in flight — drives the
 *     [SearchListPhase.Typing] shimmer when the query is non-empty.
 * @param recentQueries Persisted recent queries — caller-owned (see
 *     [RecentQueriesStore] for a `DataStore`-backed helper).
 * @param onRecentTap Invoked when the user taps a recent-query row.
 * @param emptyState Payload for the [SearchListPhase.Empty] phase.
 * @param row Composable that renders one [Result] cell.
 * @param onCancel Invoked when the user taps the leading back button.
 * @param filters Optional chrome rendered between the search field and the
 *     phase body — e.g. a category-chip filter strip. Visible in every
 *     phase so the user can pre-filter before (or while) typing. The
 *     default empty slot keeps the original field-then-results layout.
 */
@Composable
fun <Result : Any> SearchListShell(
    placeholder: String,
    query: String,
    onQueryChange: (String) -> Unit,
    results: List<Result>,
    isLoading: Boolean,
    emptyState: EmptyStateContent,
    row: @Composable (Result) -> Unit,
    onCancel: () -> Unit,
    recentQueries: List<String> = emptyList(),
    onRecentTap: (String) -> Unit = {},
    filters: @Composable () -> Unit = {},
) {
    // 250ms-debounced echo of `query`. The shell uses this to gate
    // the transition from typing-shimmer to empty so the user doesn't
    // see an empty-result flash on every keystroke.
    var debouncedQuery by remember { mutableStateOf(query) }
    LaunchedEffect(query) {
        delay(250)
        debouncedQuery = query
    }

    val phase =
        resolvePhase(
            query = query,
            debouncedQuery = debouncedQuery,
            isLoading = isLoading,
            hasResults = results.isNotEmpty(),
        )

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag(SEARCH_LIST_SHELL_TAG),
    ) {
        Header(
            placeholder = placeholder,
            query = query,
            onQueryChange = onQueryChange,
            onCancel = onCancel,
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        filters()
        Box(modifier = Modifier.fillMaxSize()) {
            when (phase) {
                SearchListPhase.Recent ->
                    RecentSection(
                        recentQueries = recentQueries,
                        onRecentTap = onRecentTap,
                    )
                SearchListPhase.Typing -> ShimmerSection()
                SearchListPhase.Results ->
                    ResultsSection(results = results, row = row)
                SearchListPhase.Empty -> EmptySection(emptyState = emptyState)
            }
        }
    }
}

/**
 * What is the shell rendering right now? Public so tests can pin the
 * exact transitions without spinning up Compose.
 */
enum class SearchListPhase {
    Recent,
    Typing,
    Results,
    Empty,
}

/**
 * Resolve the current phase. Extracted into a pure function so tests
 * can lock the state machine without a Compose dependency.
 *
 * - `query` blank → [Recent]
 * - `isLoading` → [Typing]
 * - `hasResults` → [Results]
 * - debounced echo caught up → [Empty]
 * - still in flight → [Typing]
 */
fun resolvePhase(
    query: String,
    debouncedQuery: String,
    isLoading: Boolean,
    hasResults: Boolean,
): SearchListPhase {
    val trimmed = query.trim()
    return when {
        trimmed.isEmpty() -> SearchListPhase.Recent
        isLoading -> SearchListPhase.Typing
        hasResults -> SearchListPhase.Results
        debouncedQuery == query -> SearchListPhase.Empty
        else -> SearchListPhase.Typing
    }
}

// ─── Header ────────────────────────────────────────────────────

@Composable
private fun Header(
    placeholder: String,
    query: String,
    onQueryChange: (String) -> Unit,
    onCancel: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        // Mirror iOS `@FocusState`'s on-appear focus so the keyboard
        // pops up the moment the surface opens, without the user
        // having to tap into the field.
        runCatching { focusRequester.requestFocus() }
    }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onCancel)
                    .testTag(SEARCH_LIST_CANCEL_TAG)
                    .semantics { contentDescription = "Cancel search" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronLeft,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.appText,
            )
        }
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f)) {
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                    singleLine = true,
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .focusRequester(focusRequester)
                            .testTag(SEARCH_LIST_FIELD_TAG),
                    decorationBox = { inner ->
                        if (query.isEmpty()) {
                            Text(
                                text = placeholder,
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                        inner()
                    },
                )
            }
            if (query.isNotEmpty()) {
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .clickable { onQueryChange("") }
                            .testTag(SEARCH_LIST_CLEAR_TAG)
                            .semantics { contentDescription = "Clear search" },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = Radii.xl,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

// ─── Phases ────────────────────────────────────────────────────

@Composable
private fun RecentSection(
    recentQueries: List<String>,
    onRecentTap: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .testTag(SEARCH_LIST_RECENT_SECTION_TAG),
    ) {
        if (recentQueries.isNotEmpty()) {
            Text(
                text = "Recent",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextMuted,
                modifier =
                    Modifier
                        .padding(
                            start = Spacing.s4,
                            end = Spacing.s4,
                            top = Spacing.s4,
                            bottom = Spacing.s2,
                        ).semantics { heading() },
            )
            recentQueries.forEach { entry ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable { onRecentTap(entry) }
                            .heightIn(min = 44.dp)
                            .padding(horizontal = Spacing.s4)
                            .testTag("searchListRecent.$entry")
                            .semantics { contentDescription = "Search for $entry" },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.History,
                        contentDescription = null,
                        size = 18.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = entry,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appText,
                    )
                }
                HorizontalDivider(
                    color = PantopusColors.appBorderSubtle,
                    thickness = 1.dp,
                    modifier = Modifier.padding(start = Spacing.s4 + 18.dp + Spacing.s3),
                )
            }
        }
    }
}

@Composable
private fun ShimmerSection() {
    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag(SEARCH_LIST_SHIMMER_TAG),
        contentPadding = PaddingValues(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        items(6) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 40.dp, height = 40.dp, cornerRadius = Radii.xl2)
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    Shimmer(width = 180.dp, height = 14.dp)
                    Shimmer(width = 120.dp, height = 12.dp)
                }
            }
        }
    }
}

@Composable
private fun <Result : Any> ResultsSection(
    results: List<Result>,
    row: @Composable (Result) -> Unit,
) {
    LazyColumn(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag(SEARCH_LIST_RESULTS_TAG),
    ) {
        items(items = results) { result ->
            row(result)
        }
    }
}

@Composable
private fun EmptySection(emptyState: EmptyStateContent) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag(SEARCH_LIST_EMPTY_TAG),
    ) {
        EmptyState(
            icon = emptyState.icon,
            headline = emptyState.headline,
            subcopy = emptyState.subcopy,
        )
    }
}
