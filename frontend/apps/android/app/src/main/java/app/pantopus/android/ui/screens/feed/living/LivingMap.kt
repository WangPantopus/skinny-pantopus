@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.R
import app.pantopus.android.data.api.models.moments.MomentRingDto
import app.pantopus.android.data.api.models.moments.MomentSunDto
import app.pantopus.android.data.api.models.plans.PlanPinDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.LivingBeamDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.data.moments.MomentShownHeight
import app.pantopus.android.data.moments.shownHeight
import app.pantopus.android.data.pulse.ReinventedBox
import app.pantopus.android.ui.screens.feed.reinvented.ReinventedMapItem
import app.pantopus.android.ui.screens.feed.reinvented.ReinventedMapState
import app.pantopus.android.ui.screens.moments.components.MOMENT_PIN_WIDTH
import app.pantopus.android.ui.screens.moments.components.MomentMapPin
import app.pantopus.android.ui.screens.moments.map.MomentHeightTag
import app.pantopus.android.ui.screens.moments.map.MomentsFloat
import app.pantopus.android.ui.screens.moments.map.drawFloatShadow
import app.pantopus.android.ui.theme.PantopusColors
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.MapStyleOptions
import com.google.maps.android.compose.CameraPositionState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset
import javax.inject.Inject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

/*
 * "Pulse, reinvented" phase 4, the living map (PHASE-4 pieces 1 and 2, board B4), as the iPhone's
 * (`ReinventedLivingMap.swift`) and the web's (`mapLight.ts`). Only on the Pulse tab's map, which shows only while the
 * switch is on for the person.
 *
 * - While the map's answer says `heights_on` and `float_on` (CONTRACT 6b; the `moment_float` switch, as on today's
 *   Moments map): a ring with a height floats at it, higher the higher it was made (today's `MomentsFloat` numbers,
 *   reused unchanged), with its shadow on the ground where the real sun puts it now; after sunset it hangs as a lantern
 *   on a thread; a Moment shown only as its area is a soft cloud over it; a plan glows as a beacon with a small arc of
 *   the time left before it starts.
 * - Night falls on the map when the sun is down over its middle (the map takes a dark style), whatever `float_on` says.
 *   The map is also dark whenever the phone is set to dark, and follows that setting at once (PHASE-5 D: one rule, dark
 *   when the device is dark or it is night where the map looks, bright otherwise). Lanterns and shadows still follow the
 *   real sun.
 * - The box asked of the server stays inside the world ([livingBox]): across the date line Google's southwest
 *   longitude is greater than its northeast one, which the server refuses, so the whole width is asked then.
 * - Live beams (CONTRACT 9h): on the Live map, faint lines from several captures to where they all looked, read after
 *   the map settles. A server without the route draws none and is not asked again.
 *
 * The sun's place is NOAA's general solar position formula, the same as the iPhone's, the web's and the server's
 * (`services/moments/sunPosition.js`), so they agree. Nothing here is sent anywhere but the beams' read of the map's box.
 */

/** Where the sun is over a point: degrees clockwise from true north, and above the horizon (negative after sunset). */
internal object LivingSun {
    fun position(
        latitude: Double,
        longitude: Double,
        at: Instant = Instant.now(),
    ): MomentSunDto {
        val utc = at.atOffset(ZoneOffset.UTC)
        val dayOfYear = utc.dayOfYear.toDouble()
        val hour = utc.hour + utc.minute / 60.0 + utc.second / 3600.0
        val g = 2 * PI / 365 * (dayOfYear - 1 + (hour - 12) / 24)
        val minutesFast =
            229.18 * (0.000075 + 0.001868 * cos(g) - 0.032077 * sin(g) - 0.014615 * cos(2 * g) - 0.040849 * sin(2 * g))
        val declination =
            0.006918 - 0.399912 * cos(g) + 0.070257 * sin(g) - 0.006758 * cos(2 * g) +
                0.000907 * sin(2 * g) - 0.002697 * cos(3 * g) + 0.00148 * sin(3 * g)
        val solarMinutes = hour * 60 + minutesFast + 4 * longitude
        val hourAngle = Math.toRadians(solarMinutes / 4 - 180)
        val lat = Math.toRadians(latitude)
        val cosZenith = sin(lat) * sin(declination) + cos(lat) * cos(declination) * cos(hourAngle)
        val zenith = acos(cosZenith.coerceIn(-1.0, 1.0))
        val azimuth = Math.toDegrees(atan2(sin(hourAngle), cos(hourAngle) * sin(lat) - tan(declination) * cos(lat))) + 180
        return MomentSunDto(azimuthDeg = (azimuth % 360 + 360) % 360, elevationDeg = 90 - Math.toDegrees(zenith))
    }
}

