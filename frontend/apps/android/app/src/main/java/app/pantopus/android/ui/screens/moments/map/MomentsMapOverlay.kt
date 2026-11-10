@file:Suppress("MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.moments.map

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.moments.MomentPosting
import app.pantopus.android.ui.screens.moments.components.MOMENT_CLUSTER_ANCHOR_FROM_TOP
import app.pantopus.android.ui.screens.moments.components.MOMENT_PIN_ANCHOR_FROM_TOP
import app.pantopus.android.ui.screens.moments.components.MomentClusterBubble
import app.pantopus.android.ui.screens.moments.components.MomentMapPin
import app.pantopus.android.ui.screens.moments.components.MomentPostingPin
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.pantopusShadow
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.CameraPositionState
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.log2
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
        override val latitude: Double get() = posting.latitude
        override val longitude: Double get() = posting.longitude
    }
}

/**
 * Rings over the Google map (boards M1, M2, P5), placed where the map projects them and moved with every camera
 * change without recomposing, as Plans' pins are. Drawn in Compose rather than as map markers so each ring can carry
 * the person's photo and TalkBack reads it ("Aisha M., 1 Moment, new, at Esther Short Park"). Rings closer than about
 * 48 dp gather into a crowded spot; tapping it zooms in. Zoomed all the way, rings that share a spot fan out in a
 * circle so each can be tapped. Taps anywhere else reach the map.
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
    mapReady: Boolean = true,
    camera: () -> CameraPosition = { cameraState.position },
    layoutKey: () -> Any? = { null },
) {
    val zoom by remember(cameraState) { derivedStateOf { (camera().zoom * 2f).roundToInt() / 2f } }
    val items = remember(rings, posting, zoom) { buildItems(rings, posting, zoom.toDouble()) }
    val density = LocalDensity.current
    val pxPerDp = density.density
    val pinAnchor = with(density) { MOMENT_PIN_ANCHOR_FROM_TOP.toPx() }
    val clusterAnchor = with(density) { MOMENT_CLUSTER_ANCHOR_FROM_TOP.toPx() }
    Layout(
        // Rings near an edge never draw over the status bar or the tab bar.
        modifier = modifier.fillMaxSize().clipToBounds(),
        content = {
            items.forEach { item ->
                key(item.key) {
                    when (item) {
                        is MomentItem.Single -> RingItem(item.ring) { onRing(item.ring) }
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
                val anchorY = if (item is MomentItem.Group) clusterAnchor else pinAnchor
                val single = item as? MomentItem.Single
                placeable.place(
                    x = (point.x - placeable.width / 2f + (single?.dx ?: 0f) * pxPerDp).roundToInt(),
                    y = (point.y - anchorY + (single?.dy ?: 0f) * pxPerDp).roundToInt(),
                )
            }
        }
    }
}

@Composable
private fun RingItem(
    ring: MomentRingUi,
    onTap: () -> Unit,
) {
    MomentMapPin(
        author = ring.author,
        seen = ring.seen,
        modifier =
            Modifier
                .testTag("moments.ring.${ring.id}")
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    role = Role.Button,
                    onClick = onTap,
                )
                .clearAndSetSemantics {
                    contentDescription = ring.spoken
                    role = Role.Button
                    onClick(label = "Watch") {
                        onTap()
                        true
                    }
                },
    )
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

/** Room kept around a framed crowded spot: a pin's height above its spot, half its width at the sides. */
private const val FRAME_TOP_DP = 92.0
private const val FRAME_SIDE_DP = 48.0
private const val FRAME_BOTTOM_DP = 28.0
private const val FRAME_MIN_DP = 40.0

private const val CLUSTER_DP = 48.0

/** From this zoom, rings that share a spot fan out in a circle instead of a crowded spot. */
const val MOMENTS_SPREAD_ZOOM = 17.0
private const val SPREAD_DP = 40.0
private const val SPREAD_DP_MAX = 96.0
private const val SPREAD_GAP_DP = 70.0
private const val TILE_DP = 256.0

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

/** [rings] around their shared spot, one per step of a circle, far enough apart that their pins don't touch. */
private fun spread(rings: List<MomentRingUi>): List<MomentItem.Single> {
    val radius = (SPREAD_GAP_DP / 2 / sin(PI / rings.size.coerceAtLeast(2))).coerceIn(SPREAD_DP, SPREAD_DP_MAX)
    return rings.mapIndexed { index, ring ->
        val angle = 2 * PI * index / rings.size - PI / 2
        MomentItem.Single(ring, dx = (radius * cos(angle)).toFloat(), dy = (radius * sin(angle)).toFloat())
    }
}

private fun buildItems(
    rings: List<MomentRingUi>,
    posting: List<MomentPosting>,
    zoom: Double,
): List<MomentItem> {
    val positions = rings.associate { it.id to worldDp(it.latitude, it.longitude, zoom) }
    val used = mutableSetOf<String>()
    val singles = mutableListOf<MomentItem>()
    val groups = mutableListOf<MomentItem>()
    // New rings claim their neighbors first, so a crowded spot is named after what's fresh there.
    rings.sortedByDescending { it.anyNew }.forEach { ring ->
        if (ring.id in used) return@forEach
        val (x, y) = positions.getValue(ring.id)
        val near =
            rings.filter { other ->
                other.id !in used && positions.getValue(other.id).let { (ox, oy) -> hypot(ox - x, oy - y) < CLUSTER_DP }
            }
        used += near.map { it.id }
        when {
            near.size < 2 -> singles += MomentItem.Single(ring)
            zoom >= MOMENTS_SPREAD_ZOOM -> singles += spread(near)
            else -> groups += MomentItem.Group(near)
        }
    }
    // Watched rings under new ones, your posting Moment on top.
    val ordered = singles.sortedBy { (it as MomentItem.Single).ring.anyNew }
    return groups + ordered + posting.map { MomentItem.Posting(it) }
}
