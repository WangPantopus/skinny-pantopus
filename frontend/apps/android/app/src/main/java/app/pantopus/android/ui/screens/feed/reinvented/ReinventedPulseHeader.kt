@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.MessagesButton
import app.pantopus.android.ui.components.NavigationMenuButton
import app.pantopus.android.ui.screens.feed.living.LivingAskBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * Over the map: the top row (the side menu, the scope pill, the chat button), the Map | Atlas switch (on a wide window
 * still List | Map | Atlas), and the chips the place has. Drawn on the page's background at the List height; over the map
 * each control floats on its own. Side by side on a wide window ([sideBySide]) it sits over the list's column, and both
 * List and Map read as lit while both are shown.
 */
@Composable
@Suppress("LongParameterList") // What it shows and the five choices it offers.
internal fun ReinventedPulseHeader(
    height: ReinventedHeight,
    state: ReinventedPulseState,
    onOpenMenu: () -> Unit,
    onHeight: (ReinventedHeight) -> Unit,
    onPickChip: (String) -> Unit,
    onPickReach: (String, Int) -> Unit,
    time: String,
    onPickTime: (String) -> Unit,
    atlas: Boolean = false,
    onAtlas: (Boolean) -> Unit = {},
    sideBySide: Boolean = false,
    onPickCircle: (String, String) -> Unit = { _, _ -> },
    lens: ReinventedLens = ReinventedLens(),
    lensActions: ReinventedLensActions = ReinventedLensActions({}, {}),
    modifier: Modifier = Modifier,
) {
    var showsDial by rememberSaveable { mutableStateOf(false) }
    // Over the list (its own background, buttons in line) rather than floating over the map.
    val onList = height == ReinventedHeight.List || (sideBySide && height == ReinventedHeight.Middle)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(if (onList) PantopusColors.appBg else Color.Transparent)
                .statusBarsPadding()
                .padding(bottom = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (!sideBySide) {
            // PHASE-6 A1: one row, 44 dp: the side menu, the scope pill, Map | Atlas, the lens, the chat button. The time
            // row, Ask the map and Listen live in the rail at the right edge now.
            TopLine(
                TopLineParts(height, state, atlas, onList, lens, lensActions),
                onOpenMenu = onOpenMenu,
                onDial = { showsDial = true },
                onHeight = onHeight,
                onAtlas = onAtlas,
            )
            // The place's chips under the top line until the Filters sheet takes them; none over the map alone or in My Atlas.
            val chipsHere = state.chips.size > 1 && state.reach != ReinventedPulseViewModel.EXPLORE
            if (!atlas && height != ReinventedHeight.Map && chipsHere) ChipsRow(state, onPickChip)
            return@Column
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Floating(!onList) { NavigationMenuButton(onClick = onOpenMenu, testTag = "reinventedPulse.menu") }
            ScopePill(state, onClick = { showsDial = true }, modifier = Modifier.weight(1f))
            Floating(!onList) { MessagesButton(testTag = "reinventedPulse.chat") }
        }
        SideBySideSwitch(height, atlas, onHeight, onAtlas)
        // My Atlas has no chips and no time row.
        if (atlas) return@Column
        if (height == ReinventedHeight.Map) {
            ReinventedTimeRow(time, onPickTime)
            LivingAskBar()
        } else if (state.chips.size > 1 && state.reach != ReinventedPulseViewModel.EXPLORE) {
            ChipsRow(state, onPickChip)
        }
    }
    if (showsDial) {
        ReinventedReachDial(
            reach = state.reach,
            miles = state.miles,
            onPick = { reach, miles ->
                showsDial = false
                onPickReach(reach, miles)
            },
            onDismiss = { showsDial = false },
            circleId = state.circleId,
            onPickCircle = { id, name ->
                showsDial = false
                onPickCircle(id, name)
            },
        )
    }
}

