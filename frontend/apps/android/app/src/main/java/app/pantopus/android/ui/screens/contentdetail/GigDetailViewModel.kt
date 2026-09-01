@file:Suppress("ComplexCondition", "LongMethod", "LongParameterList", "MagicNumber", "PackageNaming", "ReturnCount", "TooManyFunctions")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.notifications.GigActiveNotification
import app.pantopus.android.core.notifications.GigActiveNotifier
import app.pantopus.android.data.api.models.gigs.CancelGigReason
import app.pantopus.android.data.api.models.gigs.CancellationPreviewResponse
import app.pantopus.android.data.api.models.gigs.GigActiveStatusResponse
import app.pantopus.android.data.api.models.gigs.GigBidDto
import app.pantopus.android.data.api.models.gigs.GigChangeOrderDto
import app.pantopus.android.data.api.models.gigs.GigChangeOrderMutationResponse
import app.pantopus.android.data.api.models.gigs.GigChangeOrderType
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatus
import app.pantopus.android.data.api.models.gigs.GigPaymentResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionDto
import app.pantopus.android.data.api.models.gigs.GigReportReason
import app.pantopus.android.data.api.models.gigs.PlaceBidBody
import app.pantopus.android.data.api.models.gigs.ViewerBidStatus
import app.pantopus.android.data.api.models.offers.BidDto
import app.pantopus.android.data.api.models.offers.UpdateBidBody
import app.pantopus.android.data.api.models.payments.TipRequest
import app.pantopus.android.data.api.models.reviews.CreateReviewBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigOwnerActionsRepository
import app.pantopus.android.data.gigs.GigReassignmentRepository
import app.pantopus.android.data.gigs.GigViewerBidRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.reviews.ReviewsRepository
import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.marketplace.ListingGradient
import app.pantopus.android.ui.screens.settings.payments.CheckoutOutcome
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.inject.Inject

/**
 * Phase 5 — projection of the active-task panel (assigned → confirmed).
 * Derived once per fetch in [GigDetailViewModel.applyLoaded].
 */
data class GigActiveTaskUi(
    /** 0 Assigned · 1 In progress · 2 Marked done · 3 Confirmed. */
    val phaseIndex: Int,
    val viewerIsOwner: Boolean,
    val viewerIsWorker: Boolean,
    /** Worker on an `assigned` task that hasn't acknowledged yet. */
    val showWorkerAck: Boolean,
    /** Worker already acknowledged starting ("On my way" chip). */
    val acked: Boolean,
    /** Worker on an `assigned` task — "Start task" (`/start`). */
    val showStartTask: Boolean,
    /** Worker on an in-progress task — existing Mark delivered sheet. */
    val showMarkDelivered: Boolean,
    /** Owner once the worker marked done — "Confirm completion". */
    val showConfirmCompletion: Boolean,
    /** No-show affordance (either party), gated by `GET /no-show-check`. */
    val showNoShow: Boolean,
    /** Phase 5b — worker on an `assigned` task may flag `running_late`. */
    val showRunningLate: Boolean = false,
    /** Phase 5b — worker flagged `running_late`; both roles see the badge. */
    val runningLate: Boolean = false,
    /** Phase 5b — ETA minutes accompanying `running_late`, when given. */
    val lateEtaMinutes: Int? = null,
    /**
     * Assigned worker, before work starts — "Can't make it" self-release
     * (`POST /worker-release`, `backend/routes/gigs.js:5954`).
     */
    val showCantMakeIt: Boolean = false,
)

