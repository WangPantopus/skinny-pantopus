@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.testTagsAsResourceId
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.R
import app.pantopus.android.data.moments.MomentHeight
import app.pantopus.android.ui.screens.moments.components.MomentSelfFace
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.GoogleMapOptions
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.rememberCameraPositionState
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.pow

/** The four durations (board P3), in hours. */
private val HOURS = listOf(1, 6, 24, 48)

/**
 * The Post sheet (boards P3 and P4): a small map with the pin, the place's name and "Exact spot", "Show the area
 * instead", how long, who sees it, a caption for a photo or video, and Post. At your own home the sheet says so first.
 */
@Composable
fun MomentsPostSheet(
    state: MomentsComposeUiState,
    avatarUrl: String?,
    onShowArea: (Boolean) -> Unit,
    onHours: (Int) -> Unit,
    onAudience: (String) -> Unit,
    onCaption: (String) -> Unit,
    onPost: () -> Unit,
    modifier: Modifier = Modifier,
    onPlace: (String) -> Unit = {},
    onFindPlace: () -> Unit = {},
    onNoLocation: (Boolean) -> Unit = {},
    onShowHeight: (Boolean) -> Unit = {},
) {
    // A venue picked in the place picker moves the pin off the home (the server checks its point again).
    val venue = state.pickedVenue
    // "Don't show where": no pin, no map, connections only.
    val unplaced = state.noLocationOn
    val atHome = state.place?.atHome == true && venue == null && !unplaced
    val density = LocalDensity.current
    val keyboardPx = WindowInsets.ime.getBottom(density)
    val belowPx = WindowInsets.navigationBars.getBottom(density)
    val keyboardPadding = with(density) { (keyboardPx - belowPx).coerceAtLeast(0).toDp() }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(SheetShadow, RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                .clip(RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                .background(PantopusColors.appSurface)
                .padding(bottom = keyboardPadding)
                .testTag("moments.post")
                .semantics { contentDescription = "Post your Moment" },
    ) {
        // Everything but Post scrolls; Post stays at the bottom of the sheet, in reach whatever the screen's height.
        val scroll = rememberScrollState()
        // The caption is the sheet's one text box, at its end: with the keyboard up, the whole box shows above Post.
        LaunchedEffect(keyboardPx > 0, scroll.maxValue) { if (keyboardPx > 0) scroll.animateScrollTo(scroll.maxValue) }
        Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(scroll)) {
            Box(modifier = Modifier.fillMaxWidth().height(24.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier =
                        Modifier.size(width = 36.dp, height = 5.dp).clip(RoundedCornerShape(3.dp)).background(PantopusColors.appBorder),
                )
            }
            state.pin?.takeIf { !unplaced }?.let { pin ->
                PinMap(
                    latitude = venue?.latitude ?: pin.latitude,
                    longitude = venue?.longitude ?: pin.longitude,
                    area = state.showArea,
                    avatarUrl = avatarUrl,
                )
            }
            // The place others will read: the venue's name (or the one picked), or the town with "Show the area instead".
            val label =
                when {
                    unplaced -> NO_LOCATION
                    atHome && !state.showArea -> "Your home"
                    state.showArea -> state.place?.areaLabel ?: state.place?.placeLabel ?: "Your area"
                    else -> venue?.name ?: state.pickedPlace?.label ?: state.place?.placeLabel ?: "Where you are"
                }
            PlaceRow(state = state, label = label, atHome = atHome, onPlace = onPlace, onFindPlace = onFindPlace)
            // An album photo or video from more than a day ago: everyone sees when it was taken.
            state.takenLine?.let { taken ->
                Row(
                    modifier =
                        Modifier
                            .padding(start = Spacing.s5, end = Spacing.s5, top = 2.dp)
                            .fillMaxWidth()
                            .testTag("moments.post.taken")
                            .clearAndSetSemantics { contentDescription = "$taken. Everyone will see this date." },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Calendar,
                        contentDescription = null,
                        size = 18.dp,
                        strokeWidth = 2.2f,
                        tint = PantopusColors.appTextSecondary,
                    )
                    Text(text = taken, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                    Text(
                        text = "Everyone will see this date",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            if (atHome && !state.showArea) {
                Row(
                    modifier =
                        Modifier
                            .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2)
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(PantopusColors.momentHomeNoticeBg)
                            .border(1.dp, PantopusColors.momentHomeNoticeBorder, RoundedCornerShape(14.dp))
                            .padding(horizontal = 14.dp, vertical = Spacing.s3)
                            .testTag("moments.post.home")
                            .semantics(mergeDescendants = true) {},
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Home,
                        contentDescription = null,
                        size = 20.dp,
                        strokeWidth = 2.2f,
                        tint = PantopusColors.momentHomeNoticeIcon,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            text = "This is your home. People will see the pin on it.",
                            fontSize = 14.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.momentHomeNoticeText,
                        )
                        Text(
                            text = "Turn on Show the area instead to show only the area.",
                            fontSize = 13.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
            if (!unplaced) {
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = Spacing.s5)
                            .padding(top = 6.dp)
                            .heightIn(min = 52.dp)
                            .clickable(role = Role.Switch) { onShowArea(!state.showArea) }
                            .testTag("moments.post.area")
                            .clearAndSetSemantics {
                                contentDescription = "Show the area instead. $AREA_LINE"
                                role = Role.Switch
                                selected = state.showArea
                            },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                        Text(
                            text = "Show the area instead",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appText,
                        )
                        Text(
                            text = AREA_LINE,
                            fontSize = 12.5.sp,
                            lineHeight = 16.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    Switch(
                        checked = state.showArea,
                        onCheckedChange = onShowArea,
                        colors =
                            SwitchDefaults.colors(
                                checkedTrackColor = PantopusColors.primary600,
                                uncheckedTrackColor = PantopusColors.momentSwitchTrack,
                                uncheckedBorderColor = PantopusColors.momentSwitchTrack,
                                uncheckedThumbColor = Color.White,
                            ),
                    )
                }
            }
            NoLocationRow(state = state, onNoLocation = onNoLocation)
            state.heightFeet?.takeIf { state.offersHeight }?.let { feet ->
                HeightRow(feet = feet, on = state.showHeight, onShowHeight = onShowHeight)
            }
            SectionLabel("How long")
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).semantics { contentDescription = "How long" },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                HOURS.forEach { hours ->
                    val on = hours == state.hours
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .height(40.dp)
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(if (on) PantopusColors.primary600 else Color.Transparent)
                                .border(1.dp, if (on) PantopusColors.primary600 else PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                                .clickable(role = Role.RadioButton) { onHours(hours) }
                                .testTag("moments.post.hours.$hours")
                                .clearAndSetSemantics {
                                    contentDescription = if (hours == 1) "1 hour" else "$hours hours"
                                    role = Role.RadioButton
                                    selected = on
                                },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "${hours}h",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (on) Color.White else PantopusColors.appText,
                        )
                    }
                }
            }
            SectionLabel("Who sees it")
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4)
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(3.dp)
                        .semantics { contentDescription = "Who sees it" },
                horizontalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                listOf("nearby" to "Everyone nearby", "connections" to "My connections").forEach { (key, text) ->
                    // A Moment with no location goes only to connections: "Everyone nearby" needs a place.
                    val on = key == if (unplaced) "connections" else state.audience
                    val usable = !unplaced || key == "connections"
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .fillMaxSize()
                                .then(if (on) Modifier.pantopusShadow(SegmentShadow, RoundedCornerShape(9.dp)) else Modifier)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (on) Color.White else Color.Transparent)
                                .clickable(enabled = usable, role = Role.RadioButton) { onAudience(key) }
                                .testTag("moments.post.audience.$key")
                                .clearAndSetSemantics {
                                    contentDescription = text
                                    role = Role.RadioButton
                                    selected = on
                                },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = text,
                            fontSize = 14.5.sp,
                            fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                            color =
                                when {
                                    on -> PantopusColors.appText
                                    usable -> PantopusColors.appTextSecondary
                                    else -> PantopusColors.appTextSecondary.copy(alpha = 0.45f)
                                },
                        )
                    }
                }
            }
            if (state.media != null) {
                Row(
                    modifier =
                        Modifier
                            .padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp)
                            .fillMaxWidth()
                            .height(46.dp)
                            .clip(RoundedCornerShape(Radii.lg))
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    BasicTextField(
                        value = state.caption,
                        onValueChange = onCaption,
                        singleLine = true,
                        textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
                        cursorBrush = SolidColor(PantopusColors.primary600),
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                        modifier = Modifier.weight(1f).testTag("moments.post.caption").semantics { contentDescription = "Caption" },
                        decorationBox = { field ->
                            Box(contentAlignment = Alignment.CenterStart) {
                                if (state.caption.isEmpty()) {
                                    Text("Add a caption", fontSize = 15.sp, color = PantopusColors.appTextSecondary)
                                }
                                field()
                            }
                        },
                    )
                    Text(
                        text = "${state.caption.length} / 100",
                        fontSize = 12.5.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.testTag("moments.post.captionCount"),
                    )
                }
            }
        }
        state.notice?.let { notice ->
            Text(
                text = notice,
                fontSize = 14.sp,
                color = PantopusColors.error,
                modifier = Modifier.padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s3).testTag("moments.post.error"),
            )
        }
        Spacer(Modifier.height(14.dp))
        SheetPrimaryButton(
            label =
                when {
                    state.posting -> "Posting…"
                    // Several picked together: which one this is. The hours are on the sheet's own row either way.
                    state.pickedTogether > 1 -> "Post ${state.pickedAt} of ${state.pickedTogether}"
                    else -> "Post · shows for ${if (state.hours == 1) "1 hour" else "${state.hours} hours"}"
                },
            onClick = onPost,
            enabled = !state.posting && (state.pin != null || unplaced),
            modifier = Modifier.padding(horizontal = Spacing.s4).testTag("moments.post.submit"),
        )
        Spacer(Modifier.height(Spacing.s6))
    }
}

