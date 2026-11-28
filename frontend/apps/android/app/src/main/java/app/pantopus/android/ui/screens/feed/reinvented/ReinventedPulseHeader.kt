@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
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
 * Over the map: the top row (the side menu, the scope pill, the chat button), the big List | Map switch (the middle
 * height reads as List), and the chips the place has. Drawn on the page's background at the List height; over the map
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
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Floating(!onList) { NavigationMenuButton(onClick = onOpenMenu, testTag = "reinventedPulse.menu") }
            ScopePill(state, onClick = { showsDial = true }, modifier = Modifier.weight(1f))
            Floating(!onList) { MessagesButton(testTag = "reinventedPulse.chat") }
        }
        if (sideBySide) SideBySideSwitch(height, atlas, onHeight, onAtlas) else ViewSwitch(height, atlas, onHeight, onAtlas)
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
                .padding(horizontal = Spacing.s4)
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
            fontSize = 16.sp,
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

/** The big List | Map switch. */
@Composable
private fun ViewSwitch(
    height: ReinventedHeight,
    atlas: Boolean,
    onHeight: (ReinventedHeight) -> Unit,
    onAtlas: (Boolean) -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
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
        SwitchButton("List", PantopusIcon.List, on = !atlas && height != ReinventedHeight.Map) {
            onAtlas(false)
            onHeight(ReinventedHeight.List)
        }
        SwitchButton("Map", PantopusIcon.Map, on = !atlas && height == ReinventedHeight.Map) {
            onAtlas(false)
            onHeight(ReinventedHeight.Map)
        }
        // My Atlas: the person's own kept Moments in the list's place, and on the map.
        SwitchButton("Atlas", PantopusIcon.Layers, on = atlas) {
            onAtlas(true)
            if (height == ReinventedHeight.Map) onHeight(ReinventedHeight.Middle)
        }
    }
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
