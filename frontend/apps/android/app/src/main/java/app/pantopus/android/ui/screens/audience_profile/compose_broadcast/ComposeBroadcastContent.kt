@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.compose_broadcast

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.identity_center.IdentityKind
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A.7 (A22.2) Compose Broadcast — render-only models for the full-screen
 * broadcast composer pushed from the Audience Profile. Mirrors the iOS
 * `ComposeBroadcastContent.swift` shape so cross-platform parity tests can
 * compare projections one-to-one. No backend: seeded from
 * [ComposeBroadcastSampleData].
 */

/** Targeting for a broadcast — "All beacons" public reach down to tier locks. */
enum class BroadcastAudience(
    val key: String,
    val title: String,
    val icon: PantopusIcon,
    /** Persona tier rank for chip color via `tierColor(rank)`; null = public. */
    val tierRank: Int?,
) {
    AllBeacons("allBeacons", "All beacons", PantopusIcon.Globe, null),
    FollowersOnly("followersOnly", "Followers only", PantopusIcon.Users, 1),
    BronzePlus("bronzePlus", "Bronze+", PantopusIcon.Lock, 2),
    SilverPlus("silverPlus", "Silver+", PantopusIcon.Lock, 3),
    GoldOnly("goldOnly", "Gold only", PantopusIcon.Lock, 4),
    ;

    val isRestricted: Boolean get() = this != AllBeacons
}

/**
 * One attached media item. [bytes] carries the picked file — rendered
 * inline for images and uploaded verbatim to
 * `POST /api/upload/post-media/:messageId` after the broadcast is
 * published. Sample / snapshot data leaves it null so the preview falls
 * back to a tinted placeholder, keeping baselines deterministic.
 * [remoteUrl] is set only for already-hosted media, which rides the
 * publish body's `media[]` field instead of the upload leg.
 * [capturedLatitude]/[capturedLongitude] are the capture coordinates
 * extracted at pick time (EXIF for stills, the ISO-6709 atom for
 * videos; mirrors the iOS `ComposeMediaPreview` fields) — a LOCAL
 * place-picker anchor input only, never sent on the publish body.
 */
@Immutable
data class ComposeMediaPreview(
    val id: String,
    val kind: Kind,
    val caption: String?,
    val bytes: ByteArray? = null,
    val remoteUrl: String? = null,
    val fileName: String? = null,
    val mimeType: String? = null,
    val capturedLatitude: Double? = null,
    val capturedLongitude: Double? = null,
) {
    enum class Kind { Image, Video }

    val resolvedMimeType: String
        get() = mimeType ?: if (kind == Kind.Video) "video/mp4" else "image/jpeg"

    /** Randomised so the picker's `IMG_xxxx` never reaches S3. */
    val resolvedFileName: String
        get() =
            fileName ?: "broadcast-${id.filter { it.isLetterOrDigit() }.takeLast(8)}." +
                if (kind == Kind.Video) "mp4" else "jpg"

    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is ComposeMediaPreview &&
                    id == other.id &&
                    kind == other.kind &&
                    caption == other.caption &&
                    remoteUrl == other.remoteUrl &&
                    fileName == other.fileName &&
                    mimeType == other.mimeType &&
                    capturedLatitude == other.capturedLatitude &&
                    capturedLongitude == other.capturedLongitude &&
                    bytesEqual(bytes, other.bytes)
            )

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + kind.hashCode()
        result = 31 * result + (caption?.hashCode() ?: 0)
        result = 31 * result + (remoteUrl?.hashCode() ?: 0)
        result = 31 * result + (capturedLatitude?.hashCode() ?: 0)
        result = 31 * result + (capturedLongitude?.hashCode() ?: 0)
        result = 31 * result + (bytes?.contentHashCode() ?: 0)
        return result
    }
}

private fun bytesEqual(
    left: ByteArray?,
    right: ByteArray?,
): Boolean =
    when {
        left == null -> right == null
        right == null -> false
        else -> left.contentEquals(right)
    }

