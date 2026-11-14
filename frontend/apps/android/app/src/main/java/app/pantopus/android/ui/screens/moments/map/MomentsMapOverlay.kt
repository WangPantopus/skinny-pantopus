@file:Suppress("MagicNumber", "LongParameterList", "MatchingDeclarationName", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentSunDto
import app.pantopus.android.data.moments.MomentPosting
import app.pantopus.android.data.moments.MomentShownHeight
import app.pantopus.android.data.moments.shownHeight
import app.pantopus.android.ui.screens.moments.components.MOMENT_CLUSTER_ANCHOR_FROM_TOP
import app.pantopus.android.ui.screens.moments.components.MOMENT_PIN_ANCHOR_FROM_TOP
import app.pantopus.android.ui.screens.moments.components.MOMENT_PIN_WIDTH
import app.pantopus.android.ui.screens.moments.components.MomentClusterBubble
import app.pantopus.android.ui.screens.moments.components.MomentMapPin
import app.pantopus.android.ui.screens.moments.components.MomentPostingPin
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.Projection
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.log2
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sinh

/** What the overlay places: a ring, a crowded spot, or your Moment while it posts. */
private sealed interface MomentItem {
    val key: String
    val latitude: Double
    val longitude: Double

    data class Single(
        val ring: MomentRingUi,
        /** Where a ring sharing its spot with others sits on their circle, in dp from the spot (zoomed in). */
        val dx: Float = 0f,
        val dy: Float = 0f,
        /** One of a few rings round a shared spot: these carry no height tag yet. */
        val fanned: Boolean = false,
        /** Where its height tag sits; null with no height to show, or no room on either side at this zoom. */
        val tag: MomentTagSide? = null,
        /** Part D: the elevation it floats at by day (`MomentsFloat.kt`); null for a pin standing on its spot. */
        val float: MomentShownHeight? = null,
    ) : MomentItem {
        override val key: String get() = "ring:${ring.id}"
        override val latitude: Double get() = ring.latitude
        override val longitude: Double get() = ring.longitude
    }

    data class Group(
        val rings: List<MomentRingUi>,
    ) : MomentItem {
        override val key: String get() = "cluster:${rings.map { it.id }.sorted().joinToString(",")}"
        override val latitude: Double get() = rings.map { it.latitude }.average()
        override val longitude: Double get() = rings.map { it.longitude }.average()
    }

    data class Posting(
        val posting: MomentPosting,
    ) : MomentItem {
        override val key: String get() = "posting:${posting.momentId}"
        override val latitude: Double get() = posting.latitude ?: 0.0
        override val longitude: Double get() = posting.longitude ?: 0.0
    }
}

/**
 * Rings over the Google map (boards M1, M2, P5), placed where the map projects them and moved with every camera
 * change without recomposing, as Plans' pins are. Drawn in Compose rather than as map markers so each ring can carry
 * the person's photo and TalkBack reads it ("Aisha M., 1 Moment, new, at Esther Short Park"). Rings closer than 52 dp
 * gather into a crowded spot, as on iPhone, and so does anything a crowded spot would be drawn over: rings and bubbles
 * never sit on each other. Tapping a crowded spot zooms in. Zoomed all the way, a few rings that share a spot fan out
 * in a circle so each can be tapped. Taps anywhere else reach the map.
 */
@Composable
fun MomentsMapOverlay(
    cameraState: CameraPositionState,
    rings: List<MomentRingUi>,
    posting: List<MomentPosting>,
    avatarUrl: String?,
    onRing: (MomentRingUi) -> Unit,
    onCluster: (List<MomentRingUi>) -> Unit,
    onPosting: (MomentPosting) -> Unit,
    modifier: Modifier = Modifier,
    /** The rings drawn inside a crowded spot's bubble at this zoom, told each time they change. */
    onBubbles: (Set<String>) -> Unit = {},
    mapReady: Boolean = true,
    camera: () -> CameraPosition = { cameraState.position },
    layoutKey: () -> Any? = { null },
    /** With "Elevation" on, a single pin whose newest Moment carries a height shows it beside the ring (board H2). */
    heights: MomentHeightTagPlan = MomentHeightTagPlan(),
) {
    val zoom by remember(cameraState) { derivedStateOf { (camera().zoom * 2f).roundToInt() / 2f } }
    val density = LocalDensity.current
    // A bubble's "+N" grows with the text size, and so does the room it takes.
    val fontScale = density.fontScale
    val tagWidth = rememberTagWidth()
    // While pins float, their tags take the side away from the shadows, which turn with the map.
    val floating = heights.sun != null
    val tagBearing by remember(cameraState, floating) { derivedStateOf { if (floating) MomentsFloat.tagBearing(camera().bearing) else 0f } }
    val items =
        remember(rings, posting, zoom, fontScale, heights, tagBearing) {
            buildItems(rings, posting, zoom.toDouble(), fontScale.toDouble(), heights, tagWidth, tagBearing)
        }
    val bubbles by rememberUpdatedState(onBubbles)
    LaunchedEffect(items) {
        bubbles(items.filterIsInstance<MomentItem.Group>().flatMapTo(mutableSetOf()) { group -> group.rings.map { it.id } })
    }
    val spots = remember(density) { OverlaySpots(density) }
    Layout(
        // Rings near an edge never draw over the status bar or the tab bar.
        modifier =
            modifier
                .fillMaxSize()
                .clipToBounds()
                .floatShadows(items, heights.sun) {
                    layoutKey()
                    val bearing = camera().bearing
                    cameraState.projection?.takeIf { mapReady }?.let { it to bearing }
                },
        content = {
            items.forEach { item ->
                key(item.key) {
                    when (item) {
                        is MomentItem.Single -> {
                            val height = item.ring.ring.shownHeight.takeIf { heights.shown }
                            RingItem(item.ring, height, item.tag, item.float) { onRing(item.ring) }
                        }
                        is MomentItem.Group -> ClusterItem(item.rings) { onCluster(item.rings) }
                        is MomentItem.Posting -> PostingItem(item.posting, avatarUrl) { onPosting(item.posting) }
                    }
                }
            }
        },
    ) { measurables, constraints ->
        val placeables = measurables.map { it.measure(Constraints()) }
        layout(constraints.maxWidth, constraints.maxHeight) {
            // Reading the camera here moves the rings with the map without recomposing them.
            camera()
            layoutKey()
            if (!mapReady) return@layout
            val projection = cameraState.projection ?: return@layout
            placeables.forEachIndexed { index, placeable ->
                val item = items.getOrNull(index) ?: return@forEachIndexed
                val point = projection.toScreenLocation(LatLng(item.latitude, item.longitude))
                // Off the map: not placed, so TalkBack doesn't reach a ring nobody can see.
                if (point.x !in 0..constraints.maxWidth || point.y !in 0..constraints.maxHeight) return@forEachIndexed
                placeable.place(spots.topLeft(item, point, placeable.width))
            }
        }
    }
}

/** What placing an item needs in px: where a pin's and a bubble's points are, a pin's width, a tag over a ring. */
private class OverlaySpots(
    private val density: Density,
) {
    private val pxPerDp = density.density
    private val pinAnchor = with(density) { MOMENT_PIN_ANCHOR_FROM_TOP.toPx() }
    private val pinWidth = with(density) { MOMENT_PIN_WIDTH.roundToPx() }
    private val tagAbove = with(density) { (MOMENT_HEIGHT_TAG_HEIGHT + MOMENT_HEIGHT_TAG_GAP_ABOVE).roundToPx() }
    private val clusterAnchor = with(density) { MOMENT_CLUSTER_ANCHOR_FROM_TOP.toPx() }

    /** Where an item drawn [width] px wide goes so its point (a floating pin: its disc's middle) is on [point]. */
    fun topLeft(
        item: MomentItem,
        point: android.graphics.Point,
        width: Int,
    ): IntOffset {
        val single = item as? MomentItem.Single
        single?.float?.let { return floatTopLeft(point, width, single.tag, density.floatDiscPx(it), tagAbove) }
        val anchorY = if (item is MomentItem.Group) clusterAnchor else pinAnchor
        // A pin with a height tag is bigger than its ring: the ring, not the pair, stands on the spot.
        val (ringMiddle, over) = single?.tag.ringIn(width, pinWidth, tagAbove)
        return IntOffset(
            x = (point.x - ringMiddle + (single?.dx ?: 0f) * pxPerDp).roundToInt(),
            y = (point.y - anchorY - over + (single?.dy ?: 0f) * pxPerDp).roundToInt(),
        )
    }
}

/**
 * Part D: the floating pins' shadows on the map, under every pin, drawn from the camera as it is in the draw step, so
 * they move and turn with the map without recomposing. [camera] gives the map's projection and bearing (null before
 * the map is ready). Nothing is added while no pin floats.
 */
private fun Modifier.floatShadows(
    items: List<MomentItem>,
    sun: MomentSunDto?,
    camera: () -> Pair<Projection, Float>?,
): Modifier {
    val floats = items.filterIsInstance<MomentItem.Single>().filter { it.float != null }
    if (sun == null || floats.isEmpty()) return this
    return drawBehind {
        val (projection, bearing) = camera() ?: return@drawBehind
        floats.forEach { single ->
            val point = projection.toScreenLocation(LatLng(single.latitude, single.longitude))
            // As the pins: one off the map isn't drawn, and neither is its shadow.
            if (point.x !in 0..size.width.roundToInt() || point.y !in 0..size.height.roundToInt()) return@forEach
            val height = single.float ?: return@forEach
            drawFloatShadow(Offset(point.x.toFloat(), point.y.toFloat()), MomentsFloat.shadow(height, sun, bearing))
        }
    }
}

/** A height tag's width in dp, from its own words, so a place is only taken where the whole tag fits. */
@Composable
private fun rememberTagWidth(): (MomentShownHeight) -> Double {
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current.density
    return remember(measurer, density) {
        { height -> momentHeightTagChromeDp(height) + measurer.measure(height.text, MOMENT_HEIGHT_TAG_TEXT).size.width / density }
    }
}

/**
 * Where the ring's middle is across a pin drawn [width] px wide with its height tag, and how far the tag pushes the
 * pin down from the top, for placing the ring on its spot.
 */
private fun MomentTagSide?.ringIn(
    width: Int,
    pinWidth: Int,
    tagAbove: Int,
): Pair<Float, Int> =
    when (this) {
        MomentTagSide.AFTER -> pinWidth / 2f to 0
        MomentTagSide.BEFORE -> width - pinWidth / 2f to 0
        MomentTagSide.ABOVE -> width / 2f to tagAbove
        MomentTagSide.BELOW, null -> width / 2f to 0
    }

@Composable
private fun RingItem(
    ring: MomentRingUi,
    /** What TalkBack reads: the ring's height while "Elevation" is on, drawn or not. */
    height: MomentShownHeight?,
    /** Where the tag is drawn; null for none. */
    tag: MomentTagSide?,
    /** Part D: the elevation it floats at by day (`MomentsFloat.kt`); null stands on its spot as before. */
    float: MomentShownHeight?,
    onTap: () -> Unit,
) {
    if (float != null) {
        FloatRingItem(ring, float, tag, onTap)
        return
    }
    // The tag is inside the ring's own tap, so a tap on it plays the ring as a tap on the pin does.
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MOMENT_HEIGHT_TAG_GAP_ABOVE),
        modifier = Modifier.ringTap(ring, height, remember { MutableInteractionSource() }, onTap),
    ) {
        if (height != null && tag == MomentTagSide.ABOVE) MomentHeightTag(height = height)
        Row(horizontalArrangement = Arrangement.spacedBy(MOMENT_HEIGHT_TAG_GAP)) {
            if (height != null && tag == MomentTagSide.BEFORE) RingHeightTag(height)
            MomentMapPin(
                author = ring.author,
                seen = ring.seen,
                // A small look at their newest Moment inside the ring, when the map read one (`MomentPinPreview.kt`).
                preview = ring.ring.preview,
            )
            if (height != null && tag == MomentTagSide.AFTER) RingHeightTag(height)
        }
    }
}

