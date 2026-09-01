@file:Suppress("PackageNaming", "MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.homes.members.MemberAvatarTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import java.util.Locale

/**
 * Shared Home-scheduling primitives reused by F1 (agenda union), F2
 * (event detail RSVP) and F15 (gated scheduler). Mirrors iOS
 * `HomeSchedulingKit.swift`.
 */

/** The four RSVP states a household member can record. Mirrors iOS `HomeRsvpChoice`. */
enum class HomeRsvpChoice {
    Going,
    Maybe,
    Cant,
    NoReply,
    ;

    /** Backend status string sent on `POST …/rsvp`. */
    val backendValue: String
        get() =
            when (this) {
                Going -> "going"
                Maybe -> "maybe"
                Cant -> "declined"
                NoReply -> "pending"
            }

    val label: String
        get() =
            when (this) {
                Going -> "Going"
                Maybe -> "Maybe"
                Cant -> "Can't"
                NoReply -> "No reply"
            }

    val icon: PantopusIcon
        get() =
            when (this) {
                Going -> PantopusIcon.Check
                Maybe -> PantopusIcon.HelpCircle
                Cant -> PantopusIcon.X
                NoReply -> PantopusIcon.Minus
            }

    val background: Color
        get() =
            when (this) {
                Going -> PantopusColors.successBg
                Maybe -> PantopusColors.warningBg
                Cant -> PantopusColors.errorBg
                NoReply -> PantopusColors.appSurfaceSunken
            }

    val foreground: Color
        get() =
            when (this) {
                Going -> PantopusColors.success
                Maybe -> PantopusColors.warning
                Cant -> PantopusColors.error
                NoReply -> PantopusColors.appTextSecondary
            }

    companion object {
        /** The three states the member can actively pick (excludes [NoReply]). */
        val selectable: List<HomeRsvpChoice> = listOf(Going, Maybe, Cant)

        /** Decode a backend `rsvp_status` string. `pending`/unknown → null (renders unselected). */
        fun fromBackend(raw: String?): HomeRsvpChoice? =
            when (raw?.lowercase(Locale.ROOT)) {
                "going" -> Going
                "maybe" -> Maybe
                "declined", "cant" -> Cant
                else -> null
            }
    }
}

/** A household member resolved for the agenda / attendee rows. */
@Immutable
data class HomeMember(
    val id: String,
    val name: String,
    val initials: String,
    val isYou: Boolean = false,
) {
    companion object {
        fun initialsFor(name: String): String =
            name
                .split(' ')
                .take(2)
                .mapNotNull { it.firstOrNull()?.toString() }
                .joinToString("")
                .uppercase(Locale.ROOT)
    }
}

/** Two-stop gradient brush for a member avatar, stable per user-id. */
fun memberGradient(id: String): Brush {
    val pair = MemberAvatarTone.toneFor(id).gradient
    return Brush.linearGradient(listOf(pair.start, pair.end))
}

/** Round gradient avatar with initials. Mirrors iOS `HomeMemberAvatar`. */
@Composable
fun HomeMemberAvatar(
    member: HomeMember,
    modifier: Modifier = Modifier,
    size: Dp = 26.dp,
) {
    Box(
        modifier =
            modifier
                .size(size)
                .clip(CircleShape)
                .background(memberGradient(member.id))
                .semantics { contentDescription = member.name },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = member.initials.ifEmpty { "·" },
            color = PantopusColors.appTextInverse,
            fontSize = (size.value * 0.38f).sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

/** Overlapping avatar stack (max 3 + overflow). Mirrors iOS `HomeAvatarStack`. */
@Composable
fun HomeAvatarStack(
    members: List<HomeMember>,
    modifier: Modifier = Modifier,
    size: Dp = 26.dp,
    maxVisible: Int = 3,
) {
    if (members.isEmpty()) return
    val visible = members.take(maxVisible)
    val overflow = members.size - visible.size
    val overlap = (size.value * 0.34f).dp
    Row(
        modifier = modifier.semantics { contentDescription = "Assigned to ${members.joinToString(", ") { it.name }}" },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        visible.forEachIndexed { index, member ->
            Box(
                modifier =
                    Modifier
                        .offset(x = if (index == 0) 0.dp else -overlap * index)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .padding(1.5.dp),
            ) {
                HomeMemberAvatar(member = member, size = size)
            }
        }
        if (overflow > 0) {
            Box(
                modifier =
                    Modifier
                        .offset(x = -overlap * visible.size)
                        .size(size)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .padding(1.5.dp),
            ) {
                Box(
                    modifier = Modifier.size(size).clip(CircleShape).background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "+$overflow",
                        color = PantopusColors.appTextSecondary,
                        fontSize = (size.value * 0.32f).sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }
}

/** Home-green "Booking" tag shown on booking-union rows. Mirrors iOS `HomeBookingTag`. */
@Composable
fun HomeBookingTag(modifier: Modifier = Modifier) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.homeBg)
                .padding(horizontal = 8.dp, vertical = 2.dp)
                .semantics { contentDescription = "Booking" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CalendarCheck,
            contentDescription = null,
            size = 10.dp,
            tint = PantopusColors.homeDark,
        )
        Text(text = "Booking", fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.homeDark)
    }
}

/**
 * Booking status badge — `pending` (warning) / `confirmed` (success).
 * Mirrors iOS `SchedulingStatusPill`; testTag `scheduling.statusPill.{status}`.
 */
@Composable
fun SchedulingStatusBadge(
    status: String,
    modifier: Modifier = Modifier,
) {
    val (label, bg, fg) =
        when (status.lowercase(Locale.ROOT)) {
            "confirmed" -> Triple("Confirmed", PantopusColors.successBg, PantopusColors.success)
            "pending" -> Triple("Pending", PantopusColors.warningBg, PantopusColors.warning)
            else -> Triple(status.replaceFirstChar { it.uppercase() }, PantopusColors.appSurfaceSunken, PantopusColors.appTextSecondary)
        }
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(bg)
                .padding(horizontal = 8.dp, vertical = 3.dp)
                .testTag("scheduling.statusPill.${status.lowercase(Locale.ROOT)}")
                .semantics { contentDescription = label },
    ) {
        Text(text = label, fontSize = 9.5.sp, fontWeight = FontWeight.Bold, color = fg)
    }
}

/** Per-member RSVP pill shown in the attendee list (F2). Mirrors iOS `HomeRsvpPill`. */
@Composable
fun HomeRsvpPill(
    choice: HomeRsvpChoice,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(choice.background)
                .padding(horizontal = 9.dp, vertical = 3.dp)
                .semantics { contentDescription = "RSVP: ${choice.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        PantopusIconImage(icon = choice.icon, contentDescription = null, size = 11.dp, tint = choice.foreground)
        Text(text = choice.label, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = choice.foreground)
    }
}
