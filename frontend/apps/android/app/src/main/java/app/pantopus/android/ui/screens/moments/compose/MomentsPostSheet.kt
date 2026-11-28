@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")
@file:OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)

package app.pantopus.android.ui.screens.moments.compose

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.semantics.onClick
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
import app.pantopus.android.ui.screens.feed.reinvented.after.MomentExploreRow
import app.pantopus.android.ui.screens.feed.reinvented.after.TogetherStudioRows
import app.pantopus.android.ui.screens.moments.components.LiveGlyph
import app.pantopus.android.ui.screens.moments.components.MomentSelfFace
import app.pantopus.android.ui.screens.moments.studio.StudioMadeUpNote
import app.pantopus.android.ui.sky.SkyWords
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
import kotlin.math.log2
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
    onShowWeather: (Boolean) -> Unit = {},
    sky: MomentsSkyActions = MomentsSkyActions(),
    // Over a photo or a video the sheet pulls down to show it and back up ([MomentsPostLowering]); null keeps it still.
    lowering: MomentsPostLowering? = null,
    // A tap on the small map opens it full screen ([MomentsPostFullMap]); null keeps the map still.
    onOpenMap: (() -> Unit)? = null,
    // "Pulse, reinvented": the sheet as the Studio's drawer, without what the Studio's bar already holds (who sees it,
    // the caption and Post). False, the sheet is today's.
    studio: Boolean = false,
) {
    // "Don't show where": no pin, no map, connections only.
    val unplaced = state.noLocationOn
    // Under the Sky the home has its own note ([SkyHomeNote]): the Moment shows only its area there whatever is picked.
    val atHome = state.postAtHome
    val density = LocalDensity.current
    val keyboardPx = WindowInsets.ime.getBottom(density)
    val belowPx = WindowInsets.navigationBars.getBottom(density)
    val keyboardPadding = with(density) { (keyboardPx - belowPx).coerceAtLeast(0).toDp() }
    val lower = rememberMomentsPostLower(lowering)
    val drag = rememberMomentsPostDrag(lowering)
    Box(modifier = modifier.fillMaxWidth().then(drag)) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .pantopusShadow(SheetShadow, RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                    .clip(RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                    .background(PantopusColors.appSurface)
                    .padding(bottom = keyboardPadding)
                    .testTag("moments.post")
                    // Lowered, TalkBack reads the strip, not the options under it.
                    .then(if (lowering?.isLowered == true) Modifier.clearAndSetSemantics {} else Modifier)
                    .semantics { contentDescription = "Post your Moment" },
        ) {
            // Everything but Post scrolls; Post stays at the bottom of the sheet, in reach whatever the screen's height.
            val scroll = rememberScrollState()
            // The caption is the sheet's one text box, at its end: with the keyboard up, the whole box shows above Post.
            LaunchedEffect(keyboardPx > 0, scroll.maxValue) { if (keyboardPx > 0) scroll.animateScrollTo(scroll.maxValue) }
            Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(scroll)) {
                // The grab handle: a drag on it moves the sheet with the options' pull, a tap lowers it to show the picture.
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .height(24.dp)
                            .then(
                                if (lowering != null) {
                                    Modifier
                                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
                                            lower(true)
                                        }.testTag("moments.post.handle")
                                        .semantics {
                                            contentDescription = "Show the picture. Lowers the options so the whole picture shows"
                                            role = Role.Button
                                        }
                                } else {
                                    Modifier
                                },
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier =
                            Modifier.size(width = 36.dp, height = 5.dp).clip(RoundedCornerShape(3.dp)).background(PantopusColors.appBorder),
                    )
                }
                state.postMapSpot?.let { spot ->
                    PinMap(
                        latitude = spot.latitude,
                        longitude = spot.longitude,
                        area = spot.area,
                        avatarUrl = avatarUrl,
                        discRadiusM = spot.discRadiusM,
                        onOpen = onOpenMap,
                    )
                }
                // The place others will read: the venue's name (or the one picked), or the town with "Show the area instead".
                val label = state.postPlaceLabel
                PlaceRow(state = state, label = label, atHome = atHome, onPlace = onPlace, onFindPlace = onFindPlace)
                if (studio && state.madeUp) StudioMadeUpNote()
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
                // A photo or video the camera just took, at its exact pin away from home: everyone will see it's live (API v4.1),
                // or, shared later, that it was taken here (it never reads Live then).
                if (state.offersLive) LiveRow(later = state.shareLaterChoice != null)
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
                // The Sky: the note at home, and "Pin it at a place" in place of "Show the area instead".
                if (state.skyAtHome) SkyHomeNote()
                if (!unplaced && state.sky) SkyPinRow(state = state, onPinAtPlace = sky.onPinAtPlace, onFindPlace = onFindPlace)
                if (!unplaced && !state.sky) {
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
                if (!(studio && state.madeUp)) NoLocationRow(state = state, onNoLocation = onNoLocation)
                if (studio) MomentExploreRow(state)
                if (studio) TogetherStudioRows(state)
                state.heightFeet?.takeIf { state.offersHeight }?.let { feet ->
                    // The Sky: a floating Moment's height is "About 4,400 ft above sea level".
                    val line = if (state.sky && state.floats) SkyWords.aboutHeight(feet) else MomentHeight.line(feet)
                    HeightRow(line = line, on = state.showHeight, onShowHeight = onShowHeight)
                }
                if (state.greysHeight && !state.offersHeight) SkyGreyHeightRow()
                // The weather at the fix, for a Moment with the Live line; none when no fresh reading came (API v4.1).
                state.weatherLine?.let { line -> WeatherRow(line = line, on = state.showWeather, onShowWeather = onShowWeather) }
                if (state.shareLaterChoices.isNotEmpty()) {
                    SkyShareLaterRow(state = state, onShareLater = sky.onShareLater, onChoice = sky.onShareLaterChoice)
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
                                    .border(
                                        1.dp,
                                        if (on) PantopusColors.primary600 else PantopusColors.appBorder,
                                        RoundedCornerShape(Radii.lg),
                                    )
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
                if (!studio) {
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
                }
                if (state.media != null && !studio) {
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
                            keyboardOptions =
                                KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
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
            if (!studio) {
                Spacer(Modifier.height(14.dp))
                val sharesAt = state.sharesAt
                SheetPrimaryButton(
                    label =
                        when {
                            // Post waits for the video to be made ready (sized, and split when it's long).
                            state.posting && state.readying != null -> "Getting your video ready · ${(state.readying * 100).toInt()}%"
                            state.posting -> "Posting…"
                            // Several picked together: which one this is. The hours are on the sheet's own row either way.
                            state.pickedTogether > 1 -> "Post ${state.pickedAt} of ${state.pickedTogether}"
                            // A video longer than one Moment posts as several, one after another (contract v3.11).
                            state.videoParts > 1 -> "Post as ${state.videoParts} Moments"
                            // The Sky's "Share later": "Share at 6:40 pm · shows for 24 hours".
                            sharesAt != null -> SkyWords.shareAtButton(sharesAt, state.hours)
                            else -> "Post · shows for ${if (state.hours == 1) "1 hour" else "${state.hours} hours"}"
                        },
                    onClick = onPost,
                    enabled = !state.posting && (state.pin != null || unplaced),
                    modifier = Modifier.padding(horizontal = Spacing.s4).testTag("moments.post.submit"),
                )
            }
            Spacer(Modifier.height(Spacing.s6))
        }
        lowering?.let { MomentsPostStrip(lowering = it, onRaise = { lower(false) }, modifier = Modifier.align(Alignment.TopCenter)) }
    }
}

/** Where the small map (and the full-screen one) points, for a Moment with a place. */
internal data class PostMapSpot(
    val latitude: Double,
    val longitude: Double,
    val area: Boolean,
    // The Sky: the area's disc, in metres.
    val discRadiusM: Double?,
)

/** The map's point: the pin, a picked venue's, or under the Sky at home the area's disc around the area's own point. */
internal val MomentsComposeUiState.postMapSpot: PostMapSpot?
    get() {
        val pin = pin?.takeIf { !noLocationOn } ?: return null
        val disc = place?.area?.takeIf { sky && floats }
        val atVenue = venuePoint(pin.latitude, pin.longitude)
        return PostMapSpot(
            latitude = disc?.latitude ?: atVenue?.first ?: pin.latitude,
            longitude = disc?.longitude ?: atVenue?.second ?: pin.longitude,
            area = floats,
            discRadiusM = disc?.radiusM,
        )
    }

/** At your own home, away from the Sky: a venue picked in the place picker moves the pin off it. */
internal val MomentsComposeUiState.postAtHome: Boolean
    get() = !sky && place?.atHome == true && pickedVenue == null && !noLocationOn

/** The place others will read: the venue's name (or the one picked), or the town with "Show the area instead". */
internal val MomentsComposeUiState.postPlaceLabel: String
    get() =
        when {
            noLocationOn -> NO_LOCATION
            sky -> skyLine
            postAtHome && !showArea -> "Your home"
            showArea -> place?.areaLabel ?: place?.placeLabel ?: "Your area"
            else -> pickedVenue?.name ?: pickedPlace?.label ?: place?.placeLabel ?: "Where you are"
        }

/** What the place row says on its right: "Exact spot" or "Area" ("Exact" or "Area" under the Sky). */
internal val MomentsComposeUiState.postPlaceKind: String
    get() =
        when {
            noLocationOn -> "Not on the map"
            sky -> if (floats) SkyWords.AREA else SkyWords.EXACT
            showArea -> "Area"
            else -> "Exact spot"
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
                        atHome && !state.showArea || state.skyAtHome -> PantopusIcon.Home
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
                text = state.postPlaceKind,
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
 * "Show elevation" (board H1): how high above sea level the phone, or the album photo, says this is, as everyone will read
 * it (rounded to 10 ft). Only on the sheet where it may be shown ([MomentsComposeUiState.offersHeight]).
 */
@Composable
private fun HeightRow(
    line: String,
    on: Boolean,
    onShowHeight: (Boolean) -> Unit,
) {
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
                    contentDescription = "Show elevation. $line"
                    role = Role.Switch
                    selected = on
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = "Show elevation", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
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

/**
 * Board L1's line under the place: "Live · Taken here just now. Everyone will see that." While the Sky's "Share later"
 * is picked the Moment never reads Live, so the line says what viewers will see: "Taken here · Everyone will see that."
 * with the viewer's pin (coordinator, 2026-11-20).
 */
@Composable
private fun LiveRow(later: Boolean) {
    val title = if (later) "Taken here" else "Live"
    val line = if (later) LATER_LINE else LIVE_LINE
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s5, end = Spacing.s5, top = 2.dp)
                .fillMaxWidth()
                .testTag("moments.post.live")
                .clearAndSetSemantics { contentDescription = "$title. $line" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (later) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        } else {
            LiveGlyph(color = PantopusColors.momentLive, size = 18.dp)
            Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.momentLive)
        }
        Text(
            text = line,
            fontSize = 13.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextSecondary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
    }
}

/** "Show the weather" (board L1) with the reading at the fix; on unless turned off last time. */
@Composable
private fun WeatherRow(
    line: String,
    on: Boolean,
    onShowWeather: (Boolean) -> Unit,
) {
    val reading = "$line, as it is here right now"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = 6.dp)
                .heightIn(min = 52.dp)
                .clickable(role = Role.Switch) { onShowWeather(!on) }
                .testTag("moments.post.weather")
                .clearAndSetSemantics {
                    contentDescription = "Show the weather. $reading"
                    role = Role.Switch
                    selected = on
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = "Show the weather", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            Text(text = reading, fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary)
        }
        Switch(
            checked = on,
            onCheckedChange = onShowWeather,
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

private const val LIVE_LINE = "Taken here just now. Everyone will see that."
private const val LATER_LINE = "Everyone will see that."

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
    // The Sky: the area's disc, in metres; the map zooms out so it fills about three quarters of its height.
    discRadiusM: Double? = null,
    // A tap opens the map full screen (founder, 2026-11-24); a corner sign says so.
    onOpen: (() -> Unit)? = null,
) {
    val target = LatLng(latitude, longitude)
    val zoom = discRadiusM?.let { discZoom(it, latitude) } ?: MINI_ZOOM
    val camera =
        rememberCameraPositionState(key = "$latitude,$longitude,$area,$discRadiusM") {
            position = CameraPosition.fromLatLngZoom(target, zoom)
        }
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
                    if (onOpen != null) {
                        role = Role.Button
                        onClick(label = "Open the map full screen") {
                            onOpen()
                            true
                        }
                    }
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
                val radius = ((discRadiusM ?: AREA_RADIUS_M) / metersPerDp).dp.toPx()
                drawCircle(color = PantopusColors.primary600.copy(alpha = 0.16f), radius = radius)
                drawCircle(color = PantopusColors.primary600.copy(alpha = 0.55f), radius = radius, style = Stroke(1.5.dp.toPx()))
            }
        }
        if (!area) {
            MomentsPostSelfPin(avatarUrl = avatarUrl, modifier = Modifier.align(Alignment.Center).offset(y = (-28).dp))
        }
        if (onOpen != null) {
            // Over the map (a lite map opens Google Maps on a tap of its own): a tap here opens the full-screen map, and a
            // drag still scrolls the sheet.
            Box(modifier = Modifier.fillMaxSize().clickable(onClick = onOpen))
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(Spacing.s2)
                        .size(28.dp)
                        .pantopusShadow(ExpandShadow, CircleShape)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface.copy(alpha = 0.94f))
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Maximize,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appText,
                )
            }
        }
    }
}

