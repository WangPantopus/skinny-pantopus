@file:Suppress("PackageNaming", "LongMethod")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.scheduling._shared.TimezoneOption
import app.pantopus.android.ui.screens.scheduling._shared.defaultTimezoneOptions
import app.pantopus.android.ui.screens.scheduling._shared.searchTimezoneOptions
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

private val OFFSET_TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)

/**
 * C7 Timezone selector — a thin local wrapper around the shared
 * [TimezonePickerSheet]. Owns the search-query state, the option list
 * (common zones + the device-detected zone + the currently selected zone), and
 * reports the chosen IANA id so the picker can re-fetch slots in the new zone.
 * The selected check tints to the host's pillar [accent].
 *
 * Frame 4 (Overridden): when the user has manually changed the timezone away
 * from their detected zone ([selectedId] != [detectedId] after an explicit pick),
 * an INFO banner appears below the search field with a "Reset to detected" link.
 * This banner is injected by [OverrideAwareTimezonePickerContent] — the shared
 * [TimezonePickerSheet] doesn't have a banner slot, so this composable owns the
 * full [ModalBottomSheet] body and delegates list rendering to
 * [TimezonePickerSheet]'s internal logic via the sheet-state + banner overlay.
 */
@Composable
fun TimezoneSelectorSheet(
    selectedId: String,
    detectedId: String,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
    accent: Color = PantopusColors.primary600,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }
    val options = remember(selectedId, detectedId) { buildTimezoneOptions(detectedId, selectedId) }

    // Frame 4 (Overridden): the banner shows whenever the currently-selected zone is
    // different from the detected zone — whether that change happened in this session or
    // was already in place when the sheet opened (e.g. the user changed zones and
    // reopened the sheet). Starts true if selectedId != detectedId on open.
    var overriddenId by remember(detectedId, selectedId) {
        mutableStateOf(selectedId.takeIf { it.isNotBlank() && it != detectedId })
    }
    val isOverridden = overriddenId != null && overriddenId != detectedId

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        OverrideAwareTzContent(
            options = options,
            selectedId = if (isOverridden) overriddenId!! else selectedId,
            query = query,
            onQueryChange = { query = it },
            onSelect = { option ->
                onSelect(option.id)
                overriddenId = option.id.takeIf { it != detectedId }
                onDismiss()
            },
            onDismiss = onDismiss,
            detectedId = detectedId.takeIf { it.isNotBlank() },
            accent = accent,
            isOverridden = isOverridden,
            onResetToDetected = {
                onSelect(detectedId)
                overriddenId = null
                onDismiss()
            },
        )
    }
}

/**
 * The body content of the timezone selector sheet, with the override banner
 * injected between the search field and the zone lists when [isOverridden] is
 * true. Mirrors the shared [TimezonePickerSheet] layout (Header → SearchBox →
 * optional OverrideBanner → zone sections) while keeping all state in the
 * caller so the banner tracks the live pick.
 */