/** The living map's light: whether rings float, the sun over the map's middle and the map's turn. */
@Immutable
internal data class LivingLight(
    val floats: Boolean = false,
    val sun: MomentSunDto? = null,
    val bearing: Float = 0f,
    /** Ask the map: the pins lit, with their words; null while nothing was asked (`LivingAsk.kt`). */
    val lit: Map<String, List<String>>? = null,
    /** The phone is set to dark. */
    val deviceDark: Boolean = false,
) {
    /** The sun is down over the middle of the map. */
    val night: Boolean get() = (sun?.elevationDeg ?: 30.0) <= 0.0

    /** The map's look: dark when the phone is set to dark or it is night over the map; bright otherwise. */
    val dark: Boolean get() = deviceDark || night
}

/**
 * The map's box as the server takes it (`south < north`, `west < east`, inside ±90 and ±180): Google keeps each
 * longitude inside ±180, but across the date line (or with the whole world in view) the southwest one is not less than
 * the northeast one, so the whole width is asked then.
 */
internal fun LatLngBounds.livingBox(): ReinventedBox {
    val whole = southwest.longitude >= northeast.longitude
    return ReinventedBox(
        south = southwest.latitude.coerceIn(-90.0, 90.0),
        west = if (whole) -180.0 else southwest.longitude,
        north = northeast.latitude.coerceIn(-90.0, 90.0),
        east = if (whole) 180.0 else northeast.longitude,
    )
}

/**
 * The light of the Pulse map: whether rings float from the map's answer ([ReinventedMapState.floats]), the sun over the
 * camera's middle once the map is still (and again each minute), moved only when it moves enough to change a shadow,
 * and the pins Ask the map lit. Tells Ask the map the box, time and pins the map shows once it settles.
 */
@Composable
internal fun rememberLivingLight(
    state: ReinventedMapState,
    camera: CameraPositionState,
    ask: LivingAskViewModel = hiltViewModel(),
): LivingLight {
    var light by remember { mutableStateOf(LivingLight()) }
    val asked by ask.state.collectAsStateWithLifecycle()
    LaunchedEffect(camera.isMoving, state.time, state.items) {
        if (camera.isMoving) return@LaunchedEffect
        val box =
            camera.projection?.visibleRegion?.latLngBounds?.livingBox()
        ask.mapAt(box, state.time, state.items)
    }
    LaunchedEffect(camera) {
        snapshotFlow { if (camera.isMoving) null else camera.position }.filterNotNull().collectLatest { position ->
            while (true) {
                val next = LivingSun.position(position.target.latitude, position.target.longitude)
                val old = light.sun
                val same =
                    old != null &&
                        abs((old.azimuthDeg ?: 0.0) - (next.azimuthDeg ?: 0.0)) < 3 &&
                        abs((old.elevationDeg ?: 0.0) - (next.elevationDeg ?: 0.0)) < 1.5 &&
                        ((old.elevationDeg ?: 0.0) > 0) == ((next.elevationDeg ?: 0.0) > 0)
                if (!same || light.bearing != position.bearing) {
                    light = light.copy(sun = if (same) old else next, bearing = position.bearing)
                }
                delay(MINUTE_MS)
            }
        }
    }
    // Read on every composition, so a change of the phone's setting turns the map at once.
    val deviceDark = isSystemInDarkTheme()
    return remember(light, state.floats, asked.lit, deviceDark) {
        light.copy(floats = state.floats, lit = asked.lit, deviceDark = deviceDark)
    }
}