/** A ring's tap and what TalkBack reads ("…, 4,390 feet above sea level"), on a standing pin and a floating one alike. */
internal fun Modifier.ringTap(
    ring: MomentRingUi,
    height: MomentShownHeight?,
    source: MutableInteractionSource,
    onTap: () -> Unit,
): Modifier =
    this
        .testTag("moments.ring.${ring.id}")
        .clickable(
            interactionSource = source,
            indication = null,
            role = Role.Button,
            onClick = onTap,
        )
        .clearAndSetSemantics {
            contentDescription = ring.spoken(height)
            role = Role.Button
            onClick(label = "Watch") {
                onTap()
                true
            }
        }

/** A pin's tag, level with the middle of the ring (the top 64 dp of the pin; the tail is below). */
@Composable
private fun RingHeightTag(height: MomentShownHeight) {
    Box(modifier = Modifier.height(MOMENT_PIN_WIDTH), contentAlignment = Alignment.Center) {
        MomentHeightTag(height = height)
    }
}

@Composable
private fun ClusterItem(
    rings: List<MomentRingUi>,
    onTap: () -> Unit,
) {
    val people = rings.distinctBy { it.author.id }
    MomentClusterBubble(
        authors = people.sortedWith(compareByDescending<MomentRingUi> { it.anyNew }.thenBy { it.distanceMeters }).map { it.author },
        extra = (people.size - 3).coerceAtLeast(0),
        anyNew = rings.any { it.anyNew },
        modifier =
            Modifier
                .testTag("moments.cluster")
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = onTap,
                )
                .clearAndSetSemantics {
                    contentDescription = clusterSpoken(rings)
                    role = Role.Button
                    onClick(label = "Zoom in") {
                        onTap()
                        true
                    }
                },
    )
}

