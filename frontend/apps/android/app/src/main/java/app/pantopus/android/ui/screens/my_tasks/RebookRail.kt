@file:Suppress("MatchingDeclarationName", "PackageNaming")

package app.pantopus.android.ui.screens.my_tasks

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.gigs.RebookableGigDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.gigs.GigExtrasRepository
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * "Rebook a favorite helper" rail — mirrors iOS `RebookRailView.swift`.
 *
 * Backend: `GET /api/gigs/rebookable` (`backend/routes/gigs.js:2885`).
 * The rail renders nothing while loading, nothing on failure, and nothing
 * when the server returns an empty list. It is an opportunistic accessory
 * above My tasks, not a primary surface, so it carries no empty or error
 * state of its own — matching RN's silent-catch behaviour in
 * `components/gigs/RebookSection.tsx`.
 */
@HiltViewModel
class RebookRailViewModel
    @Inject
    constructor(
        private val repo: GigExtrasRepository,
    ) : ViewModel() {
        sealed interface State {
            data object Loading : State

            data class Loaded(val items: List<RebookableGigDto>) : State

            /** Fetch failed — the rail hides itself rather than shouting. */
            data object Unavailable : State
        }

        private val _state = MutableStateFlow<State>(State.Loading)
        val state: StateFlow<State> = _state.asStateFlow()

        private var loadedOnce = false

        fun load() {
            if (loadedOnce) return
            loadedOnce = true
            refresh()
        }

        fun refresh() {
            viewModelScope.launch {
                _state.value =
                    when (val result = repo.rebookable()) {
                        is NetworkResult.Success -> State.Loaded(result.data.rebookable)
                        is NetworkResult.Failure -> State.Unavailable
                    }
            }
        }

        companion object {
            /** "Mar 4" — the completion date under the category/price line. */
            fun completedLabel(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
                return DateTimeFormatter
                    .ofPattern("MMM d", Locale.US)
                    .withZone(ZoneId.systemDefault())
                    .format(instant)
            }

            /** `$60` for whole dollars, `$62.50` otherwise — RN `formatPrice`. */
            fun priceLabel(price: Double?): String? {
                if (price == null) return null
                return if (price == Math.floor(price)) {
                    "$${price.toInt()}"
                } else {
                    String.format(Locale.US, "$%.2f", price)
                }
            }

            /** "Cleaning · $60" — category and price, either half optional. */
            fun taskLabel(
                category: String?,
                price: Double?,
            ): String =
                listOfNotNull(
                    GigsCategory.fromBackendKey(category).label,
                    priceLabel(price),
                ).joinToString(" · ")

            /** "4.9" — one decimal, or an em dash when the worker has no rating. */
            fun ratingLabel(rating: Double?): String = if (rating == null || rating <= 0) "—" else String.format(Locale.US, "%.1f", rating)
        }
    }

private val CARD_WIDTH = 152.dp
private val CTA_HEIGHT = 34.dp

/**
 * Horizontal rail of rebookable tasks. Collapses to nothing unless the
 * server actually returned some.
 */
@Composable
fun RebookRail(
    onRebook: (RebookableGigDto) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: RebookRailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    val items = (state as? RebookRailViewModel.State.Loaded)?.items.orEmpty()
    if (items.isEmpty()) return

    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = Spacing.s3, bottom = Spacing.s2)
                .testTag("rebookRail"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        RebookRailHeader()
        Row(
            modifier =
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            items.forEach { gig ->
                RebookCard(gig = gig, onRebook = { onRebook(gig) })
            }
        }
    }
}

@Composable
private fun RebookRailHeader() {
    Column(
        modifier = Modifier.padding(horizontal = Spacing.s4).testTag("rebookRailHeader"),
    ) {
        Text(
            text = "Rebook a favorite helper",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "One tap to rehire",
            fontSize = 12.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun RebookCard(
    gig: RebookableGigDto,
    onRebook: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(CARD_WIDTH)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = gig.worker?.displayName ?: "Helper",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Star,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = RebookRailViewModel.ratingLabel(gig.worker?.rating),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = RebookRailViewModel.taskLabel(gig.category, gig.price),
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        RebookRailViewModel.completedLabel(gig.completedAt)?.let { completed ->
            Text(text = completed, fontSize = 11.sp, color = PantopusColors.appTextMuted)
        }
        Button(
            onClick = onRebook,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(CTA_HEIGHT)
                    .testTag("rebookRail.${gig.id}.rebook"),
            shape = RoundedCornerShape(Radii.md),
            colors = ButtonDefaults.buttonColors(containerColor = PantopusColors.primary600),
            contentPadding = ButtonDefaults.ContentPadding,
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ArrowsRepeat,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Rebook",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}