private const val MINUTE_MS = 60_000L

/** The map's look: dark ([LivingLight.dark]), the night style; otherwise the map's own ([day]). */
internal fun livingMapStyle(
    context: Context,
    dark: Boolean,
    day: Int,
): MapStyleOptions = MapStyleOptions.loadRawResourceStyle(context, if (dark) R.raw.living_night_map_style else day)

internal object LivingPalette {
    /** A lantern's warm light, and the beams after dark. */
    val lantern: Color get() = PantopusColors.warmAmberBorder

    /** The beams by day. */
    val beamDay: Color get() = PantopusColors.primary400

    /** A Moment shown only as its area: a soft white cloud. */
    val cloud: Color get() = Color.White
}

// The pins

/**
 * One pin of the Pulse map as the living map draws it: while rings float, a ring with a height floats at it (a
 * lantern after dark), a ring shown only as its area is a cloud, and a plan glows as a beacon; anything else, and
 * everything while rings don't float, is exactly today's pin ([today]). Its bottom stands on its point, as today's
 * pin's tip does. While Ask the map shows what it was asked, the pin is lit with its words or dimmed.
 */
@Composable
internal fun LivingPin(
    item: ReinventedMapItem,
    light: LivingLight,
    focused: Boolean,
    modifier: Modifier,
    today: @Composable (Modifier) -> Unit,
) {
    LivingLitPin(item.id, light.lit) { LivingPinBody(item, light, focused, modifier, today) }
}

@Composable
private fun LivingPinBody(
    item: ReinventedMapItem,
    light: LivingLight,
    focused: Boolean,
    modifier: Modifier,
    today: @Composable (Modifier) -> Unit,
) {
    val ring = (item as? ReinventedMapItem.Ring)?.ring
    val height = ring?.shownHeight
    val tagged = Modifier.livingFocus(focused).testTag("reinventedPulse.pin.${item.id}").then(modifier)
    when {
        !light.floats -> today(modifier)
        ring != null && ring.floating -> LivingCloud(ring, tagged)
        ring != null && height != null && light.night -> LivingLantern(ring, height, tagged)
        ring != null && height != null -> LivingFloating(ring, height, light, tagged)
        item is ReinventedMapItem.Ticket -> LivingBeacon(item.ticket) { today(modifier) }
        else -> today(modifier)
    }
}

private fun Modifier.livingFocus(focused: Boolean): Modifier =
    if (focused) {
        graphicsLayer(scaleX = 1.18f, scaleY = 1.18f)
    } else {
        this
    }

/** How far above its spot the disc hangs: 6 dp on the ground to 32 at 15,000 ft or in flight (as the iPhone's). */
private fun lift(height: MomentShownHeight) = (6 + 26 * MomentsFloat.lift(height)).dp

/** A floating ring by day: the disc with its height tag, raised over its spot, its shadow where the sun puts it. */
@Composable
private fun LivingFloating(
    ring: MomentRingDto,
    height: MomentShownHeight,
    light: LivingLight,
    modifier: Modifier,
) {
    val shadow = light.sun?.let { MomentsFloat.shadow(height, it, light.bearing) } ?: MomentsFloat.AREA_SHADOW
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier
                .drawBehind {
                    drawFloatShadow(Offset(size.width / 2, size.height), shadow.copy(opacity = min(shadow.opacity * 1.5f, 0.5f)))
                }.semantics(mergeDescendants = true) { contentDescription = "${ring.spokenAuthor}'s Moment, ${height.spoken}" },
    ) {
        LivingDisc(ring, height)
        Spacer(Modifier.height(lift(height)))
    }
}

