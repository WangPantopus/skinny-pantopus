@file:Suppress("MagicNumber", "LongMethod", "PackageNaming", "CyclomaticComplexMethod")

package app.pantopus.android.ui.screens.shared.grouped_list

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.ChannelGlyph
import app.pantopus.android.ui.components.ChannelHeader
import app.pantopus.android.ui.components.ChannelState
import app.pantopus.android.ui.components.ChannelTriad
import app.pantopus.android.ui.components.FuzzStop
import app.pantopus.android.ui.components.LocationFuzzSlider
import app.pantopus.android.ui.components.PauseBanner
import app.pantopus.android.ui.components.StealthBanner
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Callbacks the host view-model passes in. Mirror of the iOS
 * `GroupedListDataSource` protocol but expressed as separate
 * function references so this composable stays free of Hilt.
 */
data class GroupedListCallbacks(
    val onBack: (() -> Unit)? = null,
    val onTapRow: (String) -> Unit = {},
    val onToggleRow: (String, Boolean) -> Unit = { _, _ -> },
    val onSelectRadio: (String) -> Unit = {},
    val onSetSlider: (String, Int) -> Unit = { _, _ -> },
    /** A14.5 — tap on one chip of a channelTriad row. `Boolean` is the value after the flip. */
    val onToggleChannel: (String, ChannelGlyph, Boolean) -> Unit = { _, _, _ -> },
    /** A14.5 — tap on one option of a chips row. `String` is the raw (wire) option value. */
    val onSelectChip: (String, String) -> Unit = { _, _ -> },
    /** A14.5 — tap on the banner action pill (e.g. Resume). */
    val onTapBanner: () -> Unit = {},
    /** A14.7 — release the location-fuzz slider on `stop`. */
    val onSetFuzz: (String, FuzzStop) -> Unit = { _, _ -> },
    val onRetry: () -> Unit = {},
)

/** Top-level shell composable. */
@Composable
fun GroupedListScreen(
    title: String,
    state: GroupedListUiState,
    callbacks: GroupedListCallbacks = GroupedListCallbacks(),
    footerCaption: String? = null,
    /** A14.5 — optional banner pinned above the groups (paused state). */
    banner: GroupedListBanner? = null,
    /** A14.5 — dims every group card to 0.5 opacity (paused state). */
    contentDimmed: Boolean = false,
    /**
     * Optional hero / identity strip rendered above the first group
     * inside the scrollable area. Used by per-home settings screens
     * (A14.1) to host an identity card; null for vanilla settings
     * surfaces.
     */
    header: (@Composable () -> Unit)? = null,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("groupedList"),
    ) {
        TopBar(title = title, onBack = callbacks.onBack)
        when (state) {
            is GroupedListUiState.Loading -> LoadingFrame()
            is GroupedListUiState.Error -> ErrorFrame(message = state.message, onRetry = callbacks.onRetry)
            is GroupedListUiState.Loaded ->
                LoadedFrame(
                    groups = state.groups,
                    callbacks = callbacks,
                    footerCaption = footerCaption,
                    banner = banner,
                    contentDimmed = contentDimmed,
                    header = header,
                )
        }
    }
}

@Composable
private fun TopBar(
    title: String,
    onBack: (() -> Unit)?,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("groupedListBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
        } else {
            Box(modifier = Modifier.size(36.dp))
        }
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .weight(1f)
                    .semantics { heading() },
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        Box(modifier = Modifier.size(36.dp))
    }
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorder),
    )
}

