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
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.sports.ActiveSportsEventDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The Pulse topics (build spec section 4, contract section 1): a fixed list of 12, in this order. A topic filters; it
 * joins nothing. Picking one asks the Place feed for that topic (`?topic=`, `backend/routes/posts.js`, the 12 in
 * `backend/services/pulse/topics.js`). Sports keeps the lane RN shipped: For You / Local / Event / Watch mode chips in
 * place of the post-type row, an active-event module above the list, and starter prompts in the empty state
 * (constants mirror `src/constants/feed.ts:31-70`).
 */
enum class PulseTopic(
    val key: String,
    val label: String,
    val icon: PantopusIcon,
) {
    AroundHere("around_here", "Around here", PantopusIcon.MapPin),
    Outdoors("outdoors", "Outdoors", PantopusIcon.Trees),
    Gardening("gardening", "Gardening", PantopusIcon.Flower2),
    HomeRepairs("home_repairs", "Home and repairs", PantopusIcon.Hammer),
    Food("food", "Food", PantopusIcon.Utensils),
    KidsSchools("kids_schools", "Kids and schools", PantopusIcon.GraduationCap),
    Pets("pets", "Pets", PantopusIcon.PawPrint),
    ArtsCulture("arts_culture", "Arts and culture", PantopusIcon.Palette),
    Sports("sports", "Sports and fitness", PantopusIcon.Activity),
    GettingAround("getting_around", "Getting around", PantopusIcon.Bus),
    LocalGovernment("local_government", "Local government", PantopusIcon.Landmark),
    Volunteering("volunteering", "Volunteering", PantopusIcon.Hand),
    ;

    /** The name in the October 13 lane (the Pulse redesign off), which had Sports alone, called "Sports". */
    val launchLabel: String get() = if (this == Sports) "Sports" else label

    companion object {
        /** Chips shown before "More" (build spec section 4: a few at a time). */
        const val SHOWN_BEFORE_MORE = 5

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
 * The topic chips under the surface toggle (Pulse build S4): All, then the topics a few at a time with "More", which
 * shows the rest in the same row. Picking a topic replaces the one chosen; All, or tapping the chosen chip again,
 * clears it. A chosen topic always shows, and nothing is remembered across a relaunch. TalkBack reads one name per
 * chip ("All topics", "Gardening topic", "More topics"); ids `pulseTopicChip_all`, `pulseTopicChip_<topic id>` and
 * `pulseTopicChip_more`, as on iOS. With the Pulse redesign off it is the October 13 lane: the Sports chip alone
 * (`PulseFeedViewModel.availableTopics`), named "Sports", and no All; tapping it again leaves the lane.
 */
@Composable
fun PulseTopicChipRow(
    topics: List<PulseTopic>,
    activeTopic: PulseTopic?,
    onSelect: (PulseTopic?) -> Unit,
) {
    if (topics.isEmpty()) return
    val redesign = LaunchFeatures.pulseRedesign
    var expanded by rememberSaveable { mutableStateOf(false) }
    val first = topics.take(PulseTopic.SHOWN_BEFORE_MORE)
    val shown =
        when {
            expanded -> topics
            activeTopic != null && activeTopic !in first -> first + activeTopic
            else -> first
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .selectableGroup()
                .testTag("pulseTopicChipRow"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (redesign) {
            TopicChip(
                label = "All",
                icon = null,
                spokenName = "All topics",
                active = activeTopic == null,
                testTag = "pulseTopicChip_all",
                onClick = { onSelect(null) },
            )
        }
        shown.forEach { topic ->
            val label = if (redesign) topic.label else topic.launchLabel
            TopicChip(
                label = label,
                icon = topic.icon,
                spokenName = if (redesign) "$label topic" else label,
                active = activeTopic == topic,
                testTag = "pulseTopicChip_${topic.key}",
                onClick = { onSelect(if (activeTopic == topic) null else topic) },
            )
        }
        if (shown.size < topics.size) {
            MoreTopicsChip(onClick = { expanded = true })
        }
    }
}

@Composable
private fun TopicChip(
    label: String,
    icon: PantopusIcon?,
    spokenName: String,
    active: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (active) PantopusColors.primary600 else PantopusColors.appSurfaceRaised)
                .border(
                    1.dp,
                    if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                    RoundedCornerShape(Radii.pill),
                ).testTag(testTag)
                // One node per chip, read once with its state: the role and selection stay, the inner label goes.
                .selectable(selected = active, role = Role.RadioButton, onClick = onClick)
                .clearAndSetSemantics { contentDescription = spokenName }
                .padding(horizontal = Spacing.s3, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            PantopusIconImage(
                icon = it,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
            )
        }
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
            color = if (active) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
        )
    }
}

/** "More": shows the rest of the topics in the same row (no "Less"). */
@Composable
private fun MoreTopicsChip(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .testTag("pulseTopicChip_more")
                .clickable(role = Role.Button, onClick = onClick)
                .clearAndSetSemantics { contentDescription = "More topics" }
                .padding(horizontal = Spacing.s3, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = "More", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.primary600)
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 12.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
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
