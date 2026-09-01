@file:Suppress(
    "MagicNumber",
    "PackageNaming",
    "TooManyFunctions",
    "LargeClass",
    "ComplexCondition",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.compose.pulse

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.analytics.AnalyticsResult
import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.posts.PostDetailDto
import app.pantopus.android.data.api.models.posts.PostPrecheckRequest
import app.pantopus.android.data.api.models.posts.PostUpdateRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessPostsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.location.UserCoordinate
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.posts.PostPrecheckRepository
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.data.posts.PulsePostsRefreshNotifier
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.screens.compose.placepicker.MediaCaptureLocation
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.shared.form.FormAggregate
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormValidator
import app.pantopus.android.ui.screens.shared.form.all
import app.pantopus.android.ui.screens.shared.form.isoDateOrEmpty
import app.pantopus.android.ui.screens.shared.form.maxLength
import app.pantopus.android.ui.screens.shared.form.required
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import javax.inject.Inject

/**
 * Compose-form variants. Mirrors the iOS `PulseComposeIntent` 1:1 —
 * every `PulseIntent` value except `All` (a feed-row filter sentinel).
 */
enum class PulseComposeIntent(
    val key: String,
    val label: String,
    /** Backend `post_type` enum sent on `POST /api/posts`. */
    val postType: String,
    /** v1.2 `purpose` tag — mirrors postType for sortability. */
    val purpose: String,
) {
    Ask("ask", "Ask", postType = "ask_local", purpose = "ask"),
    Recommend("recommend", "Recommend", postType = "recommendation", purpose = "recommend"),
    Event("event", "Event", postType = "event", purpose = "event"),
    Lost("lost", "Lost & Found", postType = "lost_found", purpose = "lost_found"),
    Announce("announce", "Announce", postType = "local_update", purpose = "local_update"),
    ;

    /** Right-action label for the Form top-bar. */
    val ctaLabel: String get() = "Post"

    companion object {
        fun fromKey(key: String): PulseComposeIntent = entries.firstOrNull { it.key == key } ?: Ask

        /**
         * Bridge a feed-row intent into the compose subset. `All` → `Ask`.
         * The four read-only lanes added for RN chip-row parity
         * (`Alert` / `Deal` / `NeighborhoodWin` / `VisitorGuide`) have no
         * dedicated compose form yet, so they pre-fill the generic
         * Announce / Recommend composers.
         */
        fun fromFeedIntent(feed: PulseIntent): PulseComposeIntent =
            when (feed) {
                PulseIntent.All, PulseIntent.Ask -> Ask
                PulseIntent.Recommend, PulseIntent.VisitorGuide -> Recommend
                PulseIntent.Event -> Event
                PulseIntent.Lost -> Lost
                PulseIntent.Announce,
                PulseIntent.Alert,
                PulseIntent.Deal,
                PulseIntent.NeighborhoodWin,
                -> Announce
            }
    }
}

/**
 * Stable identifier for every text field in the compose form. Selector
 * state (category chip / rating stars / lost-vs-found toggle / announce
 * audience) lives on the view-model directly so the field map only
 * carries values the user can type into.
 */
enum class PulseComposeField(val key: String) {
    Title("title"),
    Body("body"),
    RecommendBusiness("recommendBusiness"),
    EventDate("eventDate"),
    EventEndDate("eventEndDate"),
    EventLocation("eventLocation"),
    EventCapacity("eventCapacity"),
    LostLastSeenLocation("lostLastSeenLocation"),
    LostLastSeenDate("lostLastSeenDate"),
    ContactPhone("contactPhone"),
    DealBusinessName("dealBusinessName"),
}

/** Author identity the post will be created under. */
enum class PulseComposeIdentity(val key: String, val label: String) {
    Personal("personal", "Personal"),
    Home("home", "Home"),
    Business("business", "Business"),
    ;

    /** Maps to backend `postAs` enum. */
    val postAs: String get() = key
}

/** Visibility scope option. */
enum class PulseComposeVisibility(val key: String, val label: String) {
    Neighbors("neighborhood", "Neighbors"),
    Connections("connections", "Connections"),
    PublicFeed("public", "Public"),
}

enum class PulseLostFoundKind(val key: String, val label: String) {
    Lost("lost", "Lost"),
    Found("found", "Found"),
}

/**
 * Lost & Found contact-preference chip. Mirrors mobile `CONTACT_PREF`;
 * backend stores `phone` combined with the number as `phone|<number>`.
 */
enum class PulseLostFoundContactPref(val key: String, val label: String) {
    Dm("dm", "Direct message"),
    Comment("comment", "Comments"),
    Phone("phone", "Phone"),
}

enum class PulseAnnounceAudience(val key: String, val label: String) {
    Neighbors("neighbors", "Neighbors"),
    Followers("followers", "Followers"),
    PublicFeed("public", "Public"),
    ;

    /** Map the announce-audience chip to the backend visibility enum. */
    val backendVisibility: String
        get() =
            when (this) {
                Neighbors -> "neighborhood"
                Followers -> "followers"
                PublicFeed -> "public"
            }
}

enum class PulseAskCategory(val key: String, val label: String) {
    Handyman("handyman", "Handyman"),
    Cleaning("cleaning", "Cleaning"),
    Advice("advice", "Advice"),
    Other("other", "Other"),
}

/**
 * One picked photo. Carries the bytes + a stable id for ForEach.
 * [capturedLatitude]/[capturedLongitude] are the EXIF capture
 * coordinates extracted at pick time (mirrors the iOS
 * `PulseComposePhoto` fields) — a LOCAL place-picker anchor input only,
 * never attached to the outgoing post body.
 */
data class PulseComposePhoto(
    val id: String,
    val data: ByteArray,
    val capturedLatitude: Double? = null,
    val capturedLongitude: Double? = null,
) {
    override fun equals(other: Any?): Boolean = other is PulseComposePhoto && other.id == id

    override fun hashCode(): Int = id.hashCode()
}

/** Maximum number of photos the picker accepts. */
const val PULSE_COMPOSE_MAX_PHOTOS: Int = 9

/** Render state for the compose screen. */
sealed interface PulseComposeUiState {
    data object Idle : PulseComposeUiState

    data object Submitting : PulseComposeUiState

    data class Success(val postId: String?) : PulseComposeUiState

    data class Error(val message: String) : PulseComposeUiState
}

/**
 * Edit-mode prefill state. Surfaces a shimmer in the view while the
 * post is being fetched and a retry CTA when the fetch fails.
 */
sealed interface PulseComposePrefillState {
    /** Create mode (no prefill needed) or prefill already resolved. */
    data object Ready : PulseComposePrefillState

    /** Fetch in flight — view shows shimmer. */
    data object Loading : PulseComposePrefillState

    /** Fetch failed — view shows error with retry. */
    data class Error(val message: String) : PulseComposePrefillState
}

/** Tone-tagged transient message surfaced by the form. */
data class PulseComposeToast(
    val text: String,
    val isError: Boolean,
)

/**
 * Backs `PulseComposeScreen`. Holds intent + identity + visibility,
 * per-field state, picked photos, and a submit pipeline that hits
 * `POST /api/posts` via [PostsRepository]. The wire shape mirrors
 * `createPostSchema` at `backend/routes/posts.js:196-300`.
 */
@HiltViewModel
class PulseComposeViewModel
    @Inject
    constructor(
        private val repo: PostsRepository,
        private val uploadRepo: UploadRepository,
        private val networkMonitor: NetworkMonitor,
        private val postsRefresh: PulsePostsRefreshNotifier,
        private val locationProvider: LocationProvider,
        savedStateHandle: SavedStateHandle,
        /** C2 — "post as this business" create route. */
        private val businessPosts: BusinessPostsRepository,
        /** Pre-post safety precheck — `POST /api/posts/precheck`. */
        private val precheckRepo: PostPrecheckRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<PulseComposeUiState>(PulseComposeUiState.Idle)
        val state: StateFlow<PulseComposeUiState> = _state.asStateFlow()

        /** Post id when editing an existing post; `null` in create mode. */
        val editingPostId: String? = savedStateHandle.get<String>(POST_ID_KEY)

        private val initialIntent: PulseComposeIntent =
            PulseComposeIntent.fromKey(savedStateHandle.get<String>(INTENT_KEY) ?: PulseComposeIntent.Ask.key)

        private val _activeIntent = MutableStateFlow(initialIntent)
        val activeIntent: StateFlow<PulseComposeIntent> = _activeIntent.asStateFlow()

        private val _prefillState =
            MutableStateFlow<PulseComposePrefillState>(
                if (editingPostId == null) PulseComposePrefillState.Ready else PulseComposePrefillState.Loading,
            )
        val prefillState: StateFlow<PulseComposePrefillState> = _prefillState.asStateFlow()

        private val _identity = MutableStateFlow(PulseComposeIdentity.Personal)
        val identity: StateFlow<PulseComposeIdentity> = _identity.asStateFlow()

        private val _visibility = MutableStateFlow(PulseComposeVisibility.Neighbors)
        val visibility: StateFlow<PulseComposeVisibility> = _visibility.asStateFlow()

        private val _lostFoundKind = MutableStateFlow(PulseLostFoundKind.Lost)
        val lostFoundKind: StateFlow<PulseLostFoundKind> = _lostFoundKind.asStateFlow()

        private val _lostFoundContactPref = MutableStateFlow(PulseLostFoundContactPref.Dm)
        val lostFoundContactPref: StateFlow<PulseLostFoundContactPref> = _lostFoundContactPref.asStateFlow()

        /** Deal expiry — required by the backend for `postType == deal`. */
        private val _dealExpiresAt = MutableStateFlow(LocalDateTime.now().plusDays(DEAL_DEFAULT_EXPIRY_DAYS))
        val dealExpiresAt: StateFlow<LocalDateTime> = _dealExpiresAt.asStateFlow()

        /** Place-eligibility warning surfaced as a banner on the draft step. */
        private val _eligibilityWarning = MutableStateFlow<String?>(null)
        val eligibilityWarning: StateFlow<String?> = _eligibilityWarning.asStateFlow()

        // Pre-post safety precheck (`POST /api/posts/precheck`).

        /**
         * Soft nudge from the precheck's first suggestion / flag. Rendered
         * as a dismissible amber banner (RN `PostComposerModal.tsx:645`).
         */
        private val _precheckNudge = MutableStateFlow<String?>(null)
        val precheckNudge: StateFlow<String?> = _precheckNudge.asStateFlow()

        /**
         * Cooldown copy when the viewer is rate-limited or restricted.
         * Non-null blocks submit (RN gates on `canPost`).
         */
        private val _precheckCooldown = MutableStateFlow<String?>(null)
        val precheckCooldown: StateFlow<String?> = _precheckCooldown.asStateFlow()

        /**
         * True when the backend classified this as a visitor post — the
         * composer shows the visitor-badge banner (RN
         * `PostComposerModal.tsx:631`).
         */
        private val _isVisitorPost = MutableStateFlow(false)
        val isVisitorPost: StateFlow<Boolean> = _isVisitorPost.asStateFlow()

        /**
         * Guards the per-draft single run. Reset whenever the body text
         * changes, mirroring RN's `precheckDone` flag.
         */
        private var precheckDone = false

        private val _announceAudience = MutableStateFlow(PulseAnnounceAudience.Neighbors)
        val announceAudience: StateFlow<PulseAnnounceAudience> = _announceAudience.asStateFlow()

        private val _safetyAlertKind = MutableStateFlow(PulseSafetyAlertKind.Theft)
        val safetyAlertKind: StateFlow<PulseSafetyAlertKind> = _safetyAlertKind.asStateFlow()

        private val _askCategory = MutableStateFlow(PulseAskCategory.Handyman)
        val askCategory: StateFlow<PulseAskCategory> = _askCategory.asStateFlow()

        private val _recommendRating = MutableStateFlow(DEFAULT_RECOMMEND_RATING)
        val recommendRating: StateFlow<Int> = _recommendRating.asStateFlow()

        /**
         * Sports-lane starter prompts open the composer with the body
         * pre-filled — RN `FeedScreen.tsx:296` (`setComposeText`). Seeded
         * as the *current* value (not the original) so the form reads
         * dirty and the CTA is live at once.
         */
        private val prefillBody: String? = savedStateHandle.get<String>(PREFILL_BODY_KEY)

        private val _fields =
            MutableStateFlow(
                PulseComposeField.entries.associateWith { field ->
                    val seed = prefillBody.takeIf { field == PulseComposeField.Body && !it.isNullOrEmpty() }
                    FormFieldState(id = field.key, value = seed.orEmpty())
                },
            )
        val fields: StateFlow<Map<PulseComposeField, FormFieldState>> = _fields.asStateFlow()

        private val _photos = MutableStateFlow<List<PulseComposePhoto>>(emptyList())
        val photos: StateFlow<List<PulseComposePhoto>> = _photos.asStateFlow()

        /** Instagram-style venue tag picked in the PlacePickerSheet. */
        private val _selectedPlaceTag = MutableStateFlow<PostPlaceTag?>(null)
        val selectedPlaceTag: StateFlow<PostPlaceTag?> = _selectedPlaceTag.asStateFlow()

        private val _toast = MutableStateFlow<PulseComposeToast?>(null)
        val toast: StateFlow<PulseComposeToast?> = _toast.asStateFlow()

        private val _shakeTrigger = MutableStateFlow(0)
        val shakeTrigger: StateFlow<Int> = _shakeTrigger.asStateFlow()

        private val _shouldDismiss = MutableStateFlow(false)
        val shouldDismiss: StateFlow<Boolean> = _shouldDismiss.asStateFlow()

        /**
         * Selector + identity baselines. Updated to the prefilled values
         * after a successful edit-mode fetch so `isDirty` compares against
         * the post's saved pose, not the create-mode defaults.
         */
        private var baselineIdentity: PulseComposeIdentity = PulseComposeIdentity.Personal
        private var baselineVisibility: PulseComposeVisibility = PulseComposeVisibility.Neighbors
        private var baselineLostFoundKind: PulseLostFoundKind = PulseLostFoundKind.Lost
        private var baselineLostFoundContactPref: PulseLostFoundContactPref = PulseLostFoundContactPref.Dm
        private var baselineAnnounceAudience: PulseAnnounceAudience = PulseAnnounceAudience.Neighbors
        private var baselineAskCategory: PulseAskCategory = PulseAskCategory.Handyman
        private var baselineRecommendRating: Int = DEFAULT_RECOMMEND_RATING

        private var postingTarget: PulsePostingTarget? = null
        private var composePurpose: PulseComposePurpose? = null
        private var flowConfigured = false

        /**
         * C2 — when non-null the create submit goes to
         * `POST /api/businesses/:businessId/posts` instead of `POST /api/posts`,
         * so the row lands with `business_author_id` set. Set by the Business
         * owner dashboard's "Post as this business" FAB; the backend gates it
         * on `profile.edit` (owner / admin / editor).
         */
        private var businessAuthorId: String? = null

        /**
         * Fresh device fix captured at submit time so the backend's
         * 5-minute GPS-freshness gate passes even when drafting takes a
         * while. Pick-time coordinates remain the fallback.
         */
        private var freshGpsFix: UserCoordinate? = null

        /** True when the draft screen was reached via target/purpose pickers. */
        val isFlowMode: Boolean get() = postingTarget != null

        val flowPurpose: PulseComposePurpose? get() = composePurpose

        val flowTargetLabel: String? get() = postingTarget?.displayLabel

        /**
         * C2 — route the create submit through the business-post endpoint.
         * Idempotent; called from a `LaunchedEffect` on the compose screen.
         */
        fun applyBusinessAuthor(businessId: String) {
            if (businessAuthorId == businessId) return
            businessAuthorId = businessId
            _identity.value = PulseComposeIdentity.Business
            baselineIdentity = PulseComposeIdentity.Business
        }

        /** True when composing from the Business owner dashboard. */
        val isBusinessAuthored: Boolean get() = businessAuthorId != null

        fun applyFlowContext(
            target: PulsePostingTarget,
            purpose: PulseComposePurpose?,
        ) {
            if (flowConfigured) return
            flowConfigured = true
            postingTarget = target
            composePurpose = purpose
            purpose?.legacyIntent?.let { _activeIntent.value = it }
            _identity.value =
                PulseComposeIdentity.entries.firstOrNull { it.key == target.postAs }
                    ?: PulseComposeIdentity.Personal
            _visibility.value =
                if (target.isNetworkTarget) PulseComposeVisibility.Connections else PulseComposeVisibility.Neighbors
            baselineIdentity = _identity.value
            baselineVisibility = _visibility.value
            checkPlaceEligibility()
        }

        /**
         * Check whether the signed-in user can post to the selected place.
         * Surfaces a warning banner instead of letting the submit 403.
         * Errors are non-blocking — the warning is simply cleared.
         */
        fun checkPlaceEligibility() {
            val target = postingTarget ?: return
            if (!target.isPlaceTarget) return
            val lat = target.targetLatitude ?: return
            val lon = target.targetLongitude ?: return
            viewModelScope.launch {
                val gps = gpsFields(target)
                when (
                    val result =
                        repo.placeEligibility(
                            latitude = lat,
                            longitude = lon,
                            gpsTimestamp = gps.timestamp,
                            gpsLatitude = gps.latitude,
                            gpsLongitude = gps.longitude,
                        )
                ) {
                    is NetworkResult.Success ->
                        _eligibilityWarning.value = if (result.data.eligible) null else result.data.reason
                    is NetworkResult.Failure -> _eligibilityWarning.value = null
                }
            }
        }

        /** True iff this view-model is wired to edit an existing post. */
        val isEditing: Boolean get() = editingPostId != null

        /**
         * Top-bar title — "Edit post" in edit mode, "Post as business" when
         * composing from the Business owner dashboard, "New post" otherwise.
         */
        val displayTitle: String
            get() =
                when {
                    isEditing -> "Edit post"
                    isBusinessAuthored -> "Post as business"
                    else -> "New post"
                }

        /** Right-action label — "Save" in edit mode, intent-driven otherwise. */
        val ctaLabel: String get() = if (isEditing) "Save" else _activeIntent.value.ctaLabel

        /** True iff the intent picker is locked (post_type is fixed on edit). */
        val isIntentLocked: Boolean get() = isEditing

        // MARK: - Selector updates

        fun selectIntent(intent: PulseComposeIntent) {
            if (isIntentLocked) return
            if (_activeIntent.value == intent) return
            _activeIntent.value = intent
        }

        fun selectIdentity(identity: PulseComposeIdentity) {
            _identity.value = identity
        }

        fun selectVisibility(visibility: PulseComposeVisibility) {
            _visibility.value = visibility
        }

        fun selectLostFoundKind(kind: PulseLostFoundKind) {
            _lostFoundKind.value = kind
        }

        fun selectLostFoundContactPref(pref: PulseLostFoundContactPref) {
            _lostFoundContactPref.value = pref
        }

        fun selectDealExpires(value: LocalDateTime) {
            _dealExpiresAt.value = value
        }

        fun selectAnnounceAudience(audience: PulseAnnounceAudience) {
            _announceAudience.value = audience
        }

        fun selectSafetyAlertKind(kind: PulseSafetyAlertKind) {
            _safetyAlertKind.value = kind
        }

        fun selectAskCategory(category: PulseAskCategory) {
            _askCategory.value = category
        }

        fun selectRecommendRating(rating: Int) {
            _recommendRating.value = rating.coerceIn(1, 5)
        }

        fun selectPlaceTag(tag: PostPlaceTag) {
            _selectedPlaceTag.value = tag
        }

        fun clearPlaceTag() {
            _selectedPlaceTag.value = null
        }

        fun update(
            field: PulseComposeField,
            value: String,
        ) {
            val map = _fields.value.toMutableMap()
            val snapshot = map[field] ?: FormFieldState(id = field.key)
            val changed = snapshot.value != value
            map[field] =
                snapshot.copy(
                    value = value,
                    touched = true,
                    error = validator(field).validate(value),
                )
            _fields.value = map
            // RN re-arms the precheck whenever the body text changes
            // (`PostComposerModal.tsx:789`).
            if (field == PulseComposeField.Body && changed) precheckDone = false
        }

        /** X on the precheck nudge banner. */
        fun dismissPrecheckNudge() {
            _precheckNudge.value = null
        }

        /**
         * Run `POST /api/posts/precheck` against the current draft and
         * project the response onto the three banners RN renders: the
         * cooldown block, the visitor badge, and the soft nudge.
         *
         * Mirrors RN `usePostComposer.ts:176-190` — Place surface only,
         * skipped while the body is empty, and run at most once per draft
         * revision. Transport failures are swallowed: the backend itself
         * fails open, so a precheck must never be the reason a post can't
         * be sent.
         */
        fun runPrecheck() {
            viewModelScope.launch { runPrecheckSuspending() }
        }

        private suspend fun runPrecheckSuspending() {
            if (isEditing) return
            val target = postingTarget
            if (target != null && !target.isPlaceTarget) return
            val body = trimmedValue(PulseComposeField.Body)
            if (body.isEmpty() || precheckDone) return
            val result =
                precheckRepo.precheck(
                    PostPrecheckRequest(
                        content = body,
                        postType = _activeIntent.value.postType,
                        purpose = _activeIntent.value.purpose,
                        surface = "place",
                        latitude = target?.targetLatitude ?: freshGpsFix?.latitude,
                        longitude = target?.targetLongitude ?: freshGpsFix?.longitude,
                    ),
                )
            precheckDone = true
            // Fail open — never block the composer on a precheck error.
            val data = (result as? NetworkResult.Success)?.data ?: return
            if (data.isVisitor == true) _isVisitorPost.value = true
            _precheckNudge.value = data.primaryNudge
            _precheckCooldown.value =
                if (data.canPost == false) {
                    data.cooldown?.reason?.let { "You have a posting restriction: $it" }
                        ?: "You have a posting restriction right now."
                } else {
                    null
                }
        }

        /**
         * ADDENDUM 2 — capture location of the first geotagged attachment
         * (in attach order), recomputed on every photo add/remove and nil
         * when nothing is geotagged. Seeds the PlacePickerSheet's "Photo
         * location" anchor. PRIVACY: a local anchor input only — it is
         * NEVER written onto the outgoing request (the post carries only
         * an explicitly picked venue).
         */
        val mediaCaptureLocation: MediaCaptureLocation?
            get() =
                _photos.value.firstNotNullOfOrNull { photo ->
                    val lat = photo.capturedLatitude
                    val lng = photo.capturedLongitude
                    if (lat != null && lng != null) MediaCaptureLocation(latitude = lat, longitude = lng) else null
                }

        fun setPhotos(photos: List<PulseComposePhoto>) {
            _photos.value = photos.take(PULSE_COMPOSE_MAX_PHOTOS)
        }

        fun appendPhoto(photo: PulseComposePhoto) {
            if (_photos.value.size >= PULSE_COMPOSE_MAX_PHOTOS) return
            _photos.value = _photos.value + photo
        }

        fun removePhoto(id: String) {
            _photos.value = _photos.value.filterNot { it.id == id }
        }

        fun dismissToast() {
            _toast.value = null
        }

        fun acknowledgeDismiss() {
            _shouldDismiss.value = false
        }

        // MARK: - Dirty / valid

        val isDirty: Boolean
            get() {
                if (_photos.value.isNotEmpty()) return true
                // Place tags are create-only (buildUpdateRequest has no
                // location fields) — mirror iOS: dirty in create mode,
                // never a no-op-Save enabler in edit mode.
                if (!isEditing && _selectedPlaceTag.value != null) return true
                if (_identity.value != baselineIdentity) return true
                if (_visibility.value != baselineVisibility) return true
                if (activeIntentFields().any { (_fields.value[it]?.isDirty == true) }) return true
                return when (_activeIntent.value) {
                    PulseComposeIntent.Ask -> _askCategory.value != baselineAskCategory
                    PulseComposeIntent.Recommend -> _recommendRating.value != baselineRecommendRating
                    PulseComposeIntent.Lost ->
                        _lostFoundKind.value != baselineLostFoundKind ||
                            _lostFoundContactPref.value != baselineLostFoundContactPref
                    PulseComposeIntent.Announce -> _announceAudience.value != baselineAnnounceAudience
                    PulseComposeIntent.Event -> false
                }
            }

        val isValid: Boolean
            get() = activeIntentFields().all { _fields.value[it]?.error == null }

        val isSubmitting: Boolean
            get() = _state.value is PulseComposeUiState.Submitting

        /** The fields the active intent's sub-form surfaces. */
        fun activeIntentFields(): List<PulseComposeField> =
            when (_activeIntent.value) {
                PulseComposeIntent.Ask -> listOf(PulseComposeField.Title, PulseComposeField.Body)
                PulseComposeIntent.Recommend -> listOf(PulseComposeField.RecommendBusiness, PulseComposeField.Body)
                PulseComposeIntent.Event ->
                    listOf(
                        PulseComposeField.Title,
                        PulseComposeField.EventDate,
                        PulseComposeField.EventEndDate,
                        PulseComposeField.EventLocation,
                        PulseComposeField.EventCapacity,
                        PulseComposeField.Body,
                    )
                PulseComposeIntent.Lost ->
                    listOf(
                        PulseComposeField.Body,
                        PulseComposeField.LostLastSeenLocation,
                        PulseComposeField.LostLastSeenDate,
                        PulseComposeField.ContactPhone,
                    )
                PulseComposeIntent.Announce ->
                    if (composePurpose == PulseComposePurpose.Deal) {
                        listOf(PulseComposeField.Title, PulseComposeField.Body, PulseComposeField.DealBusinessName)
                    } else {
                        listOf(PulseComposeField.Title, PulseComposeField.Body)
                    }
            }

        val aggregate: FormAggregate
            get() = FormAggregate.from(activeIntentFields().mapNotNull { _fields.value[it] })

        // MARK: - Validation

        @Suppress("CyclomaticComplexMethod", "LongMethod")
        private fun validator(field: PulseComposeField): FormValidator =
            when (field) {
                PulseComposeField.Title ->
                    FormValidator.all(listOf(FormValidator.required("Title"), FormValidator.maxLength(TITLE_MAX)))
                PulseComposeField.Body ->
                    FormValidator.all(
                        listOf(
                            FormValidator.required("Description"),
                            FormValidator { value ->
                                val trimmed = value.trim()
                                if (trimmed.length > BODY_MAX) {
                                    "Description must be $BODY_MAX characters or fewer."
                                } else {
                                    null
                                }
                            },
                        ),
                    )
                PulseComposeField.RecommendBusiness ->
                    FormValidator { value ->
                        val trimmed = value.trim()
                        when {
                            trimmed.isEmpty() -> "Add the business name."
                            trimmed.length > BUSINESS_NAME_MAX -> "Must be $BUSINESS_NAME_MAX characters or fewer."
                            else -> null
                        }
                    }
                PulseComposeField.EventDate ->
                    FormValidator.all(listOf(FormValidator.required("Event date"), FormValidator.isoDateOrEmpty()))
                PulseComposeField.EventLocation ->
                    FormValidator.all(listOf(FormValidator.required("Location"), FormValidator.maxLength(LOCATION_MAX)))
                PulseComposeField.EventCapacity ->
                    FormValidator { value ->
                        val trimmed = value.trim()
                        if (trimmed.isEmpty()) return@FormValidator null
                        val n = trimmed.toIntOrNull()
                        when {
                            n == null || n <= 0 -> "Capacity must be a positive number."
                            n > CAPACITY_MAX -> "Capacity is too large."
                            else -> null
                        }
                    }
                PulseComposeField.LostLastSeenLocation ->
                    FormValidator.all(listOf(FormValidator.required("Last seen"), FormValidator.maxLength(LOCATION_MAX)))
                PulseComposeField.LostLastSeenDate -> FormValidator.isoDateOrEmpty()
                PulseComposeField.EventEndDate ->
                    FormValidator { value ->
                        val trimmed = value.trim()
                        when {
                            trimmed.isEmpty() -> null
                            PICKER_DATE_TIME_PATTERN.matches(trimmed) -> null
                            ISO_DATE_ONLY_PATTERN.matches(trimmed) -> null
                            trimmed.contains('T') &&
                                runCatching { java.time.Instant.parse(trimmed) }.isSuccess -> null
                            else -> "Pick a valid end time."
                        }
                    }
                PulseComposeField.ContactPhone ->
                    FormValidator { value ->
                        val trimmed = value.trim()
                        if (trimmed.isEmpty()) return@FormValidator null
                        val digits = trimmed.count { it.isDigit() }
                        if (digits < PHONE_MIN_DIGITS || digits > PHONE_MAX_DIGITS) {
                            "Enter a valid phone number."
                        } else {
                            null
                        }
                    }
                PulseComposeField.DealBusinessName -> FormValidator.maxLength(BUSINESS_NAME_MAX)
            }

        /** Touch every active field, return the first invalid id if any. */
        fun validateAll(): PulseComposeField? {
            var firstInvalid: PulseComposeField? = null
            val map = _fields.value.toMutableMap()
            for (field in activeIntentFields()) {
                val snapshot = map[field] ?: FormFieldState(id = field.key)
                var message = validator(field).validate(snapshot.value)
                // Phone is conditionally required — only when the Lost & Found
                // contact preference is "phone". The base validator can't see
                // the selector, so the rule lives here (mirrors iOS).
                if (field == PulseComposeField.ContactPhone && message == null &&
                    _activeIntent.value == PulseComposeIntent.Lost &&
                    _lostFoundContactPref.value == PulseLostFoundContactPref.Phone &&
                    snapshot.value.trim().isEmpty()
                ) {
                    message = "Add a phone number for contact."
                }
                map[field] = snapshot.copy(error = message, touched = true)
                if (firstInvalid == null && message != null) firstInvalid = field
            }
            _fields.value = map
            return firstInvalid
        }

        // MARK: - Submit

        private suspend fun uploadPhotosIfNeeded(
            postId: String?,
            isEditing: Boolean,
        ): Pair<String, Boolean> {
            if (postId == null || _photos.value.isEmpty()) {
                return (if (isEditing) "Saved" else "Posted") to false
            }
            return when (uploadRepo.uploadPostMedia(postId, _photos.value.map { it.data })) {
                is NetworkResult.Success -> (if (isEditing) "Saved" else "Posted") to false
                is NetworkResult.Failure ->
                    (
                        if (isEditing) {
                            "Saved, but photos couldn't attach."
                        } else {
                            "Posted, but photos couldn't attach."
                        }
                    ) to true
            }
        }

        fun submit() {
            if (_state.value is PulseComposeUiState.Submitting) return
            val invalid = validateAll()
            if (invalid != null) {
                _shakeTrigger.value = _shakeTrigger.value + 1
                _toast.value = PulseComposeToast("Fix the highlighted field.", isError = true)
                Analytics.track(
                    AnalyticsEvent.FormPulseComposeValidationError(
                        intent = _activeIntent.value.key,
                        field = invalid.key,
                    ),
                )
                return
            }
            if (!networkMonitor.isOnline.value) {
                _toast.value =
                    PulseComposeToast("You're offline. Try again when you're back online.", isError = true)
                Analytics.track(
                    AnalyticsEvent.FormPulseComposeSubmit(
                        intent = _activeIntent.value.key,
                        result = AnalyticsResult.ERROR,
                    ),
                )
                return
            }
            // The precheck runs on body blur (RN `PostComposerModal.tsx:801`).
            // When it came back with a live posting restriction the draft is
            // refused here instead of round-tripping into a server rejection.
            val cooldown = _precheckCooldown.value
            if (cooldown != null) {
                _toast.value = PulseComposeToast(cooldown, isError = true)
                Analytics.track(
                    AnalyticsEvent.FormPulseComposeSubmit(
                        intent = _activeIntent.value.key,
                        result = AnalyticsResult.ERROR,
                    ),
                )
                return
            }
            _state.value = PulseComposeUiState.Submitting
            viewModelScope.launch {
                val editingId = editingPostId
                if (editingId != null) {
                    handleUpdate(editingId)
                } else {
                    refreshGpsFixIfNeeded()
                    handleCreate()
                }
            }
        }

        /**
         * Re-request a device fix right before submit so the GPS payload
         * is fresh. Best-effort with a short timeout — pick-time
         * coordinates remain the fallback.
         */
        private suspend fun refreshGpsFixIfNeeded() {
            if (postingTarget !is PulsePostingTarget.CurrentLocation) return
            freshGpsFix = locationProvider.requestCurrent(timeoutMillis = GPS_REFRESH_TIMEOUT_MS)
        }

        private suspend fun handleCreate() {
            val request = buildRequest()
            val authorId = businessAuthorId
            // C2 — "Post as this business": same body, business route.
            val createResult =
                if (authorId != null) {
                    businessPosts.createBusinessPost(authorId, request)
                } else {
                    repo.createPost(request)
                }
            when (val result = createResult) {
                is NetworkResult.Success -> {
                    val postId = result.data.post?.id ?: result.data.postId
                    val (toastText, toastError) = uploadPhotosIfNeeded(postId, isEditing = false)
                    _state.value = PulseComposeUiState.Success(postId = postId)
                    _toast.value = PulseComposeToast(toastText, isError = toastError)
                    _shouldDismiss.value = true
                    postsRefresh.notifyPostsDidChange()
                    Analytics.track(
                        AnalyticsEvent.FormPulseComposeSubmit(
                            intent = _activeIntent.value.key,
                            result = AnalyticsResult.SUCCESS,
                        ),
                    )
                }
                is NetworkResult.Failure -> {
                    val message = result.error.message.ifBlank { "Couldn't post. Try again." }
                    _state.value = PulseComposeUiState.Error(message)
                    _toast.value = PulseComposeToast(message, isError = true)
                    Analytics.track(
                        AnalyticsEvent.FormPulseComposeSubmit(
                            intent = _activeIntent.value.key,
                            result = AnalyticsResult.ERROR,
                        ),
                    )
                }
            }
        }

        private suspend fun handleUpdate(postId: String) {
            when (val result = repo.updatePost(postId, buildUpdateRequest())) {
                is NetworkResult.Success -> {
                    val resolvedId = result.data.postId ?: postId
                    val (toastText, toastError) = uploadPhotosIfNeeded(resolvedId, isEditing = true)
                    _state.value = PulseComposeUiState.Success(postId = resolvedId)
                    _toast.value = PulseComposeToast(toastText, isError = toastError)
                    _shouldDismiss.value = true
                    postsRefresh.notifyPostsDidChange()
                    Analytics.track(
                        AnalyticsEvent.FormPulseComposeSubmit(
                            intent = _activeIntent.value.key,
                            result = AnalyticsResult.SUCCESS,
                        ),
                    )
                }
                is NetworkResult.Failure -> {
                    val message = result.error.message.ifBlank { "Couldn't save. Try again." }
                    _state.value = PulseComposeUiState.Error(message)
                    _toast.value = PulseComposeToast(message, isError = true)
                    Analytics.track(
                        AnalyticsEvent.FormPulseComposeSubmit(
                            intent = _activeIntent.value.key,
                            result = AnalyticsResult.ERROR,
                        ),
                    )
                }
            }
        }

        // MARK: - Edit-mode prefill

        /**
         * Fetch the post being edited and seed every field + selector from
         * the wire payload. Idempotent — safe to call again from the retry
         * CTA when the first attempt failed.
         */
        fun loadForEdit() {
            val editingId = editingPostId ?: return
            _prefillState.value = PulseComposePrefillState.Loading
            viewModelScope.launch {
                when (val result = repo.detail(editingId)) {
                    is NetworkResult.Success -> {
                        applyPrefill(result.data.post)
                        _prefillState.value = PulseComposePrefillState.Ready
                    }
                    is NetworkResult.Failure -> {
                        val message = result.error.message.ifBlank { "Couldn't load this post. Try again." }
                        _prefillState.value = PulseComposePrefillState.Error(message)
                    }
                }
            }
        }

        /** Seed every field + selector from the saved post + rebaseline. */
        @Suppress("CyclomaticComplexMethod", "LongMethod")
        private fun applyPrefill(post: PostDetailDto) {
            val intent = PulseComposeIntent.fromFeedIntent(PulseIntent.fromPostType(post.postType))
            _activeIntent.value = intent

            // Visibility — fall back to the current selection when the
            // wire value isn't one of the form's three options.
            post.visibility
                ?.let { raw -> PulseComposeVisibility.entries.firstOrNull { it.key == raw } }
                ?.let { _visibility.value = it }
            baselineVisibility = _visibility.value

            // Identity is fixed at create time (updatePostSchema has no
            // `postAs`). The signed-in user is still the post's creator,
            // so we keep the form's selection as-is.
            baselineIdentity = _identity.value

            when (intent) {
                PulseComposeIntent.Ask -> {
                    seedField(PulseComposeField.Title, post.title.orEmpty())
                    seedField(PulseComposeField.Body, post.content)
                    post.serviceCategory
                        ?.let { raw -> PulseAskCategory.entries.firstOrNull { it.key == raw } }
                        ?.let { _askCategory.value = it }
                    baselineAskCategory = _askCategory.value
                }
                PulseComposeIntent.Recommend -> {
                    val (stars, body) = unwrapRecommendBody(post.content)
                    _recommendRating.value = stars ?: DEFAULT_RECOMMEND_RATING
                    seedField(PulseComposeField.Body, body)
                    seedField(PulseComposeField.RecommendBusiness, post.dealBusinessName.orEmpty())
                    baselineRecommendRating = _recommendRating.value
                }
                PulseComposeIntent.Event -> {
                    seedField(PulseComposeField.Title, post.title.orEmpty())
                    seedField(PulseComposeField.Body, post.content)
                    seedField(PulseComposeField.EventDate, formatEventDateForPicker(post.eventDate))
                    seedField(PulseComposeField.EventLocation, post.eventVenue.orEmpty())
                }
                PulseComposeIntent.Lost -> {
                    val (location, body) = unwrapLostBody(post.content)
                    seedField(PulseComposeField.Body, body)
                    seedField(PulseComposeField.LostLastSeenLocation, location.orEmpty())
                    post.lostFoundType
                        ?.let { raw -> PulseLostFoundKind.entries.firstOrNull { it.key == raw } }
                        ?.let { _lostFoundKind.value = it }
                    baselineLostFoundKind = _lostFoundKind.value
                }
                PulseComposeIntent.Announce -> {
                    seedField(PulseComposeField.Title, post.title.orEmpty())
                    seedField(PulseComposeField.Body, post.content)
                    post.visibility
                        ?.let { raw -> PulseAnnounceAudience.entries.firstOrNull { it.key == raw } }
                        ?.let { _announceAudience.value = it }
                    baselineAnnounceAudience = _announceAudience.value
                }
            }
        }

        private fun seedField(
            field: PulseComposeField,
            value: String,
        ) {
            val map = _fields.value.toMutableMap()
            map[field] = FormFieldState(id = field.key, value = value, originalValue = value)
            _fields.value = map
        }

        /**
         * Reverse of `composeRecommendBody`: splits "★★★☆☆\n\n<body>"
         * back into a star count + body. Returns (null, raw) when the
         * row is missing so the saved text is preserved verbatim.
         */
        private fun unwrapRecommendBody(raw: String): Pair<Int?, String> {
            val firstLine = raw.lineSequence().firstOrNull() ?: raw
            val filled = firstLine.count { it == '★' }
            val empty = firstLine.count { it == '☆' }
            if (filled + empty == 5 && firstLine.isNotEmpty()) {
                val remainder = raw.removePrefix(firstLine).trimStart('\n')
                return filled to remainder
            }
            return null to raw
        }

        /**
         * Reverse of `prefixLastSeen`: splits "Last seen: <loc>\n\n<body>"
         * back into (location, body). Returns (null, raw) when the prefix
         * is missing.
         */
        private fun unwrapLostBody(raw: String): Pair<String?, String> {
            val prefix = "Last seen: "
            if (!raw.startsWith(prefix)) return null to raw
            val afterPrefix = raw.removePrefix(prefix)
            val newlineIdx = afterPrefix.indexOf('\n')
            if (newlineIdx < 0) return afterPrefix to ""
            val location = afterPrefix.substring(0, newlineIdx)
            val body = afterPrefix.substring(newlineIdx).trimStart('\n')
            return location to body
        }

        /**
         * Convert an ISO-8601 wire date into the `yyyy-MM-dd HH:mm` shape
         * the Event date picker emits. Returns "" when the wire value is
         * missing or unparsable.
         */
        private fun formatEventDateForPicker(raw: String?): String {
            if (raw.isNullOrEmpty()) return ""
            val instant =
                runCatching {
                    java.time.Instant.parse(raw)
                }.getOrNull() ?: return raw
            val dt = instant.atZone(java.time.ZoneOffset.UTC).toLocalDateTime()
            return "%04d-%02d-%02d %02d:%02d".format(
                dt.year,
                dt.monthValue,
                dt.dayOfMonth,
                dt.hour,
                dt.minute,
            )
        }

        /**
         * Build the `PATCH /api/posts/:id` body from the active intent's
         * field values + selectors. Only the keys `updatePostSchema`
         * accepts make it onto the wire.
         */
        fun buildUpdateRequest(): PostUpdateRequest {
            val bodyValue = trimmedValue(PulseComposeField.Body)
            val titleValue = trimmedValue(PulseComposeField.Title)
            val intent = _activeIntent.value
            return when (intent) {
                PulseComposeIntent.Ask ->
                    PostUpdateRequest(
                        content = bodyValue,
                        title = titleValue,
                        visibility = _visibility.value.key,
                        serviceCategory = _askCategory.value.key,
                    )
                PulseComposeIntent.Recommend -> {
                    val business = trimmedValue(PulseComposeField.RecommendBusiness)
                    PostUpdateRequest(
                        content = composeRecommendBody(_recommendRating.value, bodyValue),
                        visibility = _visibility.value.key,
                        dealBusinessName = business.ifEmpty { null },
                    )
                }
                PulseComposeIntent.Event -> {
                    val venue = trimmedValue(PulseComposeField.EventLocation)
                    val dateRaw = trimmedValue(PulseComposeField.EventDate)
                    PostUpdateRequest(
                        content = bodyValue,
                        title = titleValue,
                        visibility = _visibility.value.key,
                        eventDate = dateRaw.ifEmpty { null }?.let { isoDateTime(it) },
                        eventVenue = venue.ifEmpty { null },
                    )
                }
                PulseComposeIntent.Lost -> {
                    val lastSeen = trimmedValue(PulseComposeField.LostLastSeenLocation)
                    PostUpdateRequest(
                        content = prefixLastSeen(bodyValue, lastSeen),
                        visibility = _visibility.value.key,
                        lostFoundType = _lostFoundKind.value.key,
                    )
                }
                PulseComposeIntent.Announce ->
                    PostUpdateRequest(
                        content = bodyValue,
                        title = titleValue,
                        visibility = _announceAudience.value.backendVisibility,
                    )
            }
        }

        // MARK: - Request assembly

        /** Compose the `POST /api/posts` body from active-intent state. */
        @Suppress("LongMethod")
        fun buildRequest(): PostCreateRequest {
            val bodyValue = trimmedValue(PulseComposeField.Body)
            val titleValue = trimmedValue(PulseComposeField.Title)
            val intent = _activeIntent.value
            val postType = effectivePostType()
            val purposeTag = effectivePurpose()
            val vis = effectiveVisibility()
            val audience = effectiveAudience()
            val postAs = postingTarget?.postAs ?: _identity.value.postAs

            val base =
                when (intent) {
                    PulseComposeIntent.Ask ->
                        PostCreateRequest(
                            content = bodyValue,
                            title = titleValue.ifEmpty { null },
                            postType = postType,
                            visibility = vis,
                            postAs = postAs,
                            serviceCategory = _askCategory.value.key,
                            audience = audience,
                            purpose = purposeTag,
                        )
                    PulseComposeIntent.Recommend -> {
                        val business = trimmedValue(PulseComposeField.RecommendBusiness)
                        PostCreateRequest(
                            content = composeRecommendBody(_recommendRating.value, bodyValue),
                            postType = postType,
                            visibility = vis,
                            postAs = postAs,
                            businessName = business.ifEmpty { null },
                            audience = audience,
                            purpose = purposeTag,
                        )
                    }
                    PulseComposeIntent.Event -> {
                        val venue = trimmedValue(PulseComposeField.EventLocation)
                        val dateRaw = trimmedValue(PulseComposeField.EventDate)
                        val endRaw = trimmedValue(PulseComposeField.EventEndDate)
                        PostCreateRequest(
                            content = bodyValue,
                            title = titleValue.ifEmpty { null },
                            postType = postType,
                            visibility = vis,
                            postAs = postAs,
                            eventDate = dateRaw.ifEmpty { null }?.let { isoDateTime(it) },
                            eventEndDate = endRaw.ifEmpty { null }?.let { isoDateTime(it) },
                            eventVenue = venue.ifEmpty { null },
                            audience = audience,
                            purpose = purposeTag,
                        )
                    }
                    PulseComposeIntent.Lost -> {
                        val lastSeen = trimmedValue(PulseComposeField.LostLastSeenLocation)
                        val phone = trimmedValue(PulseComposeField.ContactPhone)
                        PostCreateRequest(
                            content = prefixLastSeen(bodyValue, lastSeen),
                            postType = postType,
                            visibility = vis,
                            postAs = postAs,
                            lostFoundType = _lostFoundKind.value.key,
                            contactPref = _lostFoundContactPref.value.key,
                            contactPhone =
                                if (_lostFoundContactPref.value == PulseLostFoundContactPref.Phone && phone.isNotEmpty()) {
                                    phone
                                } else {
                                    null
                                },
                            audience = audience,
                            purpose = purposeTag,
                        )
                    }
                    PulseComposeIntent.Announce -> {
                        // Flow mode: the "Who can see this" radio governs
                        // visibility. Legacy single-screen mode keeps the
                        // announce-audience chips.
                        val announceVis = if (isFlowMode) vis else _announceAudience.value.backendVisibility
                        val dealBusiness = trimmedValue(PulseComposeField.DealBusinessName)
                        val isDeal = postType == "deal"
                        PostCreateRequest(
                            content = bodyValue,
                            title = titleValue.ifEmpty { null },
                            postType = postType,
                            visibility = announceVis,
                            postAs = postAs,
                            audience = audience,
                            purpose = purposeTag,
                            safetyAlertKind =
                                if (postType == "alert") {
                                    _safetyAlertKind.value.key
                                } else {
                                    null
                                },
                            dealExpiresAt = if (isDeal) isoTimestamp(_dealExpiresAt.value) else null,
                            businessName = if (isDeal && dealBusiness.isNotEmpty()) dealBusiness else null,
                        )
                    }
                }
            return applyPlaceTag(mergeTargetContext(base))
        }

        private fun effectivePostType(): String {
            composePurpose?.postType?.let { return it }
            if (postingTarget?.isNetworkTarget == true) return "general"
            return _activeIntent.value.postType
        }

        private fun effectivePurpose(): String? {
            composePurpose?.apiPurpose?.let { return it }
            if (postingTarget?.isNetworkTarget == true) return null
            return _activeIntent.value.purpose
        }

        private fun effectiveVisibility(): String {
            if (postingTarget?.isNetworkTarget == true) return PulseComposeVisibility.Connections.key
            return _visibility.value.key
        }

        private fun effectiveAudience(): String {
            if (postingTarget?.isNetworkTarget == true) return "connections"
            // Place target with the "Connections" radio selected — the post
            // should reach the network, not the neighborhood.
            if (isFlowMode && _visibility.value == PulseComposeVisibility.Connections) return "connections"
            return "nearby"
        }

        private data class GpsFields(
            val timestamp: String?,
            val latitude: Double?,
            val longitude: Double?,
        )

        private fun gpsFields(target: PulsePostingTarget): GpsFields {
            if (target !is PulsePostingTarget.CurrentLocation) return GpsFields(null, null, null)
            // Prefer the device fix captured at submit time; fall back to
            // the coordinates resolved when the target was picked.
            val fix = freshGpsFix
            return GpsFields(
                timestamp = java.time.Instant.now().truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString(),
                latitude = fix?.latitude ?: target.lat,
                longitude = fix?.longitude ?: target.lng,
            )
        }

        private fun mergeTargetContext(base: PostCreateRequest): PostCreateRequest {
            val target = postingTarget ?: return base
            val gps = gpsFields(target)
            return base.copy(
                latitude = target.targetLatitude,
                longitude = target.targetLongitude,
                locationName = if (target.isPlaceTarget) target.displayLabel else null,
                homeId = target.targetHomeId,
                businessId = target.targetBusinessId,
                gpsTimestamp = gps.timestamp,
                gpsLatitude = gps.latitude,
                gpsLongitude = gps.longitude,
            )
        }

        /**
         * Instagram-style venue tag — applied as the LAST build step so an
         * explicit pick wins over the flow-target context
         * ([mergeTargetContext] overwrites location fields wholesale). The
         * `gps*` attestation fields are deliberately untouched: they attest
         * the device fix, not the tagged venue.
         */
        private fun applyPlaceTag(request: PostCreateRequest): PostCreateRequest {
            val tag = _selectedPlaceTag.value ?: return request
            return request.copy(
                latitude = tag.latitude,
                longitude = tag.longitude,
                locationName = tag.name,
                locationAddress = tag.address,
                geocodeProvider = "mapbox",
                geocodeAccuracy = tag.kind,
                geocodePlaceId = tag.placeId,
            )
        }

        private fun trimmedValue(field: PulseComposeField): String = (_fields.value[field]?.value ?: "").trim()

        private fun composeRecommendBody(
            stars: Int,
            body: String,
        ): String {
            val clamped = stars.coerceIn(1, 5)
            val row = "★".repeat(clamped) + "☆".repeat(5 - clamped)
            return if (body.isEmpty()) row else "$row\n\n$body"
        }

        private fun prefixLastSeen(
            body: String,
            location: String,
        ): String = if (location.isEmpty()) body else "Last seen: $location\n\n$body"

        /**
         * Normalize an event date to ISO-8601. Accepts the picker-emitted
         * `yyyy-MM-dd HH:mm` shape (treated as UTC, mirroring iOS) and
         * plain `yyyy-MM-dd` (treated as 09:00 UTC). Returns the raw
         * string unchanged when it already carries a `T` separator.
         */
        private fun isoDateTime(raw: String): String {
            if (raw.contains('T')) return raw
            if (PICKER_DATE_TIME_PATTERN.matches(raw)) return raw.replaceFirst(" ", "T") + ":00Z"
            return "${raw}T09:00:00Z"
        }

        /** Encode a local date-time as an ISO-8601 UTC instant. */
        private fun isoTimestamp(value: LocalDateTime): String =
            value
                .atZone(java.time.ZoneId.systemDefault())
                .toInstant()
                .truncatedTo(java.time.temporal.ChronoUnit.SECONDS)
                .toString()

        companion object {
            const val INTENT_KEY = "intent"
            const val POST_ID_KEY = "postId"

            /** Nav arg carrying a Sports-lane starter's prompt text. */
            const val PREFILL_BODY_KEY = "prefillBody"
            private const val TITLE_MAX = 255
            private const val BODY_MAX = 5000
            private const val LOCATION_MAX = 255
            private const val BUSINESS_NAME_MAX = 255
            private const val CAPACITY_MAX = 100_000
            private const val DEFAULT_RECOMMEND_RATING = 5
            private const val PHONE_MIN_DIGITS = 7
            private const val PHONE_MAX_DIGITS = 15
            private const val DEAL_DEFAULT_EXPIRY_DAYS = 7L
            private const val GPS_REFRESH_TIMEOUT_MS = 3_000L
            private val PICKER_DATE_TIME_PATTERN = Regex("""^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$""")
            private val ISO_DATE_ONLY_PATTERN = Regex("""^\d{4}-\d{2}-\d{2}$""")
        }
    }
