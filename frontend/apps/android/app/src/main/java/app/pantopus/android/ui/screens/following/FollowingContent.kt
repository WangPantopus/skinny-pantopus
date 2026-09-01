@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.following

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.following.FollowingRowDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * §1A① — "Following" (Beacons you follow). UI models + the client-side
 * projection that groups [FollowingRowDto]s into the three activity buckets
 * the design renders (New updates · Active · Quiet). Pure data + logic so it
 * unit-tests on the JVM and mirrors the iOS `FollowingProjection`.
 */

// region Sort

enum class FollowingSort(
    val wire: String,
    val label: String,
) {
    Activity("activity", "Activity"),
    Recent("recent", "Recent"),
    Alpha("alpha", "A–Z"),
    Unread("unread", "Unread"),
}

// endregion

// region Sections

enum class FollowingSectionKind(
    val header: String,
    val testTag: String,
) {
    NewUpdates("New updates", "followingSection.newUpdates"),
    Active("Active", "followingSection.active"),
    Quiet("Quiet", "followingSection.quiet"),
}

data class FollowingSection(
    val kind: FollowingSectionKind,
    val rows: List<FollowingRow>,
) {
    val count: Int get() = rows.size
    val isTinted: Boolean get() = kind == FollowingSectionKind.NewUpdates
}

// endregion

// region Notification level

/**
 * Per-Beacon notification level. Wire values are validated server-side
 * against `all | highlights | none` (`notificationPreferenceSchema`,
 * `backend/routes/personas.js:88`).
 */
enum class FollowingNotificationLevel(
    val wire: String,
    val label: String,
    val toastLabel: String,
    val icon: PantopusIcon,
) {
    All("all", "All", "All updates", PantopusIcon.Bell),
    Highlights("highlights", "Highlights", "Highlights only", PantopusIcon.BellRing),
    Off("none", "Off", "Off", PantopusIcon.BellOff),
    ;

    /** Tap order: All → Highlights → Off → All. */
    val next: FollowingNotificationLevel
        get() =
            when (this) {
                All -> Highlights
                Highlights -> Off
                Off -> All
            }

    companion object {
        fun from(raw: String?): FollowingNotificationLevel = entries.firstOrNull { it.wire == raw?.lowercase() } ?: All
    }
}

// endregion

// region Avatar tone

/** Deterministic per-Beacon avatar tint, mapped only onto existing tokens. */
enum class FollowingAvatarTone(
    val color: Color,
) {
    Sky(PantopusColors.primary600),
    Green(PantopusColors.home),
    Violet(PantopusColors.business),
    Amber(PantopusColors.warning),
    Rose(PantopusColors.rose),
    Slate(PantopusColors.slate),
    ;

    companion object {
        fun forKey(key: String): FollowingAvatarTone {
            val all = entries
            if (all.isEmpty()) return Sky
            var sum = 0
            for (ch in key) sum += ch.code
            return all[(sum % all.size + all.size) % all.size]
        }
    }
}

// endregion

// region Row

sealed interface FollowingRowTrailing {
    data class Unread(val text: String) : FollowingRowTrailing

    data object Muted : FollowingRowTrailing

    data object Chevron : FollowingRowTrailing
}

data class FollowingRow(
    val id: String,
    val personaId: String,
    val handle: String,
    val displayName: String,
    val avatarUrl: String?,
    val initials: String,
    val toneKey: String,
    val verified: Boolean,
    val followerLabel: String?,
    val tierName: String?,
    val bodyText: String,
    val bodyIsQuiet: Boolean,
    val timeLabel: String?,
    val trailing: FollowingRowTrailing,
    val isMuted: Boolean,
    /** Current per-Beacon notification level — drives the inline bell. */
    val notificationLevel: FollowingNotificationLevel = FollowingNotificationLevel.All,
    /** Paid memberships answer 409 on unfollow; bulk unfollow skips them. */
    val isPaid: Boolean = false,
    /** Paused Beacons render dimmed and their bell is disabled (RN parity). */
    val isPaused: Boolean = false,
) {
    val tone: FollowingAvatarTone get() = FollowingAvatarTone.forKey(toneKey)
    val subtitle: String
        get() = if (followerLabel != null) "@$handle · $followerLabel followers" else "@$handle"

    fun toActionTarget(): FollowingActionTarget =
        FollowingActionTarget(
            id = id,
            personaId = personaId,
            displayName = displayName,
            handle = handle,
            initials = initials,
            toneKey = toneKey,
            verified = verified,
            isMuted = isMuted,
            notificationLevel = notificationLevel,
            isPaid = isPaid,
        )
}