/** Your face in the sky-to-green ring, on a pin like the map's: 48 by 56 dp, its point at the bottom middle. */
@Composable
internal fun MomentsPostSelfPin(
    avatarUrl: String?,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.size(width = 48.dp, height = 56.dp)) {
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

/** The zoom at which a disc of [radiusM] metres spans about three quarters of the 150 dp map's height. */
private fun discZoom(
    radiusM: Double,
    latitude: Double,
): Float = log2(EQUATOR_METERS_PER_DP * cos(latitude * PI / 180.0) * DISC_DP / radiusM).toFloat().coerceAtMost(MINI_ZOOM)

/** The disc's radius on the 150 dp map: about three quarters of its height across. */
private const val DISC_DP = 54.0

private val SheetShadow = PantopusElevation(Color.Black, 0.30f, 24.dp, 0.dp, (-6).dp)
private val SegmentShadow = PantopusElevation(Color.Black, 0.12f, 3.dp, 0.dp, 1.dp)
private val ExpandShadow = PantopusElevation(Color.Black, 0.12f, 3.dp, 0.dp, 2.dp)
private const val MINI_ZOOM = 15.5f

/** "Within about half a mile": how far from the real spot the server may place an area pin (0.55 mile). */
private const val AREA_RADIUS_M = 885.0

/** Meters per dp on the map at zoom 0 on the equator (256 dp tiles). */
private const val EQUATOR_METERS_PER_DP = 156_543.03392

/** The area switch's second line (REVIEW P7: people here read miles, and the pin can sit that far from the spot). */
private const val AREA_LINE = "People see a pin within about half a mile, not the exact spot"
