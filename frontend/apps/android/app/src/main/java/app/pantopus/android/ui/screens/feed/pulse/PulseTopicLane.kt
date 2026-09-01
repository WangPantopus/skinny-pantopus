@file:Suppress("LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.sports.ActiveSportsEventDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Nearby feed's topic lane. RN ships exactly one topic — Sports —
 * which replaces the post-type chip row with its own For You / Local /
 * Event / Watch mode chips, floats an active-event module above the
 * list, and offers starter prompts in the empty state.
 *
 * Constants mirror `src/constants/feed.ts:31-70`; the feed query params
 * (`topic`, `sportsMode`, `eventKey`) are validated at
 * `backend/routes/posts.js:1478-1489`.
 */
enum class PulseTopic(
    val key: String,
    val label: String,
    val icon: PantopusIcon,
) {
    Sports("sports", "Sports", PantopusIcon.Activity),
    ;

    companion object {
        fun fromKey(key: String?): PulseTopic? = entries.firstOrNull { it.key == key }
    }
}

/**
 * Mode chips shown while the Sports lane is active. Sent as
 * `sportsMode` — the handler 400s on anything outside this set
 * (`backend/routes/posts.js:1485`).
 */
enum class PulseSportsMode(
    val key: String,
    val label: String,
    val icon: PantopusIcon,
) {
    ForYou("for_you", "For You", PantopusIcon.Sparkles),
    Local("local", "Local", PantopusIcon.MapPin),
    Event("event", "Event", PantopusIcon.Crown),
    Watch("watch", "Watch", PantopusIcon.Tv),
    ;

    companion object {
        fun fromKey(key: String): PulseSportsMode = entries.firstOrNull { it.key == key } ?: ForYou
    }
}

/**
 * One Sports empty-state starter. Tapping it opens the composer with the
 * prompt pre-filled — RN `SPORTS_PULSE_STARTERS`
 * (`src/constants/feed.ts:180-193`).
 */
@Immutable
data class PulseSportsStarter(
    val id: String,
    val label: String,
    /** Composer body pre-fill. */
    val placeholder: String,
) {
    companion object {
        /** Ordered exactly as RN renders them. */
        val all: List<PulseSportsStarter> =
            listOf(
                PulseSportsStarter(
                    id = "anyone_watching",
                    label = "Anyone watching tonight?",
                    placeholder = "Who are you watching tonight? Anyone want to join?",
                ),
                PulseSportsStarter(
                    id = "best_place_watch",
                    label = "Best place to watch?",
                    placeholder = "Any good spots to watch around here?",
                ),
                PulseSportsStarter(
                    id = "youth_signups",
                    label = "Youth sports signups?",
                    placeholder = "Looking for youth league signups or tryouts…",
                ),
                PulseSportsStarter(
                    id = "pickup_weekend",
                    label = "Pickup game this weekend?",
                    placeholder = "Anyone want to run a pickup game this weekend?",
                ),
            )
    }
}

/**
 * Row of topic chips under the surface toggle. Tapping an active chip
 * exits the lane (RN `TopicChipRow.tsx:38`).
 */
@Composable
fun PulseTopicChipRow(
    topics: List<PulseTopic>,
    activeTopic: PulseTopic?,
    onSelect: (PulseTopic?) -> Unit,
) {
    if (topics.isEmpty()) return
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag("pulseTopicChipRow"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        topics.forEach { topic ->
            val active = activeTopic == topic
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (active) PantopusColors.primary600 else PantopusColors.appSurfaceRaised)
                        .border(
                            1.dp,
                            if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(Radii.pill),
                        ).clickable { onSelect(if (active) null else topic) }
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .semantics { selected = active }
                        .testTag("pulseTopicChip_${topic.key}"),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = topic.icon,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
                Text(
                    text = topic.label,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                )
            }
        }
    }
}

/**
 * Compact card above the Sports feed while a major event is live —
 * RN `SportsEventModule.tsx`.
 */
@Composable
fun PulseSportsEventModule(
    event: ActiveSportsEventDto,
    onSeeThreads: () -> Unit,
    onStartThread: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag("pulseSportsEventModule"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Crown,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "${event.displayName ?: event.eventKey} is live",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                maxLines = 1,
            )
        }
        Text(
            text = "Start a game thread, ask where to watch, or share your take.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier = Modifier.padding(top = Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "See threads",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .clickable { onSeeThreads() }
                        .padding(horizontal = Spacing.s3, vertical = 7.dp)
                        .testTag("pulseSportsEventSeeThreads"),
            )
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable { onStartThread() }
                        .padding(horizontal = Spacing.s3, vertical = 7.dp)
                        .testTag("pulseSportsEventStartThread"),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Pencil,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.2f,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Start a thread",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/** Starter chips rendered under the Sports lane's empty state. */
@Composable
fun PulseSportsStarterRow(onSelect: (PulseSportsStarter) -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("pulseSportsStarters"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Start the conversation",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PulseSportsStarter.all.forEach { starter ->
                Text(
                    text = starter.label,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.primary50)
                            .clickable { onSelect(starter) }
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("pulseSportsStarter_${starter.id}"),
                )
            }
        }
    }
}