data class FollowingActionTarget(
    val id: String,
    val personaId: String,
    val displayName: String,
    val handle: String,
    val initials: String,
    val toneKey: String,
    val verified: Boolean,
    val isMuted: Boolean,
    val notificationLevel: FollowingNotificationLevel = FollowingNotificationLevel.All,
    val isPaid: Boolean = false,
) {
    val tone: FollowingAvatarTone get() = FollowingAvatarTone.forKey(toneKey)
}

/**
 * Confirm-dialog payload for the long-press multi-select bulk unfollow.
 * Mirrors RN's `performBulkUnfollow` alert
 * (`pantopus/frontend/apps/mobile/src/app/beacons/following.tsx:193`).
 */
data class FollowingBulkUnfollowRequest(
    val membershipIds: List<String>,
    val personaIds: List<String>,
    val skippedPaidCount: Int,
) {
    val title: String
        get() = "Unfollow ${personaIds.size} ${if (personaIds.size == 1) "Beacon" else "Beacons"}?"

    val message: String
        get() =
            if (skippedPaidCount > 0) {
                val plural = if (skippedPaidCount == 1) "" else "s"
                "$skippedPaidCount paid membership$plural will be skipped — manage those in Audience."
            } else {
                "You can re-follow any Beacon later."
            }
}

// endregion

// region Mute durations

enum class FollowingMutePreset(
    val days: Int,
    val label: String,
) {
    OneDay(1, "For 1 day"),
    OneWeek(7, "For 1 week"),
    ThirtyDays(30, "For 30 days"),
    ;

    val testTag: String get() = "followingMute.$days"
}

const val FOLLOWING_MUTE_MAX_DAYS = 365

// endregion

// region UI state

sealed interface FollowingUiState {
    data object Loading : FollowingUiState

    data class Loaded(
        val sections: List<FollowingSection>,
        val totalFollowing: Int,
        val unreadBeacons: Int,
    ) : FollowingUiState

    data object Empty : FollowingUiState

    data class Error(val message: String) : FollowingUiState
}

// endregion

// region Projection

object FollowingProjection {
    private const val ACTIVE_WINDOW_SECONDS = 30L * 86_400L
    private const val UNREAD_CAP = 25

    fun sections(
        dtos: List<FollowingRowDto>,
        now: Instant,
    ): List<FollowingSection> {
        val buckets = linkedMapOf<FollowingSectionKind, MutableList<FollowingRow>>()
        for (dto in dtos) {
            val (kind, row) = project(dto, now)
            buckets.getOrPut(kind) { mutableListOf() }.add(row)
        }
        return listOf(
            FollowingSectionKind.NewUpdates,
            FollowingSectionKind.Active,
            FollowingSectionKind.Quiet,
        ).mapNotNull { kind ->
            buckets[kind]?.takeIf { it.isNotEmpty() }?.let { FollowingSection(kind, it) }
        }
    }