/**
 * The place's name and "Exact spot" or "Area". For an exact pin the row is a button with a small chevron: when more
 * than one name fits the spot (contract v3, place-preview's `places`, the automatic one first) a short list of them,
 * then "Find another place"; otherwise, and at home, it opens the place picker right away (the Pulse composer's, around
 * the pin: the coffee shop, the school or the stadium the photo was taken in). The one picked is what everyone reads.
 */
@Composable
private fun PlaceRow(
    state: MomentsComposeUiState,
    label: String,
    atHome: Boolean,
    onPlace: (String) -> Unit,
    onFindPlace: () -> Unit,
) {
    val tappable = state.canFindPlace
    val quickPicks = state.canPickPlace
    var choosing by remember { mutableStateOf(false) }
    if (!tappable) choosing = false
    Box(
        modifier =
            if (tappable) {
                Modifier
                    .fillMaxWidth()
                    .clickable(role = Role.Button, onClickLabel = "Change the place") {
                        if (quickPicks) choosing = true else onFindPlace()
                    }.testTag("moments.post.placeChange")
                    .semantics { contentDescription = "Place: $label, exact spot" }
            } else {
                Modifier.fillMaxWidth()
            },
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(start = Spacing.s5, end = Spacing.s5, top = 10.dp)
                    .heightIn(min = 32.dp)
                    .testTag("moments.post.place"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon =
                    when {
                        state.noLocationOn -> PantopusIcon.MapPinOff
                        atHome && !state.showArea -> PantopusIcon.Home
                        else -> PantopusIcon.MapPin
                    },
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = label,
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text(
                text =
                    when {
                        state.noLocationOn -> "Not on the map"
                        state.showArea -> "Area"
                        else -> "Exact spot"
                    },
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
            if (tappable) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronDown,
                    contentDescription = null,
                    size = 16.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
        if (quickPicks) {
            val venue = state.pickedVenue
            val selectedKey = if (venue != null) null else state.pickedPlace?.key ?: state.placeChoices.firstOrNull()?.key
            DropdownMenu(
                expanded = choosing,
                onDismissRequest = { choosing = false },
                modifier = Modifier.semantics { testTagsAsResourceId = true }.testTag("moments.post.places"),
            ) {
                Text(
                    text = "Name this place",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2).semantics { heading() },
                )
                // The venue picked in the place picker leads the list while it names the Moment.
                venue?.let { picked ->
                    PlaceChoiceItem(label = picked.name, on = true, tag = "moments.post.place.venue") { choosing = false }
                }
                state.placeChoices.forEachIndexed { index, choice ->
                    PlaceChoiceItem(label = choice.label, on = choice.key == selectedKey, tag = "moments.post.place.$index") {
                        choosing = false
                        onPlace(choice.key)
                    }
                }
                DropdownMenuItem(
                    text = {
                        Text(
                            text = "Find another place",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.primary600,
                        )
                    },
                    onClick = {
                        choosing = false
                        onFindPlace()
                    },
                    leadingIcon = {
                        PantopusIconImage(
                            icon = PantopusIcon.Search,
                            contentDescription = null,
                            size = 20.dp,
                            strokeWidth = 2.2f,
                            tint = PantopusColors.primary600,
                            modifier = Modifier.padding(horizontal = 12.dp),
                        )
                    },
                    modifier = Modifier.widthIn(min = 240.dp, max = 320.dp).testTag("moments.post.findPlace"),
                )
            }
        }
    }
}

/** One name in the place list, with its radio button. */
@Composable
private fun PlaceChoiceItem(
    label: String,
    on: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    DropdownMenuItem(
        text = {
            Text(
                text = label,
                fontSize = 15.sp,
                fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        },
        onClick = onClick,
        leadingIcon = {
            RadioButton(
                selected = on,
                onClick = null,
                colors = RadioButtonDefaults.colors(selectedColor = PantopusColors.primary600),
            )
        },
        modifier =
            Modifier
                .widthIn(min = 240.dp, max = 320.dp)
                .testTag(tag)
                .semantics {
                    role = Role.RadioButton
                    selected = on
                },
    )
}

/**
 * "Don't show where" (founder 2026-11-11): no pin and not on the map; only connections see it. It stays on when there's
 * no pin at all (location off), and it needs a connection.
 */
@Composable
private fun NoLocationRow(
    state: MomentsComposeUiState,
    onNoLocation: (Boolean) -> Unit,
) {
    val noConnections = state.hasConnections == false
    val enabled = !state.noLocationLocked && (!noConnections || state.noLocationOn)
    val line =
        when {
            noConnections && !state.noLocationOn -> "Add a connection first. Only your connections see a Moment with no location."
            state.noLocationLocked -> "Location is off, so only your connections see it. It isn't on the map."
            else -> "Only your connections see it. It isn't on the map."
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = 6.dp)
                .heightIn(min = 52.dp)
                .clickable(enabled = enabled, role = Role.Switch) { onNoLocation(!state.noLocationOn) }
                .testTag("moments.post.noLocation")
                .clearAndSetSemantics {
                    contentDescription = "Don't show where. $line"
                    role = Role.Switch
                    selected = state.noLocationOn
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = "Don't show where", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            Text(text = line, fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
        }
        Switch(
            checked = state.noLocationOn,
            onCheckedChange = onNoLocation,
            enabled = enabled,
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    uncheckedTrackColor = PantopusColors.momentSwitchTrack,
                    uncheckedBorderColor = PantopusColors.momentSwitchTrack,
                    uncheckedThumbColor = Color.White,
                ),
        )
    }
}

/**
 * "Show height" (board H1): how high above sea level the phone, or the album photo, says this is, as everyone will read
 * it (rounded to 10 ft). Only on the sheet where it may be shown ([MomentsComposeUiState.offersHeight]).
 */
@Composable
private fun HeightRow(
    feet: Int,
    on: Boolean,
    onShowHeight: (Boolean) -> Unit,
) {
    val line = MomentHeight.line(feet)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = 6.dp)
                .heightIn(min = 52.dp)
                .clickable(role = Role.Switch) { onShowHeight(!on) }
                .testTag("moments.post.height")
                .clearAndSetSemantics {
                    contentDescription = "Show height. $line"
                    role = Role.Switch
                    selected = on
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = "Show height", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            Text(text = line, fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
        }
        Switch(
            checked = on,
            onCheckedChange = onShowHeight,
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    uncheckedTrackColor = PantopusColors.momentSwitchTrack,
                    uncheckedBorderColor = PantopusColors.momentSwitchTrack,
                    uncheckedThumbColor = Color.White,
                ),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontSize = 13.sp,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(start = Spacing.s5, top = 14.dp, bottom = 10.dp),
    )
}