/** A floating ring after sunset: a lantern on a thread down to its spot. */
@Composable
private fun LivingLantern(
    ring: MomentRingDto,
    height: MomentShownHeight,
    modifier: Modifier,
) {
    val scale = MomentsFloat.scale(height)
    val lantern = LivingPalette.lantern
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier.semantics(mergeDescendants = true) {
                contentDescription = "${ring.spokenAuthor}'s Moment, a lantern at ${height.spoken}"
            },
    ) {
        LivingDisc(
            ring,
            height,
            glow = {
                val reach = (46 * scale).dp.toPx()
                drawCircle(
                    brush =
                        Brush.radialGradient(
                            0f to lantern.copy(alpha = 0.65f),
                            0.4f to lantern.copy(alpha = 0.65f),
                            1f to lantern.copy(alpha = 0f),
                            center = Offset(size.width / 2, size.height - size.width / 2),
                            radius = reach,
                        ),
                    radius = reach,
                    center = Offset(size.width / 2, size.height - size.width / 2),
                )
            },
        )
        Box(Modifier.width(1.5.dp).height(lift(height)).background(lantern.copy(alpha = 0.8f)))
        Box(Modifier.size(5.dp).background(lantern, CircleShape))
    }
}

/** A Moment shown only as its area: today's disc in a soft cloud over it, its shadow right under. */
@Composable
private fun LivingCloud(
    ring: MomentRingDto,
    modifier: Modifier,
) {
    val cloud = LivingPalette.cloud
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            modifier
                .drawBehind { drawFloatShadow(Offset(size.width / 2, size.height), MomentsFloat.AREA_SHADOW) }
                .semantics(mergeDescendants = true) { contentDescription = "${ring.spokenAuthor}'s Moment, over its area" },
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier.drawBehind {
                    val cloudSize = Size(132.dp.toPx(), 88.dp.toPx())
                    val topLeft = Offset((size.width - cloudSize.width) / 2, (size.height - cloudSize.height) / 2)
                    drawOval(
                        brush =
                            Brush.radialGradient(
                                0f to cloud.copy(alpha = 0.95f),
                                0.6f to cloud.copy(alpha = 0.75f),
                                1f to cloud.copy(alpha = 0f),
                                center = center,
                                radius = cloudSize.width / 2,
                            ),
                        topLeft = topLeft,
                        size = cloudSize,
                    )
                },
        ) {
            MomentMapPin(
                author = ring.author,
                seen = ring.moments.map { it.seen },
                preview = ring.preview,
                tail = false,
                live = ring.liveUntil != null,
            )
        }
        Spacer(Modifier.height(10.dp))
    }
}

/** The disc with no tail, a little bigger the higher it was made, its height tag over it. */
@Composable
private fun LivingDisc(
    ring: MomentRingDto,
    height: MomentShownHeight,
    glow: (androidx.compose.ui.graphics.drawscope.DrawScope.() -> Unit)? = null,
) {
    val scale = MomentsFloat.scale(height)
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        MomentHeightTag(height = height)
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(MOMENT_PIN_WIDTH * scale).then(if (glow != null) Modifier.drawBehind(glow) else Modifier),
        ) {
            MomentMapPin(
                author = ring.author,
                seen = ring.moments.map { it.seen },
                preview = ring.preview,
                tail = false,
                live = ring.liveUntil != null,
                modifier =
                    Modifier.graphicsLayer {
                        scaleX = scale
                        scaleY = scale
                    },
            )
        }
    }
}

private val MomentRingDto.spokenAuthor: String get() = author.firstName ?: "Someone"

/**
 * A plan's pin while rings float: it glows as a beacon, with an arc of the hours left before it starts on a small white
 * face at its corner (a full ring six hours ahead, gone once it has started).
 */