@Composable
private fun OverrideAwareTzContent(
    options: List<TimezoneOption>,
    selectedId: String?,
    query: String,
    onQueryChange: (String) -> Unit,
    onSelect: (TimezoneOption) -> Unit,
    onDismiss: () -> Unit,
    detectedId: String?,
    accent: Color,
    isOverridden: Boolean,
    onResetToDetected: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = Spacing.s5),
    ) {
        // Header row (mirrors shared Header composable layout).
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            // Left spacer balances the "Done" text button so the title stays centred.
            Box(modifier = Modifier.padding(start = Spacing.s5))
            Text(
                text = "Time zone",
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center,
            )
            Text(
                text = "Done",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = accent,
                modifier = Modifier.clickable(onClick = onDismiss),
            )
        }

        // Search field (mirrors shared SearchBox composable).
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
                size = 15.dp,
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
                    size = 15.dp,
                    tint = PantopusColors.appTextMuted,
                    modifier = Modifier.clickable { onQueryChange("") },
                )
            }
        }

        // Frame 4 (Overridden): INFO banner — "You changed this from your detected zone."
        // Only rendered when the user has manually picked a zone other than the detected one.
        if (isOverridden) {
            TzOverrideBanner(accent = accent, onReset = onResetToDetected)
        }

        // Zone lists — same logic as the shared TimezonePickerSheet: a non-blank
        // query searches the full IANA database (capped), blank keeps Common.
        val filtered = remember(query, options) { searchTimezoneOptions(query, options) }
        when {
            filtered.isEmpty() -> {
                // No-match state (same as shared TimezonePickerSheet.NoMatch).
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s6),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .padding(bottom = Spacing.s1)
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.appSurfaceSunken)
                                .padding(Spacing.s3),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.SearchX,
                            contentDescription = null,
                            size = 24.dp,
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
            query.isNotBlank() -> {
                TzSectionLabel("Results")
                TzZoneListCard(rows = filtered, selectedId = selectedId, detectedId = detectedId, accent = accent, onSelect = onSelect)
            }
            else -> {
                val detected = options.firstOrNull { it.id == detectedId }
                if (detected != null) {
                    TzSectionLabel("Detected")
                    TzZoneListCard(
                        rows = listOf(detected),
                        selectedId = selectedId,
                        detectedId = detectedId,
                        accent = accent,
                        onSelect = onSelect,
                    )
                }
                TzSectionLabel("Common")
                TzZoneListCard(rows = filtered, selectedId = selectedId, detectedId = detectedId, accent = accent, onSelect = onSelect)
            }
        }
    }
}

/**
 * Frame 4 override banner: INFO card shown when the user has manually changed
 * the timezone away from the device-detected zone. Matches the design's
 * `INFO_BG / INFO_BORDER` treatment with an info icon, text, and a
 * "Reset to detected" link with a rotate-ccw icon (closest: [PantopusIcon.RefreshCw]).
 */
@Composable
private fun TzOverrideBanner(
    accent: Color,
    onReset: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.info,
            modifier = Modifier.padding(top = 1.dp),
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "You changed this from your detected zone.",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.info,
            )
            // "Reset to detected" link — accent color, rotate-ccw icon (RefreshCw is closest).
            Row(
                modifier = Modifier.padding(top = Spacing.s1).clickable(onClick = onReset),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.RefreshCw,
                    contentDescription = null,
                    size = 12.dp,
                    tint = accent,
                )
                Text(
                    text = "Reset to detected",
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = accent,
                )
            }
        }
    }
}

@Composable
private fun TzSectionLabel(text: String) {
    Text(
        text = text.uppercase(),
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = Spacing.s5, vertical = Spacing.s2),
    )
}

@Composable
private fun TzZoneListCard(
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
            TzZoneRow(
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
private fun TzZoneRow(
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
        Box(
            modifier = Modifier.size(width = 22.dp, height = 18.dp).padding(end = Spacing.s2),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (selected) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = "Selected", size = 18.dp, tint = accent)
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = zone.name,
                    style = PantopusTextStyle.small,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
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

/**
 * Common zones plus the detected + selected zones (so both always appear and
 * are reachable without searching). De-duplicated by IANA id.
 */
internal fun buildTimezoneOptions(
    detectedId: String,
    selectedId: String,
    now: Instant = Instant.now(),
): List<TimezoneOption> {
    val base = defaultTimezoneOptions(now)
    val byId = base.associateBy { it.id }.toMutableMap()
    listOf(detectedId, selectedId).forEach { id ->
        if (id.isNotBlank() && id !in byId) {
            optionFor(id, now)?.let { byId[id] = it }
        }
    }
    // Keep the curated order, with any extra (detected/selected) zones appended.
    return base + byId.values.filter { it.id !in base.map { b -> b.id } }
}

private fun optionFor(
    id: String,
    now: Instant,
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
