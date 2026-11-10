@file:Suppress("MagicNumber", "LongMethod", "LongParameterList", "CyclomaticComplexMethod")

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
import com.google.maps.android.compose.GoogleMap
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
) {
    val atHome = state.place?.atHome == true
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
            state.pin?.let { pin ->
                PinMap(latitude = pin.latitude, longitude = pin.longitude, area = state.showArea, avatarUrl = avatarUrl)
            }
            // The place others will read: the venue's name, or the town with "Show the area instead".
            val label =
                when {
                    atHome && !state.showArea -> "Your home"
                    state.showArea -> state.place?.areaLabel ?: state.place?.placeLabel ?: "Your area"
                    else -> state.place?.placeLabel ?: "Where you are"
                }
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
                    icon = if (atHome && !state.showArea) PantopusIcon.Home else PantopusIcon.MapPin,
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
                Text(text = if (state.showArea) "Area" else "Exact spot", fontSize = 13.sp, color = PantopusColors.appTextSecondary)
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
                    Text(text = "Show the area instead", fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
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
                    val on = key == state.audience
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .fillMaxSize()
                                .then(if (on) Modifier.pantopusShadow(SegmentShadow, RoundedCornerShape(9.dp)) else Modifier)
                                .clip(RoundedCornerShape(9.dp))
                                .background(if (on) Color.White else Color.Transparent)
                                .clickable(role = Role.RadioButton) { onAudience(key) }
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
                            color = if (on) PantopusColors.appText else PantopusColors.appTextSecondary,
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
            label = if (state.posting) "Posting…" else "Post · shows for ${if (state.hours == 1) "1 hour" else "${state.hours} hours"}",
            onClick = onPost,
            enabled = !state.posting && state.pin != null,
            modifier = Modifier.padding(horizontal = Spacing.s4).testTag("moments.post.submit"),
        )
        Spacer(Modifier.height(Spacing.s6))
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
 * With "Show the area instead" the map pulls back and a soft circle covers where the pin may land for others (within
 * about half a mile), with no pin on your spot.
 */
@Composable
private fun PinMap(
    latitude: Double,
    longitude: Double,
    area: Boolean,
    avatarUrl: String?,
) {
    val target = LatLng(latitude, longitude)
    val zoom = if (area) AREA_ZOOM else MINI_ZOOM
    val camera = rememberCameraPositionState(key = "$latitude,$longitude,$area") { position = CameraPosition.fromLatLngZoom(target, zoom) }
    val options = remember { GoogleMapOptions().liteMode(true) }
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
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = camera,
            googleMapOptionsFactory = { options },
            uiSettings =
                MapUiSettings(
                    zoomControlsEnabled = false,
                    mapToolbarEnabled = false,
                    scrollGesturesEnabled = false,
                    zoomGesturesEnabled = false,
                ),
        )
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

/** Pulled back far enough for the whole area to show. */
private const val AREA_ZOOM = 12.5f

/** "Within about half a mile": how far from the real spot the server may place an area pin (0.55 mile). */
private const val AREA_RADIUS_M = 885.0

/** Meters per dp on the map at zoom 0 on the equator (256 dp tiles). */
private const val EQUATOR_METERS_PER_DP = 156_543.03392

/** The area switch's second line (REVIEW P7: people here read miles, and the pin can sit that far from the spot). */
private const val AREA_LINE = "People see a pin within about half a mile, not the exact spot"