    fun project(
        dto: FollowingRowDto,
        now: Instant,
    ): Pair<FollowingSectionKind, FollowingRow> {
        val muted = dto.mutedUntil != null
        val unread = if (muted) 0 else (dto.unreadCount ?: 0).coerceAtLeast(0)
        val createdAt = dto.latestPost?.createdAt
        val recent = isRecent(createdAt, now)

        val kind =
            when {
                unread > 0 -> FollowingSectionKind.NewUpdates
                dto.latestPost != null && recent -> FollowingSectionKind.Active
                else -> FollowingSectionKind.Quiet
            }

        val bodyText: String
        val bodyIsQuiet: Boolean
        val timeLabel: String?
        if (kind == FollowingSectionKind.Quiet) {
            bodyText = if (muted) "No updates while muted" else "No recent updates"
            bodyIsQuiet = true
            timeLabel = null
        } else {
            bodyText = dto.latestPost?.snippet.orEmpty()
            bodyIsQuiet = false
            timeLabel = relativeTime(createdAt, now)
        }

        val trailing =
            when {
                kind == FollowingSectionKind.NewUpdates -> FollowingRowTrailing.Unread(unreadBadge(unread))
                muted -> FollowingRowTrailing.Muted
                else -> FollowingRowTrailing.Chevron
            }

        val display = dto.persona.displayName?.takeIf { it.isNotEmpty() } ?: dto.persona.handle

        val row =
            FollowingRow(
                id = dto.membershipId,
                personaId = dto.persona.id,
                handle = dto.persona.handle,
                displayName = display,
                avatarUrl = dto.persona.avatarUrl,
                initials = initials(display, dto.persona.handle),
                toneKey = dto.persona.id,
                verified = dto.persona.verified ?: false,
                followerLabel = dto.persona.followerCount?.let(::compactCount),
                tierName = dto.paidTier?.name,
                bodyText = bodyText,
                bodyIsQuiet = bodyIsQuiet,
                timeLabel = timeLabel,
                trailing = trailing,
                isMuted = muted,
                notificationLevel = FollowingNotificationLevel.from(dto.notificationLevel),
                isPaid = (dto.paidTier?.rank ?: 0) > 1,
                isPaused = dto.persona.status?.lowercase() == "paused",
            )
        return kind to row
    }

    fun unreadBadge(count: Int): String = if (count >= UNREAD_CAP) "$UNREAD_CAP+" else "$count"

    fun initials(
        name: String,
        fallback: String,
    ): String {
        val source = name.ifEmpty { fallback }
        val letters =
            source
                .split(" ")
                .filter { it.isNotBlank() }
                .take(2)
                .mapNotNull { it.firstOrNull() }
                .joinToString("")
                .uppercase()
        return letters.ifEmpty { "•" }
    }

    fun compactCount(value: Int): String =
        when {
            value >= 1_000_000 -> trimmed(value / 1_000_000.0) + "m"
            value >= 1_000 -> trimmed(value / 1_000.0) + "k"
            else -> "$value"
        }

    private fun trimmed(value: Double): String {
        val tenths = Math.round(value * 10)
        val whole = tenths / 10
        val frac = (tenths % 10).toInt()
        return if (frac == 0) "$whole" else "$whole.$frac"
    }

    fun isRecent(
        raw: String?,
        now: Instant,
        windowSeconds: Long = ACTIVE_WINDOW_SECONDS,
    ): Boolean {
        val date = parseInstant(raw) ?: return false
        return ChronoUnit.SECONDS.between(date, now) <= windowSeconds
    }

    fun relativeTime(
        raw: String?,
        now: Instant,
    ): String? {
        val date = parseInstant(raw) ?: return null
        val seconds = ChronoUnit.SECONDS.between(date, now).coerceAtLeast(0)
        return when {
            seconds < 60 -> "now"
            seconds < 3_600 -> "${seconds / 60}m"
            seconds < 86_400 -> "${seconds / 3_600}h"
            seconds < 604_800 -> "${seconds / 86_400}d"
            seconds < 31_536_000 -> "${seconds / 604_800}w"
            else -> "${seconds / 31_536_000}y"
        }
    }

    fun parseInstant(raw: String?): Instant? {
        if (raw.isNullOrEmpty()) return null
        return runCatching { Instant.parse(raw) }.getOrNull()
    }
}

// endregion
