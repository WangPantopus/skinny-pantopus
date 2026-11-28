@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented.after

import android.os.SystemClock
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.MomentPlanDto
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.ui.screens.plans.host.HostDraft
import app.pantopus.android.ui.screens.plans.host.PickedPlace
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * What today's plan composer is filled with when a plan starts from a Moment ("Want to come?", CONTRACT 6g): the
 * Moment's words as the title and, when it has one, the place everyone sees (its own answer's point and label, never
 * a finer one). The person changes either in the composer.
 */
data class MomentPlanSeed(
    val momentId: String,
    val title: String,
    val placeName: String?,
    val latitude: Double?,
    val longitude: Double?,
) {
    companion object {
        fun of(moment: MomentDto): MomentPlanSeed {
            val words = (if (moment.kind == "text") moment.text else moment.caption).orEmpty().trim().take(TITLE_MAX)
            val label = moment.placeLabel?.takeIf { it.isNotBlank() }
            val placed = !moment.noLocation && label != null && moment.latitude != null && moment.longitude != null
            return MomentPlanSeed(
                momentId = moment.id,
                title = words,
                placeName = label.takeIf { placed },
                latitude = moment.latitude.takeIf { placed },
                longitude = moment.longitude.takeIf { placed },
            )
        }

        private const val TITLE_MAX = 80
    }
}

/**
 * The plan waiting for the Plans tab's composer ("Want to come?"), as Today's "Host again" hands one over: the viewer
 * closes, the Plans tab opens its composer (`/plans/new`), and the composer takes the seed once. Presented there, the
 * composer keeps its own pickers (LEAD-3, 90th pass: never present it over the viewer).
 */
object MomentPlanHandoff {
    /** The seed and when it was handed (the phone's uptime clock, which never jumps). */
    @Volatile private var pending: Pair<MomentPlanSeed, Long>? = null

    fun hand(seed: MomentPlanSeed) {
        pending = seed to SystemClock.elapsedRealtime()
    }

    /**
     * The seed, once, and only for the composer that opens right after it was handed (within [FRESH_MS]); null for
     * every composer opened any other way. A hand-over nobody took (the composer was already open, the person backed
     * out) is dropped, so a later "Host a plan" never starts from that Moment (LEAD-3, 15:27).
     */
    fun take(): MomentPlanSeed? {
        val (seed, at) = pending ?: return null
        pending = null
        return seed.takeIf { SystemClock.elapsedRealtime() - at <= FRESH_MS }
    }

    private const val FRESH_MS = 15_000L
}

/**
 * The Plans composer's draft filled from the Moment, once its kind is chosen: the words as the title and the Moment's
 * place as the plan's public place (the person may change either). A Moment shown as an area gives its area's point.
 */
internal fun HostDraft.filledFrom(seed: MomentPlanSeed): HostDraft {
    var draft = this
    if (seed.title.isNotBlank()) draft = draft.copy(title = seed.title, titleEdited = true)
    val name = seed.placeName
    val latitude = seed.latitude
    val longitude = seed.longitude
    if (name != null && latitude != null && longitude != null) {
        val place =
            PickedPlace(name = name, address = null, latitude = latitude, longitude = longitude, category = null, distanceMeters = null)
        draft = draft.copy(atHome = false, place = place)
    }
    return draft
}

/** Whether "Want to come?" is offered here: Plans is on for the person (read where the viewer is). */
@HiltViewModel
class MomentPlanViewModel
    @Inject
    constructor(
        feature: PlansFeature,
    ) : ViewModel() {
        val flags = feature.flags
    }

/**
 * "Want to come? Start a plan" is offered on one's own live Moment under one's own name with no plan yet, while Plans
 * is on (the viewer's caller decides the switch: `studio`).
 */