@Composable
private fun LivingBeacon(
    ticket: PlanPinDto,
    content: @Composable () -> Unit,
) {
    val left = remember(ticket.startsAt) { hoursLeft(ticket.startsAt) }
    val ink = PantopusColors.primary600
    Box {
        Box(
            modifier =
                Modifier
                    .background(ink.copy(alpha = 0.22f), RoundedCornerShape(50))
                    .border(2.dp, ink.copy(alpha = 0.55f), RoundedCornerShape(50))
                    .padding(5.dp),
        ) { content() }
        if (left != null) {
            Canvas(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .offset(x = 8.dp, y = (-8).dp)
                        .size(20.dp)
                        .clearAndSetSemantics {},
            ) {
                drawCircle(Color.White)
                val inset = 3.dp.toPx() + 1.5.dp.toPx()
                drawArc(
                    color = ink,
                    startAngle = -90f,
                    sweepAngle = 360f * left,
                    useCenter = false,
                    topLeft = Offset(inset, inset),
                    size = Size(size.width - 2 * inset, size.height - 2 * inset),
                    style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round),
                )
            }
        }
    }
}

/** The share of six hours still to wait before the plan starts; null once started or with no start time. */
private fun hoursLeft(startsAt: String?): Float? {
    val starts = startsAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
    val hours = (starts.toEpochMilli() - System.currentTimeMillis()) / 3_600_000.0
    if (hours <= 0) return null
    return min(hours / 6, 1.0).toFloat()
}

// The beams

/**
 * Live beams on the Pulse map, on the Live map only: a faint line from each capture to where they all looked, and a
 * glow there. Not tappable, not read aloud. Read once the map is still, for the box in view.
 */
@Composable
internal fun LivingBeamsLayer(
    camera: CameraPositionState,
    time: String,
    dark: Boolean,
    viewModel: LivingMapViewModel = hiltViewModel(),
) {
    val beams by viewModel.beams.collectAsStateWithLifecycle()
    LaunchedEffect(camera.isMoving, time) {
        if (camera.isMoving) return@LaunchedEffect
        val box = camera.projection?.visibleRegion?.latLngBounds?.livingBox() ?: return@LaunchedEffect
        viewModel.read(box, live = time == ReinventedMapState.LIVE)
    }
    if (beams.isEmpty()) return
    val color = if (dark) LivingPalette.lantern else LivingPalette.beamDay
    Canvas(modifier = Modifier.fillMaxSize().testTag("reinventedPulse.beams").clearAndSetSemantics {}) {
        // Reading the camera here moves the beams with the map.
        camera.position
        val projection = camera.projection ?: return@Canvas
        beams.forEach { beam ->
            val target = projection.toScreenLocation(LatLng(beam.target.latitude, beam.target.longitude))
            val end = Offset(target.x.toFloat(), target.y.toFloat())
            beam.from.forEach { from ->
                val start = projection.toScreenLocation(LatLng(from.latitude, from.longitude))
                drawLine(
                    color = color.copy(alpha = 0.45f),
                    start = Offset(start.x.toFloat(), start.y.toFloat()),
                    end = end,
                    strokeWidth = 3.dp.toPx(),
                    cap = StrokeCap.Round,
                )
            }
            drawCircle(color.copy(alpha = 0.35f), radius = 9.dp.toPx(), center = end)
        }
    }
}

/** The live beams in the map's box (CONTRACT 9h), on the Live map only. */
@HiltViewModel
class LivingMapViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _beams = MutableStateFlow<List<LivingBeamDto>>(emptyList())
        val beams: StateFlow<List<LivingBeamDto>> = _beams.asStateFlow()

        /** A server from before the beams answered 404: none are drawn, and it isn't asked again in this run. */
        private var missing = false
        private var reading: Job? = null

        fun read(
            box: ReinventedBox,
            live: Boolean,
        ) {
            reading?.cancel()
            if (!live || missing) {
                if (_beams.value.isNotEmpty()) _beams.value = emptyList()
                return
            }
            reading =
                viewModelScope.launch {
                    when (val answer = repository.beams(box)) {
                        is NetworkResult.Success ->
                            if (answer.data.map { it.id } != _beams.value.map { it.id }) _beams.value = answer.data
                        is NetworkResult.Failure ->
                            if (answer.error is NetworkError.NotFound || answer.error.code == HTTP_NOT_FOUND) {
                                missing = true
                                _beams.value = emptyList()
                            }
                    }
                }
        }

        private companion object {
            const val HTTP_NOT_FOUND = 404
        }
    }
