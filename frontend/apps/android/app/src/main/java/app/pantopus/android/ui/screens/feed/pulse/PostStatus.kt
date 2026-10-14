package app.pantopus.android.ui.screens.feed.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId
import java.time.format.TextStyle
import java.util.Locale

/**
 * How a post ended, or when a heads-up ends (Pulse build S7, build spec section 4): the one status word the card, the
 * post page, My posts and Saved show. The words were agreed with iOS (PI) on October 14.
 */
@Immutable
data class PostStatus(
    /** What the pill shows: "Answered", "Gone", "Reunited", "Happened · 3 went", "Ends Wed 4pm". */
    val text: String,
    /** What TalkBack reads ("Answered", not the check mark). */
    val spoken: String,
    val kind: Kind,
) {
    enum class Kind {
        /** An Ask someone answered: the check icon. */
        Answered,

        /** An offer claimed, a pet reunited, an event that happened. */
        Ended,

        /** An open heads-up with an end time: the clock icon. */
        Ends,
    }

    companion object {
        private val ANSWERED = PostStatus(text = "Answered", spoken = "Answered", kind = Kind.Answered)

        /**
         * The status of a post from its `resolution` (S7's columns; null while open) and, for older rows, its `state`.
         * `closed`, `closed_unanswered`, `expired` and values this build doesn't know show no word: those posts have
         * left the views. An open heads-up whose `expires_at` is still ahead shows when it ends, in the viewer's zone.
         * [goingCount] is the event's going count (the like count today).
         */
        fun of(
            postType: String?,
            state: String?,
            resolution: String?,
            expiresAt: String?,
            goingCount: Int,
            now: Instant = Instant.now(),
            zone: ZoneId = ZoneId.systemDefault(),
        ): PostStatus? =
            when (resolution) {
                "answered" -> ANSWERED
                "claimed" -> PostStatus(text = "Gone", spoken = "Gone", kind = Kind.Ended)
                "reunited" -> PostStatus(text = "Reunited", spoken = "Reunited", kind = Kind.Ended)
                "happened" ->
                    if (goingCount > 0) {
                        PostStatus(text = "Happened · $goingCount went", spoken = "Happened, $goingCount went", kind = Kind.Ended)
                    } else {
                        PostStatus(text = "Happened", spoken = "Happened", kind = Kind.Ended)
                    }
                null ->
                    when {
                        state == "solved" -> ANSWERED
                        postType == "alert" -> endsStatus(expiresAt, now, zone)
                        else -> null
                    }
                else -> null
            }

        private fun endsStatus(
            expiresAt: String?,
            now: Instant,
            zone: ZoneId,
        ): PostStatus? {
            val end = runCatching { Instant.parse(expiresAt) }.getOrNull()?.takeIf { it.isAfter(now) } ?: return null
            val words = "Ends ${dayAndHour(end, zone)}"
            return PostStatus(text = words, spoken = words, kind = Kind.Ends)
        }

        /** "Wed 4pm", "Wed 4:30pm": the weekday and the time in [zone], am or pm in lower case with no space. */
        fun dayAndHour(
            at: Instant,
            zone: ZoneId = ZoneId.systemDefault(),
        ): String {
            val local = at.atZone(zone)
            val day = local.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.getDefault())
            val hour12 = (local.hour % HOURS_ON_CLOCK).let { if (it == 0) HOURS_ON_CLOCK else it }
            val minutes = if (local.minute == 0) "" else ":%02d".format(local.minute)
            val half = if (local.hour < HOURS_ON_CLOCK) "am" else "pm"
            return "$day $hour12$minutes$half"
        }

        private const val HOURS_ON_CLOCK = 12
    }
}

/** The status as a small pill: words always, an icon for "Answered" (check) and "Ends …" (clock); id `pulsePostStatus_<post id>`. */
@Composable
fun PostStatusPill(
    status: PostStatus,
    postId: String,
    modifier: Modifier = Modifier,
) {
    val (tint, background) =
        when (status.kind) {
            PostStatus.Kind.Answered -> PantopusColors.success to PantopusColors.successLight
            PostStatus.Kind.Ended -> PantopusColors.slate to PantopusColors.slateBg
            PostStatus.Kind.Ends -> PantopusColors.warning to PantopusColors.warningBg
        }
    Row(
        modifier =
            modifier
                .heightIn(min = 22.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2)
                .clearAndSetSemantics { contentDescription = status.spoken }
                .testTag("pulsePostStatus_$postId"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        val icon =
            when (status.kind) {
                PostStatus.Kind.Answered -> PantopusIcon.CheckCircle
                PostStatus.Kind.Ends -> PantopusIcon.Clock
                PostStatus.Kind.Ended -> null
            }
        icon?.let { PantopusIconImage(icon = it, contentDescription = null, size = 11.dp, tint = tint) }
        Text(text = status.text, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tint)
    }
}
