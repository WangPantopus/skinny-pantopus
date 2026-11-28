@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.ReinventedKeptDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * My Atlas in the list's place (PHASE-1 §2 piece 13): the person's own kept Moments by day ("Today", "Yesterday",
 * then the date), newest first, as tiles with each one's time, 30 a page and more as it scrolls. Private to them.
 */
@Composable
internal fun ReinventedAtlasList(
    state: ReinventedAtlasState,
    onOpen: (MomentDto) -> Unit,
    onMore: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    search: (@Composable () -> Unit)? = null,
) {
    val moments = state.moments
    if (moments == null) {
        if (state.failed) {
            EmptyState(
                icon = PantopusIcon.AlertTriangle,
                headline = "Your Atlas didn't load",
                subcopy = "Check your connection and try again.",
                ctaTitle = "Try again",
                onCta = onRetry,
                modifier = modifier.padding(top = Spacing.s5),
            )
        }
        return
    }
    val grid = rememberLazyGridState()
    val nearEnd by remember {
        derivedStateOf {
            val info = grid.layoutInfo
            (info.visibleItemsInfo.lastOrNull()?.index ?: -1) >= info.totalItemsCount - 6
        }
    }
    LaunchedEffect(nearEnd, state.cursor) { if (nearEnd && state.cursor != null) onMore() }
    val days = remember(moments) { moments.groupBy { atlasDay(it.createdAt) } }
    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        state = grid,
        modifier = modifier.fillMaxSize().testTag("reinventedPulse.atlas"),
        contentPadding = PaddingValues(start = Spacing.s3, end = Spacing.s3, bottom = 120.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        // Atlas search (phase 4, `feed/living/LivingAtlasSearch.kt`): the field, and its results while a search shows.
        search?.let { item(span = { GridItemSpan(maxLineSpan) }, key = "search") { it() } }
        item(span = { GridItemSpan(maxLineSpan) }, key = "intro") {
            Text(
                text = if (moments.isEmpty()) ATLAS_EMPTY else ATLAS_INTRO,
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(horizontal = Spacing.s1, vertical = Spacing.s3),
            )
        }
        // "Went because of you" (CONTRACT 8c), private to the Atlas's owner; nothing when there are none.
        item(span = { GridItemSpan(maxLineSpan) }, key = "strands") { ReinventedStrandsSection() }
        days.forEach { (day, dayMoments) ->
            item(span = { GridItemSpan(maxLineSpan) }, key = "day-$day") {
                Text(
                    text = day,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.padding(horizontal = Spacing.s1).padding(top = Spacing.s2).semantics { heading() },
                )
            }
            items(dayMoments, key = { it.id }) { moment -> AtlasTile(moment) { onOpen(moment) } }
        }
    }
}

@Composable
private fun AtlasTile(
    moment: MomentDto,
    onOpen: () -> Unit,
) {
    val time = atlasTime(moment.createdAt)
    Box(
        modifier =
            Modifier
                .aspectRatio(0.8f)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(role = Role.Button, onClick = onOpen)
                .semantics(mergeDescendants = true) { contentDescription = spokenTile(time, moment.placeLabel) }
                .testTag("reinventedPulse.atlas.${moment.id}"),
    ) {
        MomentPicture(moment, Modifier.fillMaxSize())
        Text(
            text = time.orEmpty(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier =
                Modifier
                    .align(Alignment.BottomStart)
                    .background(Color.Black.copy(alpha = 0.45f))
                    .padding(horizontal = 6.dp, vertical = 3.dp),
        )
    }
}

/**
 * One kept Moment opened: its picture, the day, time and place, its words, "Only you see your Atlas.", and Delete for
 * good, which asks first.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReinventedAtlasItem(
    state: ReinventedAtlasState,
    onClose: () -> Unit,
    onAskDelete: () -> Unit,
    onKeep: () -> Unit,
    onDelete: () -> Unit,
) {
    val moment = state.opened ?: return
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("reinventedPulse.atlasItem"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(bottom = Spacing.s5).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            MomentPicture(moment, Modifier.fillMaxWidth().height(320.dp).clip(RoundedCornerShape(Radii.lg)))
            Text(
                text = listOfNotNull(atlasDay(moment.createdAt), atlasTime(moment.createdAt), moment.placeLabel).joinToString(" · "),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            moment.caption?.takeIf { it.isNotBlank() }?.let { Text(it, fontSize = 15.sp, color = PantopusColors.appText) }
            Text("Only you see your Atlas.", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
            state.note?.let { Text(it, fontSize = 13.sp, color = PantopusColors.error) }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onClose, modifier = Modifier.testTag("reinventedPulse.atlasItem.close")) { Text("Close") }
                TextButton(
                    onClick = onAskDelete,
                    enabled = !state.deleting,
                    modifier = Modifier.testTag("reinventedPulse.atlasItem.delete"),
                ) {
                    Text("Delete for good", color = PantopusColors.error, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
    if (state.confirming) {
        AlertDialog(
            onDismissRequest = onKeep,
            title = { Text("Delete this Moment for good?") },
            text = { Text("Its picture is removed now and can't come back.", textAlign = TextAlign.Start) },
            confirmButton = {
                TextButton(onClick = onDelete, modifier = Modifier.testTag("reinventedPulse.atlasItem.confirm")) {
                    Text("Delete for good", color = PantopusColors.error)
                }
            },
            dismissButton = { TextButton(onClick = onKeep) { Text("Keep it") } },
        )
    }
}

private const val ATLAS_INTRO = "My Atlas: every Moment you take is kept here for you alone, after it fades for everyone else."
private const val ATLAS_EMPTY = "Nothing here yet. The Moments you post from now on are kept here."

/** "Today", "Yesterday", or "Nov 24" (with the year when it isn't this year), in the phone's own time zone. */
internal fun atlasDay(iso: String?): String {
    val instant = iso?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return "Earlier"
    val zone = ZoneId.systemDefault()
    val day = instant.atZone(zone).toLocalDate()
    val today = LocalDate.now(zone)
    return when (day) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> day.format(DateTimeFormatter.ofPattern(if (day.year == today.year) "MMM d" else "MMM d, yyyy", Locale.US))
    }
}

/** "3:42 PM", in the phone's own time zone; null when it can't be read. */
private fun atlasTime(iso: String?): String? =
    iso
        ?.let { runCatching { Instant.parse(it) }.getOrNull() }
        ?.atZone(ZoneId.systemDefault())
        ?.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))

/** A kept Moment of My Atlas as a pin on the map; none for one with no place. */
internal fun MomentDto.asKeptPin(): ReinventedMapItem? {
    if (noLocation) return null
    val lat = latitude ?: return null
    val lng = longitude ?: return null
    return ReinventedMapItem.Kept(ReinventedKeptDto(id, lat, lng, this))
}

private fun spokenTile(
    time: String?,
    place: String?,
): String = listOfNotNull("Your Moment", time, place).joinToString(", ")