/** The mutable composer payload — what would be POSTed on send. */
@Immutable
data class ComposeBroadcastDraft(
    val body: String = "",
    val audience: BroadcastAudience = BroadcastAudience.AllBeacons,
    val media: List<ComposeMediaPreview> = emptyList(),
    /** Instagram-style venue tag riding the publish body's location keys. */
    val placeTag: PostPlaceTag? = null,
) {
    /** Nothing worth sending — empty body and no media. */
    val isEmpty: Boolean get() = body.isBlank() && media.isEmpty()

    /** Free attachment slots left before the nine-item cap. */
    val remainingMediaSlots: Int get() = (MEDIA_LIMIT - media.size).coerceAtLeast(0)

    /**
     * ADDENDUM 2 — capture location of the first geotagged attachment:
     * stills in attach order first, then videos (first geotagged item
     * wins, matching Instagram/iOS). Recomputed on every media
     * add/remove because it derives from [media]; nil when nothing is
     * geotagged. PRIVACY: a local place-picker anchor input only — it
     * never rides the publish body, which carries only an explicitly
     * picked venue.
     */
    val mediaCaptureLocation: MediaCaptureLocation?
        get() =
            (
                media.filter { it.kind == ComposeMediaPreview.Kind.Image } +
                    media.filter { it.kind == ComposeMediaPreview.Kind.Video }
            ).firstNotNullOfOrNull { item ->
                val lat = item.capturedLatitude
                val lng = item.capturedLongitude
                if (lat != null && lng != null) MediaCaptureLocation(latitude = lat, longitude = lng) else null
            }

    companion object {
        /**
         * RN caps a broadcast at nine attachments (`postMediaComposer.ts`
         * → `.slice(0, 9)`), matching `upload.array('files', 9)` on
         * `/api/upload/post-media/:postId`.
         */
        const val MEDIA_LIMIT = 9
    }
}

/** The persona a broadcast is sent as — drives the composer PersonaRow. */
@Immutable
data class BroadcastPersona(
    val id: String,
    val handle: String,
    val displayName: String,
    val kind: IdentityKind,
    val avatarInitial: String,
)

/** One recent broadcast with inline analytics (pre-formatted strings). */
@Immutable
data class RecentBroadcastContent(
    val id: String,
    val timeLabel: String,
    val audience: BroadcastAudience,
    val body: String,
    val reach: String,
    val read: String,
    val readPct: String,
    val reactions: String,
    val replies: String,
    val hasMedia: Boolean,
)

/** Send lifecycle, kept separate from the editable draft. */
sealed interface ComposePhase {
    data object Idle : ComposePhase

    data object Sending : ComposePhase

    data class Error(val message: String) : ComposePhase
}

/**
 * The prompt's composer-state contract, derived from the live draft +
 * [ComposePhase]. Mirrors the iOS `ComposeBroadcastState` enum so parity
 * tests line up.
 */
sealed interface ComposeBroadcastState {
    data object Empty : ComposeBroadcastState

    data class Composing(val draft: ComposeBroadcastDraft) : ComposeBroadcastState

    data class Scheduled(val draft: ComposeBroadcastDraft, val sendAt: Long) : ComposeBroadcastState

    data object Sending : ComposeBroadcastState

    data class Error(val message: String) : ComposeBroadcastState
}

/**
 * Full UI state the screen renders from. The editor is always present;
 * `phase` + the draft drive [composeState] and the screen chrome.
 */
@Immutable
data class ComposeBroadcastUiState(
    val persona: BroadcastPersona,
    val recentBroadcasts: List<RecentBroadcastContent>,
    val draft: ComposeBroadcastDraft,
    val scheduledAtMillis: Long?,
    val scheduledLabel: String?,
    val phase: ComposePhase,
    val isDirty: Boolean,
    val maxCharacterCount: Int = 1_000,
    val audienceReach: Map<BroadcastAudience, Int> = emptyMap(),
) {
    val characterCount: Int get() = draft.body.length
    val isOverLimit: Boolean get() = characterCount > maxCharacterCount
    val hasRecentBroadcasts: Boolean get() = recentBroadcasts.isNotEmpty()
    val isSending: Boolean get() = phase == ComposePhase.Sending

    val canSend: Boolean
        get() = phase != ComposePhase.Sending && !draft.isEmpty && !isOverLimit

    val primaryActionTitle: String
        get() = if (hasRecentBroadcasts) "Send broadcast" else "Send your first broadcast"

    fun reach(audience: BroadcastAudience): Int? = audienceReach[audience]

    fun composeState(): ComposeBroadcastState =
        when (val current = phase) {
            ComposePhase.Sending -> ComposeBroadcastState.Sending
            is ComposePhase.Error -> ComposeBroadcastState.Error(current.message)
            ComposePhase.Idle ->
                when {
                    scheduledAtMillis != null -> ComposeBroadcastState.Scheduled(draft, scheduledAtMillis)
                    draft.isEmpty -> ComposeBroadcastState.Empty
                    else -> ComposeBroadcastState.Composing(draft)
                }
        }
}