@Composable
internal fun LoadingFrame() {
    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("groupedListLoading"),
        contentPadding = PaddingValues(vertical = Spacing.s3),
    ) {
        items(3) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .height(140.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
internal fun LoadedFrame(
    groups: List<GroupedListGroup>,
    callbacks: GroupedListCallbacks,
    footerCaption: String?,
    banner: GroupedListBanner? = null,
    contentDimmed: Boolean = false,
    header: (@Composable () -> Unit)? = null,
) {
    val optimistic = remember { mutableStateMapOf<String, RowControl>() }
    LaunchedEffect(groups) {
        // The view-model is the source of truth the moment it emits a
        // new projection: confirmed mutations re-emit the same value
        // (dropping the override is a no-op) and rolled-back ones
        // re-emit the server value, which has to win.
        optimistic.clear()
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().testTag("groupedListContent"),
        contentPadding = PaddingValues(bottom = Spacing.s6),
    ) {
        if (header != null) {
            item(key = "header") {
                Box(
                    modifier =
                        Modifier
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                            .testTag("groupedListHeader"),
                ) { header() }
            }
        }
        if (banner != null) {
            item(key = "banner") {
                val bannerModifier =
                    Modifier
                        .padding(start = Spacing.s3, end = Spacing.s3, top = Spacing.s3)
                        .testTag("groupedListBanner")
                when (banner.style) {
                    GroupedListBanner.Style.Pause ->
                        PauseBanner(
                            icon = banner.icon,
                            title = banner.title,
                            subtitle = banner.subtitle,
                            actionLabel = banner.actionLabel,
                            modifier = bannerModifier,
                            onAction = callbacks.onTapBanner,
                        )
                    GroupedListBanner.Style.Stealth ->
                        StealthBanner(
                            icon = banner.icon,
                            title = banner.title,
                            subtitle = banner.subtitle,
                            modifier = bannerModifier,
                        )
                }
            }
        }
        groups.forEach { group ->
            val regular = group.rows.filter { !it.destructive }
            val destructive = group.rows.filter { it.destructive }
            if (regular.isNotEmpty() || group.fuzz != null) {
                item(key = "overline_${group.id}") {
                    if (group.overline != null) {
                        Text(
                            text = group.overline.uppercase(),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = PantopusColors.appTextSecondary,
                            letterSpacing = 0.9.sp,
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(start = Spacing.s4, end = Spacing.s4, top = 18.dp, bottom = Spacing.s2)
                                    .testTag("groupedListOverline_${group.id}"),
                        )
                    } else {
                        Box(modifier = Modifier.height(8.dp))
                    }
                }
                item(key = "card_${group.id}") {
                    Card(
                        group = group,
                        rows = regular,
                        optimistic = optimistic,
                        callbacks = callbacks,
                        contentDimmed = contentDimmed,
                    )
                }
                if (group.helper != null) {
                    item(key = "helper_${group.id}") {
                        Text(
                            text = group.helper,
                            fontSize = 11.5.sp,
                            color = if (contentDimmed) PantopusColors.appTextMuted else PantopusColors.appTextSecondary,
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2)
                                    .testTag("groupedListHelper_${group.id}"),
                        )
                    }
                }
            }
            destructive.forEach { row ->
                item(key = "destructive_${row.id}") {
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .padding(start = Spacing.s3, end = Spacing.s3, top = 18.dp)
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.appSurface)
                                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                                .testTag("groupedListDestructive_${row.id}"),
                    ) {
                        RowItem(
                            row = row,
                            control = optimistic[row.id] ?: row.control,
                            isLast = true,
                            optimistic = optimistic,
                            callbacks = callbacks,
                        )
                    }
                }
            }
        }
        if (footerCaption != null) {
            item(key = "footer") {
                Text(
                    text = footerCaption,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 18.dp, start = Spacing.s4, end = Spacing.s4)
                            .testTag("groupedListFooter"),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun Card(
    group: GroupedListGroup,
    rows: List<GroupedListRow>,
    optimistic: androidx.compose.runtime.snapshots.SnapshotStateMap<String, RowControl>,
    callbacks: GroupedListCallbacks,
    contentDimmed: Boolean = false,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3)
                .alpha(if (contentDimmed) 0.5f else 1f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("groupedListCard_${group.id}"),
    ) {
        val fuzz = group.fuzz
        if (fuzz != null) {
            LocationFuzzSlider(
                leadIn = fuzz.leadIn,
                stop = fuzz.stop,
                onChange = { newStop -> callbacks.onSetFuzz(group.id, newStop) },
            )
        } else {
            if (group.showsChannelHeader) {
                ChannelHeader()
            }
            rows.forEachIndexed { index, row ->
                RowItem(
                    row = row,
                    control = optimistic[row.id] ?: row.control,
                    isLast = index == rows.size - 1,
                    optimistic = optimistic,
                    callbacks = callbacks,
                    contentDimmed = contentDimmed,
                )
                if (index < rows.size - 1) {
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .padding(start = Spacing.s4)
                                .background(PantopusColors.appBorder.copy(alpha = 0.6f)),
                    )
                }
            }
        }
    }
}

@Composable
private fun RowItem(
    row: GroupedListRow,
    control: RowControl,
    isLast: Boolean,
    optimistic: androidx.compose.runtime.snapshots.SnapshotStateMap<String, RowControl>,
    callbacks: GroupedListCallbacks,
    contentDimmed: Boolean = false,
) {
    val onClickRow = {
        when (control) {
            is RowControl.Chevron, is RowControl.ChipStatus -> callbacks.onTapRow(row.id)
            is RowControl.Radio -> {
                optimistic[row.id] = RowControl.Radio(isSelected = true)
                callbacks.onSelectRadio(row.id)
            }
            else ->
                if (row.destructive) {
                    callbacks.onTapRow(row.id)
                }
        }
    }
    // Triad + chip-strip rows own their chip taps; the row itself
    // isn't tappable.
    val ownsInnerTaps = control.ownsInnerTaps
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .then(if (ownsInnerTaps) Modifier else Modifier.clickable(onClick = onClickRow))
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .testTag(row.testTag ?: "groupedListRow_${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        row.leadingIcon?.let { leadingIcon ->
            Box(
                modifier =
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = leadingIcon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = row.label,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = if (row.destructive) PantopusColors.error else PantopusColors.appText,
                lineHeight = 20.sp,
            )
            if (row.subtext != null) {
                Text(
                    text = row.subtext,
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                    lineHeight = 16.sp,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            if (control is RowControl.Slider) {
                SliderControl(
                    rowId = row.id,
                    stops = control.stops,
                    index = control.index,
                    onSet = { newIndex ->
                        optimistic[row.id] = RowControl.Slider(control.stops, newIndex)
                        callbacks.onSetSlider(row.id, newIndex)
                    },
                )
            }
            if (control is RowControl.Chips) {
                ChipStrip(
                    rowId = row.id,
                    options = control.options,
                    selected = control.selected,
                    onSelect = { value ->
                        if (value != control.selected) {
                            optimistic[row.id] = RowControl.Chips(control.options, value)
                            callbacks.onSelectChip(row.id, value)
                        }
                    },
                )
            }
        }
        when (control) {
            is RowControl.Chevron -> ChevronGlyph()
            is RowControl.Toggle ->
                Switch(
                    checked = control.isOn,
                    onCheckedChange = { newValue ->
                        optimistic[row.id] = RowControl.Toggle(newValue)
                        callbacks.onToggleRow(row.id, newValue)
                    },
                    colors =
                        SwitchDefaults.colors(
                            checkedTrackColor = PantopusColors.primary600,
                            checkedThumbColor = Color.White,
                        ),
                    modifier = Modifier.testTag("groupedListToggle_${row.id}"),
                )
            is RowControl.Radio ->
                RadioGlyph(isSelected = control.isSelected, modifier = Modifier.testTag("groupedListRadio_${row.id}"))
            is RowControl.ChipStatus -> {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    ChipView(label = control.label, tone = control.tone, rowId = row.id)
                    if (control.includesChevron) ChevronGlyph()
                }
            }
            // Both render inline under the row label, not in the
            // trailing slot.
            is RowControl.Slider, is RowControl.Chips -> {}
            is RowControl.ChannelTriad ->
                ChannelTriad(
                    p = channelState(control.p, ChannelGlyph.P, control.locked),
                    e = channelState(control.e, ChannelGlyph.E, control.locked),
                    s = channelState(control.s, ChannelGlyph.S, control.locked),
                    onTap =
                        if (contentDimmed) {
                            null
                        } else {
                            { glyph -> flipChannel(row.id, control, glyph, optimistic, callbacks) }
                        },
                    modifier = Modifier.testTag("groupedListTriad_${row.id}"),
                )
        }
    }
    if (!isLast) Box(modifier = Modifier.size(0.dp))
}

private fun channelState(
    on: Boolean,
    glyph: ChannelGlyph,
    locked: Set<ChannelGlyph>,
): ChannelState =
    when {
        locked.contains(glyph) -> ChannelState.Locked
        on -> ChannelState.On
        else -> ChannelState.Off
    }

private fun flipChannel(
    rowId: String,
    control: RowControl.ChannelTriad,
    glyph: ChannelGlyph,
    optimistic: androidx.compose.runtime.snapshots.SnapshotStateMap<String, RowControl>,
    callbacks: GroupedListCallbacks,
) {
    if (control.locked.contains(glyph)) return
    val newP = if (glyph == ChannelGlyph.P) !control.p else control.p
    val newE = if (glyph == ChannelGlyph.E) !control.e else control.e
    val newS = if (glyph == ChannelGlyph.S) !control.s else control.s
    val newValue =
        when (glyph) {
            ChannelGlyph.P -> newP
            ChannelGlyph.E -> newE
            ChannelGlyph.S -> newS
        }
    optimistic[rowId] = RowControl.ChannelTriad(newP, newE, newS, control.locked)
    callbacks.onToggleChannel(rowId, glyph, newValue)
}

@Composable
private fun ChevronGlyph() {
    PantopusIconImage(
        icon = PantopusIcon.ChevronRight,
        contentDescription = null,
        size = Radii.xl,
        strokeWidth = 2.2f,
        tint = PantopusColors.appTextSecondary,
    )
}

@Composable
private fun RadioGlyph(
    isSelected: Boolean,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(22.dp)
                .border(
                    1.5.dp,
                    if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(11.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun ChipView(
    label: String,
    tone: RowControl.ChipTone,
    rowId: String,
) {
    val bg =
        when (tone) {
            RowControl.ChipTone.Success -> PantopusColors.successBg
            RowControl.ChipTone.Info -> PantopusColors.primary50
            RowControl.ChipTone.Neutral -> PantopusColors.appSurfaceSunken
            RowControl.ChipTone.Warning -> PantopusColors.warningBg
        }
    val fg =
        when (tone) {
            RowControl.ChipTone.Success -> PantopusColors.success
            RowControl.ChipTone.Info -> PantopusColors.primary700
            RowControl.ChipTone.Neutral -> PantopusColors.appTextStrong
            RowControl.ChipTone.Warning -> PantopusColors.warning
        }
    Box(
        modifier =
            Modifier
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(Radii.pill))
                .background(bg)
                .padding(horizontal = Spacing.s2, vertical = 3.dp)
                .testTag("groupedListChip_$rowId"),
    ) {
        Text(
            text = label.uppercase(),
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = fg,
            letterSpacing = 0.4.sp,
        )
    }
}

/**
 * A14.5 — horizontally scrolling single-select value chips under the
 * row label (briefing send time, quiet-hours bounds). The raw option
 * string is both the label and the wire value.
 */
@Composable
private fun ChipStrip(
    rowId: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s2)
                .horizontalScroll(rememberScrollState())
                .testTag("groupedListChipStrip_$rowId"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        options.forEach { option ->
            val isActive = option == selected
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (isActive) PantopusColors.primary50 else PantopusColors.appSurfaceSunken)
                        .border(
                            1.dp,
                            if (isActive) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        )
                        .clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .semantics { this.contentDescription = option }
                        .testTag("groupedListChipOption_${rowId}_$option"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = option,
                    fontSize = 13.sp,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
                    color = if (isActive) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun SliderControl(
    rowId: String,
    stops: List<String>,
    index: Int,
    onSet: (Int) -> Unit,
) {
    val count = stops.size.coerceAtLeast(2)
    val active = index.coerceIn(0, count - 1)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .testTag("groupedListSlider_$rowId"),
    ) {
        var widthPx = remember { 0f }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(26.dp)
                    .onGloballyPositioned { coords -> widthPx = coords.size.width.toFloat() }
                    .pointerInput(stops, active) {
                        detectTapGestures { offset ->
                            if (widthPx <= 0) return@detectTapGestures
                            val fraction = (offset.x / widthPx).coerceIn(0f, 1f)
                            val target = (fraction * (count - 1)).toInt()
                            if (target != active) onSet(target)
                        }
                    },
        ) {
            // Track
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(4.dp)
                        .align(Alignment.CenterStart)
                        .clip(RoundedCornerShape(2.dp))
                        .background(PantopusColors.appBorder),
            )
            // Filled
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth(active.toFloat() / (count - 1).toFloat())
                        .height(4.dp)
                        .align(Alignment.CenterStart)
                        .clip(RoundedCornerShape(2.dp))
                        .background(PantopusColors.primary600),
            )
            // Stops
            for (i in 0 until count) {
                val fraction = i.toFloat() / (count - 1).toFloat()
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth(fraction)
                            .height(26.dp),
                    contentAlignment = Alignment.CenterEnd,
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(
                                    if (i <= active) PantopusColors.primary600 else PantopusColors.appBorder,
                                ),
                    )
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 2.dp)) {
            stops.forEachIndexed { i, label ->
                Text(
                    text = label,
                    fontSize = 11.sp,
                    fontWeight = if (i == active) FontWeight.Bold else FontWeight.Medium,
                    color = if (i == active) PantopusColors.appText else PantopusColors.appTextSecondary,
                )
                if (i < stops.size - 1) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(Spacing.s6)
                .testTag("groupedListError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Box(modifier = Modifier.height(12.dp))
        Text(
            text = "Couldn't load",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Box(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = PantopusColors.appTextSecondary,
        )
        Box(modifier = Modifier.height(16.dp))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .heightIn(min = 44.dp)
                    .semantics { this.contentDescription = "Try again" }
                    .testTag("groupedListRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}