@Composable
private fun PostingItem(
    posting: MomentPosting,
    avatarUrl: String?,
    onTap: () -> Unit,
) {
    val label = postingLabel(posting)
    val author = posting.author
    if (posting.stage == MomentPosting.Stage.DONE && author != null) {
        // It's live: the same pin its ring will be, standing in until the map's read brings the ring itself.
        MomentMapPin(
            author = author,
            seen = listOf(false),
            modifier = Modifier.testTag("moments.posting").clearAndSetSemantics { contentDescription = "Your Moment is live" },
        )
        return
    }
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier =
            Modifier
                .testTag("moments.posting")
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = onTap,
                )
                .clearAndSetSemantics {
                    contentDescription =
                        if (posting.stage == MomentPosting.Stage.FAILED) {
                            "Your Moment couldn't post. Try again"
                        } else {
                            "Your Moment is posting, ${(posting.progress * 100).roundToInt()} percent"
                        }
                    role = Role.Button
                },
    ) {
        MomentPostingPin(progress = posting.progress, avatarUrl = avatarUrl, author = author)
        Text(
            text = label,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (posting.stage == MomentPosting.Stage.FAILED) PantopusColors.error else PantopusColors.primary600,
            maxLines = 1,
            modifier =
                Modifier
                    .padding(top = 5.dp)
                    .pantopusShadow(PantopusElevations.md, RoundedCornerShape(13.dp))
                    .clip(RoundedCornerShape(13.dp))
                    .background(PantopusColors.mapGlass)
                    .padding(horizontal = 10.dp, vertical = 4.dp)
                    .testTag("moments.posting.label"),
        )
    }
}

