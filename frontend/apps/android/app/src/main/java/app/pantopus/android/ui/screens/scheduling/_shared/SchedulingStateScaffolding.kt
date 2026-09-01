@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The shared four-state idiom for **non-list** scheduling surfaces (forms,
 * details, public flows), aligned to the list shell's `ListOfRowsUiState` so
 * every stream reuses one shape. List screens keep using `ListOfRowsScreen`;
 * this is the equivalent for everything else.
 *
 * Loading is a shimmer skeleton (never a screen-level spinner); Empty uses the
 * design-system [EmptyState]; Error uses [ErrorState] wired to retry.
 */
sealed interface SchedulingScreenState<out T> {
    data object Loading : SchedulingScreenState<Nothing>

    data class Empty(
        val icon: PantopusIcon,
        val headline: String,
        val subcopy: String,
        val ctaTitle: String? = null,
        val onCta: (() -> Unit)? = null,
    ) : SchedulingScreenState<Nothing>

    data class Loaded<T>(
        val data: T,
    ) : SchedulingScreenState<T>

    data class Error(
        val message: String,
    ) : SchedulingScreenState<Nothing>
}

/**
 * Switch a [SchedulingScreenState] to its loading / empty / error / content
 * rendering. [content] receives the loaded data.
 */
@Composable
fun <T> SchedulingStateScaffold(
    state: SchedulingScreenState<T>,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    loading: @Composable () -> Unit = { SchedulingLoadingSkeleton(modifier) },
    content: @Composable (T) -> Unit,
) {
    when (state) {
        is SchedulingScreenState.Loading -> loading()
        is SchedulingScreenState.Empty ->
            EmptyState(
                icon = state.icon,
                headline = state.headline,
                subcopy = state.subcopy,
                modifier = modifier,
                ctaTitle = state.ctaTitle,
                onCta = state.onCta,
            )
        is SchedulingScreenState.Error ->
            ErrorState(message = state.message, modifier = modifier, onRetry = onRetry)
        is SchedulingScreenState.Loaded -> content(state.data)
    }
}

private val SKELETON_LINE_FULL = 200.dp
private val SKELETON_LINE_SHORT = 120.dp
private val SKELETON_LINE_HEIGHT = 14.dp
private val SKELETON_LINE_HEIGHT_SM = 12.dp

/**
 * Default loading skeleton: a stack of card frames, each carrying two shimmer
 * text-lines — mirrors the loaded list/detail geometry rather than a spinner.
 */
@Composable
fun SchedulingLoadingSkeleton(
    modifier: Modifier = Modifier,
    rows: Int = 5,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        repeat(rows) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.xl))
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = SKELETON_LINE_FULL, height = SKELETON_LINE_HEIGHT, cornerRadius = Radii.xs)
                Shimmer(width = SKELETON_LINE_SHORT, height = SKELETON_LINE_HEIGHT_SM, cornerRadius = Radii.xs)
            }
        }
    }
}