/**
 * The mini map with the pin (board P3): a still Google map in lite mode, your face in the new-Moment ring on the spot.
 * With "Show the area instead" there is no pin on your spot: the area others may see the pin in (within about half a
 * mile) is tinted, which at this map's street-level zoom is all of it.
 */
@Composable
private fun PinMap(
    latitude: Double,
    longitude: Double,
    area: Boolean,
    avatarUrl: String?,
) {
    val target = LatLng(latitude, longitude)
    val zoom = MINI_ZOOM
    val camera = rememberCameraPositionState(key = "$latitude,$longitude,$area") { position = CameraPosition.fromLatLngZoom(target, zoom) }
    val options = remember { GoogleMapOptions().liteMode(true) }
    val context = LocalContext.current
    // The same quiet map as the Moments tab's.
    val properties =
        remember(context) { MapProperties(mapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, R.raw.nearby_map_style)) }
    Box(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .height(150.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .testTag("moments.post.map")
                .clearAndSetSemantics {
                    contentDescription = if (area) "Map with the area around your Moment" else "Map with your Moment's pin"
                },
    ) {
        key(area) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = camera,
                googleMapOptionsFactory = { options },
                properties = properties,
                uiSettings =
                    MapUiSettings(
                        zoomControlsEnabled = false,
                        mapToolbarEnabled = false,
                        scrollGesturesEnabled = false,
                        zoomGesturesEnabled = false,
                    ),
            )
        }
        if (area) {
            // Drawn over the map rather than on it, so it shows whatever the tiles do.
            val metersPerDp = EQUATOR_METERS_PER_DP * cos(latitude * PI / 180.0) / 2.0.pow(zoom.toDouble())
            Canvas(modifier = Modifier.fillMaxSize()) {
                val radius = (AREA_RADIUS_M / metersPerDp).dp.toPx()
                drawCircle(color = PantopusColors.primary600.copy(alpha = 0.16f), radius = radius)
                drawCircle(color = PantopusColors.primary600.copy(alpha = 0.55f), radius = radius, style = Stroke(1.5.dp.toPx()))
            }
        }
        if (!area) {
            Box(modifier = Modifier.align(Alignment.Center).offset(y = (-28).dp).size(width = 48.dp, height = 56.dp)) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val unit = size.width / 48f
                    drawCircle(Color.White, radius = 23.5f * unit, center = Offset(24f * unit, 24f * unit))
                    val tail =
                        androidx.compose.ui.graphics.Path().apply {
                            moveTo(18f * unit, 44f * unit)
                            lineTo(24f * unit, 55f * unit)
                            lineTo(30f * unit, 44f * unit)
                            close()
                        }
                    drawPath(tail, Color.White)
                    drawCircle(
                        brush =
                            Brush.linearGradient(
                                listOf(PantopusColors.momentRingStart, PantopusColors.momentRingEnd),
                                start = Offset(2.5f * unit, 2.5f * unit),
                                end = Offset(45.5f * unit, 45.5f * unit),
                            ),
                        radius = 21.5f * unit,
                        center = Offset(24f * unit, 24f * unit),
                        style = Stroke(3f * unit),
                    )
                }
                MomentSelfFace(size = 36.dp, avatarUrl = avatarUrl, modifier = Modifier.offset(x = 6.dp, y = 6.dp))
            }
        }
    }
}

private val SheetShadow = PantopusElevation(Color.Black, 0.30f, 24.dp, 0.dp, (-6).dp)
private val SegmentShadow = PantopusElevation(Color.Black, 0.12f, 3.dp, 0.dp, 1.dp)
private const val MINI_ZOOM = 15.5f

/** "Within about half a mile": how far from the real spot the server may place an area pin (0.55 mile). */
private const val AREA_RADIUS_M = 885.0

/** Meters per dp on the map at zoom 0 on the equator (256 dp tiles). */
private const val EQUATOR_METERS_PER_DP = 156_543.03392

/** The area switch's second line (REVIEW P7: people here read miles, and the pin can sit that far from the spot). */
private const val AREA_LINE = "People see a pin within about half a mile, not the exact spot"