/** "Posting · 65%", "Checking…", or "Couldn't post · Try again" under your posting ring. */
internal fun postingLabel(posting: MomentPosting): String =
    when (posting.stage) {
        MomentPosting.Stage.FAILED -> "Couldn't post · Try again"
        MomentPosting.Stage.CHECKING, MomentPosting.Stage.DONE -> "Almost there…"
        else -> "Posting · ${(posting.progress * 100).roundToInt()}%"
    }

/** "Esther Short Park: 5 people, 3 new. Zoom in" (board M1). */
internal fun clusterSpoken(rings: List<MomentRingUi>): String {
    val people = rings.distinctBy { it.author.id }.size
    val fresh = rings.filter { it.anyNew && !it.mine }.distinctBy { it.author.id }.size
    val place = rings.groupingBy { it.placeLabel }.eachCount().maxByOrNull { it.value }?.key
    val count = if (people == 1) "1 person" else "$people people"
    return listOfNotNull(place?.let { "$it:" }, "$count, $fresh new").joinToString(" ")
}

/**
 * Where the camera goes for a tapped crowded spot (board M2): the closest zoom at which all of [points] (latitude,
 * longitude) fit in a map area of [widthDp] × [heightDp] with room for the pins themselves, which stand above their
 * spots, and for the circle they fan out in when they share one. Returns the camera's latitude, longitude and zoom.
 */
internal fun clusterCamera(
    points: List<Pair<Double, Double>>,
    widthDp: Double,
    heightDp: Double,
    minZoom: Double,
): Triple<Double, Double, Float> {
    val world = points.map { (latitude, longitude) -> worldDp(latitude, longitude, 0.0) }
    val spanX = world.maxOf { it.first } - world.minOf { it.first }
    val spanY = world.maxOf { it.second } - world.minOf { it.second }
    val maxZoom = MOMENTS_SPREAD_ZOOM + 0.5

    fun fit(extra: Double): Double {
        val roomX = (widthDp - 2 * (FRAME_SIDE_DP + extra)).coerceAtLeast(FRAME_MIN_DP)
        val roomY = (heightDp - FRAME_TOP_DP - FRAME_BOTTOM_DP - 2 * extra).coerceAtLeast(FRAME_MIN_DP)
        val byX = if (spanX > 0) log2(roomX / spanX) else maxZoom
        val byY = if (spanY > 0) log2(roomY / spanY) else maxZoom
        return min(byX, byY).coerceIn(minZoom.coerceAtMost(maxZoom), maxZoom)
    }
    // Zoomed far enough for rings sharing a spot to fan out, the frame leaves room for their circle too.
    val plain = fit(0.0)
    val zoom = if (plain >= MOMENTS_SPREAD_ZOOM) fit(SPREAD_DP_MAX).coerceAtLeast(MOMENTS_SPREAD_ZOOM) else plain
    val scale = TILE_DP * 2.0.pow(zoom)
    val centerX = (world.maxOf { it.first } + world.minOf { it.first }) / 2 * 2.0.pow(zoom)
    val centerY = (world.maxOf { it.second } + world.minOf { it.second }) / 2 * 2.0.pow(zoom)
    // Pins stand above their spots, so the spots sit a little below the middle.
    val targetY = centerY - (FRAME_TOP_DP - FRAME_BOTTOM_DP) / 2
    val longitude = centerX / scale * 360.0 - 180.0
    val latitude = atan(sinh(PI * (1 - 2 * targetY / scale))) * 180.0 / PI
    return Triple(latitude, longitude, zoom.toFloat())
}