@HiltViewModel
@Suppress("LargeClass")
class GigDetailViewModel
    @Inject
    constructor(
        private val repo: GigsRepository,
        // RN→native parity: Q&A upvote / pin / delete + the poster's
        // "Remind worker" nudge live on their own thin repository.
        private val extrasRepo: app.pantopus.android.data.gigs.GigExtrasRepository,
        private val reassignmentRepo: GigReassignmentRepository,
        // Bidder side — `GET /api/gigs/:id/my-bid`; the update / withdraw
        // half reuses OffersRepository rather than duplicating the routes.
        private val viewerBidRepo: GigViewerBidRepository,
        // RN→native parity: withdraw-counter, close-open-task, and the
        // urgent live fulfillment stepper.
        private val ownerActionsRepo: GigOwnerActionsRepository,
        private val offersRepo: OffersRepository,
        private val authRepo: AuthRepository,
        private val filesRepo: FilesRepository,
        private val paymentsRepo: PaymentsRepository,
        private val reviewsRepo: ReviewsRepository,
        private val socket: SocketManager,
        private val activeNotifier: GigActiveNotifier,
        // RN→native parity: the v2 scored-offers list and the public
        // "share live status" link.
        private val gigsV2Repo: app.pantopus.android.data.gigs.GigsV2Repository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        companion object {
            const val GIG_ID_KEY = "gigId"

            /**
             * Page size for the `GET /api/gigs/my-bids` fallback that
             * enriches a countered bid with its counter columns. Mirrors
             * RN's `getMyBids({ limit: 200 })` (`BidPanel.tsx:111`).
             */
            private const val MY_BIDS_LOOKUP_LIMIT = 200

            /**
             * Server-side cooldown between two "Remind worker" nudges
             * (`GIG_START_REMINDER_COOLDOWN_MS`, `backend/routes/gigs.js:48`).
             */
            const val WORKER_REMINDER_COOLDOWN_MS: Long = 15L * 60L * 1000L

            /** `"12m"` / `"1h 5m"` / `"2h"` — `null` once the window passed. */
            fun cooldownRemaining(
                endsAtMillis: Long,
                nowMillis: Long,
            ): String? {
                val remaining = endsAtMillis - nowMillis
                if (remaining <= 0L) return null
                val totalMinutes = ((remaining + 59_999L) / 60_000L).toInt()
                if (totalMinutes < 60) return "${totalMinutes}m"
                val hours = totalMinutes / 60
                val minutes = totalMinutes % 60
                return if (minutes > 0) "${hours}h ${minutes}m" else "${hours}h"
            }

            /** ISO-8601 → epoch millis; `null` when absent or unparseable. */
            fun parseEpochMillis(iso: String?): Long? {
                if (iso.isNullOrEmpty()) return null
                return runCatching { Instant.parse(iso).toEpochMilli() }.getOrNull()
            }

            /**
             * Pull `next_allowed_at` out of the rate-limit body a 429 carries
             * (`backend/routes/gigs.js:5781`).
             */
            fun nextAllowedAt(error: app.pantopus.android.data.api.net.NetworkError): Long? {
                val body = (error as? app.pantopus.android.data.api.net.NetworkError.ClientError)?.body ?: return null
                return runCatching {
                    JSONObject(body).optString("next_allowed_at").takeIf { it.isNotBlank() }
                }.getOrNull()?.let { parseEpochMillis(it) }
            }

            /**
             * Worker self-completion gate: the signed-in viewer is the
             * assigned worker (`accepted_by`) and the task is `in_progress`
             * (mirrors the backend `mark-completed` precondition + MyBids'
             * "Mark complete" gate).
             */
            fun viewerCanMarkDelivered(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty()) return false
                if (gig.acceptedBy != currentUserId) return false
                return gig.status?.lowercase() == "in_progress"
            }

            /**
             * Tip gate (Block 3D): the poster, on a completed + owner-confirmed
             * gig with an assigned worker. Mirrors the `/tip` preconditions.
             */
            fun viewerCanTip(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty() || gig.userId != currentUserId) return false
                if (gig.acceptedBy.isNullOrEmpty()) return false
                if (gig.status?.lowercase() != "completed") return false
                return !gig.ownerConfirmedAt.isNullOrEmpty()
            }

            /**
             * Instant-accept gate (Phase 5, work item 3): mirrors
             * `POST /instant-accept` preconditions — `engagement_mode ==
             * "instant_accept"`, still `open`, and viewer ≠ owner.
             */
            fun viewerCanInstantAccept(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty()) return false
                if (gig.userId == currentUserId) return false
                if (gig.engagementMode != "instant_accept") return false
                return gig.status?.lowercase() == "open"
            }

            /**
             * Phase strip index for the active-task panel:
             * 0 Assigned · 1 In progress · 2 Marked done (worker completed,
             * owner hasn't confirmed) · 3 Confirmed. `null` when the gig is
             * outside the assigned → confirmed lifecycle.
             */
            fun activePhaseIndex(gig: GigDto): Int? =
                when (gig.status?.lowercase()) {
                    "assigned" -> 0
                    "in_progress" -> 1
                    "completed" -> if (gig.ownerConfirmedAt.isNullOrEmpty()) 2 else 3
                    else -> null
                }

            /**
             * Owner confirm gate: `POST /complete` is for the poster once the
             * worker marked done (`completed` + no `owner_confirmed_at`).
             */
            fun ownerCanConfirmCompletion(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty() || gig.userId != currentUserId) return false
                if (gig.status?.lowercase() != "completed") return false
                return gig.ownerConfirmedAt.isNullOrEmpty()
            }

            /**
             * "Can't make it" gate — the assigned worker releases themselves
             * before work starts. Mirrors `POST /worker-release`'s
             * preconditions exactly (`backend/routes/gigs.js:5972-5984`):
             * caller is `accepted_by`, `status == "assigned"`, `started_at`
             * still null.
             */
            fun workerCanRelease(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty() || gig.acceptedBy != currentUserId) return false
                if (gig.status?.lowercase() != "assigned") return false
                return gig.startedAt.isNullOrEmpty()
            }

            /**
             * "Replace worker" gate — the poster swaps the assigned worker
             * out before work starts. Mirrors `POST /reopen-bidding`'s
             * preconditions (`backend/routes/gigs.js:4900-4914`): owner-only,
             * `status == "assigned"`, `started_at` still null. Unlike Cancel
             * task this costs no cancellation fee.
             */
            fun ownerCanReplaceWorker(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty() || gig.userId != currentUserId) return false
                if (gig.status?.lowercase() != "assigned") return false
                return gig.startedAt.isNullOrEmpty()
            }

            /** Either participant on a completed gig may leave one review. */
            fun viewerCanReview(
                gig: GigDto,
                currentUserId: String?,
            ): Boolean {
                if (currentUserId.isNullOrEmpty()) return false
                if (gig.status?.lowercase() != "completed") return false
                return gig.userId == currentUserId || gig.acceptedBy == currentUserId
            }

            /** Shared web link for the Android share sheet (work item 6). */
            fun shareUrl(gigId: String): String = "https://pantopus.com/gigs/$gigId"

            /**
             * Phase 6b — phase line for the ongoing active-task
             * notification. Non-null while the task is live for a
             * participant (assigned / in progress / marked done awaiting
             * the owner); null once resolved (confirmed complete,
             * cancelled) or outside the active lifecycle.
             */
            fun activeNotificationLine(gig: GigDto): String? =
                when (gig.status?.lowercase()) {
                    "assigned" ->
                        when (gig.workerAckStatus) {
                            "starting_now" -> "Worker on the way"
                            "running_late" ->
                                gig.workerAckEtaMinutes?.let { "Running ~$it min late" } ?: "Running late"
                            else -> "Assigned — waiting for worker"
                        }
                    "in_progress" -> "In progress"
                    "completed" ->
                        if (gig.ownerConfirmedAt.isNullOrEmpty()) "Marked done — confirm completion" else null
                    else -> null
                }

            /**
             * Engagement modes whose owner surface RN drives from the v2
             * scored-offers endpoint rather than the plain bids list
             * (`gig-v2/[id].tsx:105`).
             */
            internal val SCORED_OFFER_MODES = listOf("curated_offers", "quotes")

            /** True when this gig's owner surface should ask for ranked offers. */
            internal fun usesScoredOffers(gig: GigDto): Boolean = gig.engagementMode?.lowercase() in SCORED_OFFER_MODES

            /** Room events emitted by `emitGigUpdate` (`backend/routes/gigs.js:413`). */
            internal val GIG_ROOM_EVENTS =
                listOf(
                    "gig:bid-update",
                    "gig:bid-accepted",
                    "gig:status-change",
                    "gig:worker-ack",
                    "gig:completion-update",
                    "gig:payment-update",
                    "gig:qa-update",
                    // P6b — `POST /reschedule` fires `gig:rescheduled`
                    // (`backend/routes/gigs.js:6465`).
                    "gig:rescheduled",
                    // Urgent live fulfillment — `POST /:gigId/status` emits
                    // this into the same room (`backend/routes/gigs.js:8770`);
                    // the refetch pulls the new rung through refreshFulfillment.
                    "gig_status_update",
                )
        }

        private val gigId: String = savedStateHandle.get<String>(GIG_ID_KEY) ?: ""

        private val _state = MutableStateFlow<ContentDetailUiState>(ContentDetailUiState.Loading)
        val state: StateFlow<ContentDetailUiState> = _state.asStateFlow()

        private val _tipStatus = MutableStateFlow<TipStatus>(TipStatus.Idle)
        val tipStatus: StateFlow<TipStatus> = _tipStatus.asStateFlow()

        private val _events = MutableSharedFlow<GigTipEvent>(extraBufferCapacity = 4)
        val events: SharedFlow<GigTipEvent> = _events.asSharedFlow()

        private val _openChatEvents = MutableSharedFlow<GigOpenChatEvent>(extraBufferCapacity = 1)
        val openChatEvents: SharedFlow<GigOpenChatEvent> = _openChatEvents.asSharedFlow()

        private var rawGig: GigDto? = null
        private var canMarkDelivered = false
        private var canTip = false
        private var viewerIsOwner = false

        /** P1.C — bookmark state for the top-bar toggle (`saved_by_user`). */
        private val _saved = MutableStateFlow(false)
        val saved: StateFlow<Boolean> = _saved.asStateFlow()

        /** P1.C — true while a save/unsave call is in flight (re-entrancy guard). */
        private var saveInFlight = false

        // MARK: - Phase 5 lifecycle state

        /** One-shot lifecycle effects: PaymentSheet presentation + toasts. */
        private val _lifecycleEvents = MutableSharedFlow<GigLifecycleEvent>(extraBufferCapacity = 8)
        val lifecycleEvents: SharedFlow<GigLifecycleEvent> = _lifecycleEvents.asSharedFlow()

        /** Raw bids for the owner panel (owner-only endpoint; empty otherwise). */
        private val _bids = MutableStateFlow<List<GigBidDto>>(emptyList())
        val bids: StateFlow<List<GigBidDto>> = _bids.asStateFlow()

        /**
         * Ranking metadata keyed by bid id, populated only when the owner's
         * bids came from the v2 scored-offers endpoint
         * (`GET /api/v2/gigs/:gigId/offers`). Empty on the `/bids` fallback.
         */
        private val _offerRankings = MutableStateFlow<Map<String, GigOfferRanking>>(emptyMap())
        val offerRankings: StateFlow<Map<String, GigOfferRanking>> = _offerRankings.asStateFlow()

        /** True while `POST /share-status` is in flight — debounces taps. */
        private val _sharingLiveStatus = MutableStateFlow(false)
        val sharingLiveStatus: StateFlow<Boolean> = _sharingLiveStatus.asStateFlow()

        /** Minted live-status links; the screen copies them to the clipboard. */
        private val _liveStatusEvents = MutableSharedFlow<GigLiveStatusEvent>(extraBufferCapacity = 4)
        val liveStatusEvents: SharedFlow<GigLiveStatusEvent> = _liveStatusEvents.asSharedFlow()

        /** Bid id whose accept/counter/reject call is in flight. */
        private val _bidActionInFlight = MutableStateFlow<String?>(null)
        val bidActionInFlight: StateFlow<String?> = _bidActionInFlight.asStateFlow()

        // MARK: - Viewer's own bid (bidder side)

        /**
         * The signed-in viewer's own bid on this gig, from
         * `GET /api/gigs/:id/my-bid`. Null for the poster, for signed-out
         * viewers, and for anyone who has not bid.
         */
        private val _viewerBid = MutableStateFlow<BidDto?>(null)
        val viewerBid: StateFlow<BidDto?> = _viewerBid.asStateFlow()

        /** True while an update / withdraw / counter response is in flight. */
        private val _viewerBidActionInFlight = MutableStateFlow(false)
        val viewerBidActionInFlight: StateFlow<Boolean> = _viewerBidActionInFlight.asStateFlow()

        private var viewerIsWorker = false

        /** True while `POST /instant-accept` is in flight. */
        private val _instantAcceptInFlight = MutableStateFlow(false)
        val instantAcceptInFlight: StateFlow<Boolean> = _instantAcceptInFlight.asStateFlow()

        /** Active-task panel projection; null outside assigned → confirmed. */
        private val _activeTask = MutableStateFlow<GigActiveTaskUi?>(null)
        val activeTask: StateFlow<GigActiveTaskUi?> = _activeTask.asStateFlow()

        /** Review affordance on a completed gig. */
        private val _reviewState = MutableStateFlow<GigReviewState>(GigReviewState.Hidden)
        val reviewState: StateFlow<GigReviewState> = _reviewState.asStateFlow()

        /** Owner cancel sheet — fee preview from `GET /cancellation-preview`. */
        private val _cancelPreview = MutableStateFlow<CancellationPreviewResponse?>(null)
        val cancelPreview: StateFlow<CancellationPreviewResponse?> = _cancelPreview.asStateFlow()

        private val _cancelPreviewLoading = MutableStateFlow(false)
        val cancelPreviewLoading: StateFlow<Boolean> = _cancelPreviewLoading.asStateFlow()

        // MARK: - Phase 5b lifecycle-completer state

        /** Payment card (owner, assigned+) from `GET /payment`; null hides it. */
        private val _payment = MutableStateFlow<GigPaymentResponse?>(null)
        val payment: StateFlow<GigPaymentResponse?> = _payment.asStateFlow()

        /** Change orders for the active task (both roles, assigned/in_progress). */
        private val _changeOrders = MutableStateFlow<List<GigChangeOrderDto>>(emptyList())
        val changeOrders: StateFlow<List<GigChangeOrderDto>> = _changeOrders.asStateFlow()

        /** Change-order id whose approve / reject / withdraw is in flight. */
        private val _changeOrderActionInFlight = MutableStateFlow<String?>(null)
        val changeOrderActionInFlight: StateFlow<String?> = _changeOrderActionInFlight.asStateFlow()

        // MARK: - Urgent live fulfillment (RN `ActiveTaskPanel`)

        /**
         * Latest `GET /:gigId/active-status` payload for an urgent /
         * starts-asap task. Null hides the live stepper entirely (the
         * backend 400s the route on non-urgent gigs).
         */
        private val _fulfillment = MutableStateFlow<GigActiveStatusResponse?>(null)
        val fulfillment: StateFlow<GigActiveStatusResponse?> = _fulfillment.asStateFlow()

        /** True while an `on_the_way` / `arrived` / `in_progress` advance is in flight. */
        private val _fulfillmentActionInFlight = MutableStateFlow(false)
        val fulfillmentActionInFlight: StateFlow<Boolean> = _fulfillmentActionInFlight.asStateFlow()

        /** Which checkout the presented PaymentSheet belongs to. */
        private sealed interface PendingCheckout {
            data class BidAccept(val bidId: String) : PendingCheckout

            data object InstantAccept : PendingCheckout
        }

        private var pendingCheckout: PendingCheckout? = null
        private var canInstantAccept = false
        private var realtimeJob: Job? = null
        private var refetchInFlight = false

        private val _questions = MutableStateFlow<List<GigQuestionDto>>(emptyList())
        val questions: StateFlow<List<GigQuestionDto>> = _questions.asStateFlow()

        private val _questionsLoading = MutableStateFlow(false)
        val questionsLoading: StateFlow<Boolean> = _questionsLoading.asStateFlow()

        private val _newQuestionText = MutableStateFlow("")
        val newQuestionText: StateFlow<String> = _newQuestionText.asStateFlow()

        private val _answeringQuestionId = MutableStateFlow<String?>(null)
        val answeringQuestionId: StateFlow<String?> = _answeringQuestionId.asStateFlow()

        private val _answerDraftText = MutableStateFlow("")
        val answerDraftText: StateFlow<String> = _answerDraftText.asStateFlow()

        private val _questionSubmitting = MutableStateFlow(false)
        val questionSubmitting: StateFlow<Boolean> = _questionSubmitting.asStateFlow()

        private val _answerSubmitting = MutableStateFlow(false)
        val answerSubmitting: StateFlow<Boolean> = _answerSubmitting.asStateFlow()

        /**
         * Id of the question whose upvote / pin / delete round-trip is in
         * flight — disables that row's action strip.
         */
        private val _questionActionInFlight = MutableStateFlow<String?>(null)
        val questionActionInFlight: StateFlow<String?> = _questionActionInFlight.asStateFlow()

        /**
         * End of the local "Remind worker" cooldown window (epoch millis).
         * Seeded from the gig's `last_worker_reminder_at` and refreshed
         * from the POST's `sent_at` (or a 429's `next_allowed_at`).
         */
        private val _workerReminderCooldownEndsAt = MutableStateFlow<Long?>(null)
        val workerReminderCooldownEndsAt: StateFlow<Long?> = _workerReminderCooldownEndsAt.asStateFlow()

        /** Payment id of the in-flight tip, used to reconcile after PaymentSheet. */
        private var pendingTipPaymentId: String? = null

        /** Current gig snapshot — null until the first fetch resolves. */
        fun gigSnapshot(): GigDto? = rawGig

        /** True when the viewer is the assigned worker on an in-progress task. */
        fun canMarkDelivered(): Boolean = canMarkDelivered

        /** True when the poster can tip the worker on this completed gig (3D). */
        fun canTip(): Boolean = canTip

        /** True when the dock primary is "Accept this task" (instant accept). */
        fun canInstantAccept(): Boolean = canInstantAccept

        /** True when the signed-in viewer owns this gig. */
        fun viewerIsOwner(): Boolean = viewerIsOwner

        fun canAskQuestion(): Boolean = currentUserId() != null && !viewerIsOwner

        fun setNewQuestionText(value: String) {
            _newQuestionText.value = value.take(1000)
        }

        fun setAnswerDraftText(value: String) {
            _answerDraftText.value = value.take(2000)
        }

        fun beginAnswering(questionId: String) {
            _answeringQuestionId.value = questionId
            _answerDraftText.value = ""
        }

        fun cancelAnswering() {
            _answeringQuestionId.value = null
            _answerDraftText.value = ""
        }

        fun loadQuestions() {
            viewModelScope.launch {
                _questionsLoading.value = true
                when (val result = repo.questions(gigId)) {
                    is NetworkResult.Success -> _questions.value = result.data.questions
                    is NetworkResult.Failure -> _questions.value = emptyList()
                }
                _questionsLoading.value = false
            }
        }

        fun submitQuestion(onError: (String) -> Unit = {}) {
            val trimmed = _newQuestionText.value.trim()
            if (trimmed.length < 5) {
                onError("Question must be at least 5 characters.")
                return
            }
            viewModelScope.launch {
                _questionSubmitting.value = true
                when (val result = repo.askQuestion(gigId, trimmed)) {
                    is NetworkResult.Success -> {
                        _newQuestionText.value = ""
                        loadQuestions()
                    }
                    is NetworkResult.Failure -> onError(result.error.message)
                }
                _questionSubmitting.value = false
            }
        }

        fun submitAnswer(
            questionId: String,
            onError: (String) -> Unit = {},
        ) {
            val trimmed = _answerDraftText.value.trim()
            if (trimmed.isEmpty()) {
                onError("Answer can't be empty.")
                return
            }
            viewModelScope.launch {
                _answerSubmitting.value = true
                when (val result = repo.answerQuestion(gigId, questionId, trimmed)) {
                    is NetworkResult.Success -> {
                        _answeringQuestionId.value = null
                        _answerDraftText.value = ""
                        loadQuestions()
                    }
                    is NetworkResult.Failure -> onError(result.error.message)
                }
                _answerSubmitting.value = false
            }
        }

        // MARK: - Structured Q&A engagement (RN `QASection`)

        /** Pinned answers render in their own block above the thread. */
        fun pinnedQuestions(all: List<GigQuestionDto>): List<GigQuestionDto> = all.filter { it.isPinned == true && it.isAnswered }

        /** Everything the pinned block doesn't already show. */
        fun unpinnedQuestions(all: List<GigQuestionDto>): List<GigQuestionDto> = all.filterNot { it.isPinned == true && it.isAnswered }

        /** Upvote gate — any signed-in viewer. */
        fun canUpvoteQuestion(): Boolean = currentUserId() != null

        /**
         * The viewer asked this question, so they may delete it (the poster
         * may delete any — `backend/routes/gigs.js:7638`).
         */
        fun viewerAskedQuestion(question: GigQuestionDto): Boolean {
            val me = currentUserId() ?: return false
            val asker = question.asker?.id ?: return false
            return me.isNotEmpty() && asker == me
        }

        /** Delete gate — asker or gig poster. */
        fun canDeleteQuestion(question: GigQuestionDto): Boolean = viewerIsOwner || viewerAskedQuestion(question)

        /**
         * Pin gate — poster only, and only once the question is answered
         * (an unanswered pin has nothing to surface).
         */
        fun canPinQuestion(question: GigQuestionDto): Boolean = viewerIsOwner && question.isAnswered

        /**
         * Toggle the viewer's upvote (`POST .../questions/:id/upvote`,
         * `backend/routes/gigs.js:7535`). The backend owns the count, so we
         * refetch the thread rather than guessing locally.
         */
        fun toggleQuestionUpvote(
            questionId: String,
            onError: (String) -> Unit = {},
        ) {
            if (!canUpvoteQuestion() || _questionActionInFlight.value != null) return
            _questionActionInFlight.value = questionId
            viewModelScope.launch {
                when (val result = extrasRepo.upvoteQuestion(gigId, questionId)) {
                    is NetworkResult.Success -> loadQuestions()
                    is NetworkResult.Failure -> onError(result.error.displayMessage("Couldn't record your upvote."))
                }
                _questionActionInFlight.value = null
            }
        }

        /**
         * Poster pins / unpins an answered question
         * (`POST .../questions/:id/pin`, `backend/routes/gigs.js:7482`).
         */
        fun toggleQuestionPin(
            questionId: String,
            onError: (String) -> Unit = {},
        ) {
            if (_questionActionInFlight.value != null) return
            _questionActionInFlight.value = questionId
            viewModelScope.launch {
                when (val result = extrasRepo.pinQuestion(gigId, questionId)) {
                    is NetworkResult.Success -> loadQuestions()
                    is NetworkResult.Failure -> onError(result.error.displayMessage("Couldn't update the pin."))
                }
                _questionActionInFlight.value = null
            }
        }

        /**
         * Asker (or the poster) deletes a question
         * (`DELETE .../questions/:id`, `backend/routes/gigs.js:7600`).
         */
        fun deleteQuestion(
            questionId: String,
            onError: (String) -> Unit = {},
        ) {
            if (_questionActionInFlight.value != null) return
            _questionActionInFlight.value = questionId
            viewModelScope.launch {
                when (val result = extrasRepo.deleteQuestion(gigId, questionId)) {
                    is NetworkResult.Success -> {
                        if (_answeringQuestionId.value == questionId) cancelAnswering()
                        loadQuestions()
                    }
                    is NetworkResult.Failure -> onError(result.error.displayMessage("Couldn't delete the question."))
                }
                _questionActionInFlight.value = null
            }
        }

        // MARK: - "Remind worker" (RN `handleRemindWorker`)

        /**
         * "Remind worker" gate — poster, gig still `assigned`, a worker is
         * attached, and work hasn't started. Mirrors the route's
         * preconditions (`backend/routes/gigs.js:5753-5766`).
         */
        fun canRemindWorker(): Boolean {
            val gig = rawGig ?: return false
            if (!viewerIsOwner) return false
            if (gig.status?.lowercase() != "assigned") return false
            if (gig.acceptedBy.isNullOrEmpty()) return false
            return gig.startedAt.isNullOrEmpty()
        }

        /** Re-seed the cooldown from a freshly-loaded gig row. */
        private fun syncWorkerReminderCooldown(gig: GigDto) {
            val sent = parseEpochMillis(gig.lastWorkerReminderAt)
            if (sent == null) {
                _workerReminderCooldownEndsAt.value = null
                return
            }
            val ends = sent + WORKER_REMINDER_COOLDOWN_MS
            _workerReminderCooldownEndsAt.value = ends.takeIf { it > System.currentTimeMillis() }
        }

        /**
         * Poster nudges the assigned worker — `POST .../remind-worker`
         * (`backend/routes/gigs.js:5734`). A 429 carries `next_allowed_at`,
         * which we adopt so the button reports the real server window.
         */
        fun remindWorker() {
            if (!canRemindWorker()) return
            val ends = _workerReminderCooldownEndsAt.value
            if (ends != null && ends > System.currentTimeMillis()) {
                val remaining = cooldownRemaining(ends, System.currentTimeMillis())
                viewModelScope.launch {
                    _lifecycleEvents.emit(
                        GigLifecycleEvent.Toast("A reminder was already sent. Try again in $remaining.", isError = true),
                    )
                }
                return
            }
            viewModelScope.launch {
                when (val result = extrasRepo.remindWorker(gigId)) {
                    is NetworkResult.Success -> {
                        val sent = parseEpochMillis(result.data.sentAt) ?: System.currentTimeMillis()
                        _workerReminderCooldownEndsAt.value = sent + WORKER_REMINDER_COOLDOWN_MS
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(result.data.message ?: "Reminder sent to the worker."),
                        )
                        silentRefetch()
                    }
                    is NetworkResult.Failure -> {
                        nextAllowedAt(result.error)?.let { _workerReminderCooldownEndsAt.value = it }
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Couldn't send the reminder."),
                                isError = true,
                            ),
                        )
                    }
                }
            }
        }

        private fun currentUserId(): String? = (authRepo.state.value as? AuthRepository.State.SignedIn)?.user?.id

        fun load() = fetch(showLoading = true)

        /**
         * Phase 5 — refetch triggered by a `gig:*` room event: refreshes the
         * loaded projection in place without flashing the skeleton, and
         * never downgrades a loaded screen to Error.
         */
        fun silentRefetch() = fetch(showLoading = false)

        private fun fetch(showLoading: Boolean) {
            if (!showLoading && refetchInFlight) return
            if (showLoading) _state.value = ContentDetailUiState.Loading
            refetchInFlight = true
            viewModelScope.launch {
                when (val result = repo.detail(gigId)) {
                    is NetworkResult.Success -> {
                        val bids = fetchOwnerBids(result.data.gig)
                        // Bidder side — resolve before projecting so the
                        // dock renders "Update bid" on the first frame.
                        loadViewerBid(result.data.gig)
                        applyLoaded(result.data.gig, bids)
                        loadQuestions()
                    }
                    is NetworkResult.Failure -> {
                        if (showLoading) {
                            _state.value = ContentDetailUiState.Error(result.error.displayMessage("Couldn't load detail."))
                        }
                    }
                }
                refetchInFlight = false
            }
        }

        /**
         * Owner bid list. For `curated_offers` / `quotes` gigs this first
         * tries `GET /api/v2/gigs/:gigId/offers` (ranked + trust capsules,
         * `backend/routes/offersV2.js:47`) and keeps the server's ordering;
         * on any failure — 403, 404, decode — it falls back to
         * `GET /api/gigs/:gigId/bids`, exactly like RN
         * (`gig-v2/[id].tsx:105-120`).
         */
        private suspend fun fetchOwnerBids(gig: GigDto): List<GigBidDto> {
            if (usesScoredOffers(gig)) {
                val scored = gigsV2Repo.scoredOffers(gigId)
                if (scored is NetworkResult.Success) {
                    _offerRankings.value =
                        scored.data.offers.associate { offer ->
                            offer.id to
                                GigOfferRanking(
                                    matchScore = offer.matchScore,
                                    matchRank = offer.matchRank,
                                    isRecommended = offer.isRecommended == true,
                                    averageRating = offer.trustCapsule?.averageRating,
                                    reviewCount = offer.trustCapsule?.reviewCount,
                                    gigsCompleted = offer.trustCapsule?.gigsCompleted,
                                )
                        }
                    return scored.data.offers.map { it.asBid() }
                }
            }
            _offerRankings.value = emptyMap()
            return when (val bidsResult = repo.bids(gigId)) {
                is NetworkResult.Success -> bidsResult.data.bids
                is NetworkResult.Failure -> emptyList()
            }
        }

        // MARK: - Share live status

        /**
         * Poster or assigned helper on a live task can mint a public status
         * link (`backend/routes/gigsV2.js:244` gates on `user_id` /
         * `accepted_by`; RN only renders the affordance while the task is
         * assigned / in progress — `gig-detail-v2/ETATracker.tsx:57`).
         */
        fun canShareLiveStatus(): Boolean {
            val gig = rawGig ?: return false
            if (!viewerIsOwner && !viewerIsWorker) return false
            return gig.status?.lowercase() in listOf("assigned", "in_progress")
        }

        /**
         * `POST /api/gigs/:gigId/share-status` — mint (or re-mint) the 24h
         * public status link. The screen copies [GigLiveStatusEvent.url] to
         * the clipboard, mirroring RN's clipboard-only share.
         */
        fun shareLiveStatus() {
            if (!canShareLiveStatus() || _sharingLiveStatus.value) return
            _sharingLiveStatus.value = true
            viewModelScope.launch {
                when (val result = gigsV2Repo.shareStatus(gigId)) {
                    is NetworkResult.Success ->
                        _liveStatusEvents.emit(GigLiveStatusEvent(result.data.shareUrl))
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Couldn't create a status link."),
                                isError = true,
                            ),
                        )
                }
                _sharingLiveStatus.value = false
            }
        }

        /** Derive every per-viewer gate + the projection from a fresh gig. */
        private fun applyLoaded(
            gig: GigDto,
            bids: List<GigBidDto>,
        ) {
            val uid = currentUserId()
            rawGig = gig
            _saved.value = gig.savedByUser == true
            viewerIsOwner = uid != null && uid == gig.userId
            viewerIsWorker = uid != null && uid == gig.acceptedBy
            canMarkDelivered = viewerCanMarkDelivered(gig, uid)
            canTip = viewerCanTip(gig, uid)
            canInstantAccept = viewerCanInstantAccept(gig, uid)
            _bids.value = bids
            _activeTask.value = deriveActiveTask(gig, uid)
            syncWorkerReminderCooldown(gig)
            syncActiveNotification(gig, uid)
            refreshNoShowEligibility(gig, uid)
            refreshReviewState(gig, uid)
            refreshPayment(gig, uid)
            refreshChangeOrders(gig, uid)
            refreshFulfillment(gig, uid)
            _state.value =
                ContentDetailUiState.Loaded(
                    Projection.project(
                        gig,
                        bids,
                        canMarkDelivered,
                        canTip,
                        uid,
                        canInstantAccept,
                        Projection.ownerPanelHandlesBids(gig, viewerIsOwner),
                        viewerCanEditBid(),
                    ),
                )
        }

        // MARK: - Viewer's own bid

        /**
         * Load the signed-in viewer's own bid on this gig.
         *
         * `GET /api/gigs/:id/my-bid` (`backend/routes/gigs.js:7882`) is the
         * source of truth for *existence*, but its column list omits the
         * counter fields, so a `countered` bid is enriched from
         * `GET /api/gigs/my-bids` (`backend/routes/gigs.js:1452`) — which
         * carries `counter_amount` and `counter_status`. A *failed* my-bid
         * call also falls back to my-bids (mirrors RN
         * `BidPanel.fetchMyBid`, `BidPanel.tsx:110`).
         */
        private suspend fun loadViewerBid(gig: GigDto) {
            val uid = currentUserId()
            if (uid == null || uid == gig.userId) {
                _viewerBid.value = null
                return
            }
            val myBid = viewerBidRepo.myBid(gigId)
            // A successful `bid: null` is authoritative, so the common
            // "hasn't bid" case stays a single request; only a *failed*
            // call or a countered bid needs the my-bids enrichment.
            val resolved = myBid is NetworkResult.Success
            var bid: BidDto? = if (myBid is NetworkResult.Success) myBid.data.bid else null
            val needsCounterFields = bid?.status?.lowercase() == "countered"
            if (!resolved || needsCounterFields) {
                val mine = offersRepo.myBids(limit = MY_BIDS_LOOKUP_LIMIT)
                if (mine is NetworkResult.Success) {
                    mine.data.bids.firstOrNull { it.gigId == gigId }?.let { bid = it }
                }
            }
            _viewerBid.value = bid
        }

        /**
         * True when the viewer has a bid still live on this gig (`pending`,
         * `countered`, `accepted`). Withdrawn / rejected / expired bids
         * leave the screen on its normal "Place bid" path.
         */
        fun viewerHasActiveBid(): Boolean {
            val status = _viewerBid.value?.status?.lowercase() ?: return false
            return status in ViewerBidStatus.ACTIVE
        }

        /**
         * True when the viewer's bid can still be edited or withdrawn: gig
         * still `open` and the bid `pending` / `countered` — the backend's
         * own preconditions (`backend/routes/gigs.js:4166` and
         * `backend/routes/gigs.js:5440`).
         */
        fun viewerCanEditBid(): Boolean {
            if (rawGig?.status?.lowercase() != "open") return false
            val status = _viewerBid.value?.status?.lowercase() ?: return false
            return status in ViewerBidStatus.MUTABLE
        }

        /**
         * True when the poster sent a counter-offer the viewer has not
         * answered yet — surfaces Accept / Decline instead of Update /
         * Withdraw.
         */
        fun viewerHasPendingCounter(): Boolean {
            val bid = _viewerBid.value ?: return false
            return bid.status?.lowercase() == "countered" &&
                bid.counterStatus == "pending" &&
                bid.counterAmount != null
        }

        /**
         * The "Your bid" panel renders whenever a non-owner viewer has a
         * live bid. Suppressed once they became the assigned worker — the
         * active-task panel owns that surface (mirrors RN's `!isWorker`
         * guard, `BidPanel.tsx:540`).
         */
        fun showViewerBidPanel(): Boolean = !viewerIsOwner && !viewerIsWorker && viewerHasActiveBid()

        /**
         * Update the viewer's existing bid —
         * `PUT /api/gigs/:gigId/bids/:bidId` (`backend/routes/gigs.js:4143`).
         */
        fun updateViewerBid(
            amount: Double,
            message: String?,
            proposedTime: String? = null,
            onResult: (Boolean) -> Unit = {},
        ) {
            val bidId = _viewerBid.value?.id
            if (bidId == null || _viewerBidActionInFlight.value) {
                onResult(false)
                return
            }
            _viewerBidActionInFlight.value = true
            viewModelScope.launch {
                val result =
                    offersRepo.updateBid(
                        gigId = gigId,
                        bidId = bidId,
                        body = UpdateBidBody(bidAmount = amount, message = message, proposedTime = proposedTime),
                    )
                _viewerBidActionInFlight.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        load()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /**
         * Withdraw the viewer's bid —
         * `DELETE /api/gigs/:gigId/bids/:bidId` (`backend/routes/gigs.js:5417`).
         * The backend soft-deletes to `withdrawn`, which drops the panel and
         * restores the "Place bid" dock on refresh.
         */
        fun withdrawViewerBid(reason: String? = null) {
            val bidId = _viewerBid.value?.id ?: return
            if (_viewerBidActionInFlight.value) return
            _viewerBidActionInFlight.value = true
            viewModelScope.launch {
                val result = offersRepo.withdrawBid(gigId = gigId, bidId = bidId, reason = reason)
                _viewerBidActionInFlight.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _viewerBid.value = null
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Bid withdrawn."))
                        load()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
            }
        }

        /**
         * Accept the poster's counter-offer —
         * `POST .../bids/:bidId/counter/accept` (`backend/routes/gigs.js:5191`).
         * The bid amount becomes the counter amount and reverts to `pending`.
         */
        fun acceptViewerCounter() =
            respondToViewerCounter(success = "Counter-offer accepted.") { bidId ->
                repo.acceptCounterOffer(gigId, bidId)
            }

        /**
         * Decline the poster's counter-offer —
         * `POST .../bids/:bidId/counter/decline` (`backend/routes/gigs.js:5267`).
         * The original bid stands.
         */
        fun declineViewerCounter() =
            respondToViewerCounter(success = "Counter-offer declined.") { bidId ->
                repo.declineCounterOffer(gigId, bidId)
            }

        private fun respondToViewerCounter(
            success: String,
            call: suspend (String) -> NetworkResult<Any>,
        ) {
            val bidId = _viewerBid.value?.id ?: return
            if (!viewerHasPendingCounter() || _viewerBidActionInFlight.value) return
            _viewerBidActionInFlight.value = true
            viewModelScope.launch {
                val result = call(bidId)
                _viewerBidActionInFlight.value = false
                when (result) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(success))
                        load()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
            }
        }

        private fun deriveActiveTask(
            gig: GigDto,
            uid: String?,
            noShowEligible: Boolean = false,
        ): GigActiveTaskUi? {
            val phase = activePhaseIndex(gig) ?: return null
            val isOwner = uid != null && uid == gig.userId
            val isWorker = uid != null && uid == gig.acceptedBy
            if (!isOwner && !isWorker) return null
            val status = gig.status?.lowercase()
            val runningLate = isLifecycleParticipantLate(gig, status)
            return GigActiveTaskUi(
                phaseIndex = phase,
                viewerIsOwner = isOwner,
                viewerIsWorker = isWorker,
                showWorkerAck = isWorker && status == "assigned" && gig.workerAckStatus.isNullOrEmpty(),
                acked = isWorker && gig.workerAckStatus == "starting_now",
                showStartTask = isWorker && status == "assigned",
                showMarkDelivered = canMarkDelivered,
                showConfirmCompletion = ownerCanConfirmCompletion(gig, uid),
                showNoShow = noShowEligible,
                // 5b — secondary "Running late" while assigned, unless already flagged.
                showRunningLate = isWorker && status == "assigned" && gig.workerAckStatus != "running_late",
                runningLate = runningLate,
                lateEtaMinutes = if (runningLate) gig.workerAckEtaMinutes else null,
                showCantMakeIt = workerCanRelease(gig, uid),
            )
        }

        /** 5b — late badge for both roles while the ack is still relevant. */
        private fun isLifecycleParticipantLate(
            gig: GigDto,
            status: String?,
        ): Boolean = status == "assigned" && gig.workerAckStatus == "running_late"

        /**
         * Phase 6b — mirror the active phase into the ongoing system
         * notification: post/update for participants while the task is
         * live, cancel once it resolves (owner-confirmed / cancelled) or
         * when the viewer isn't involved. Runs on every fresh gig — the
         * same transitions the phase strip uses, including `gig:*`
         * room-event refetches.
         */
        private fun syncActiveNotification(
            gig: GigDto,
            uid: String?,
        ) {
            val participant = uid != null && (uid == gig.userId || uid == gig.acceptedBy)
            val line = activeNotificationLine(gig)
            if (participant && line != null) {
                activeNotifier.post(
                    GigActiveNotification(
                        gigId = gigId,
                        title = gig.title,
                        phaseLine = line,
                        categoryKey = gig.category,
                    ),
                )
            } else {
                activeNotifier.cancel(gigId)
            }
        }

        /**
         * Either party (`/report-no-show` gates poster + worker) on an
         * assigned / in-progress task: ask `GET /no-show-check` whether to
         * surface the affordance.
         */
        private fun refreshNoShowEligibility(
            gig: GigDto,
            uid: String?,
        ) {
            val participant = uid != null && (uid == gig.userId || uid == gig.acceptedBy)
            val status = gig.status?.lowercase()
            if (!participant || (status != "assigned" && status != "in_progress")) return
            viewModelScope.launch {
                when (val result = repo.noShowCheck(gigId)) {
                    is NetworkResult.Success ->
                        if (result.data.canReport == true) {
                            _activeTask.value = deriveActiveTask(gig, uid, noShowEligible = true)
                        }
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        /**
         * Completed gigs: resolve "Leave a review" vs "Reviewed ✓" from
         * `GET /api/reviews/my-pending`. Falls back to the counterparty
         * derived from the gig when the pending fetch fails (the backend
         * still rejects duplicate reviews with a 409).
         */
        private fun refreshReviewState(
            gig: GigDto,
            uid: String?,
        ) {
            if (!viewerCanReview(gig, uid)) {
                _reviewState.value = GigReviewState.Hidden
                return
            }
            viewModelScope.launch {
                when (val result = reviewsRepo.myPending()) {
                    is NetworkResult.Success -> {
                        val entry = result.data.pending.firstOrNull { it.gigId == gigId }
                        _reviewState.value =
                            if (entry != null) {
                                GigReviewState.Available(
                                    revieweeId = entry.revieweeId ?: fallbackRevieweeId(gig, uid).orEmpty(),
                                    revieweeName = entry.revieweeName,
                                )
                            } else {
                                GigReviewState.Submitted
                            }
                    }
                    is NetworkResult.Failure -> {
                        if (_reviewState.value !is GigReviewState.Submitted) {
                            val reviewee = fallbackRevieweeId(gig, uid)
                            _reviewState.value =
                                if (reviewee != null) {
                                    GigReviewState.Available(revieweeId = reviewee, revieweeName = null)
                                } else {
                                    GigReviewState.Hidden
                                }
                        }
                    }
                }
            }
        }

        /** Owner reviews the worker; worker reviews the poster. */
        private fun fallbackRevieweeId(
            gig: GigDto,
            uid: String?,
        ): String? = if (uid == gig.userId) gig.acceptedBy else gig.userId

        // MARK: - Phase 5b · payment card (work item 1)

        /**
         * Owner on an assigned+ task: fetch the payment summary; the card
         * silently hides on failure / 404 / no linked payment. Re-runs with
         * every gig refresh (including `gig:*` room events).
         */
        private fun refreshPayment(
            gig: GigDto,
            uid: String?,
        ) {
            val isOwner = uid != null && uid == gig.userId
            val assignedPlus = gig.status?.lowercase() in listOf("assigned", "in_progress", "completed")
            if (!isOwner || !assignedPlus) {
                _payment.value = null
                return
            }
            viewModelScope.launch {
                when (val result = repo.gigPayment(gigId)) {
                    is NetworkResult.Success -> _payment.value = result.data.takeIf { it.payment != null }
                    is NetworkResult.Failure -> _payment.value = null
                }
            }
        }

        // MARK: - Phase 5b · change orders (work item 2)

        /** Both participants while assigned / in progress; cleared otherwise. */
        private fun refreshChangeOrders(
            gig: GigDto,
            uid: String?,
        ) {
            val participant = uid != null && (uid == gig.userId || uid == gig.acceptedBy)
            val status = gig.status?.lowercase()
            if (!participant || (status != "assigned" && status != "in_progress")) {
                _changeOrders.value = emptyList()
                return
            }
            viewModelScope.launch {
                when (val result = repo.changeOrders(gigId)) {
                    is NetworkResult.Success -> _changeOrders.value = result.data.changeOrders
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        // MARK: - Urgent live fulfillment stepper

        /**
         * Live fulfillment status for an urgent / starts-asap task, both
         * roles, while the task is assigned or in progress. The backend
         * 400s the route on non-urgent gigs and 403s non-participants, so
         * a failure just hides the stepper. Mirrors RN's `ActiveTaskPanel`
         * mount fetch (`ActiveTaskPanel.tsx:114`).
         */
        private fun refreshFulfillment(
            gig: GigDto,
            uid: String?,
        ) {
            val participant = uid != null && (uid == gig.userId || uid == gig.acceptedBy)
            val status = gig.status?.lowercase()
            if (!gig.usesLiveFulfillment() || !participant || (status != "assigned" && status != "in_progress")) {
                _fulfillment.value = null
                return
            }
            viewModelScope.launch {
                when (val result = ownerActionsRepo.activeStatus(gigId)) {
                    is NetworkResult.Success -> _fulfillment.value = result.data
                    is NetworkResult.Failure -> _fulfillment.value = null
                }
            }
        }

        /** True when the live stepper renders (urgent task, participant). */
        fun showFulfillmentPanel(): Boolean = _fulfillment.value != null

        /**
         * The next rung this viewer may set, with its CTA label. Worker:
         * nothing → `on_the_way` → `arrived`. Poster: `arrived` →
         * `in_progress` ("Confirm arrival"). Mirrors RN's status buttons
         * (`ActiveTaskPanel.tsx:280-326`).
         */
        fun nextFulfillmentAction(): Pair<GigFulfillmentStatus, String>? {
            if (_fulfillment.value == null) return null
            val current = _fulfillment.value?.status
            if (viewerIsWorker) {
                return when (current) {
                    null -> GigFulfillmentStatus.OnTheWay to "I'm on the way"
                    GigFulfillmentStatus.OnTheWay -> GigFulfillmentStatus.Arrived to "I've arrived"
                    else -> null
                }
            }
            if (viewerIsOwner &&
                (current == GigFulfillmentStatus.Arrived || current == GigFulfillmentStatus.PickedUp)
            ) {
                return GigFulfillmentStatus.InProgress to "Confirm arrival"
            }
            return null
        }

        /**
         * Advance the urgent-task fulfillment status
         * (`POST /api/gigs/:gigId/status`). Role gating is enforced
         * server-side; the panel only ever offers the caller's own next
         * rung.
         */
        fun advanceFulfillment(status: GigFulfillmentStatus) {
            if (_fulfillmentActionInFlight.value) return
            _fulfillmentActionInFlight.value = true
            viewModelScope.launch {
                when (val result = ownerActionsRepo.updateFulfillmentStatus(gigId, status)) {
                    is NetworkResult.Success -> {
                        _fulfillment.value =
                            (_fulfillment.value ?: GigActiveStatusResponse(gigId = gigId)).copy(
                                fulfillmentStatus = result.data.fulfillmentStatus ?: status.wire,
                            )
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Status updated."))
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Failed to update status"),
                                isError = true,
                            ),
                        )
                }
                _fulfillmentActionInFlight.value = false
            }
        }

        /** True when the "Changes" card renders (both roles, assigned/in_progress). */
        fun showChangeOrders(): Boolean {
            val gig = rawGig ?: return false
            val uid = currentUserId() ?: return false
            if (uid != gig.userId && uid != gig.acceptedBy) return false
            return gig.status?.lowercase() in listOf("assigned", "in_progress")
        }

        /** Signed-in viewer id — the Changes card gates per-row actions on it. */
        fun viewerUserId(): String? = currentUserId()

        /** Propose a change order (`POST /change-orders`). */
        fun proposeChangeOrder(
            type: GigChangeOrderType,
            description: String,
            amountChange: Double?,
            timeChangeMinutes: Int?,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                val result =
                    repo.createChangeOrder(
                        gigId = gigId,
                        type = type.wireValue,
                        description = description,
                        amountChange = amountChange?.takeIf { it != 0.0 },
                        timeChangeMinutes = timeChangeMinutes?.takeIf { it != 0 },
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Change request sent"))
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /** Counterparty approves; price deltas land on the gig server-side. */
        fun approveChangeOrder(orderId: String) = changeOrderAction(orderId, "Change approved") { repo.approveChangeOrder(gigId, orderId) }

        /** Counterparty declines the pending order. */
        fun rejectChangeOrder(orderId: String) = changeOrderAction(orderId, "Change declined") { repo.rejectChangeOrder(gigId, orderId) }

        /** Requester withdraws their own pending order. */
        fun withdrawChangeOrder(orderId: String) =
            changeOrderAction(orderId, "Change request withdrawn") { repo.withdrawChangeOrder(gigId, orderId) }

        private fun changeOrderAction(
            orderId: String,
            successToast: String,
            call: suspend () -> NetworkResult<GigChangeOrderMutationResponse>,
        ) {
            if (_changeOrderActionInFlight.value != null) return
            _changeOrderActionInFlight.value = orderId
            viewModelScope.launch {
                when (val result = call()) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(successToast))
                        silentRefetch()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
                _changeOrderActionInFlight.value = null
            }
        }

        fun placeBid(
            amount: Double,
            message: String?,
            proposedTime: String? = null,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                val result =
                    repo.placeBid(
                        gigId = gigId,
                        body =
                            PlaceBidBody(
                                bidAmount = amount,
                                message = message,
                                proposedTime = proposedTime,
                            ),
                    )
                if (result is NetworkResult.Success) {
                    load()
                    onResult(true)
                } else {
                    onResult(false)
                }
            }
        }

        /**
         * Upload each proof photo via `POST /api/files/upload`, then mark
         * the task completed with the resulting URLs + the optional note.
         * Calls [onResult] with `true` so the Delivery Proof sheet can flip
         * to its SUBMITTED confirmation; refreshes the task on success.
         */
        fun submitDeliveryProof(
            photos: List<DeliveryProofPhoto>,
            note: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            val gig = rawGig
            if (gig == null || photos.isEmpty()) {
                onResult(false)
                return
            }
            viewModelScope.launch {
                val urls = mutableListOf<String>()
                for (photo in photos) {
                    val upload =
                        filesRepo.uploadFile(
                            filename = photo.filename,
                            mimeType = photo.mimeType,
                            bytes = photo.bytes,
                            fileType = "gig_completion",
                            visibility = "private",
                        )
                    when (upload) {
                        is NetworkResult.Success -> urls.add(upload.data.file.url)
                        is NetworkResult.Failure -> {
                            onResult(false)
                            return@launch
                        }
                    }
                }
                when (repo.markCompleted(gigId, note, urls)) {
                    is NetworkResult.Success -> {
                        load()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> onResult(false)
                }
            }
        }

        /** Returns the gig id wired from `SavedStateHandle`. */
        fun currentGigId(): String = gigId

        // MARK: - P1.C Save / bookmark

        /**
         * Toggle the bookmark optimistically: flip immediately, call the
         * endpoint, revert + [onError] on failure.
         */
        fun toggleSave(onError: (String) -> Unit = {}) {
            if (saveInFlight) return
            saveInFlight = true
            val target = !_saved.value
            _saved.value = target
            viewModelScope.launch {
                val result = if (target) repo.save(gigId) else repo.unsave(gigId)
                if (result is NetworkResult.Failure) {
                    _saved.value = !target
                    onError(if (target) "Couldn't save this task." else "Couldn't remove the save.")
                }
                saveInFlight = false
            }
        }

        // MARK: - Phase 5 · owner bid actions (work item 1)

        /**
         * Owner accepts a bid from the detail bids panel. Free gigs land
         * immediately; paid gigs return PaymentSheet params and stay in
         * `pending_payment` until `finalize-accept` (same flow as Mailbox
         * A17.6).
         */
        fun acceptBidAsOwner(bidId: String) {
            if (_bidActionInFlight.value != null) return
            _bidActionInFlight.value = bidId
            viewModelScope.launch {
                when (val result = repo.acceptBid(gigId, bidId)) {
                    is NetworkResult.Success -> {
                        val params = result.data.sheetParams()
                        val needsPayment =
                            result.data.requiresPaymentSetup == true || !params.clientSecret.isNullOrBlank()
                        if (needsPayment) {
                            pendingCheckout = PendingCheckout.BidAccept(bidId)
                            _lifecycleEvents.emit(GigLifecycleEvent.PresentPaymentSheet(params))
                        } else {
                            _lifecycleEvents.emit(GigLifecycleEvent.Toast("Bid accepted"))
                            _bidActionInFlight.value = null
                            silentRefetch()
                        }
                    }
                    is NetworkResult.Failure -> {
                        _bidActionInFlight.value = null
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                    }
                }
            }
        }

        /** Owner counters a pending bid; the row flips to "Countered $X". */
        fun counterBidAsOwner(
            bidId: String,
            amount: Double,
            message: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            if (_bidActionInFlight.value != null) {
                onResult(false)
                return
            }
            _bidActionInFlight.value = bidId
            viewModelScope.launch {
                when (val result = repo.counterBid(gigId, bidId, amount, message)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Counter-offer sent"))
                        _bidActionInFlight.value = null
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _bidActionInFlight.value = null
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /** Owner rejects a bid after the confirm step; the row dims. */
        fun rejectBidAsOwner(bidId: String) {
            if (_bidActionInFlight.value != null) return
            _bidActionInFlight.value = bidId
            viewModelScope.launch {
                when (val result = repo.rejectBid(gigId, bidId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Bid rejected"))
                        _bidActionInFlight.value = null
                        silentRefetch()
                    }
                    is NetworkResult.Failure -> {
                        _bidActionInFlight.value = null
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                    }
                }
            }
        }

        /**
         * Poster withdraws the pending counter-offer they sent — the bid
         * reverts to its original amount and goes back to `pending`, so
         * the row flips from "Countered $X" back to Accept / Counter /
         * Reject. Mirrors RN `OffersPanel.handleWithdrawCounter`
         * (`OffersPanel.tsx:177`). Route `backend/routes/gigs.js:5342`.
         */
        fun withdrawCounterAsOwner(bidId: String) {
            if (_bidActionInFlight.value != null) return
            _bidActionInFlight.value = bidId
            viewModelScope.launch {
                when (val result = ownerActionsRepo.withdrawCounterOffer(gigId, bidId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Counter-offer withdrawn."))
                        _bidActionInFlight.value = null
                        silentRefetch()
                    }
                    is NetworkResult.Failure -> {
                        _bidActionInFlight.value = null
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Failed to withdraw counter"),
                                isError = true,
                            ),
                        )
                    }
                }
            }
        }

        /**
         * Poster closes a **still-open** task: `DELETE /api/gigs/:id`
         * removes the row outright (the backend 400s any other status).
         * Mirrors RN's `handleCloseGig` open branch (`gig/[id].tsx:427`);
         * the caller pops back once `onDone(true)` fires.
         */
        fun closeGig(onDone: (Boolean) -> Unit) {
            if (!canCloseTask()) {
                onDone(false)
                return
            }
            viewModelScope.launch {
                when (val result = ownerActionsRepo.deleteGig(gigId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Gig closed successfully."))
                        onDone(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Failed to close gig."),
                                isError = true,
                            ),
                        )
                        onDone(false)
                    }
                }
            }
        }

        // MARK: - Phase 5 · instant accept (work item 3)

        /** Helper claims an instant-accept task; PaymentSheet only when the payload demands it. */
        fun instantAccept() {
            if (!canInstantAccept || _instantAcceptInFlight.value) return
            _instantAcceptInFlight.value = true
            viewModelScope.launch {
                when (val result = repo.instantAccept(gigId)) {
                    is NetworkResult.Success -> {
                        val params = result.data.sheetParams()
                        if (result.data.requiresPaymentSetup == true && !params.clientSecret.isNullOrBlank()) {
                            pendingCheckout = PendingCheckout.InstantAccept
                            _lifecycleEvents.emit(GigLifecycleEvent.PresentPaymentSheet(params))
                        } else {
                            _lifecycleEvents.emit(GigLifecycleEvent.Toast("Task accepted — it's yours"))
                            _instantAcceptInFlight.value = false
                        }
                        load()
                    }
                    is NetworkResult.Failure -> {
                        _instantAcceptInFlight.value = false
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                    }
                }
            }
        }

        /** Stripe outcome for the lifecycle PaymentSheet (accept-bid / instant-accept). */
        fun onLifecycleCheckoutOutcome(outcome: CheckoutOutcome) {
            val pending = pendingCheckout ?: return
            pendingCheckout = null
            viewModelScope.launch {
                when (pending) {
                    is PendingCheckout.BidAccept -> {
                        when (outcome) {
                            CheckoutOutcome.Paid -> {
                                when (val result = repo.finalizeAcceptBid(gigId, pending.bidId)) {
                                    is NetworkResult.Success ->
                                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Bid accepted"))
                                    is NetworkResult.Failure ->
                                        _lifecycleEvents.emit(
                                            GigLifecycleEvent.Toast(result.error.message, isError = true),
                                        )
                                }
                            }
                            CheckoutOutcome.Canceled -> {
                                repo.abortAcceptBid(gigId, pending.bidId)
                                _lifecycleEvents.emit(GigLifecycleEvent.Toast("Payment canceled", isError = true))
                            }
                            is CheckoutOutcome.Declined -> {
                                repo.abortAcceptBid(gigId, pending.bidId)
                                _lifecycleEvents.emit(
                                    GigLifecycleEvent.Toast(
                                        outcome.message ?: "Your card was declined.",
                                        isError = true,
                                    ),
                                )
                            }
                        }
                        _bidActionInFlight.value = null
                    }
                    is PendingCheckout.InstantAccept -> {
                        when (outcome) {
                            CheckoutOutcome.Paid ->
                                _lifecycleEvents.emit(GigLifecycleEvent.Toast("Task accepted — it's yours"))
                            CheckoutOutcome.Canceled ->
                                _lifecycleEvents.emit(
                                    GigLifecycleEvent.Toast("Payment setup pending — finish it to start", isError = true),
                                )
                            is CheckoutOutcome.Declined ->
                                _lifecycleEvents.emit(
                                    GigLifecycleEvent.Toast(
                                        outcome.message ?: "Your card was declined.",
                                        isError = true,
                                    ),
                                )
                        }
                        _instantAcceptInFlight.value = false
                    }
                }
                silentRefetch()
            }
        }

        // MARK: - Phase 5 · active task (work item 4)

        /** Worker "I'm on it" — `POST /worker-ack` with `starting_now`. */
        fun workerAck() {
            viewModelScope.launch {
                when (val result = repo.workerAck(gigId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Owner notified — you're on it"))
                        silentRefetch()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
            }
        }

        /**
         * Phase 5b — worker "Running late": `POST /worker-ack` with
         * `running_late` + the optional ETA (1..480 min) and note.
         */
        fun workerRunningLate(
            etaMinutes: Int?,
            note: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                val result =
                    repo.workerAck(
                        gigId = gigId,
                        status = "running_late",
                        etaMinutes = etaMinutes,
                        note = note,
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Owner notified — running late"))
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /** Worker `POST /start` — `assigned → in_progress`. */
        fun startTask() {
            viewModelScope.launch {
                when (val result = repo.startGig(gigId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Task started"))
                        silentRefetch()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
            }
        }

        /** Owner `POST /complete` — confirm the worker's marked-done. */
        fun confirmCompletion() {
            viewModelScope.launch {
                when (val result = repo.completeGigAsPoster(gigId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Completion confirmed"))
                        silentRefetch()
                    }
                    is NetworkResult.Failure ->
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                }
            }
        }

        /** Either party `POST /report-no-show` — cancels the task with an incident. */
        fun reportNoShow(
            description: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = repo.reportNoShow(gigId, description)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("No-show reported"))
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        // MARK: - Phase 5 · reviews (work item 5)

        /** Submit the review draft from the sheet. Returns `true` on success. */
        suspend fun submitGigReview(
            rating: Int,
            comment: String?,
        ): Boolean {
            val target = _reviewState.value as? GigReviewState.Available ?: return false
            val body =
                CreateReviewBody(
                    gigId = gigId,
                    revieweeId = target.revieweeId,
                    rating = rating,
                    comment = comment,
                )
            return when (val result = reviewsRepo.create(body)) {
                is NetworkResult.Success -> {
                    _reviewState.value = GigReviewState.Submitted
                    _lifecycleEvents.emit(GigLifecycleEvent.Toast("Review submitted. Thanks!"))
                    true
                }
                is NetworkResult.Failure -> {
                    _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                    false
                }
            }
        }

        // MARK: - Phase 5 · report + cancel (work items 6–7)

        /** Flag the gig for moderation (`POST /report`). */
        fun submitReport(
            reason: GigReportReason,
            details: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = repo.reportGig(gigId, reason.wireValue, details)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Report sent — thanks for flagging"))
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /** Owner can cancel while the task is open / assigned / in progress. */

        /**
         * "Cancel task" overflow gate — the poster on a live gig.
         *
         * RN branches here (`gig/[id].tsx:412`): an **open** gig is
         * *closed* (`DELETE /api/gigs/:id`, the row disappears) while an
         * assigned / in-progress one is *cancelled* (`POST /cancel`, fees
         * may apply). [canCloseTask] covers the first branch.
         */
        fun canCancelTask(): Boolean {
            val gig = rawGig ?: return false
            if (!viewerIsOwner) return false
            return gig.status?.lowercase() in listOf("assigned", "in_progress")
        }

        /**
         * "Close task" overflow gate — the poster on a still-open gig.
         * `DELETE /api/gigs/:id` rejects any other status ("Can only
         * delete open gigs", `backend/routes/gigs.js:3755`).
         */
        fun canCloseTask(): Boolean {
            val gig = rawGig ?: return false
            if (!viewerIsOwner) return false
            return gig.status?.lowercase() == "open"
        }

        // MARK: - Pre-start release (reopen bidding / worker self-release)

        /** Overflow gate for "Replace worker" — poster, assigned, pre-start. */
        fun canReplaceWorker(): Boolean {
            val gig = rawGig ?: return false
            return ownerCanReplaceWorker(gig, currentUserId())
        }

        /**
         * Poster's "Replace worker" — `POST /reopen-bidding`. Unassigns the
         * current worker, cancels the pre-capture payment hold, rejects
         * their accepted bid, and moves the gig back to `open`
         * (`backend/routes/gigs.js:4874`). Refetches on success so the
         * lifecycle sections re-render in the reopened state.
         */
        fun replaceWorker(onResult: (Boolean) -> Unit = {}) {
            viewModelScope.launch {
                when (val result = reassignmentRepo.reopenBidding(gigId)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.data.message ?: "Worker removed and bidding reopened",
                            ),
                        )
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Failed to replace worker"),
                                isError = true,
                            ),
                        )
                        onResult(false)
                    }
                }
            }
        }

        /**
         * Assigned worker's "Can't make it" — `POST /worker-release`.
         * Unassigns the viewer, releases the payment hold, reopens the task
         * for bids, and notifies the poster (`backend/routes/gigs.js:5954`).
         */
        fun releaseAssignment(
            note: String? = null,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = reassignmentRepo.workerRelease(gigId, note)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.data.message ?: "You have been released from this task",
                            ),
                        )
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(
                            GigLifecycleEvent.Toast(
                                result.error.displayMessage("Failed to release from task"),
                                isError = true,
                            ),
                        )
                        onResult(false)
                    }
                }
            }
        }

        /** Fetch the zone + fee preview when the cancel sheet opens. */
        fun requestCancelPreview() {
            _cancelPreview.value = null
            _cancelPreviewLoading.value = true
            viewModelScope.launch {
                when (val result = repo.cancellationPreview(gigId)) {
                    is NetworkResult.Success -> _cancelPreview.value = result.data
                    is NetworkResult.Failure -> Unit
                }
                _cancelPreviewLoading.value = false
            }
        }

        /**
         * Phase 6b — poster moves an assigned task to a new future start
         * instead of cancelling (`POST /reschedule`,
         * `backend/routes/gigs.js:6405`; gated by the preview's
         * `can_reschedule`). The backend resets the worker's on-my-way
         * state and notifies them; `gig:rescheduled` refreshes the room.
         */
        fun rescheduleTask(
            scheduledStartIso: String,
            note: String?,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = repo.rescheduleGig(gigId, scheduledStartIso, note)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Task rescheduled"))
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        /** Owner confirms the cancel with a reason radio. */
        fun confirmCancel(
            reason: CancelGigReason,
            onResult: (Boolean) -> Unit = {},
        ) {
            viewModelScope.launch {
                when (val result = repo.cancelGig(gigId, reason.wireValue)) {
                    is NetworkResult.Success -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast("Task cancelled"))
                        silentRefetch()
                        onResult(true)
                    }
                    is NetworkResult.Failure -> {
                        _lifecycleEvents.emit(GigLifecycleEvent.Toast(result.error.message, isError = true))
                        onResult(false)
                    }
                }
            }
        }

        // MARK: - Phase 5 · realtime (work item 8)

        /**
         * Join the `gig:<id>` room (`backend/socket/chatSocketio.js:246`)
         * and silently refetch on any room event for this gig. Re-emits
         * the join on every reconnect via the connectionState replay.
         */
        fun joinRealtime() {
            if (realtimeJob != null) return
            realtimeJob =
                viewModelScope.launch {
                    launch {
                        socket.connectionState.collect { state ->
                            if (state == SocketManager.ConnectionState.Connected) {
                                socket.emit("gig:join", JSONObject().put("gigId", gigId))
                            }
                        }
                    }
                    GIG_ROOM_EVENTS.forEach { event ->
                        launch {
                            socket.eventsOf(event).collect { json ->
                                val target = json.optString("gigId")
                                if (target.isEmpty() || target == gigId) silentRefetch()
                            }
                        }
                    }
                }
        }

        /** Leave the room + stop collecting when the screen goes away. */
        fun leaveRealtime() {
            realtimeJob?.cancel()
            realtimeJob = null
            socket.emit("gig:leave", JSONObject().put("gigId", gigId))
        }

        // MARK: - Tip (Block 3D)

        /** Tap "Send a tip" → create the tip payment, then ask the screen to present PaymentSheet. */
        fun sendTip(amountCents: Int) {
            if (!canTip) return
            _tipStatus.value = TipStatus.Sending
            viewModelScope.launch {
                when (val result = paymentsRepo.tip(TipRequest(gigId = gigId, amount = amountCents))) {
                    is NetworkResult.Success -> {
                        pendingTipPaymentId = result.data.paymentId
                        _events.emit(GigTipEvent.PresentTipSheet(result.data.sheetParams()))
                    }
                    is NetworkResult.Failure -> {
                        _tipStatus.value = TipStatus.Failed(result.error.message)
                    }
                }
            }
        }

        /** Result of presenting the tip PaymentSheet, mapped from Stripe in the screen. */
        fun onTipOutcome(outcome: CheckoutOutcome) {
            when (outcome) {
                CheckoutOutcome.Paid -> {
                    _tipStatus.value = TipStatus.Succeeded
                    viewModelScope.launch {
                        // Best-effort reconcile (mobile PaymentSheet may beat the webhook), then refresh.
                        pendingTipPaymentId?.let { paymentsRepo.tipRefreshStatus(it) }
                        pendingTipPaymentId = null
                        load()
                    }
                }
                CheckoutOutcome.Canceled -> _tipStatus.value = TipStatus.Canceled
                is CheckoutOutcome.Declined ->
                    _tipStatus.value = TipStatus.Failed(outcome.message ?: "Your card was declined.")
            }
        }

        /** Clear the tip toast once the screen has shown it. */
        fun clearTipStatus() {
            _tipStatus.value = TipStatus.Idle
        }

        /** Get-or-create the gig chat room, then emit navigation payload. */
        fun openGigChat() {
            val gig = rawGig ?: return
            val poster = gig.posterIdentity()
            val name = poster?.resolvedDisplayName() ?: gig.title
            val initials = Projection.initialsFromName(name)
            val verified = poster?.resolvedVerified() == true
            viewModelScope.launch {
                when (val result = repo.chatRoom(gigId)) {
                    is NetworkResult.Success ->
                        _openChatEvents.emit(
                            GigOpenChatEvent(
                                roomId = result.data.roomId,
                                displayName = name,
                                initials = initials,
                                verified = verified,
                            ),
                        )
                    is NetworkResult.Failure -> Unit
                }
            }
        }

        object Projection {
            /**
             * V2 ("Magic Task") is the default for open gigs. Legacy V1 is
             * used only when `is_v2 == false` or when an awarded terminal
             * state has no explicit V2 flag.
             */
            fun project(
                gig: GigDto,
                bids: List<GigBidDto>,
                canMarkDelivered: Boolean = false,
                canTip: Boolean = false,
                viewerUserId: String? = null,
                canInstantAccept: Boolean = false,
                suppressBidsModule: Boolean = false,
                viewerCanUpdateBid: Boolean = false,
            ): ContentDetailContent {
                return if (shouldProjectTaskV2(gig)) {
                    projectTaskV2(
                        gig,
                        bids,
                        canMarkDelivered,
                        canTip,
                        viewerUserId,
                        canInstantAccept,
                        suppressBidsModule,
                        viewerCanUpdateBid,
                    )
                } else {
                    projectGigV1(gig, bids, canTip, viewerUserId, suppressBidsModule, viewerCanUpdateBid)
                }
            }

            /**
             * The interactive owner bids panel (scroll footer, see
             * [app.pantopus.android.ui.screens.contentdetail.GigLifecycleSections])
             * supersedes the read-only "N bids" module — without this the
             * owner of an open gig sees the same bid list twice.
             */
            fun ownerPanelHandlesBids(
                gig: GigDto,
                viewerIsOwner: Boolean,
            ): Boolean = viewerIsOwner && gig.status?.lowercase() == "open"

            fun posterCounterparty(
                gig: GigDto,
                viewerUserId: String?,
            ): ContentDetailCounterparty? {
                val posterId = gig.userId?.takeIf { it.isNotEmpty() } ?: return null
                val creator = gig.posterIdentity()
                val name = creator?.resolvedDisplayName() ?: "Neighbor"
                val handle = creator?.resolvedHandle()?.let { "@$it" }
                val showsButton = viewerUserId?.let { it != posterId } ?: true
                return ContentDetailCounterparty(
                    displayName = name,
                    initials = initialsFromName(name),
                    avatarUrl = creator?.resolvedAvatarUrl(),
                    identityKind = null,
                    verified = creator?.resolvedVerified() == true,
                    rating = null,
                    trailing = handle,
                    showsMessageButton = showsButton,
                )
            }

            fun initialsFromName(name: String): String =
                name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()

            /** `is_v2 == false` → V1; `true` → V2; `null` → V2 unless awarded. */
            private fun shouldProjectTaskV2(gig: GigDto): Boolean {
                if (gig.isV2 == false) return false
                if (gig.isV2 == true) return true
                return !isAwarded(gig)
            }

            /** Poster dock on a completed gig — primary becomes "Send a tip" (3D). */
            val tipDock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Send a tip", icon = PantopusIcon.HandCoins),
                )

            /**
             * The bidder's dock once they already have a live bid — "Place
             * bid" would re-POST and 409, so the primary becomes "Update
             * bid" and the "Your bid" panel below carries Withdraw and the
             * counter responses.
             */
            val updateBidDock =
                ContentDetailDock(
                    secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                    primary = ContentDetailDockButton(label = "Update bid", icon = PantopusIcon.Pencil),
                )

            @Suppress("CyclomaticComplexMethod", "LongParameterList")
            private fun projectTaskV2(
                gig: GigDto,
                bids: List<GigBidDto>,
                canMarkDelivered: Boolean,
                canTip: Boolean = false,
                viewerUserId: String? = null,
                canInstantAccept: Boolean = false,
                suppressBidsModule: Boolean = false,
                viewerCanUpdateBid: Boolean = false,
            ): ContentDetailContent {
                val category = GigsCategory.fromBackendKey(gig.category)
                val bidCount = gig.bidCount ?: bids.size
                // Phase 5 — the owner of an open task gets the interactive
                // bids panel (scroll footer) instead of the read-only module.
                val metaPieces =
                    listOfNotNull(
                        distanceLabel(gig.distanceMiles),
                        relativeAge(gig.createdAt)?.let { "posted $it ago" },
                    )
                val priceLine = gig.price?.let { priceLabel(it, gig.payType) }
                val hero =
                    ContentDetailHero(
                        title = gig.title,
                        categoryChip = ContentDetailCategoryChip(category.label, category),
                        meta = metaPieces.takeIf { it.isNotEmpty() }?.joinToString(" · "),
                        priceLine = priceLine,
                        priceCaption = if (priceLine != null) "budget · cash or transfer" else null,
                    )
                val statStrip = statRows(gig)
                val modules =
                    buildList {
                        gig.description?.takeIf { it.isNotEmpty() }?.let {
                            add(
                                ContentDetailModule.Description(
                                    id = "desc",
                                    title = "What needs doing",
                                    icon = PantopusIcon.ClipboardList,
                                    body = it,
                                ),
                            )
                        }
                        addAll(locationModules(gig))
                        locationMapModule(gig)?.let { add(it) }
                        gig.scheduledStart?.takeIf { it.isNotEmpty() }?.let { iso ->
                            add(
                                ContentDetailModule.CaptionedText(
                                    id = "when",
                                    title = "When",
                                    icon = PantopusIcon.Calendar,
                                    label = formatScheduledStart(iso),
                                ),
                            )
                        } ?: gig.deadline?.takeIf { it.isNotEmpty() }?.let { iso ->
                            add(
                                ContentDetailModule.CaptionedText(
                                    id = "by",
                                    title = "By",
                                    icon = PantopusIcon.Calendar,
                                    label = formatScheduledStart(iso),
                                ),
                            )
                        }
                        photoStripModule(gig)?.let { add(it) }
                        add(
                            ContentDetailModule.CapsuleRow(
                                id = "trust",
                                capsules =
                                    listOf(
                                        ContentDetailPill(
                                            id = "addr",
                                            label = "Verified address",
                                            icon = PantopusIcon.ShieldCheck,
                                            tone = ContentDetailPill.Tone.Info,
                                        ),
                                        ContentDetailPill(
                                            id = "local",
                                            label = "Local Pantopus job",
                                            icon = PantopusIcon.Check,
                                            tone = ContentDetailPill.Tone.Success,
                                        ),
                                    ),
                            ),
                        )
                        if (suppressBidsModule) {
                            // Owner sees the interactive panel below — skip
                            // both the read-only module and the bidder callout.
                        } else if (bidCount > 0 && bids.isNotEmpty()) {
                            add(
                                ContentDetailModule.Bids(
                                    id = "bids",
                                    title = "$bidCount bids",
                                    sub = bidRangeSub(bids),
                                    bids = bids.map { projectBid(it) },
                                ),
                            )
                        } else {
                            add(
                                ContentDetailModule.Callout(
                                    id = "be-first",
                                    style = ContentDetailModule.Callout.Style.Empty,
                                    tone = ContentDetailModule.Callout.Tone.Dashed,
                                    icon = PantopusIcon.HandCoins,
                                    iconTone = ContentDetailModule.Callout.IconTone.Primary,
                                    title = "Be the first to bid",
                                    subtitle =
                                        "Fresh posts usually get a hire in the first hour. " +
                                            "First three bids land at the top of the list.",
                                    footerPill = "neighbors viewing",
                                ),
                            )
                        }
                    }
                val statusLabel =
                    if (bidCount > 0) {
                        "Open · $bidCount ${if (bidCount == 1) "bid" else "bids"}"
                    } else {
                        "Open · No bids yet"
                    }
                // The assigned worker viewing an in-progress task gets the
                // completion affordance (→ Delivery Proof sheet) instead of
                // the bidder dock; everyone else sees "Place bid".
                val statusPill =
                    ContentDetailPill(
                        id = "status",
                        label = if (canMarkDelivered) "In progress" else statusLabel,
                        icon = PantopusIcon.Circle,
                        tone = ContentDetailPill.Tone.Warning,
                    )
                val dock =
                    if (canTip) {
                        tipDock
                    } else if (canMarkDelivered) {
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Mark as delivered", icon = PantopusIcon.CheckCheck),
                        )
                    } else if (canInstantAccept) {
                        // Phase 5 work item 3 — instant-accept primary CTA.
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Accept this task", icon = PantopusIcon.Zap),
                        )
                    } else if (viewerCanUpdateBid) {
                        updateBidDock
                    } else {
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Place bid"),
                        )
                    }
                return ContentDetailContent(
                    kind = ContentDetailKind.Gig,
                    statusPill = statusPill,
                    hero = hero,
                    statStrip = statStrip,
                    counterparty = posterCounterparty(gig, viewerUserId),
                    modules = modules,
                    trustCapsules = emptyList(),
                    dock = dock,
                )
            }

            /**
             * A09.1 "Photos · N" strip when the gig carries uploaded
             * attachments. Each tile renders the poster's real attachment;
             * the deterministic gradient keyed off the URL is the loading /
             * failure fallback.
             */
            private fun photoStripModule(gig: GigDto): ContentDetailModule.PhotoStrip? {
                val attachments = gig.attachments?.takeIf { it.isNotEmpty() } ?: return null
                return ContentDetailModule.PhotoStrip(
                    id = "photos",
                    title = "Photos",
                    icon = PantopusIcon.Image,
                    countLabel = "${attachments.size}",
                    tiles =
                        attachments.map { url ->
                            ContentDetailPhotoTile(
                                id = url,
                                gradient = ListingGradient.from(url),
                                icon = PantopusIcon.Image,
                                imageUrl = url,
                            )
                        },
                )
            }

            /**
             * A09.1 bids subheader — "low $X · high $Y" once two or more
             * live bids carry amounts; null otherwise.
             */
            private fun bidRangeSub(bids: List<GigBidDto>): String? {
                val amounts = bids.mapNotNull { it.bidAmount ?: it.amount }
                if (amounts.size < 2) return null
                return "low ${bidAmountLabel(amounts.min())} · high ${bidAmountLabel(amounts.max())}"
            }

            private fun bidAmountLabel(amount: Double): String =
                if (amount % 1.0 == 0.0) "$${amount.toInt()}" else String.format("$%.2f", amount)

            private fun locationModules(gig: GigDto): List<ContentDetailModule> {
                val pickup = gig.pickupAddress?.takeIf { it.isNotEmpty() }
                val dropoff = gig.dropoffAddress?.takeIf { it.isNotEmpty() }
                if (pickup != null && dropoff != null) {
                    return listOf(
                        ContentDetailModule.TwoStop(
                            id = "stops",
                            title = "Pickup → drop-off",
                            icon = PantopusIcon.MapPin,
                            stops =
                                listOf(
                                    ContentDetailModule.TwoStop.Stop(
                                        letter = "A",
                                        tone = ContentDetailModule.TwoStop.StopTone.Primary,
                                        address = pickup,
                                        distance = distanceLabel(gig.distanceMiles),
                                    ),
                                    ContentDetailModule.TwoStop.Stop(
                                        letter = "B",
                                        tone = ContentDetailModule.TwoStop.StopTone.Success,
                                        address = dropoff,
                                        distance = null,
                                    ),
                                ),
                        ),
                    )
                }
                if (pickup != null) {
                    return listOf(
                        ContentDetailModule.DetailRow(
                            id = "where",
                            title = "Where",
                            sectionIcon = PantopusIcon.MapPin,
                            rowIcon = PantopusIcon.MapPin,
                            label = pickup,
                            trailing = distanceLabel(gig.distanceMiles),
                        ),
                    )
                }
                return emptyList()
            }

            private fun locationMapModule(gig: GigDto): ContentDetailModule.LocationMap? {
                val coordinate = resolveMapCoordinate(gig) ?: return null
                val approximate = gig.locationUnlocked != true
                val footnote =
                    if (approximate) {
                        "Approximate area — the circle covers ~500m around the actual location. Tap to explore."
                    } else {
                        "Tap to pan and zoom the map."
                    }
                return ContentDetailModule.LocationMap(
                    latitude = coordinate.first,
                    longitude = coordinate.second,
                    isApproximate = approximate,
                    footnote = footnote,
                    category = GigsCategory.fromBackendKey(gig.category),
                )
            }

            private fun resolveMapCoordinate(gig: GigDto): Pair<Double, Double>? {
                val lat = gig.latitude ?: gig.location?.latitude ?: gig.approxLocation?.latitude
                val lng = gig.longitude ?: gig.location?.longitude ?: gig.approxLocation?.longitude
                return if (lat != null && lng != null) lat to lng else null
            }

            private fun projectGigV1(
                gig: GigDto,
                bids: List<GigBidDto>,
                canTip: Boolean = false,
                viewerUserId: String? = null,
                suppressBidsModule: Boolean = false,
                viewerCanUpdateBid: Boolean = false,
            ): ContentDetailContent {
                val awarded = isAwarded(gig)
                val bidCount = gig.bidCount ?: bids.size
                val metaPieces =
                    listOfNotNull(
                        distanceLabel(gig.distanceMiles),
                        gig.scheduledStart?.takeIf { it.isNotEmpty() }?.let { formatScheduledStart(it) },
                    )
                val priceLine = gig.price?.let { priceLabel(it, gig.payType) }
                val hero =
                    ContentDetailHero(
                        title = gig.title,
                        categoryChip = null,
                        meta = metaPieces.takeIf { it.isNotEmpty() }?.joinToString(" · "),
                        priceLine = priceLine,
                        priceCaption = gigV1PriceCaption(priceLine, awarded),
                    )
                val modules =
                    buildList {
                        if (awarded) {
                            add(
                                ContentDetailModule.Callout(
                                    id = "awarded",
                                    style = ContentDetailModule.Callout.Style.Banner,
                                    tone = ContentDetailModule.Callout.Tone.Success,
                                    icon = PantopusIcon.Check,
                                    iconTone = ContentDetailModule.Callout.IconTone.Success,
                                    title = awardWinnerName(gig, bids)?.let { "Awarded to $it" } ?: "Awarded",
                                    subtitle =
                                        listOfNotNull(relativeAge(gig.acceptedAt)?.let { "$it ago" }, "bidding now closed")
                                            .joinToString(" · "),
                                ),
                            )
                        }
                        gig.description?.takeIf { it.isNotEmpty() }?.let {
                            add(ContentDetailModule.Description(id = "desc", title = "Description", icon = null, body = it))
                        }
                        locationMapModule(gig)?.let { add(it) }
                        if (bids.isNotEmpty() && !suppressBidsModule) {
                            add(
                                ContentDetailModule.Bids(
                                    id = "bids",
                                    title = "$bidCount bids",
                                    sub = if (awarded) "closed" else null,
                                    bids = bids.map { projectBid(it, if (awarded) gig.acceptedBy else null) },
                                ),
                            )
                        }
                    }
                return ContentDetailContent(
                    kind = ContentDetailKind.Gig,
                    statusPill = gigV1StatusPill(awarded),
                    hero = hero,
                    statStrip = emptyList(),
                    counterparty = posterCounterparty(gig, viewerUserId),
                    modules = modules,
                    trustCapsules = emptyList(),
                    dock = gigV1Dock(canTip = canTip, awarded = awarded, viewerCanUpdateBid = viewerCanUpdateBid),
                )
            }

            private fun gigV1StatusPill(awarded: Boolean): ContentDetailPill =
                if (awarded) {
                    ContentDetailPill(
                        id = "status",
                        label = "Awarded",
                        icon = PantopusIcon.Check,
                        tone = ContentDetailPill.Tone.Success,
                    )
                } else {
                    ContentDetailPill(
                        id = "status",
                        label = "Open",
                        icon = PantopusIcon.Circle,
                        tone = ContentDetailPill.Tone.Warning,
                    )
                }

            private fun gigV1Dock(
                canTip: Boolean,
                awarded: Boolean,
                viewerCanUpdateBid: Boolean = false,
            ): ContentDetailDock =
                when {
                    canTip -> tipDock
                    awarded ->
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Bidding closed", icon = PantopusIcon.Lock, enabled = false),
                        )
                    viewerCanUpdateBid -> updateBidDock
                    else ->
                        ContentDetailDock(
                            secondary = ContentDetailDockButton(label = "Message", icon = PantopusIcon.Send),
                            primary = ContentDetailDockButton(label = "Place bid"),
                        )
                }

            private fun isAwarded(gig: GigDto): Boolean {
                if (gig.acceptedBy.isNullOrEmpty()) return false
                return gig.status in listOf("accepted", "awarded", "completed", "in_progress")
            }

            private fun awardWinnerName(
                gig: GigDto,
                bids: List<GigBidDto>,
            ): String? {
                val winner = bids.firstOrNull { it.userId == gig.acceptedBy }
                return winner?.bidderIdentity()?.resolvedDisplayName()
            }

            private fun projectBid(
                bid: GigBidDto,
                acceptedBy: String? = null,
            ): ContentDetailBidRow {
                val name = bid.bidderIdentity()?.resolvedDisplayName() ?: "Bidder"
                val initials =
                    name.split(" ").take(2).mapNotNull { it.firstOrNull()?.toString() }.joinToString("").uppercase()
                val amount = bid.bidAmount ?: bid.amount ?: 0.0
                val amountLabel = bidAmountLabel(amount)
                val won = acceptedBy != null && bid.userId == acceptedBy
                val dimmed = acceptedBy != null && !won
                return ContentDetailBidRow(
                    id = bid.id,
                    initials = initials.ifEmpty { "?" },
                    displayName = name,
                    ratingLine = "verified neighbor",
                    amount = amountLabel,
                    verified = bid.bidderIdentity()?.resolvedVerified() == true,
                    won = won,
                    dimmed = dimmed,
                )
            }

            private fun priceLabel(
                price: Double,
                payType: String?,
            ): String {
                val base = if (price % 1.0 == 0.0) "$${price.toInt()}" else String.format("$%.2f", price)
                return when (payType) {
                    "hourly" -> "$base / hr"
                    "per_session" -> "$base / session"
                    "per_walk" -> "$base / walk"
                    "per_visit" -> "$base / visit"
                    else -> base
                }
            }

            private fun distanceLabel(miles: Double?): String? {
                if (miles == null) return null
                return when {
                    miles < 0.1 -> "< 0.1 mi"
                    miles < 10 -> String.format("%.1f mi", miles)
                    else -> "${miles.toInt()} mi"
                }
            }

            private fun relativeAge(iso: String?): String? {
                if (iso.isNullOrEmpty()) return null
                return runCatching {
                    val instant = Instant.parse(iso)
                    val seconds = Duration.between(instant, Instant.now()).seconds
                    when {
                        seconds < 60 -> "now"
                        seconds < 3_600 -> "${seconds / 60}m"
                        seconds < 86_400 -> "${seconds / 3_600}h"
                        seconds < 604_800 -> "${seconds / 86_400}d"
                        else -> "${seconds / 604_800}w"
                    }
                }.getOrNull()
            }

            private fun statRows(gig: GigDto): List<ContentDetailStat> {
                val out = mutableListOf<ContentDetailStat>()
                gig.scheduledStart?.takeIf { it.isNotEmpty() }?.let { scheduled ->
                    out.add(ContentDetailStat(formatScheduledDate(scheduled), "fixed date"))
                } ?: gig.scheduleType?.takeIf { it.isNotEmpty() }?.let { schedule ->
                    out.add(
                        ContentDetailStat(
                            schedule.replace('_', ' ').replaceFirstChar { it.uppercase() },
                            "schedule",
                        ),
                    )
                }
                gig.taskArchetype?.takeIf { it.isNotEmpty() }?.let { archetype ->
                    out.add(
                        ContentDetailStat(
                            archetype.replace('_', ' ').replaceFirstChar { it.uppercase() },
                            "type",
                        ),
                    )
                }
                gig.engagementMode?.takeIf { it.isNotEmpty() }?.let { engagement ->
                    out.add(
                        ContentDetailStat(
                            engagement.replace('_', ' ').replaceFirstChar { it.uppercase() },
                            "mode",
                        ),
                    )
                }
                return out.take(3)
            }

            private fun formatScheduledStart(iso: String): String =
                parseInstant(iso)?.let { instant ->
                    DateTimeFormatter.ofPattern("EEE MMM d · h:mm a")
                        .withZone(ZoneId.systemDefault())
                        .format(instant)
                } ?: iso

            private fun formatScheduledDate(iso: String): String =
                parseInstant(iso)?.let { instant ->
                    DateTimeFormatter.ofPattern("EEE MMM d")
                        .withZone(ZoneId.systemDefault())
                        .format(instant)
                } ?: iso

            private fun parseInstant(iso: String): Instant? = runCatching { Instant.parse(iso) }.getOrNull()
        }
    }

private fun gigV1PriceCaption(
    priceLine: String?,
    awarded: Boolean,
): String? =
    when {
        priceLine == null -> null
        awarded -> "winning bid"
        else -> "budget"
    }