/** What the phone's top line shows. */
private class TopLineParts(
    val height: ReinventedHeight,
    val state: ReinventedPulseState,
    val atlas: Boolean,
    /** Drawn on the page's background (the sheet is full) rather than floating over the map. */
    val onList: Boolean,
    val lens: ReinventedLens,
    val lensActions: ReinventedLensActions,
)

/** The phone's top line, one row 44 dp high; while the lens is open, its field takes the row. */
@Composable
private fun TopLine(
    parts: TopLineParts,
    onOpenMenu: () -> Unit,
    onDial: () -> Unit,
    onHeight: (ReinventedHeight) -> Unit,
    onAtlas: (Boolean) -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = Spacing.s2).testTag("reinventedPulse.topLine")) {
        // On a narrow phone the switch shows its two icons only, so the town's name keeps room.
        val narrow = maxWidth < 380.dp
        Row(
            modifier = Modifier.fillMaxWidth().height(44.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            if (parts.lens.open) {
                ReinventedLensField(parts.lens, parts.lensActions)
                return@Row
            }
            Floating(!parts.onList) {
                NavigationMenuButton(onClick = onOpenMenu, testTag = "reinventedPulse.menu", modifier = Modifier.size(44.dp))
            }
            ScopePill(parts.state, onClick = onDial, modifier = Modifier.weight(1f), compact = true)
            SmallSwitch(parts.height, parts.atlas, narrow, onHeight, onAtlas)
            ReinventedLensButton(parts.lens, floating = !parts.onList)
            Floating(!parts.onList) { MessagesButton(testTag = "reinventedPulse.chat", modifier = Modifier.size(44.dp)) }
        }
    }
}

/**
 * Map | Atlas, small, in the top line (PHASE-6 A1). Map leaves My Atlas and, when the sheet is full, lowers it to half so
 * the map shows; Atlas shows the person's own kept Moments in the sheet.
 */
@Composable
private fun SmallSwitch(
    height: ReinventedHeight,
    atlas: Boolean,
    narrow: Boolean,
    onHeight: (ReinventedHeight) -> Unit,
    onAtlas: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Row(
        modifier =
            Modifier
                .height(36.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(2.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        SmallSwitchButton("Map", PantopusIcon.Map, on = !atlas, narrow) {
            onAtlas(false)
            if (height == ReinventedHeight.List) onHeight(ReinventedHeight.Middle)
        }
        SmallSwitchButton("Atlas", PantopusIcon.Layers, on = atlas, narrow) {
            onAtlas(true)
            if (height == ReinventedHeight.Map) onHeight(ReinventedHeight.Middle)
        }
    }
}

@Composable
private fun SmallSwitchButton(
    title: String,
    icon: PantopusIcon,
    on: Boolean,
    narrow: Boolean,
    onClick: () -> Unit,
) {
    val color = if (on) Color.White else PantopusColors.appText
    Box(
        modifier =
            Modifier
                .fillMaxHeight()
                .clip(CircleShape)
                .background(if (on) PantopusColors.primary600 else Color.Transparent)
                .selectable(selected = on, role = Role.Tab, onClick = onClick)
                .semantics { contentDescription = title }
                .padding(horizontal = if (narrow) 8.dp else 10.dp)
                .testTag("reinventedPulse.view.${title.lowercase()}"),
        contentAlignment = Alignment.Center,
    ) {
        if (narrow) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = color)
        } else {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = color)
        }
    }
}

/** A round button that stands on its own over the map. */
@Composable
private fun Floating(
    over: Boolean,
    content: @Composable () -> Unit,
) {
    Box(modifier = if (over) Modifier.clip(CircleShape).background(PantopusColors.appSurface) else Modifier) { content() }
}