/**
 * Room kept around a framed crowded spot: a little above the topmost spot (the map's own top padding already keeps a
 * pin's height clear under the top row), half a pin's width at the sides.
 */
private const val FRAME_TOP_DP = 21.0
private const val FRAME_SIDE_DP = 48.0
private const val FRAME_BOTTOM_DP = 28.0
private const val FRAME_MIN_DP = 40.0

/** Two rings closer than this join a bubble (a pin is 64 dp wide), as iPhone's `clusterPoints`. */
private const val CLUSTER_DP = 52.0

/** How far two drawn shapes may overlap before they join: the same give two pins 52 dp apart have. */
private const val OVERLAP_GIVE_DP = 12.0

/** From this zoom, rings that share a spot fan out in a circle instead of a crowded spot. */
const val MOMENTS_SPREAD_ZOOM = 17.0

/** More rings than this stay a crowded spot even zoomed all the way (iPhone's `fanLimit`): the strip lists them. */
private const val FAN_LIMIT = 6
private const val SPREAD_DP = 40.0
private const val SPREAD_DP_MAX = 96.0
private const val SPREAD_GAP_DP = 70.0
private const val TILE_DP = 256.0

/** A pin's drawn size around its spot: 64 × 72, the point at the bottom (`MomentMapPin`). */
private const val PIN_HALF_WIDTH_DP = 32.0
private const val PIN_ABOVE_DP = 71.0
private const val PIN_BELOW_DP = 1.0

/** A bubble's drawn size (`MomentClusterBubble`): 50 dp tall over a 9 dp point, 7 + faces + 15 dp wide. */
private const val BUBBLE_ABOVE_DP = 59.0
private const val BUBBLE_PADDING_DP = 22.0
private const val BUBBLE_FACE_DP = 36.0
private const val BUBBLE_FACE_STEP_DP = 28.0
private const val BUBBLE_EXTRA_GAP_DP = 10.0

/** About the width of one character of "+12" (15 sp, bold). */
private const val BUBBLE_EXTRA_CHAR_DP = 9.5

/** Web Mercator position in dp at [zoom], for distances between rings. */
private fun worldDp(
    latitude: Double,
    longitude: Double,
    zoom: Double,
): Pair<Double, Double> {
    val scale = TILE_DP * 2.0.pow(zoom)
    val x = (longitude + 180.0) / 360.0 * scale
    val s = sin(latitude * PI / 180.0).coerceIn(-0.9999, 0.9999)
    val y = (0.5 - ln((1 + s) / (1 - s)) / (4 * PI)) * scale
    return x to y
}

/** How far [count] rings that share a spot sit from it, far enough apart that their pins don't touch. */
private fun spreadRadius(count: Int): Double = (SPREAD_GAP_DP / 2 / sin(PI / count.coerceAtLeast(2))).coerceIn(SPREAD_DP, SPREAD_DP_MAX)

/** [rings] around their shared spot, one per step of a circle, far enough apart that their pins don't touch. */
private fun spread(rings: List<MomentRingUi>): List<MomentItem.Single> {
    val radius = spreadRadius(rings.size)
    return rings.mapIndexed { index, ring ->
        val angle = 2 * PI * index / rings.size - PI / 2
        MomentItem.Single(ring, dx = (radius * cos(angle)).toFloat(), dy = (radius * sin(angle)).toFloat(), fanned = true)
    }
}

/** Zoomed all the way in, a few rings fan out round their spot; more stay a crowded spot. */
private fun fansOut(
    group: List<MomentRingUi>,
    zoom: Double,
): Boolean = zoom >= MOMENTS_SPREAD_ZOOM && group.size in 2..FAN_LIMIT