internal fun MomentDto.offersPlan(
    mine: Boolean,
    plansOn: Boolean,
    now: Instant = Instant.now(),
): Boolean {
    if (!mine || !plansOn || plan != null) return false
    // A plan shows who hosts it: never from a business's or a made-up name's Moment.
    if (author.kind != "person" || author.madeUpName || state != "live") return false
    val ends = expiresAt?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return false
    return ends.isAfter(now)
}

/** What the viewer's own-Moment menu offers, set by [MomentPlanOffer] while it shows, read by [MomentPlanMenuItem]. */
internal object MomentPlanMenu {
    val offer = mutableStateOf<(() -> Unit)?>(null)
}

/**
 * Under the viewer's header while the switch is on (the caller's `studio`): the Moment's plan, opening its own screen in
 * Plans ("Your plan", "Want to come?" or "You're in"); and, on one's own live Moment with no plan yet while Plans is on,
 * "Want to come? Start a plan" in the More menu ([MomentPlanMenuItem]). [onClose] closes the viewer first.
 */
@Composable
fun MomentPlanOffer(
    moment: MomentDto,
    mine: Boolean,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: MomentPlanViewModel = hiltViewModel(),
) {
    val flags by viewModel.flags.collectAsStateWithLifecycle()
    // "Mail it" (8j) rides the same hook: it sets its own item in the same More menu.
    MomentMailItOffer(moment, mine, onClose)
    val offers = moment.offersPlan(mine, flags.plans)
    DisposableEffect(moment.id, offers) {
        MomentPlanMenu.offer.value =
            if (offers) {
                {
                    MomentPlanHandoff.hand(MomentPlanSeed.of(moment))
                    onClose()
                    DeepLinkRouter.handle("/plans/new")
                }
            } else {
                null
            }
        onDispose { MomentPlanMenu.offer.value = null }
    }
    val plan = moment.plan ?: return
    MomentPlanPill(plan, mine, modifier) {
        onClose()
        DeepLinkRouter.handle("/plans/${plan.id}")
    }
}

/**
 * "Want to come? Start a plan" in one's own Moment's More menu, while [MomentPlanOffer] offers it; then "Mail it" while
 * [MomentMailItOffer] offers it (8j); else nothing.
 */
@Composable
fun MomentPlanMenuItem() {
    MomentPlanStartItem()
    MomentMailItMenuItem()
}

@Composable
private fun MomentPlanStartItem() {
    val start = MomentPlanMenu.offer.value ?: return
    DropdownMenuItem(
        text = { Text("Want to come? Start a plan", color = Color.White) },
        leadingIcon = { PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 18.dp, tint = Color.White) },
        onClick = start,
        modifier = Modifier.testTag("moments.menu.plan"),
    )
}

@Composable
private fun MomentPlanPill(
    plan: MomentPlanDto,
    mine: Boolean,
    modifier: Modifier = Modifier,
    onOpen: () -> Unit,
) {
    val heading =
        when {
            mine -> "Your plan"
            plan.viewerRole == "guest" -> "You're in"
            else -> "Want to come?"
        }
    val going = plan.goingCount?.takeIf { it > 0 }?.let { "$it going" }
    val line = listOfNotNull(plan.title, planTime(plan.startsAt), going).joinToString(" · ")
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.primary600.copy(alpha = 0.92f))
                .clickable(role = Role.Button, onClickLabel = "Open the plan in Plans", onClick = onOpen)
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .testTag("moments.viewer.plan"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Calendar, contentDescription = null, size = 16.dp, tint = Color.White)
        Column {
            Text(heading, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(line, fontSize = 12.5.sp, color = Color.White.copy(alpha = 0.85f), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** "Sat 11:00 AM", in the phone's own time zone; null when it can't be read. */
private fun planTime(iso: String?): String? =
    iso
        ?.let { runCatching { Instant.parse(it) }.getOrNull() }
        ?.atZone(ZoneId.systemDefault())
        ?.format(DateTimeFormatter.ofPattern("EEE h:mm a", Locale.US))
