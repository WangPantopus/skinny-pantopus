@file:Suppress("PackageNaming", "LongParameterList")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

const val TIMEZONE_PICKER_TAG = "schedulingTimezonePickerSheet"

private val ICON_SM = 16.dp
private val ICON_LG = 24.dp

/** One row in the timezone picker. `id` is the IANA zone the caller stores. */
data class TimezoneOption(
    val id: String,
    val name: String,
    val offset: String,
    val localTime: String,
)

/**
 * The IANA timezone selector — a searchable bottom sheet opened from the slot
 * picker's timezone chip. Mirrors the searchable settings-list: a search field,
 * a pinned Detected row for the device zone, and a Common list. The selected
 * checkmark uses the host's pillar [accent]; all other chrome stays neutral.
 *
 * Stateless over [query]/[selectedId]; the caller owns the text + selection and
 * re-times the slots beneath on change.
 */
@Composable
fun TimezonePickerSheet(
    options: List<TimezoneOption>,
    selectedId: String?,
    query: String,
    onQueryChange: (String) -> Unit,
    onSelect: (TimezoneOption) -> Unit,
    onDismiss: () -> Unit,
    sheetState: SheetState,
    modifier: Modifier = Modifier,
    detectedId: String? = null,
    accent: Color = PantopusColors.primary600,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = modifier.testTag(TIMEZONE_PICKER_TAG),
    ) {
        Header(accent = accent, onDone = onDismiss)
        SearchBox(query = query, onQueryChange = onQueryChange)

        // Non-blank queries search the full IANA database (capped), so any city
        // is findable; blank keeps the curated Common list.
        val filtered = remember(query, options) { searchTimezoneOptions(query, options) }
        when {
            filtered.isEmpty() -> NoMatch(query)
            query.isNotBlank() -> {
                SectionLabel("Results")
                ZoneList(rows = filtered, selectedId = selectedId, detectedId = detectedId, accent = accent, onSelect = onSelect)
            }
            else -> {
                val detected = options.firstOrNull { it.id == detectedId }
                if (detected != null) {
                    SectionLabel("Detected")
                    ZoneList(
                        rows = listOf(detected),
                        selectedId = selectedId,
                        detectedId = detectedId,
                        accent = accent,
                        onSelect = onSelect,
                    )
                }
                SectionLabel("Common")
                ZoneList(rows = filtered, selectedId = selectedId, detectedId = detectedId, accent = accent, onSelect = onSelect)
            }
        }
    }
}

@Composable
private fun Header(
    accent: Color,
    onDone: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(width = 56.dp, height = 1.dp))
        Text(
            text = "Time zone",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Done",
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = accent,
            modifier = Modifier.clickable(onClick = onDone),
        )
    }
}

@Composable
private fun SearchBox(
    query: String,
    onQueryChange: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = ICON_SM,
            tint = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(end = Spacing.s2),
        )
        Box(modifier = Modifier.weight(1f)) {
            if (query.isEmpty()) {
                Text(
                    text = "Search city or time zone",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextMuted,
                )
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                cursorBrush = SolidColor(PantopusColors.primary600),
                textStyle = PantopusTextStyle.small.copy(color = PantopusColors.appText),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (query.isNotEmpty()) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Clear search",
                size = ICON_SM,
                tint = PantopusColors.appTextMuted,
                modifier = Modifier.clickable { onQueryChange("") },
            )
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = Spacing.s5, vertical = Spacing.s2),
    )
}

@Composable
private fun ZoneList(
    rows: List<TimezoneOption>,
    selectedId: String?,
    detectedId: String?,
    accent: Color,
    onSelect: (TimezoneOption) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        rows.forEach { zone ->
            ZoneRow(
                zone = zone,
                selected = zone.id == selectedId,
                detected = zone.id == detectedId,
                accent = accent,
                onClick = { onSelect(zone) },
            )
        }
    }
}

@Composable
private fun ZoneRow(
    zone: TimezoneOption,
    selected: Boolean,
    detected: Boolean,
    accent: Color,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(width = 22.dp, height = 18.dp), contentAlignment = Alignment.CenterStart) {
            if (selected) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = "Selected", size = 18.dp, tint = accent)
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = zone.name, style = PantopusTextStyle.small, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                if (detected) {
                    Text(
                        text = "DETECTED",
                        style = PantopusTextStyle.overline,
                        color = PantopusColors.primary700,
                        modifier =
                            Modifier
                                .padding(start = Spacing.s2)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.primary50)
                                .padding(horizontal = Spacing.s2, vertical = Spacing.s0),
                    )
                }
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = zone.offset,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            Text(text = zone.localTime, style = PantopusTextStyle.overline, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun NoMatch(query: String) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(52.dp).clip(RoundedCornerShape(Radii.pill)).background(PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.SearchX,
                contentDescription = null,
                size = ICON_LG,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Text(
            text = "No time zones match \"$query\"",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(text = "Try a city name.", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
    }
}

private val OFFSET_TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
private val DEFAULT_ZONE_IDS =
    listOf(
        "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
        "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney", "UTC",
    )

/** Search results are capped so a broad query ("a") doesn't render 400 rows. */
private const val SEARCH_RESULT_CAP = 60

/** Live option row for an IANA zone [id], or null when the id doesn't resolve. */
fun timezoneOption(
    id: String,
    now: Instant = Instant.now(),
): TimezoneOption? =
    runCatching {
        val zoned = ZonedDateTime.ofInstant(now, ZoneId.of(id))
        val offsetId = zoned.offset.id.let { if (it == "Z") "GMT" else "GMT$it" }
        TimezoneOption(
            id = id,
            name = id.substringAfterLast('/').replace('_', ' '),
            offset = offsetId,
            localTime = zoned.format(OFFSET_TIME_FORMAT),
        )
    }.getOrNull()

/**
 * A curated set of common timezones with live offsets/local times, for callers
 * that don't supply their own. Snapshot tests should pass fixed options instead
 * (this reads the wall clock).
 */
fun defaultTimezoneOptions(now: Instant = Instant.now()): List<TimezoneOption> = DEFAULT_ZONE_IDS.mapNotNull { timezoneOption(it, now) }

/**
 * Search the FULL IANA zone database, not just the curated rows — "Karachi",
 * "Kolkata", etc. must be findable even though they aren't in the Common list.
 * Matching caller-supplied rows keep their friendlier names and lead the list;
 * the rest of the database fills in behind (id or city-name match), capped at
 * [SEARCH_RESULT_CAP]. Blank queries return [curated] unchanged.
 */
fun searchTimezoneOptions(
    query: String,
    curated: List<TimezoneOption>,
    zoneIds: Collection<String> = ZoneId.getAvailableZoneIds(),
    now: Instant = Instant.now(),
): List<TimezoneOption> {
    val q = query.trim()
    if (q.isEmpty()) return curated
    val curatedMatches = curated.filter { it.name.contains(q, ignoreCase = true) || it.id.contains(q, ignoreCase = true) }
    val curatedIds = curatedMatches.map { it.id }.toSet()
    val extra =
        zoneIds.asSequence()
            .filter { it !in curatedIds }
            .filter { id ->
                id.contains(q, ignoreCase = true) ||
                    id.substringAfterLast('/').replace('_', ' ').contains(q, ignoreCase = true)
            }
            .sorted()
            .mapNotNull { timezoneOption(it, now) }
            .take((SEARCH_RESULT_CAP - curatedMatches.size).coerceAtLeast(0))
            .toList()
    return (curatedMatches + extra).take(SEARCH_RESULT_CAP)
}