/** Where something is drawn on the map, in world dp at the overlay's zoom. */
private data class Frame(
    val left: Double,
    val top: Double,
    val right: Double,
    val bottom: Double,
)

private fun pinFrame(
    x: Double,
    y: Double,
): Frame = Frame(x - PIN_HALF_WIDTH_DP, y - PIN_ABOVE_DP, x + PIN_HALF_WIDTH_DP, y + PIN_BELOW_DP)

/** A bubble's width: up to three faces 28 dp apart, and "+N" for the people it holds beyond them. */
private fun bubbleWidth(
    group: List<MomentRingUi>,
    fontScale: Double,
): Double {
    val people = group.distinctBy { it.author.id }.size
    val faces = people.coerceIn(1, 3)
    val extra = people - faces
    val extraWidth = if (extra > 0) BUBBLE_EXTRA_GAP_DP + BUBBLE_EXTRA_CHAR_DP * fontScale * ("+$extra".length) else 0.0
    return BUBBLE_PADDING_DP + BUBBLE_FACE_DP + BUBBLE_FACE_STEP_DP * (faces - 1) + extraWidth
}

/** What [group] draws: one pin, the pins of a fan, or a bubble at the middle of its rings. */
private fun frameOf(
    group: List<MomentRingUi>,
    positions: Map<String, Pair<Double, Double>>,
    zoom: Double,
    fontScale: Double,
): Frame {
    val points = group.map { positions.getValue(it.id) }
    if (group.size == 1) return pinFrame(points[0].first, points[0].second)
    if (fansOut(group, zoom)) {
        val radius = spreadRadius(group.size)
        val pins =
            points.mapIndexed { index, (x, y) ->
                val angle = 2 * PI * index / group.size - PI / 2
                pinFrame(x + radius * cos(angle), y + radius * sin(angle))
            }
        return Frame(pins.minOf { it.left }, pins.minOf { it.top }, pins.maxOf { it.right }, pins.maxOf { it.bottom })
    }
    val x = points.map { it.first }.average()
    val y = points.map { it.second }.average()
    val half = bubbleWidth(group, fontScale) / 2
    return Frame(x - half, y - BUBBLE_ABOVE_DP, x + half, y)
}

/**
 * Whether two groups would be drawn over each other: two pins when their centers are closer than 52 dp (iPhone's rule),
 * anything wider (a bubble, a fan) when the shapes overlap by more than the same 12 dp of give.
 */
private fun overlaps(
    first: List<MomentRingUi>,
    firstFrame: Frame,
    second: List<MomentRingUi>,
    secondFrame: Frame,
    positions: Map<String, Pair<Double, Double>>,
): Boolean {
    if (first.size == 1 && second.size == 1) {
        val (x, y) = positions.getValue(first[0].id)
        val (ox, oy) = positions.getValue(second[0].id)
        return hypot(ox - x, oy - y) < CLUSTER_DP
    }
    val across = min(firstFrame.right, secondFrame.right) - max(firstFrame.left, secondFrame.left)
    val down = min(firstFrame.bottom, secondFrame.bottom) - max(firstFrame.top, secondFrame.top)
    return across > OVERLAP_GIVE_DP && down > OVERLAP_GIVE_DP
}

/**
 * A bubble sits at the middle of its rings and is wider than a pin, so it can land on a ring or another bubble (your
 * own ring included): groups whose drawn shapes would overlap join, until none do (REVIEW LA2).
 */
private fun joinOverlapping(
    groups: MutableList<List<MomentRingUi>>,
    positions: Map<String, Pair<Double, Double>>,
    zoom: Double,
    fontScale: Double,
) {
    val frames = groups.mapTo(mutableListOf()) { frameOf(it, positions, zoom, fontScale) }
    while (true) {
        val (first, second) = firstOverlap(groups, frames, positions) ?: return
        groups[first] = groups[first] + groups[second]
        groups.removeAt(second)
        frames.removeAt(second)
        frames[first] = frameOf(groups[first], positions, zoom, fontScale)
    }
}

/** The first two groups that would be drawn over each other, by their places in [groups]; null when none are. */
private fun firstOverlap(
    groups: List<List<MomentRingUi>>,
    frames: List<Frame>,
    positions: Map<String, Pair<Double, Double>>,
): Pair<Int, Int>? {
    for (first in groups.indices) {
        for (second in first + 1 until groups.size) {
            if (overlaps(groups[first], frames[first], groups[second], frames[second], positions)) return first to second
        }
    }
    return null
}