/** The town's name (or Close circle): it opens the reach dial. */
@Composable
private fun ScopePill(
    state: ReinventedPulseState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    val title = scopeTitle(state)
    val shape = RoundedCornerShape(percent = 50)
    Row(
        modifier =
            modifier
                .height(44.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .selectable(selected = false, role = Role.Button, onClick = onClick)
                .semantics(mergeDescendants = true) { contentDescription = "Showing $title. Change what Pulse shows" }
                .padding(horizontal = if (compact) Spacing.s3 else Spacing.s4)
                .testTag("reinventedPulse.scope"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val icon =
            when (state.reach) {
                ReinventedPulseViewModel.CLOSE -> PantopusIcon.Users
                ReinventedPulseViewModel.EXPLORE -> PantopusIcon.Globe
                else -> PantopusIcon.MapPin
            }
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = PantopusColors.primary600)
        Text(
            text = title,
            fontSize = if (compact) 14.sp else 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(icon = PantopusIcon.ChevronDown, contentDescription = null, size = 16.dp, tint = PantopusColors.appText)
    }
}

/** "Camas · 25 mi", "Around me" before the town is known, or "Close circle". */
internal fun scopeTitle(state: ReinventedPulseState): String =
    when (state.reach) {
        ReinventedPulseViewModel.CLOSE -> state.circleName ?: "Close circle"
        ReinventedPulseViewModel.EXPLORE -> "Explore"
        else -> state.placeLabel?.let { "$it · ${state.miles} mi" } ?: "Around me"
    }

/**
 * The switch side by side: List and Map are both lit while both are shown; a tap on one shows it alone, and a tap on the
 * lit one again goes back to both.
 */
@Composable
private fun SideBySideSwitch(
    height: ReinventedHeight,
    atlas: Boolean,
    onHeight: (ReinventedHeight) -> Unit,
    onAtlas: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    val listOn = !atlas && height != ReinventedHeight.Map
    val mapOn = !atlas && height != ReinventedHeight.List
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // Out of My Atlas, either goes back to both.
        SwitchButton("List", PantopusIcon.List, on = listOn) {
            onAtlas(false)
            onHeight(if (atlas || height == ReinventedHeight.List) ReinventedHeight.Middle else ReinventedHeight.List)
        }
        SwitchButton("Map", PantopusIcon.Map, on = mapOn) {
            onAtlas(false)
            onHeight(if (atlas || height == ReinventedHeight.Map) ReinventedHeight.Middle else ReinventedHeight.Map)
        }
        // My Atlas: the person's own kept Moments in the list's column, beside the map of them.
        SwitchButton("Atlas", PantopusIcon.Layers, on = atlas) {
            onAtlas(true)
            onHeight(ReinventedHeight.Middle)
        }
    }
}

@Composable
private fun RowScope.SwitchButton(
    title: String,
    icon: PantopusIcon,
    on: Boolean,
    onClick: () -> Unit,
) {
    val color = if (on) Color.White else PantopusColors.appText
    Row(
        modifier =
            Modifier
                .weight(1f)
                .heightIn(min = 40.dp)
                .clip(CircleShape)
                .background(if (on) PantopusColors.primary600 else Color.Transparent)
                .selectable(selected = on, role = Role.Tab, onClick = onClick)
                .testTag("reinventedPulse.view.${title.lowercase()}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = color)
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = color)
    }
}

/** The chips the place has something for; an empty chip is not drawn. */
@Composable
private fun ChipsRow(
    state: ReinventedPulseState,
    onPick: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = Spacing.s4),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        state.chips.forEach { chip ->
            val on = state.chip == chip
            val shape = RoundedCornerShape(percent = 50)
            Text(
                text = reinventedChipTitle(chip),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (on) Color.White else PantopusColors.appText,
                modifier =
                    Modifier
                        .clip(shape)
                        .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(1.dp, if (on) Color.Transparent else PantopusColors.appBorder, shape)
                        .selectable(selected = on, role = Role.Tab) { onPick(chip) }
                        .padding(horizontal = Spacing.s3, vertical = 7.dp)
                        .testTag("reinventedPulse.chip.$chip"),
            )
        }
    }
}