/**
 * Gives each single pin with a height its tag's place (`MomentHeightTagPlan`): after the ring if nothing is there, else
 * before it, else over it, else none. [taken] is what every pin, fan and bubble covers; a pin's own frame is told apart by where it
 * stands. Taken in a steady order (by id), so a pin keeps its side from one read to the next. A floating pin (part D)
 * measures round its disc and tries the sides away from its shadow first, under it included ([bearing]: the map's turn).
 */
private fun tagged(
    singles: List<MomentItem.Single>,
    taken: List<Frame>,
    zoom: Double,
    heights: MomentHeightTagPlan,
    tagWidth: (MomentShownHeight) -> Double,
    bearing: Float = 0f,
): List<MomentItem.Single> {
    if (!heights.shown) return singles
    val edges = heights.edges?.let { (west, east) -> worldDp(0.0, west, zoom).first to worldDp(0.0, east, zoom).first }
    val floatOrder = heights.sun?.let { MomentsFloat.sides(it, bearing) }.orEmpty()
    val tags = mutableListOf<Frame>()
    val sides = mutableMapOf<String, MomentTagSide>()
    singles.filterNot { it.fanned }.sortedBy { it.ring.id }.forEach { single ->
        val height = single.ring.ring.shownHeight ?: return@forEach
        val (x, y) = worldDp(single.latitude, single.longitude, zoom)
        val width = tagWidth(height)
        val (own, places) = single.float?.let { floatPlaces(x, y, width, it, floatOrder) } ?: standingPlaces(x, y, width)
        val free =
            places.firstOrNull { (_, tag) ->
                val inside = edges == null || (tag.left >= edges.first + TAG_EDGE_DP && tag.right <= edges.second - TAG_EDGE_DP)
                inside && taken.none { it != own && it.touches(tag) } && tags.none { it.touches(tag) }
            } ?: return@forEach
        tags += free.second
        sides[single.ring.id] = free.first
    }
    return singles.map { single -> sides[single.ring.id]?.takeUnless { single.fanned }?.let { single.copy(tag = it) } ?: single }
}

/** A standing pin's own frame and its tag's places, in the order tried: after, before, over. */
private fun standingPlaces(
    x: Double,
    y: Double,
    width: Double,
): Pair<Frame, List<Pair<MomentTagSide, Frame>>> {
    val reach = PIN_HALF_WIDTH_DP + TAG_GAP_DP
    // Level with the middle of the ring, which is 39 dp above the pin's point.
    val top = y - TAG_MIDDLE_ABOVE_DP - TAG_HEIGHT_DP / 2
    val after = Frame(x + reach, top, x + reach + width, top + TAG_HEIGHT_DP)
    val before = Frame(x - reach - width, top, x - reach, top + TAG_HEIGHT_DP)
    val over = y - PIN_ABOVE_DP - TAG_GAP_ABOVE_DP
    val above = Frame(x - width / 2, over - TAG_HEIGHT_DP, x + width / 2, over)
    return pinFrame(x, y) to listOf(MomentTagSide.AFTER to after, MomentTagSide.BEFORE to before, MomentTagSide.ABOVE to above)
}

/** A floating pin's own frame (its disc round its spot) and its tag's places round the disc, in [order]. */
private fun floatPlaces(
    x: Double,
    y: Double,
    width: Double,
    height: MomentShownHeight,
    order: List<MomentTagSide>,
): Pair<Frame, List<Pair<MomentTagSide, Frame>>> {
    val radius = PIN_HALF_WIDTH_DP * MomentsFloat.scale(height)
    val reach = radius + TAG_GAP_DP
    val gap = radius + TAG_GAP_ABOVE_DP
    val top = y - TAG_HEIGHT_DP / 2
    val places =
        mapOf(
            MomentTagSide.AFTER to Frame(x + reach, top, x + reach + width, top + TAG_HEIGHT_DP),
            MomentTagSide.BEFORE to Frame(x - reach - width, top, x - reach, top + TAG_HEIGHT_DP),
            MomentTagSide.ABOVE to Frame(x - width / 2, y - gap - TAG_HEIGHT_DP, x + width / 2, y - gap),
            MomentTagSide.BELOW to Frame(x - width / 2, y + gap, x + width / 2, y + gap + TAG_HEIGHT_DP),
        )
    return discFrame(x, y, height) to order.mapNotNull { side -> places[side]?.let { side to it } }
}

/** What a floating pin covers: its disc, scaled for its elevation, round its spot. */
private fun discFrame(
    x: Double,
    y: Double,
    height: MomentShownHeight,
): Frame {
    val radius = PIN_HALF_WIDTH_DP * MomentsFloat.scale(height)
    return Frame(x - radius, y - radius, x + radius, y + radius)
}

/** Whether a tag at [tag] would sit on this frame, with a little space kept clear round it. */
private fun Frame.touches(tag: Frame): Boolean =
    left < tag.right + TAG_SPACE_DP &&
        right > tag.left - TAG_SPACE_DP &&
        top < tag.bottom + TAG_SPACE_DP &&
        bottom > tag.top - TAG_SPACE_DP

private const val TAG_GAP_DP = 3.0
private const val TAG_GAP_ABOVE_DP = 2.0
private const val TAG_HEIGHT_DP = 24.0
private const val TAG_MIDDLE_ABOVE_DP = 39.0
private const val TAG_SPACE_DP = 1.0
private const val TAG_EDGE_DP = 6.0

private fun buildItems(
    rings: List<MomentRingUi>,
    posting: List<MomentPosting>,
    zoom: Double,
    fontScale: Double,
    heights: MomentHeightTagPlan = MomentHeightTagPlan(),
    tagWidth: (MomentShownHeight) -> Double = { 0.0 },
    bearing: Float = 0f,
): List<MomentItem> {
    val positions = rings.associate { it.id to worldDp(it.latitude, it.longitude, zoom) }
    val used = mutableSetOf<String>()
    val groups = mutableListOf<List<MomentRingUi>>()
    // New rings claim their neighbors first, so a crowded spot is named after what's fresh there.
    rings.sortedByDescending { it.anyNew }.forEach { ring ->
        if (ring.id in used) return@forEach
        val (x, y) = positions.getValue(ring.id)
        val near =
            rings.filter { other ->
                other.id !in used && positions.getValue(other.id).let { (ox, oy) -> hypot(ox - x, oy - y) < CLUSTER_DP }
            }
        used += near.map { it.id }
        groups.add(near)
    }
    joinOverlapping(groups, positions, zoom, fontScale)
    val singles = mutableListOf<MomentItem.Single>()
    val bubbles = mutableListOf<MomentItem>()
    groups.forEach { group ->
        when {
            group.size < 2 -> singles += MomentItem.Single(group.first())
            fansOut(group, zoom) -> singles += spread(group)
            else -> bubbles += MomentItem.Group(group)
        }
    }
    // Watched rings under new ones, your posting Moment on top.
    // The tags are measured where the pins stand on screen: at the map's own zoom, not the rounded one.
    val exact = heights.zoom?.toDouble() ?: zoom
    val standing = if (exact == zoom) positions else rings.associate { it.id to worldDp(it.latitude, it.longitude, exact) }
    if (heights.sun != null && heights.shown) {
        return floatItems(groups, singles, bubbles, posting, standing, exact, zoom, fontScale, heights, tagWidth, bearing)
    }
    val taken = groups.map { frameOf(it, standing, zoom, fontScale) }
    val ordered = tagged(singles.sortedBy { it.ring.anyNew }, taken, exact, heights, tagWidth)
    return bubbles + ordered + posting.map { MomentItem.Posting(it) }
}

/**
 * Part D, by day: each single pin with an elevation floats (fans and crowded spots don't), covers its disc for the
 * tags' room, and the higher ones are drawn over the lower ones, all over the pins that stand on their spots.
 */
private fun floatItems(
    groups: List<List<MomentRingUi>>,
    singles: List<MomentItem.Single>,
    bubbles: List<MomentItem>,
    posting: List<MomentPosting>,
    standing: Map<String, Pair<Double, Double>>,
    exact: Double,
    zoom: Double,
    fontScale: Double,
    heights: MomentHeightTagPlan,
    tagWidth: (MomentShownHeight) -> Double,
    bearing: Float,
): List<MomentItem> {
    val floated =
        singles.map { single -> single.ring.ring.shownHeight?.takeUnless { single.fanned }?.let { single.copy(float = it) } ?: single }
    val heightOf = floated.mapNotNull { single -> single.float?.let { single.ring.id to it } }.toMap()
    val taken =
        groups.map { group ->
            val height = group.singleOrNull()?.let { heightOf[it.id] }
            val (x, y) = standing.getValue(group.first().id)
            if (height != null) discFrame(x, y, height) else frameOf(group, standing, zoom, fontScale)
        }
    val ordered =
        floated
            .sortedBy { it.ring.anyNew }
            .sortedWith(compareBy({ it.float?.let(MomentsFloat::lift) ?: -1.0 }, { it.float?.feet ?: Int.MIN_VALUE }))
    return bubbles + tagged(ordered, taken, exact, heights, tagWidth, bearing) + posting.map { MomentItem.Posting(it) }
}
