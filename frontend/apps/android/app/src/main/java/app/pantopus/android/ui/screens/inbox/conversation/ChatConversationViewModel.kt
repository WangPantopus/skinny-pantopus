@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.ai.AIActionCardStore
import app.pantopus.android.data.ai.AIActionRunner
import app.pantopus.android.data.ai.AIChatRepository
import app.pantopus.android.data.ai.AIChatStreamEvent
import app.pantopus.android.data.ai.AIConversationSession
import app.pantopus.android.data.ai.AIPdfCheck
import app.pantopus.android.data.ai.AIScreenContext
import app.pantopus.android.data.api.models.chats.ChatChangesResponse
import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.ChatMessageSender
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatReactionSummary
import app.pantopus.android.data.api.models.chats.ChatReadReceipt
import app.pantopus.android.data.api.models.chats.ChatTopic
import app.pantopus.android.data.api.models.chats.FindOrCreateTopicBody
import app.pantopus.android.data.api.models.chats.SendChatMessageBody
import app.pantopus.android.data.api.models.chats.resolvedText
import app.pantopus.android.data.api.models.chats.resolvedType
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.api.net.readableForbiddenMessage
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.chats.ActiveChatThread
import app.pantopus.android.data.chats.ChatOutbox
import app.pantopus.android.data.chats.ChatOutboxEntry
import app.pantopus.android.data.chats.ChatOutboxTopic
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.chats.ChatSendTarget
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.links.LinkPreview
import app.pantopus.android.data.links.LinkPreviewRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.place.PlaceRepository
import app.pantopus.android.data.profile.UserReportsRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.upload.UploadFile
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.theme.PantopusIcon
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import timber.log.Timber
import java.io.File
import java.io.IOException
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

@HiltViewModel
class ChatConversationViewModel
    @Inject
    constructor(
        private val repo: ChatRepository,
        private val socket: SocketManager,
        private val uploadRepo: UploadRepository,
        private val aiRepo: AIChatRepository,
        private val gigsRepo: GigsRepository,
        private val listingsRepo: ListingsRepository,
        private val geoApi: GeoApi,
        private val locationProvider: LocationProvider,
        private val blocksRepo: BlocksRepository,
        private val reportsRepo: UserReportsRepository,
        private val linkPreviewRepo: LinkPreviewRepository,
        private val aiSession: AIConversationSession,
        private val activeChatThread: ActiveChatThread,
        private val placeRepository: PlaceRepository,
        private val aiActions: AIActionRunner,
        private val aiCards: AIActionCardStore,
        private val outbox: ChatOutbox? = null,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ChatConversationUiState>(ChatConversationUiState.Loading)
        val state: StateFlow<ChatConversationUiState> = _state.asStateFlow()

        private val _counterparty =
            MutableStateFlow<ChatCounterparty>(ChatCounterparty.Person(displayName = "", initials = ""))
        val counterparty: StateFlow<ChatCounterparty> = _counterparty.asStateFlow()

        private val _composerText = MutableStateFlow("")
        val composerText: StateFlow<String> = _composerText.asStateFlow()

        private val _isSending = MutableStateFlow(false)
        val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

        private val _replyingTo = MutableStateFlow<ChatReplyPreview?>(null)
        val replyingTo: StateFlow<ChatReplyPreview?> = _replyingTo.asStateFlow()

        private val _editingMessageId = MutableStateFlow<String?>(null)
        val editingMessageId: StateFlow<String?> = _editingMessageId.asStateFlow()

        private val _topics = MutableStateFlow<List<ChatConversationTopic>>(emptyList())
        val topics: StateFlow<List<ChatConversationTopic>> = _topics.asStateFlow()

        private val _selectedTopicId = MutableStateFlow<String?>(null)
        val selectedTopicId: StateFlow<String?> = _selectedTopicId.asStateFlow()

        private val _isCounterpartyTyping = MutableStateFlow(false)
        val isCounterpartyTyping: StateFlow<Boolean> = _isCounterpartyTyping.asStateFlow()

        private val _queuedAttachments = MutableStateFlow<List<ChatQueuedAttachment>>(emptyList())
        val queuedAttachments: StateFlow<List<ChatQueuedAttachment>> = _queuedAttachments.asStateFlow()

        private val _shareableGigs = MutableStateFlow<List<ChatShareGigOption>>(emptyList())
        val shareableGigs: StateFlow<List<ChatShareGigOption>> = _shareableGigs.asStateFlow()

        private val _shareableListings = MutableStateFlow<List<ChatShareListingOption>>(emptyList())
        val shareableListings: StateFlow<List<ChatShareListingOption>> = _shareableListings.asStateFlow()

        private val _isLoadingShareOptions = MutableStateFlow(false)
        val isLoadingShareOptions: StateFlow<Boolean> = _isLoadingShareOptions.asStateFlow()

        private val _shareOptionsError = MutableStateFlow<String?>(null)
        val shareOptionsError: StateFlow<String?> = _shareOptionsError.asStateFlow()

        private val _isSharingLocation = MutableStateFlow(false)
        val isSharingLocation: StateFlow<Boolean> = _isSharingLocation.asStateFlow()

        // Timeline row id ("bubble_<messageId>") the screen should scroll
        // to — set once when opened from Chat Search with a matched message
        // present in the loaded page. Cleared via [consumePendingScroll].
        private val _pendingScrollTarget = MutableStateFlow<String?>(null)
        val pendingScrollTarget: StateFlow<String?> = _pendingScrollTarget.asStateFlow()

        // Pre-bid gig-room send limit notice (429 PRE_BID_LIMIT). Rendered
        // as a dismissible banner above the composer; cleared on the next
        // successful send or via [dismissSendLimitNotice].
        private val _sendLimitNotice = MutableStateFlow<String?>(null)
        val sendLimitNotice: StateFlow<String?> = _sendLimitNotice.asStateFlow()

        /**
         * The line shown in place of the composer when the conversation takes no messages from you (the server's
         * `sendRefusal` sentence: a direct chat with a draft or closed business), or null.
         */
        private val _composerClosedNote = MutableStateFlow<String?>(null)
        val composerClosedNote: StateFlow<String?> = _composerClosedNote.asStateFlow()

        private val _isSelectionMode = MutableStateFlow(false)
        val isSelectionMode: StateFlow<Boolean> = _isSelectionMode.asStateFlow()

        private val _selectedMessageIds = MutableStateFlow<Set<String>>(emptySet())
        val selectedMessageIds: StateFlow<Set<String>> = _selectedMessageIds.asStateFlow()

        private val _isBlocking = MutableStateFlow(false)
        val isBlocking: StateFlow<Boolean> = _isBlocking.asStateFlow()

        private val _isReporting = MutableStateFlow(false)
        val isReporting: StateFlow<Boolean> = _isReporting.asStateFlow()

        // One-shot toast/snackbar text after a report attempt (success or
        // friendly failure). Cleared via [dismissReportNotice].
        private val _reportNotice = MutableStateFlow<String?>(null)
        val reportNotice: StateFlow<String?> = _reportNotice.asStateFlow()

        // One-shot snackbar text when a delete, edit or reaction fails, so
        // the rollback isn't silent. Cleared via [dismissActionFailure].
        private val _actionFailure = MutableStateFlow<String?>(null)
        val actionFailure: StateFlow<String?> = _actionFailure.asStateFlow()

        // A downloaded attachment for the screen to hand to another app.
        // Cleared via [consumeOpenFile].
        private val _openFile = MutableStateFlow<ChatOpenFile?>(null)
        val openFile: StateFlow<ChatOpenFile?> = _openFile.asStateFlow()

        // Resolved link-preview metadata keyed by URL (A15.2 `.link-bubble`).
        // Held on the VM (not remember{}) so previews survive rotation. A
        // key mapped to null means resolution finished with no usable
        // metadata — the bubble renders nothing (no skeleton, no error).
        private val _linkPreviews = MutableStateFlow<Map<String, LinkPreview?>>(emptyMap())
        val linkPreviews: StateFlow<Map<String, LinkPreview?>> = _linkPreviews.asStateFlow()
        private val linkPreviewsInFlight = mutableSetOf<String>()

        // True while an AI reply stream is in flight — the composer swaps
        // its send disc for a stop button (A15.3) bound to [cancelAiStream].
        private val _isAiStreaming = MutableStateFlow(false)
        val isAiStreaming: StateFlow<Boolean> = _isAiStreaming.asStateFlow()

        // True while "Delete conversation" runs; the header's menu and sending wait.
        private val _isDeletingAi = MutableStateFlow(false)
        val isDeletingAi: StateFlow<Boolean> = _isDeletingAi.asStateFlow()

        // AI assistant phase 1: the screen the thread was opened from ("About: …"), sent with its messages.
        private val _aiContext = MutableStateFlow<AIScreenContext?>(null)
        val aiContext: StateFlow<AIScreenContext?> = _aiContext.asStateFlow()

        // That screen's starter prompts, offered until the person sends something.
        private val _aiStarters = MutableStateFlow<List<String>>(emptyList())
        val aiStarters: StateFlow<List<String>> = _aiStarters.asStateFlow()

        // A15 `.ctx-strip` — pinned gig context for gig rooms. Populated
        // once per VM from the gig detail fetch when the route carried a
        // gigId; null hides the strip.
        private val _gigContext = MutableStateFlow<ChatGigContextStrip?>(null)
        val gigContext: StateFlow<ChatGigContextStrip?> = _gigContext.asStateFlow()

        // A15.3 capability chips for the AI welcome card (tap-to-send). Launch cut #4 (Open gigs):
        // the assistant doesn't price tasks, so "Price a task" gives way to the nearby question (as on web).
        // Launch cut #10 (Mailbox): no mailbox to summarize; a home question it answers from the calendar instead.
        // The assistant can't look people up (it points to Search); it can start a Support Train.
        val aiPrompts: List<ChatPromptChip> =
            listOf(
                if (LaunchFeatures.openGigs) {
                    ChatPromptChip("price", "Price a task", PantopusIcon.Hammer)
                } else {
                    ChatPromptChip("nearby", "What's happening nearby?", PantopusIcon.MapPin)
                },
                ChatPromptChip("draft", "Draft a Pulse post", PantopusIcon.Pencil),
                if (LaunchFeatures.mailbox) {
                    ChatPromptChip("mail", "Summarize mail", PantopusIcon.Mailbox)
                } else {
                    ChatPromptChip("pickup", "When's my pickup?", PantopusIcon.Calendar)
                },
                ChatPromptChip("support_train", "Start a Support Train", PantopusIcon.Utensils),
            )

        val emptyChips: List<ChatPromptChip> =
            listOfNotNull(
                ChatPromptChip("intro", "Introduce yourself", PantopusIcon.Hand),
                // Launch cuts #4 (Open Gigs) / #3 (Marketplace): no gig or listing openers.
                ChatPromptChip("gig", "Ask about the gig", PantopusIcon.Briefcase).takeIf { LaunchFeatures.openGigs },
                ChatPromptChip("listing", "Share a listing", PantopusIcon.Tag).takeIf { LaunchFeatures.marketplace },
            )

        private var mode: ChatThreadMode = ChatThreadMode.Ai
        private var initialTopic: ChatInitialTopic? = null
        private var currentUserId: String = ""
        private val asBusinessUserId: String?
            get() = (mode as? ChatThreadMode.Room)?.asBusinessUserId
        private val messageIdentityId: String
            get() = asBusinessUserId ?: currentUserId
        private var gigId: String? = null
        private var scrollToMessageId: String? = null
        private var didResolveScrollTarget = false
        private var messages: MutableList<ChatMessageDto> = mutableListOf()
        private val messageTimes = LinkedHashMap<String, Instant>()
        private val messageOrder = compareBy<ChatMessageDto> { messageInstant(it.createdAt) }.thenBy { it.id }
        private val pendingByClientId = LinkedHashMap<String, ChatMessageDto>()
        private val failedClientIds = mutableSetOf<String>()

        /**
         * Failed sends the server refused with a 403 (blocked, not a
         * participant, the account can't message). They show "Not sent"
         * with no Retry, since resending cannot succeed.
         */
        private val refusedClientIds = mutableSetOf<String>()

        /** Why the last direct-room creation failed, kept for the send that awaited it. */
        private var directRoomFailure: NetworkError? = null
        private var hasMore = false
        private var oldestCursor: String? = null
        private var activeRoomIds: Set<String> = emptySet()
        private val joinedRoomIds = mutableSetOf<String>()
        private val roomJoinJobs = mutableMapOf<String, Job>()
        private val historyReadsInFlight = mutableSetOf<Pair<HistoryReadContext, String?>>()
        private val changedDuringCatchUp = mutableSetOf<String>()

        // Person-mode direct room — resolved once via `POST /api/chat/direct`
        // (find-or-create, idempotent server-side) and cached for the VM's
        // lifetime. Person threads must always send here, never to a shared
        // gig/group room surfaced by the aggregated fetch.
        private var directRoomId: String? = null

        // In-flight direct-room resolution, shared so concurrent sends make
        // a single `POST /api/chat/direct`.
        private var directRoomDeferred: Deferred<String?>? = null
        private var historyGeneration = 0L
        private var historyRefusal: String? = null
        private var historyCopyContext: HistoryReadContext? = null
        private var updateHistoryCopy: ((ChatMessagesResponse) -> Unit)? = null

        /** The newest server page behind the copy; the copy keeps its room list so an unchanged reopen can get a 304. */
        private var historyPage: ChatMessagesResponse? = null
        private val deletedMessageVersions = linkedMapOf<String, Long>()

        // Send inputs captured per optimistic row, keyed by its bare-UUID
        // `clientMessageId`. Survives refetches so retry resends the same
        // payload under the same idempotency key.
        private val sendContextsByClientId = LinkedHashMap<String, PendingSendContext>()
        private var outboxJob: Job? = null
        private var outboxAcceptedJob: Job? = null
        private val outboxClientIds = mutableSetOf<String>()

        /**
         * Inputs needed to (re)send one optimistic message. Captured at
         * send time so retry doesn't re-read mutated composer state.
         *
         * @property fileIds uploaded attachment ids — set after the first
         *   successful upload so a retry after a failed POST doesn't
         *   re-upload.
         * @property messageType explicit type for rich sends (`gig_offer`,
         *   `location`, …). `null` for composer sends, which infer
         *   `text` / `file` and are the only sends that carry the queued
         *   composer attachments.
         */
        private data class PendingSendContext(
            val text: String,
            val fileIds: List<String>? = null,
            val replyToId: String? = null,
            val topicId: String? = null,
            val messageType: String? = null,
            val metadata: Map<String, Any>? = null,
        )

        // Photos sent to the assistant, by the message that carried them: where each is on the phone, because the
        // server deletes a photo once it has read it and its reference never loads.
        private val aiSentPhotos = mutableMapOf<String, List<String>>()

        // PDFs sent to the assistant, by the message that carried them: the name and size its chip shows.
        private val aiSentFiles = mutableMapOf<String, List<ChatSentFile>>()

        private var aiConversationId: String? = null

        // The brief or nudge the thread was opened for (its notification id): the thread scrolls to its message once.
        private var aiNudgeId: String? = null

        // The conversation that brief or nudge was added to (its notification says which).
        private var aiNudgeConversationId: String? = null
        private val aiDraftsByMessageId = mutableMapOf<String, List<ChatAIDraftCard>>()

        // Buttons to screens of the app under each reply (`link` events and history `links`).
        private val aiLinksByMessageId = mutableMapOf<String, List<ChatAILink>>()

        // What the assistant is doing while a tool runs ("Drafting your post…"), shown on the pending reply.
        private var aiStatus: String? = null
        private var markReadJob: Job? = null
        private var isForeground = true
        private var visibleReadThroughId: String? = null
        private var lastReadMessageId: String? = null
        private var readReceiptJob: Job? = null
        private var connectionJob: Job? = null
        private var messageJob: Job? = null
        private var updateJob: Job? = null
        private var deleteJob: Job? = null
        private var reactJob: Job? = null

        // Live presence (item: user:online / user:offline) — flips the
        // person counterparty's `online` flag so the header dot reacts.
        private var presenceOnlineJob: Job? = null
        private var presenceOfflineJob: Job? = null

        // Debounce for `message:reaction_updated` refetches — the event
        // carries no viewer-relative reaction state, so we still refetch,
        // but a reaction burst collapses into one fetch.
        private var reactionRefetchJob: Job? = null

        // Adaptive fallback refresh while the socket is down — started by the
        // connectionState collector, cancelled on connect / teardown.
        private var fallbackPollJob: Job? = null
        private var catchUpJob: Job? = null
        private var topicsJob: Job? = null
        private var topicsRefreshRequested = false

        // The attachment download in flight; a second tap waits for it.
        private var openAttachmentJob: Job? = null

        // Decodes full socket payloads (`message:new` broadcasts the
        // serializeChatMessageForViewer spread — the same snake_case shape
        // the REST list returns) straight into [ChatMessageDto]. All chats
        // DTOs are Moshi codegen, so a plain builder resolves them.
        private val socketMessageAdapter = Moshi.Builder().build().adapter(ChatMessageDto::class.java)

        // In-flight AI stream — kept so [cancelAiStream] can stop generation
        // mid-reply. [streamingAssistantId] is the local assistant row the
        // stream is filling; partial deltas land in [messages] as they
        // arrive, so cancelling only needs to finalize an empty bubble.
        private var aiStreamJob: Job? = null
        private var streamingAssistantId: String? = null

        // Typing indicator (item: typing realtime). Incoming: socket
        // `typing:user` / `typing:stopped` flip [_isCounterpartyTyping] with
        // a 5s auto-clear. Outgoing: `typing:start` is emitted at most every
        // 6s while the composer changes (backend rate limit is 10/min,
        // backend/socket/chatSocketio.js:345), `typing:stop` on send/clear.
        private var typingUserJob: Job? = null
        private var typingStoppedJob: Job? = null
        private var typingClearJob: Job? = null
        private var lastTypingEmitAtMs: Long = 0L
        private var didEmitTypingStart = false

        fun configure(
            mode: ChatThreadMode,
            counterparty: ChatCounterparty,
            currentUserId: String,
            scrollToMessageId: String? = null,
            initialTopic: ChatInitialTopic? = null,
            gigId: String? = null,
            aiContext: AIScreenContext? = null,
            aiNudgeId: String? = null,
            aiConversationId: String? = null,
        ) {
            if (this.currentUserId != null && (this.currentUserId != currentUserId || this.mode != mode)) {
                teardown()
                messages.clear()
                deletedMessageVersions.clear()
                pendingByClientId.clear()
                sendContextsByClientId.clear()
                outboxClientIds.clear()
                _isSending.value = false
                _composerText.value = ""
                _queuedAttachments.value = emptyList()
                _replyingTo.value = null
                failedClientIds.clear()
                refusedClientIds.clear()
                directRoomDeferred?.cancel()
                directRoomDeferred = null
                directRoomId = null
                activeRoomIds = emptySet()
                visibleReadThroughId = null
                lastReadMessageId = null
                _selectedTopicId.value = null
                _topics.value = emptyList()
                _state.value = ChatConversationUiState.Loading
            }
            this.mode = mode
            this.currentUserId = currentUserId
            this._counterparty.value = counterparty
            this.scrollToMessageId = scrollToMessageId
            this.initialTopic = initialTopic
            this.gigId = gigId
            if (mode is ChatThreadMode.Ai) {
                this.aiNudgeId = aiNudgeId
                this.aiNudgeConversationId = aiConversationId
            }
            // Configured again after a rotation: the starters already used stay gone.
            if (mode is ChatThreadMode.Ai && aiContext != _aiContext.value) {
                _aiContext.value = aiContext
                _aiStarters.value = aiContext?.starters.orEmpty()
            }
        }

        /** Clear the scroll target after the screen has scrolled to it. */
        fun consumePendingScroll() {
            _pendingScrollTarget.value = null
        }

        fun load() {
            observeOutbox()
            if (_state.value is ChatConversationUiState.Loaded) {
                // Back on screen after teardown() (a pushed screen, a tab
                // switch): listen again. Re-joining the rooms backfills what
                // arrived meanwhile.
                if (connectionJob == null) {
                    publishViewedRooms()
                    subscribeToSockets()
                }
                fetch(initial = true, quiet = true)
                return
            }
            // A brief or nudge opens the conversation it was added to, at its message (AI assistant phase 2 §8.2).
            val openedForNudge = aiNudgeId != null || aiNudgeConversationId != null
            if (mode is ChatThreadMode.Ai && aiConversationId == null && openedForNudge) {
                openAtNudge()
            } else if (mode is ChatThreadMode.Ai && aiConversationId == null) {
                // Seed AI continuity: a new VM instance for the AI thread keeps
                // appending to the conversation the app session already opened
                // for this account (another account's id is never handed out).
                aiConversationId = aiSession.conversationIdFor(currentUserId)
                // Cold relaunch: the session holder is empty — restore the
                // latest backend conversation id so the thread continues
                // across app restarts.
                if (aiConversationId == null && aiSession.freshStartUserId != currentUserId) restoreLatestAiConversation()
                // Reopened in the same app session (from Messages or an Ask button): the conversation
                // continues, so its earlier turns show as well.
                aiConversationId?.let { id -> viewModelScope.launch { loadAiHistory(id) } }
            }
            loadTopicsIfNeeded()
            loadGigContextIfNeeded()
            fetch(initial = true)
            subscribeToSockets()
        }

        /**
         * Cross-relaunch AI continuity: `GET /api/ai/conversations` lists
         * conversation metadata newest-updated first — adopt the latest id
         * so the next send appends to it instead of forking a new thread,
         * and show its earlier turns so the assistant never refers to
         * something the person can't see.
         */
        private fun restoreLatestAiConversation() {
            viewModelScope.launch {
                when (val result = aiRepo.conversations()) {
                    is NetworkResult.Success -> {
                        val latest = result.data.conversations.firstOrNull() ?: return@launch
                        // The SSE stream may have assigned an id while this
                        // fetch was in flight — never clobber it.
                        if (aiConversationId == null) {
                            aiConversationId = latest.id
                            aiSession.setConversation(latest.id, currentUserId)
                            loadAiHistory(latest.id)
                        }
                    }
                    is NetworkResult.Failure ->
                        Timber.w("restore AI conversation failed: ${result.error.message}")
                }
            }
        }

        /**
         * A brief or nudge was tapped (a push or a notification row): the conversation its notification names opens and
         * continues while the person still has it (else the newest, which a nudge's arrival lists first), scrolled to
         * the message whose history item carries the notification's id. A server without that id opens it at its newest
         * message.
         */
        private fun openAtNudge() {
            viewModelScope.launch {
                val listed = (aiRepo.conversations() as? NetworkResult.Success)?.data?.conversations.orEmpty()
                val named = aiNudgeConversationId?.takeIf { id -> listed.any { it.id == id } }
                val id = named ?: listed.firstOrNull()?.id ?: aiSession.conversationIdFor(currentUserId) ?: return@launch
                // A message sent while the list loaded keeps its own conversation.
                if (aiConversationId != null || messages.isNotEmpty()) return@launch
                aiConversationId = id
                aiSession.setConversation(id, currentUserId)
                aiSession.freshStartUserId = null
                loadAiHistory(id)
            }
        }

        /**
         * A pickup-days card's Save: the household's days through the pickup calendar
         * route, exactly as the Today editor saves them. The card shows how it went.
         */
        fun savePickupSchedule(card: ChatAIDraftCard) {
            val pickup = card.pickup ?: return
            if (pickup.save == ChatAIPickupSave.Saving || pickup.save == ChatAIPickupSave.Saved) return
            updatePickup(card.id) { it.copy(save = ChatAIPickupSave.Saving) }
            viewModelScope.launch {
                val request =
                    SetPickupDayRequest(
                        weekday = pickup.garbageWeekday,
                        recyclingFrequency = pickup.recyclingFrequency,
                        recyclingNextDate = pickup.recyclingNextDate.takeIf { pickup.recyclingFrequency != "not_set" },
                    )
                val save =
                    when (val result = placeRepository.setPickupDay(pickup.homeId, request)) {
                        is NetworkResult.Success -> ChatAIPickupSave.Saved
                        is NetworkResult.Failure ->
                            ChatAIPickupSave.Failed(result.error.displayMessage("Couldn't save your pickup days. Try again."))
                    }
                updatePickup(card.id) { it.copy(save = save) }
            }
        }

        private fun updatePickup(
            cardId: String,
            change: (ChatAIPickupSchedule) -> ChatAIPickupSchedule,
        ) {
            val messageId = aiDraftsByMessageId.entries.firstOrNull { (_, cards) -> cards.any { it.id == cardId } }?.key ?: return
            aiDraftsByMessageId[messageId] =
                aiDraftsByMessageId[messageId].orEmpty().map { card ->
                    if (card.id == cardId) card.copy(pickup = card.pickup?.let(change)) else card
                }
            rebuild()
        }

        /**
         * Seed the thread with a restored conversation's turns
         * (`GET /api/ai/conversations/:id/messages`). A draft and the note
         * after it share one reply, as they did when it streamed. A server
         * without the route leaves the thread empty, as before.
         */
        @Suppress("CyclomaticComplexMethod")
        private suspend fun loadAiHistory(conversationId: String) {
            if (messages.isNotEmpty()) return
            val history =
                when (val result = aiRepo.conversationMessages(conversationId)) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> {
                        Timber.w("AI conversation history unavailable: ${result.error.message}")
                        return
                    }
                }
            // A message sent (or "New chat") while this loaded wins.
            if (messages.isNotEmpty() || aiConversationId != conversationId) return
            val restored = mutableListOf<ChatMessageDto>()
            val drafts = mutableMapOf<String, List<ChatAIDraftCard>>()
            val links = mutableMapOf<String, List<ChatAILink>>()
            // A brief's or nudge's notification id, by the reply its first item opened.
            val nudgeReplies = mutableMapOf<String, String>()
            var openReplyId: String? = null
            history.messages.forEachIndexed { index, item ->
                val id = "ai_history_$index"
                val text = item.text.orEmpty()
                if (item.role == "user") {
                    openReplyId = null
                    val sent = sentText(text, item.photos ?: 0, item.documents ?: 0)
                    restored.add(localMessage(id = id, text = sent, userId = currentUserId, type = "text", createdAt = item.at))
                    return@forEachIndexed
                }
                val draft = item.draft?.let { aiRepo.draftCard(it.type, it.draft) }
                val itemLinks = item.links.orEmpty().mapNotNull { aiRepo.link(it.label, it.url) }
                if (draft == null && text.isEmpty() && itemLinks.isEmpty()) return@forEachIndexed
                // A brief or nudge (its line, then its cards) is a reply of its own, never the note of the one before.
                val nudge = item.nudgeNotificationId
                if (nudge != null) openReplyId = null
                // A draft, its link buttons and the note after it share one reply, as they did when it streamed.
                val replyId =
                    openReplyId?.takeIf { open -> restored.any { it.id == open } }
                        ?: id.also { restored.add(localMessage(id = it, text = "", userId = "ai", type = "ai_reply", createdAt = item.at)) }
                if (text.isNotEmpty()) {
                    val at = restored.indexOfFirst { it.id == replyId }
                    restored[at] = localMessage(id = replyId, text = text, userId = "ai", type = "ai_reply", createdAt = item.at)
                }
                // A brief's or nudge's cards join its line.
                openReplyId = if (nudge != null) replyId else replyId.takeIf { text.isEmpty() }
                draft?.let { drafts[replyId] = drafts[replyId].orEmpty() + withSavedRuns(it) }
                if (itemLinks.isNotEmpty()) links[replyId] = links[replyId].orEmpty() + itemLinks
                nudge?.let { nudgeReplies.putIfAbsent(it, replyId) }
            }
            messages.addAll(restored)
            aiDraftsByMessageId.putAll(drafts)
            aiLinksByMessageId.putAll(links)
            // Opened for a brief or nudge: its message comes into view (the Chat Search scroll), once.
            aiNudgeId?.let { nudge ->
                aiNudgeId = null
                nudgeReplies[nudge]?.let { replyId ->
                    scrollToMessageId = replyId
                    didResolveScrollTarget = false
                }
            }
            rebuild()
        }

        /** An action card as this phone left it: the buttons that succeeded, or "Not now". */
        private fun withSavedRuns(draft: ChatAIDraftCard): ChatAIDraftCard {
            val card = draft.action ?: return draft
            val fewerId = card.fewerLikeThis?.id
            val runs =
                aiCards.done(card.id).associate { saved ->
                    // "Fewer like this" stands apart from the card's other buttons; an earlier version saved it with them.
                    val scope =
                        if (saved.scope == ChatAIActionCard.CARD_SCOPE && saved.actionId == fewerId) {
                            ChatAIActionCard.FEWER_SCOPE
                        } else {
                            saved.scope
                        }
                    scope to ChatAICardRun.Done(saved.actionId, saved.link, saved.note)
                }
            return draft.copy(action = card.copy(runs = card.runs + runs, dismissed = aiCards.isDismissed(card.id)))
        }

        /**
         * An action card's button (AI assistant phase 1 contract, section 4.3): the request goes out only if
         * it is on the allowlist, through the signed-in client. [scope] is [ChatAIActionCard.CARD_SCOPE], the
         * row's id or [ChatAIActionCard.FEWER_SCOPE]. The card's buttons wait while it runs; a success is remembered
         * on this phone. "Fewer like this" stays usable on an expired or finished card until it's used.
         */
        fun runAIAction(
            draft: ChatAIDraftCard,
            scope: String,
            action: ChatAICardAction,
        ) {
            val card = draft.action ?: return
            if (!card.canRun(scope, action)) return
            val runScope = card.runScope(scope, action)
            updateActionCard(draft.id) { it.copy(runs = it.runs + (runScope to ChatAICardRun.Running(action.id))) }
            viewModelScope.launch {
                val run =
                    when (val outcome = aiActions.run(action)) {
                        is AIActionRunner.Outcome.Done -> {
                            aiCards.markDone(card.id, AIActionCardStore.Done(runScope, action.id, outcome.link, outcome.note))
                            ChatAICardRun.Done(action.id, outcome.link, outcome.note)
                        }
                        is AIActionRunner.Outcome.Failed -> ChatAICardRun.Failed(action.id, outcome.message)
                        AIActionRunner.Outcome.NotAllowed ->
                            ChatAICardRun.Failed(action.id, "This card can't be used in this version of Pantopus.")
                        AIActionRunner.Outcome.SessionChanged ->
                            ChatAICardRun.Failed(action.id, "This card is from an earlier sign-in. Ask again.")
                    }
                updateActionCard(draft.id) { it.copy(runs = it.runs + (runScope to run)) }
            }
        }

        /** "Not now": the card stays in the thread without its buttons, on this phone only. */
        fun dismissAIAction(draft: ChatAIDraftCard) {
            val card = draft.action ?: return
            if (card.isRunning) return
            aiCards.dismiss(card.id)
            updateActionCard(draft.id) { it.copy(dismissed = true) }
        }

        private fun updateActionCard(
            draftId: String,
            change: (ChatAIActionCard) -> ChatAIActionCard,
        ) {
            val messageId = aiDraftsByMessageId.entries.firstOrNull { (_, cards) -> cards.any { it.id == draftId } }?.key ?: return
            aiDraftsByMessageId[messageId] =
                aiDraftsByMessageId[messageId].orEmpty().map { draft ->
                    if (draft.id == draftId) draft.copy(action = draft.action?.let(change)) else draft
                }
            rebuild()
        }

        /** A restored message of the person's: their words, or a line for the photos and documents they sent alone. */
        private fun sentText(
            text: String,
            photos: Int,
            documents: Int = 0,
        ): String {
            if (text.isNotEmpty()) return text
            val sent =
                listOfNotNull(
                    when {
                        photos == 1 -> "a photo"
                        photos > 1 -> "$photos photos"
                        else -> null
                    },
                    when {
                        documents == 1 -> "a document"
                        documents > 1 -> "$documents documents"
                        else -> null
                    },
                )
            return if (sent.isEmpty()) text else "Sent ${sent.joinToString(" and ")}"
        }

        /**
         * A15 `.ctx-strip` — resolve the pinned gig context for a gig room
         * from the existing gig detail endpoint (`GET /api/gigs/:id`).
         */
        private fun loadGigContextIfNeeded() {
            val id = gigId ?: return
            if (mode !is ChatThreadMode.Room) return
            if (_gigContext.value != null) return
            viewModelScope.launch {
                when (val result = gigsRepo.detail(id)) {
                    is NetworkResult.Success -> {
                        val gig = result.data.gig
                        val meta =
                            listOfNotNull(
                                gig.category?.replaceFirstChar { it.uppercase() },
                                gig.price?.let { "$${it.toInt()}" },
                                gig.status?.replace('_', ' ')?.replaceFirstChar { it.uppercase() },
                            ).joinToString(" · ")
                        _gigContext.value =
                            ChatGigContextStrip(
                                gigId = gig.id,
                                title = gig.title,
                                meta = meta,
                            )
                    }
                    is NetworkResult.Failure ->
                        Timber.w("load gig context failed: ${result.error.message}")
                }
            }
        }

        /**
         * Pull, Retry and the socket-down poll. A thread already on screen is read again in place (no Loading
         * flash, no lost scroll); only an error or an empty first load starts over.
         */
        fun refresh() {
            // An access refusal tears listeners down. Retry must restore live updates as well as the first page.
            if (connectionJob == null) subscribeToSockets()
            loadTopicsIfNeeded()
            fetch(initial = true, quiet = _state.value is ChatConversationUiState.Loaded, force = true)
        }

        fun selectTopic(topicId: String?) {
            historyGeneration++
            catchUpJob?.cancel()
            visibleReadThroughId = null
            _selectedTopicId.value = if (_selectedTopicId.value == topicId) null else topicId
            // A stale PRE_BID_LIMIT banner shouldn't survive a topic switch
            // (mirrors iOS selectTopic).
            _sendLimitNotice.value = null
            fetch(initial = true)
        }

        fun loadOlder() {
            if (!hasMore) return
            val cursor = oldestCursor ?: return
            fetch(initial = false, before = cursor)
        }

        fun setComposerText(value: String) {
            _composerText.value = value
            if (value.isBlank()) {
                emitTypingStop()
            } else {
                emitTypingStartThrottled()
            }
        }

        /**
         * Room to address typing signals to. Only a room id that is already
         * known qualifies — typing must never trigger room creation, so an
         * unresolved person thread stays silent until the first send
         * resolves the direct room.
         */
        private fun typingRoomIdOrNull(): String? =
            when (val target = mode) {
                is ChatThreadMode.Room -> target.id
                is ChatThreadMode.Person -> directRoomId
                ChatThreadMode.Ai -> null
            }

        private fun emitTypingStartThrottled() {
            val roomId = typingRoomIdOrNull() ?: return
            if (socket.connectionState.value != SocketManager.ConnectionState.Connected) return
            val now = System.currentTimeMillis()
            // ≥6s between emits keeps continuous typing at ≤10 emits/min —
            // the backend's socket rate limit for `typing:start`.
            if (now - lastTypingEmitAtMs < TYPING_EMIT_THROTTLE_MS) return
            lastTypingEmitAtMs = now
            didEmitTypingStart = true
            socket.emit("typing:start", JSONObject().put("roomId", roomId))
        }

        private fun emitTypingStop() {
            if (!didEmitTypingStart) return
            didEmitTypingStart = false
            lastTypingEmitAtMs = 0L
            val roomId = typingRoomIdOrNull() ?: return
            if (socket.connectionState.value != SocketManager.ConnectionState.Connected) return
            socket.emit("typing:stop", JSONObject().put("roomId", roomId))
        }

        fun tapPrompt(chip: ChatPromptChip) {
            _composerText.value = chip.label
        }

        fun queueSamplePhotoAttachment() {
            appendQueuedAttachment(
                ChatQueuedAttachment("queued_photo", ChatQueuedAttachmentKind.Image, "shelves.jpg", "image/jpeg"),
            )
        }

        fun queueSampleDocumentAttachment() {
            appendQueuedAttachment(
                ChatQueuedAttachment("queued_pdf", ChatQueuedAttachmentKind.Document, "shelf.pdf", "application/pdf"),
            )
        }

        fun queueSampleAttachments() {
            queueSamplePhotoAttachment()
            queueSampleDocumentAttachment()
        }

        fun removeQueuedAttachment(id: String) {
            _queuedAttachments.value = _queuedAttachments.value.filterNot { it.id == id }
        }

        fun queueAttachment(
            kind: ChatQueuedAttachmentKind,
            filename: String,
            mimeType: String,
            bytes: ByteArray,
            sourceUri: String? = null,
        ) {
            // The assistant reads a PDF of up to 10 MB (`POST /api/upload/ai-media`); a bigger one is turned away here.
            if (mode is ChatThreadMode.Ai && mimeType == PDF_MIME && bytes.size > AIPdfCheck.MAX_BYTES) {
                refuseAttachment(AIPdfCheck.TOO_LARGE)
                return
            }
            appendQueuedAttachment(
                ChatQueuedAttachment(
                    id = UUID.randomUUID().toString(),
                    kind = kind,
                    filename = filename,
                    mimeType = mimeType,
                    bytes = bytes,
                    sourceUri = sourceUri,
                ),
            )
        }

        /** A picked file the assistant can't take: the reason, in the server's words, and nothing queued. */
        fun refuseAttachment(reason: String) {
            _actionFailure.value = reason
        }

        private fun appendQueuedAttachment(attachment: ChatQueuedAttachment) {
            if (_queuedAttachments.value.any { it.id == attachment.id }) return
            _queuedAttachments.value = (_queuedAttachments.value + attachment).take(5)
        }

        fun loadShareableGigs() {
            viewModelScope.launch {
                _isLoadingShareOptions.value = true
                _shareOptionsError.value = null
                when (val result = gigsRepo.myGigs()) {
                    is NetworkResult.Success ->
                        _shareableGigs.value =
                            result.data.gigs.map {
                                ChatShareGigOption(
                                    id = it.id,
                                    title = it.title,
                                    category = it.category,
                                    price = it.price,
                                    status = it.status,
                                )
                            }
                    is NetworkResult.Failure -> {
                        _shareOptionsError.value = result.error.message
                        _shareableGigs.value = emptyList()
                    }
                }
                _isLoadingShareOptions.value = false
            }
        }

        fun loadShareableListings() {
            viewModelScope.launch {
                _isLoadingShareOptions.value = true
                _shareOptionsError.value = null
                when (val result = listingsRepo.myListings(limit = 100)) {
                    is NetworkResult.Success ->
                        _shareableListings.value =
                            result.data.listings.mapNotNull { listing ->
                                val title = listing.title?.takeIf { it.isNotBlank() } ?: return@mapNotNull null
                                ChatShareListingOption(
                                    id = listing.id,
                                    title = title,
                                    category = listing.category,
                                    price = listing.price,
                                    isFree = listing.isFree == true,
                                    condition = listing.condition,
                                    imageUrl = listing.firstImage ?: listing.mediaUrls?.firstOrNull(),
                                )
                            }
                    is NetworkResult.Failure -> {
                        _shareOptionsError.value = result.error.message
                        _shareableListings.value = emptyList()
                    }
                }
                _isLoadingShareOptions.value = false
            }
        }

        fun sendCurrentLocation() {
            if (_isSharingLocation.value || _isSending.value) return
            viewModelScope.launch {
                _isSharingLocation.value = true
                try {
                    val coordinate = locationProvider.requestCurrent() ?: return@launch
                    var address =
                        String.format(
                            Locale.US,
                            "%.2f, %.2f",
                            coordinate.latitude,
                            coordinate.longitude,
                        )
                    try {
                        val response = geoApi.reverse(coordinate.latitude, coordinate.longitude)
                        val locality = response.normalized.localityLabel
                        if (locality.isNotEmpty()) address = locality
                    } catch (_: Exception) {
                        // keep coordinate fallback
                    }
                    sendRichMessage(
                        messageText = address,
                        messageType = "location",
                        metadata =
                            mapOf(
                                "latitude" to coordinate.latitude,
                                "longitude" to coordinate.longitude,
                                "address" to address,
                            ),
                    )
                } finally {
                    _isSharingLocation.value = false
                }
            }
        }

        fun sendGigOffer(gig: ChatShareGigOption) {
            val metadata =
                buildMap<String, Any> {
                    put("gigId", gig.id)
                    put("title", gig.title)
                    gig.category?.let { put("category", it) }
                    gig.price?.let { put("price", it) }
                    gig.status?.let { put("status", it) }
                }
            sendRichMessage(
                messageText = gig.title,
                messageType = "gig_offer",
                metadata = metadata,
                topicForPerson = Triple("task", gig.id, gig.title),
            )
        }

        fun sendListingOffer(listing: ChatShareListingOption) {
            val metadata =
                buildMap<String, Any> {
                    put("listingId", listing.id)
                    put("title", listing.title)
                    put("isFree", listing.isFree)
                    listing.category?.let { put("category", it) }
                    listing.price?.let { put("price", it) }
                    listing.condition?.let { put("condition", it) }
                    listing.imageUrl?.let { put("imageUrl", it) }
                }
            sendRichMessage(
                messageText = listing.title,
                messageType = "listing_offer",
                metadata = metadata,
                topicForPerson = Triple("listing", listing.id, listing.title),
            )
        }

        private fun sendRichMessage(
            messageText: String,
            messageType: String,
            metadata: Map<String, Any>,
            topicForPerson: Triple<String, String, String>? = null,
        ) {
            if (mode is ChatThreadMode.Ai || _isSending.value || _composerClosedNote.value != null) return
            if (outbox != null) {
                enqueueRich(messageText, messageType, metadata, topicForPerson)
                return
            }
            _isSending.value = true
            viewModelScope.launch {
                try {
                    val topicId = resolveTopicIdForShare(topicForPerson)
                    val clientId = newClientMessageId()
                    val pending =
                        optimisticRich(
                            text = messageText,
                            clientId = clientId,
                            roomId = knownRoomIdHint(),
                            messageType = messageType,
                            metadata = metadata,
                            replyToId = _replyingTo.value?.messageId,
                        ).copy(topicId = topicId)
                    pendingByClientId[clientId] = pending
                    sendContextsByClientId[clientId] =
                        PendingSendContext(
                            text = messageText,
                            replyToId = _replyingTo.value?.messageId,
                            topicId = topicId,
                            messageType = messageType,
                            metadata = metadata,
                        )
                    _replyingTo.value = null
                    rebuild()
                    val succeeded = performSend(clientId)
                    if (succeeded && topicForPerson != null) loadTopicsIfNeeded()
                } finally {
                    _isSending.value = false
                }
            }
        }

        private suspend fun resolveTopicIdForShare(topic: Triple<String, String, String>?): String? {
            if (topic == null) return _selectedTopicId.value
            val target = mode as? ChatThreadMode.Person ?: return _selectedTopicId.value
            return when (
                val result =
                    repo.findOrCreateTopic(
                        target.otherUserId,
                        FindOrCreateTopicBody(
                            topicType = topic.first,
                            topicRefId = topic.second,
                            title = topic.third,
                        ),
                    )
            ) {
                // Tag the card with its topic but keep the current view, as web does. Selecting
                // the topic here, without a refetch, hid the other person's later messages.
                is NetworkResult.Success -> result.data.topic.id
                is NetworkResult.Failure -> {
                    Timber.w("find/create share topic failed: ${result.error.message}")
                    _selectedTopicId.value
                }
            }
        }

        private fun optimisticRich(
            text: String,
            clientId: String,
            roomId: String,
            messageType: String,
            metadata: Map<String, Any>,
            replyToId: String?,
        ): ChatMessageDto =
            ChatMessageDto(
                id = "client_$clientId",
                roomId = roomId,
                userId = messageIdentityId,
                messageText = text,
                messageType = messageType,
                metadata = metadata,
                replyToId = sanitizedReplyToId(replyToId, roomId),
                clientMessageId = clientId,
                createdAt = Instant.now().toString(),
                sender =
                    ChatMessageSender(
                        id = messageIdentityId,
                        username = null,
                        name = null,
                        profilePictureUrl = null,
                    ),
            )

        /**
         * Tap a welcome-card capability chip — send its label as the
         * thread's first message (transitions the AI thread out of the
         * welcome/empty state).
         */
        fun sendCapabilityPrompt(chip: ChatPromptChip) {
            sendAiStarter(chip.label)
        }

        /**
         * A starter prompt: a whole question goes at once; one that trails off ("Remind us…") fills the
         * composer for the person to finish.
         */
        fun sendAiStarter(text: String) {
            if (text.endsWith("…")) {
                _composerText.value = text.removeSuffix("…").trimEnd() + " "
                return
            }
            _composerText.value = text
            send()
        }

        fun send() {
            if (outbox != null && mode !is ChatThreadMode.Ai && _editingMessageId.value == null) {
                enqueueComposer()
            } else {
                sendImmediately()
            }
        }

        private fun sendImmediately() {
            val trimmed = _composerText.value.trim()
            val hasQueuedFiles = _queuedAttachments.value.any { it.bytes != null }
            if ((trimmed.isEmpty() && !hasQueuedFiles) || _isSending.value) return
            // A conversation that takes no messages from you says why in place of the composer.
            if (_composerClosedNote.value != null) return
            // AI sends stream on their own cancellable job so the composer's
            // stop button can abort generation (A15.3) without blocking
            // [isSending] for the whole stream.
            if (_editingMessageId.value == null && mode is ChatThreadMode.Ai) {
                if (_isAiStreaming.value || _isDeletingAi.value) return
                _composerText.value = ""
                _aiStarters.value = emptyList()
                startAiStream(trimmed)
                return
            }
            _composerText.value = ""
            emitTypingStop()
            _isSending.value = true

            viewModelScope.launch {
                try {
                    val editingId = _editingMessageId.value
                    if (editingId != null) {
                        when (val result = repo.editMessage(editingId, trimmed)) {
                            is NetworkResult.Success -> {
                                applyUpdatedMessage(result.data.message)
                                cancelMessageAction()
                            }
                            is NetworkResult.Failure -> {
                                _composerText.value = trimmed
                                _actionFailure.value = "Couldn't save your edit. Try again."
                                Timber.w("chat edit failed: ${result.error.message}")
                            }
                        }
                        return@launch
                    }
                    val clientId = newClientMessageId()
                    val pending =
                        optimistic(
                            text = trimmed.ifEmpty { "Attachment" },
                            clientId = clientId,
                            roomId = knownRoomIdHint(),
                            replyToId = _replyingTo.value?.messageId,
                        )
                    pendingByClientId[clientId] = pending
                    sendContextsByClientId[clientId] =
                        PendingSendContext(
                            text = trimmed,
                            replyToId = _replyingTo.value?.messageId,
                            topicId = _selectedTopicId.value,
                        )
                    // The sending bubble quotes the original now, and a retry keeps the reply.
                    _replyingTo.value = null
                    rebuild()
                    performSend(clientId)
                } finally {
                    _isSending.value = false
                }
            }
        }

        private fun enqueueRich(
            text: String,
            type: String,
            metadata: Map<String, Any>,
            topic: Triple<String, String, String>?,
        ) {
            val queue = outbox ?: return
            val target = sendTarget() ?: return
            val clientId = newClientMessageId()
            val roomId = knownRoomIdHint()
            val replyId = sanitizedReplyToId(_replyingTo.value?.messageId, roomId)
            val pending = optimisticRich(text, clientId, roomId, type, metadata, replyId).copy(topicId = _selectedTopicId.value)
            val entry =
                ChatOutboxEntry(
                    clientId = clientId,
                    target = target,
                    pending = pending,
                    body =
                        SendChatMessageBody(
                            roomId = roomId,
                            messageText = text,
                            messageType = type,
                            clientMessageId = clientId,
                            replyToId = replyId,
                            topicId = pending.topicId,
                            metadata = metadata,
                            asBusinessUserId = target.asBusinessUserId,
                        ),
                    topic = topic?.takeIf { target.kind == "person" }?.let { ChatOutboxTopic(it.first, it.second, it.third) },
                )
            _isSending.value = true
            viewModelScope.launch {
                try {
                    val error = queue.enqueue(entry, emptyList())
                    if (target != sendTarget()) return@launch
                    if (error != null) {
                        _actionFailure.value = error
                    } else if (_replyingTo.value?.messageId == replyId) {
                        _replyingTo.value = null
                    }
                } finally {
                    if (target == sendTarget()) _isSending.value = false
                }
            }
        }

        private fun sendTarget(): ChatSendTarget? =
            when (val target = mode) {
                is ChatThreadMode.Room -> ChatSendTarget(currentUserId, "room", target.id, target.asBusinessUserId)
                is ChatThreadMode.Person -> ChatSendTarget(currentUserId, "person", target.otherUserId)
                ChatThreadMode.Ai -> null
            }

        private fun observeOutbox() {
            val queue = outbox ?: return
            val target = sendTarget() ?: return
            if (outboxJob != null) return
            outboxJob =
                viewModelScope.launch {
                    queue.entries.collect { entries ->
                        if (target != sendTarget()) return@collect
                        val held = entries.filter { it.target == target }
                        val ids = held.mapTo(mutableSetOf()) { it.clientId }
                        (outboxClientIds - ids).forEach { id ->
                            pendingByClientId.remove(id)
                            failedClientIds.remove(id)
                            refusedClientIds.remove(id)
                        }
                        outboxClientIds.clear()
                        outboxClientIds.addAll(ids)
                        val confirmed = messages.mapNotNullTo(mutableSetOf()) { it.clientMessageId }
                        held.filterNot { it.clientId in confirmed }.forEach { entry ->
                            pendingByClientId[entry.clientId] = entry.pending
                            if (entry.error != null) failedClientIds.add(entry.clientId) else failedClientIds.remove(entry.clientId)
                            if (entry.refused) refusedClientIds.add(entry.clientId) else refusedClientIds.remove(entry.clientId)
                        }
                        if (held.isNotEmpty() || _state.value is ChatConversationUiState.Loaded) rebuild()
                    }
                }
            outboxAcceptedJob =
                viewModelScope.launch {
                    queue.accepted.collect { (destination, message) ->
                        if (destination != sendTarget()) return@collect
                        message.clientMessageId?.let { id ->
                            pendingByClientId.remove(id)
                            failedClientIds.remove(id)
                            refusedClientIds.remove(id)
                        }
                        if (mode is ChatThreadMode.Person) directRoomId = message.roomId
                        activeRoomIds = activeRoomIds + message.roomId
                        if (matchesTopicFilter(message)) upsert(message)
                        refreshUnknownTopics(listOf(message))
                        _sendLimitNotice.value = null
                        publishViewedRooms()
                        joinActiveRoomsIfPossible()
                        rebuild()
                        scheduleMarkRead()
                    }
                }
        }

        /** Persist the complete send snapshot before clearing the composer; network delivery continues independently. */
        private fun enqueueComposer() {
            val queue = outbox ?: return
            val target = sendTarget() ?: return
            val draft = _composerText.value
            val text = draft.trim()
            val attachments = _queuedAttachments.value.filter { it.bytes != null }
            if (text.isEmpty() && attachments.isEmpty()) return
            if (_isSending.value || _composerClosedNote.value != null) return
            val clientId = newClientMessageId()
            val roomId = knownRoomIdHint()
            val replyId = sanitizedReplyToId(_replyingTo.value?.messageId, roomId)
            val pending = optimistic(text.ifEmpty { "Attachment" }, clientId, roomId, replyId)
            val entry =
                ChatOutboxEntry(
                    clientId = clientId,
                    target = target,
                    pending = pending,
                    body =
                        SendChatMessageBody(
                            roomId = roomId,
                            messageText = text.ifEmpty { null },
                            messageType = if (attachments.isEmpty()) "text" else "file",
                            clientMessageId = clientId,
                            replyToId = replyId,
                            topicId = _selectedTopicId.value,
                            asBusinessUserId = target.asBusinessUserId,
                        ),
                )
            val files = attachments.map { UploadFile(it.filename, it.mimeType, requireNotNull(it.bytes)) }
            val attachmentIds = attachments.mapTo(mutableSetOf()) { it.id }
            _isSending.value = true
            viewModelScope.launch {
                try {
                    val error = queue.enqueue(entry, files)
                    if (target != sendTarget()) return@launch
                    if (error != null) {
                        _actionFailure.value = error
                        return@launch
                    }
                    if (_composerText.value == draft) _composerText.value = ""
                    _queuedAttachments.value = _queuedAttachments.value.filterNot { it.id in attachmentIds }
                    if (_replyingTo.value?.messageId == replyId) _replyingTo.value = null
                    emitTypingStop()
                } finally {
                    if (target == sendTarget()) _isSending.value = false
                }
            }
        }

        /**
         * Retry a failed optimistic send. Accepts the timeline row id
         * (`client_<uuid>`) or the bare client id, and resends with the
         * same `clientMessageId` — the backend dedups on it, so a retry
         * after a lost response can't double-post.
         */
        fun retry(clientId: String) {
            val bareId = clientId.removePrefix("client_")
            if (outbox != null && bareId in outboxClientIds) {
                outbox.retry(bareId)
            } else {
                retryImmediately(bareId)
            }
        }

        private fun retryImmediately(bareId: String) {
            if (!pendingByClientId.containsKey(bareId)) return
            if (!sendContextsByClientId.containsKey(bareId)) return
            if (refusedClientIds.contains(bareId)) return
            if (_isSending.value || _composerClosedNote.value != null) return
            failedClientIds.remove(bareId)
            _isSending.value = true
            viewModelScope.launch {
                try {
                    rebuild()
                    performSend(bareId)
                } finally {
                    _isSending.value = false
                }
            }
        }

        /**
         * Shared send/retry tail. Resolves the destination room (creating
         * the direct room on a person thread's first message), uploads the
         * composer's queued attachments at most once, and POSTs under the
         * pending row's idempotency key.
         */
        private suspend fun performSend(clientId: String): Boolean {
            var context = sendContextsByClientId[clientId] ?: return false
            val roomId = ensureRoomId()
            if (roomId == null) {
                directRoomFailure?.takeIf(::isSendRefused)?.let { markRefused(clientId, it) }
                directRoomFailure = null
                failedClientIds.add(clientId)
                rebuild()
                return false
            }
            if (context.messageType == null && context.fileIds == null) {
                context =
                    try {
                        context.copy(fileIds = uploadQueuedAttachmentsIfNeeded(roomId, clientId))
                    } catch (error: IllegalStateException) {
                        Timber.w(error, "chat attachment upload failed")
                        failedClientIds.add(clientId)
                        rebuild()
                        return false
                    }
                sendContextsByClientId[clientId] = context
            }
            val fileIds = context.fileIds.orEmpty()
            val result =
                repo.sendMessage(
                    SendChatMessageBody(
                        roomId = roomId,
                        messageText = context.text.ifEmpty { null },
                        messageType = context.messageType ?: if (fileIds.isEmpty()) "text" else "file",
                        fileIds = fileIds.ifEmpty { null },
                        clientMessageId = clientId,
                        replyToId = sanitizedReplyToId(context.replyToId, roomId),
                        topicId = context.topicId,
                        metadata = context.metadata,
                        asBusinessUserId = asBusinessUserId,
                    ),
                )
            return when (result) {
                is NetworkResult.Success -> {
                    // Swap optimistic → server message. The socket echo may
                    // have landed it via a refetch already, so replace-by-id.
                    pendingByClientId.remove(clientId)
                    sendContextsByClientId.remove(clientId)
                    failedClientIds.remove(clientId)
                    upsert(result.data.message)
                    _sendLimitNotice.value = null
                    if (context.messageType == null) _queuedAttachments.value = emptyList()
                    rebuild()
                    scheduleMarkRead()
                    true
                }
                is NetworkResult.Failure -> {
                    if (isPreBidLimit(result.error)) {
                        _sendLimitNotice.value = preBidLimitNotice()
                    } else if (isSendRefused(result.error)) {
                        markRefused(clientId, result.error)
                    }
                    // Don't resurrect a row that a concurrent socket echo
                    // already confirmed and retired (lost-response race —
                    // the server broadcasts `message:new` before the POST's
                    // HTTP response).
                    if (sendContextsByClientId.containsKey(clientId)) {
                        failedClientIds.add(clientId)
                        rebuild()
                    }
                    Timber.w("chat send failed: ${result.error.message}")
                    false
                }
            }
        }

        /**
         * `POST /api/chat/messages` answers 429 with a body carrying
         * `code: "PRE_BID_LIMIT"` when a non-bidder exceeds the gig room's
         * pre-bid message allowance (`backend/routes/chats.js:1574`).
         */

        /** A 403 refusal of the send itself (`chats.js` "Unable to message this user" / "Not a participant"). */
        private fun isSendRefused(error: NetworkError): Boolean =
            error is NetworkError.Forbidden || (error is NetworkError.ClientError && error.code == 403)

        /**
         * 403: the server refuses this pairing (blocked, not a participant,
         * or the account can't message). Retrying cannot succeed: show the
         * server's reason ("Unable to message this user") and mark the row
         * "Not sent" without a Retry.
         */
        private fun markRefused(
            clientId: String,
            error: NetworkError,
        ) {
            val reason =
                when (error) {
                    is NetworkError.Forbidden -> error.reason
                    is NetworkError.ClientError -> readableForbiddenMessage(error.body)
                    else -> null
                }
            _sendLimitNotice.value = reason ?: SEND_REFUSED_NOTICE
            refusedClientIds.add(clientId)
        }

        private fun isPreBidLimit(error: NetworkError): Boolean =
            error is NetworkError.ClientError &&
                error.code == 429 &&
                error.body?.contains("PRE_BID_LIMIT") == true

        /**
         * The wire `replyToId` is accepted only when it points at a
         * persisted message that lives in the room we're actually sending
         * to. The backend rejects the whole send (400) if the reply target
         * is missing, soft-deleted, or in a different room
         * (`backend/routes/chats.js:1654`). Two cases this guards:
         * - person threads aggregate messages across every shared room
         *   (direct + gig + group), but we always send to the direct room —
         *   a reply to a gig/group bubble would 400;
         * - an optimistic (`client_`-prefixed) row isn't a UUID and isn't
         *   persisted yet.
         * In either case we drop the linkage and still deliver the text,
         * rather than failing the message permanently.
         */
        private fun sanitizedReplyToId(
            replyToId: String?,
            roomId: String,
        ): String? {
            if (replyToId == null) return null
            return messages.firstOrNull { it.id == replyToId && it.roomId == roomId }?.id
        }

        /**
         * Insert a persisted message, replacing any copy that already
         * arrived through a socket-triggered refetch.
         */
        private fun upsert(message: ChatMessageDto) {
            changedDuringCatchUp.add(message.id)
            if (!matchesTopicFilter(message) || !canMerge(message)) return
            val index = messages.indexOfFirst { it.id == message.id }
            if (index >= 0) messages[index] = keepingWriter(message, messages[index]) else messages.add(message)
            messages.sortWith(messageOrder)
        }

        /**
         * Bare UUID — the send validator is `Joi.string().uuid()`
         * (`backend/routes/chats.js:159`), so a prefixed id fails the
         * whole request with a 400. The `client_` prefix lives only on
         * the local optimistic row id.
         */
        private fun newClientMessageId(): String = UUID.randomUUID().toString()

        /** Launch the AI reply stream on its own cancellable job. */
        private fun startAiStream(text: String) {
            _isAiStreaming.value = true
            aiStreamJob =
                viewModelScope.launch {
                    try {
                        streamAiMessage(text)
                    } finally {
                        _isAiStreaming.value = false
                    }
                }
        }

        /**
         * Stop button (A15.3): cancel the in-flight AI stream and finalize
         * the assistant row. Partial deltas were committed to [messages] as
         * they streamed, so a partially-written reply simply stays; an
         * empty "thinking" bubble is dropped entirely (matches iOS).
         */
        fun cancelAiStream() {
            val job = aiStreamJob ?: return
            aiStreamJob = null
            job.cancel()
            _isAiStreaming.value = false
            aiStatus = null
            val assistantId = streamingAssistantId
            streamingAssistantId = null
            if (assistantId != null) {
                val index = messages.indexOfFirst { it.id == assistantId }
                if (index >= 0 && messages[index].resolvedText.isEmpty() && aiDraftsByMessageId[assistantId].isNullOrEmpty()) {
                    messages.removeAt(index)
                    rebuild()
                }
            }
        }

        /**
         * "Delete conversation" (the header's More menu): every conversation the assistant keeps for this person goes
         * (`DELETE /api/ai/conversations/:id`), the one on screen and any earlier one "New chat" or another device
         * left, which the next launch would otherwise show. Each one's cards are read first, so their records on this
         * phone go with it. Then the thread starts over, as "New chat" does.
         */
        fun deleteAiConversations() {
            if (mode !is ChatThreadMode.Ai || _isDeletingAi.value) return
            _isDeletingAi.value = true
            cancelAiStream()
            viewModelScope.launch {
                val failure = deleteEveryAiConversation()
                _isDeletingAi.value = false
                if (failure == null) {
                    startNewAiConversation()
                } else {
                    _actionFailure.value = failure
                }
            }
        }

        /** Null once none is left, else what to tell the person. */
        private suspend fun deleteEveryAiConversation(): String? {
            val deleted = mutableSetOf<String>()
            val activeId = aiConversationId
            return try {
                var listed = aiRepo.conversations(oldestFirst = true).orThrow().conversations.map { it.id }
                var rounds = 1
                // Oldest first across every page. Keep the displayed thread until it is the only one left.
                while (listed.any { it !in deleted } && rounds < AI_DELETE_ROUNDS) {
                    val onlyActive = listed.size == 1 && listed.first() == activeId
                    val ids = listed.filter { it !in deleted && (it != activeId || onlyActive) }
                    if (ids.isEmpty()) break
                    for (id in ids) {
                        deleteAiConversation(id, activeId)
                        deleted += id
                    }
                    listed = aiRepo.conversations(oldestFirst = true).orThrow().conversations.map { it.id }
                    rounds++
                }
                if (listed.isEmpty()) null else AI_DELETE_FAILED
            } catch (error: NetworkError) {
                Timber.w("AI conversation delete failed: ${error.message}")
                when {
                    // The one on screen goes only once it is the last one listed, so after its delete only the check failed.
                    activeId != null && activeId in deleted -> null
                    error.code == HTTP_TOO_MANY_REQUESTS -> AI_DELETE_TOO_MANY
                    else -> AI_DELETE_FAILED
                }
            }
        }

        private suspend fun deleteAiConversation(
            id: String,
            activeId: String?,
        ) {
            val cardIds = aiActionCardIds(id)
            aiRepo.deleteConversation(id).orThrow()
            aiCards.forget(cardIds)
            // Clear a confirmed deletion even if the following verification read fails.
            if (id == activeId) startNewAiConversation()
        }

        /** The action cards in one conversation, by card id; none when it is already gone. */
        private suspend fun aiActionCardIds(conversationId: String): Set<String> =
            when (val history = aiRepo.conversationMessages(conversationId)) {
                is NetworkResult.Success ->
                    history.data.messages
                        .mapNotNull { item -> item.draft?.takeIf { it.type == "action" } }
                        .mapNotNull { aiRepo.draftCard(it.type, it.draft)?.action?.id }
                        .toSet()
                is NetworkResult.Failure -> if (history.error is NetworkError.NotFound) emptySet() else throw history.error
            }

        /**
         * A15.3 "New chat": stop a reply in progress, clear the thread back to its starter prompts, and
         * forget the conversation so the next message starts a new one. A message being written stays.
         */
        fun startNewAiConversation() {
            if (mode !is ChatThreadMode.Ai) return
            aiStreamJob?.cancel()
            aiStreamJob = null
            _isAiStreaming.value = false
            aiStatus = null
            streamingAssistantId = null
            aiConversationId = null
            aiSession.setConversation(null, currentUserId)
            aiSession.freshStartUserId = currentUserId
            aiSentPhotos.clear()
            aiSentFiles.clear()
            messages.clear()
            aiDraftsByMessageId.clear()
            aiLinksByMessageId.clear()
            // Opened from a screen: the new conversation is about it too, with its starters again.
            _aiStarters.value = _aiContext.value?.starters.orEmpty()
            rebuild()
        }

        private suspend fun streamAiMessage(text: String) {
            // A refusal shown for the last Send.
            _sendLimitNotice.value = null
            // What the upload sends, taken before it starts: where each photo is on the phone, and each PDF's name and size.
            val queued = _queuedAttachments.value.filter { it.bytes != null }
            val photos = queued.filter { it.mimeType.startsWith("image/") }.mapNotNull { it.sourceUri }
            val files = queued.filter { it.mimeType == PDF_MIME }.map { ChatSentFile(it.filename, it.bytes?.size?.let(::fileSizeLabel)) }
            val imageUrls = uploadAIMessageFiles(text, queued) ?: return
            val userMessage =
                localMessage(
                    id = "ai_user_${UUID.randomUUID()}",
                    text = text,
                    userId = currentUserId,
                    type = "text",
                )
            if (imageUrls.isNotEmpty()) {
                if (photos.isNotEmpty()) aiSentPhotos[userMessage.id] = photos
                if (files.isNotEmpty()) aiSentFiles[userMessage.id] = files
            }
            val assistantId = "ai_assistant_${UUID.randomUUID()}"
            streamingAssistantId = assistantId
            messages.add(userMessage)
            messages.add(localMessage(id = assistantId, text = "", userId = "ai", type = "ai_reply"))
            // Files picked while the upload ran stay.
            _queuedAttachments.value = _queuedAttachments.value.filterNot { attachment -> queued.any { it.id == attachment.id } }
            rebuild()

            var streamedText = ""
            // A turn ends with `done` or an `error`; a stream that just stops was cut off (the server went away mid-turn).
            var ended = false
            runCatching {
                aiRepo.streamChat(
                    message =
                        text.ifEmpty {
                            if (photos.isEmpty() && files.isNotEmpty()) {
                                "What can you tell me about this document?"
                            } else {
                                "What can you tell me about this image?"
                            }
                        },
                    conversationId = aiConversationId,
                    images = imageUrls,
                    context = _aiContext.value,
                ).collect { event ->
                    when (event) {
                        is AIChatStreamEvent.Conversation -> {
                            aiConversationId = event.id
                            aiSession.setConversation(event.id, currentUserId)
                            aiSession.freshStartUserId = null
                        }
                        is AIChatStreamEvent.Status -> {
                            aiStatus = event.message
                            rebuild()
                        }
                        is AIChatStreamEvent.TextDelta -> {
                            aiStatus = null
                            streamedText += event.delta
                            replaceLocalMessage(assistantId, streamedText, "ai_reply", "ai")
                        }
                        is AIChatStreamEvent.Draft -> {
                            aiStatus = null
                            aiDraftsByMessageId[assistantId] = aiDraftsByMessageId[assistantId].orEmpty() + withSavedRuns(event.draft)
                            rebuild()
                        }
                        is AIChatStreamEvent.Link -> {
                            aiLinksByMessageId[assistantId] = aiLinksByMessageId[assistantId].orEmpty() + event.link
                            rebuild()
                        }
                        is AIChatStreamEvent.Error -> {
                            ended = true
                            aiStatus = null
                            giveBackIfUnanswered(assistantId, text, queued)
                            replaceLocalMessage(assistantId, event.message, "ai_reply", "ai")
                        }
                        AIChatStreamEvent.Done -> {
                            ended = true
                            aiStatus = null
                        }
                    }
                }
                if (!ended) throw IOException("The reply stream stopped before it was done")
            }.onFailure { error ->
                // A user-initiated stop is not a connection failure —
                // [cancelAiStream] already finalized the row.
                if (error is CancellationException) throw error
                giveBackIfUnanswered(assistantId, text, queued)
                replaceLocalMessage(assistantId, "I lost the connection. Please try again.", "ai_reply", "ai")
            }
            aiStatus = null
            streamingAssistantId = null
        }

        /**
         * A reply that failed before it said anything (no words, card or link): the person's words and files go back
         * in the composer, so trying again is one tap, and the files upload again then. Words typed in the meantime
         * stay. Call it before the error replaces the empty reply.
         */
        private fun giveBackIfUnanswered(
            assistantId: String,
            text: String,
            queued: List<ChatQueuedAttachment>,
        ) {
            val answered =
                messages.any { it.id == assistantId && it.resolvedText.isNotEmpty() } ||
                    !aiDraftsByMessageId[assistantId].isNullOrEmpty() ||
                    !aiLinksByMessageId[assistantId].isNullOrEmpty()
            if (answered) return
            if (_composerText.value.isEmpty()) _composerText.value = text
            _queuedAttachments.value = (queued + _queuedAttachments.value).distinctBy { it.id }.take(5)
        }

        fun react(
            messageId: String,
            reaction: String,
        ) {
            // The request carries the state this tap asks for, so a retry after a lost reply keeps the reaction instead
            // of undoing it.
            val reacted =
                messages.firstOrNull { it.id == messageId }?.let { message ->
                    message.reactions.none { it.reaction == reaction && it.reactedByMe }
                }
            viewModelScope.launch {
                when (val result = repo.reactToMessage(messageId, reaction, reacted)) {
                    is NetworkResult.Failure -> {
                        _actionFailure.value = "Couldn't add your reaction. Try again."
                        Timber.w("chat react failed: ${result.error.message}")
                    }
                    is NetworkResult.Success -> result.data.reactions?.let { applyReactions(messageId, it) }
                    else -> Unit
                }
            }
        }

        fun beginReply(messageId: String) {
            val message = (messages + pendingByClientId.values).firstOrNull { it.id == messageId } ?: return
            _replyingTo.value =
                ChatReplyPreview(
                    messageId = message.id,
                    senderName = replyNameOf(message),
                    text = message.resolvedText,
                )
            _editingMessageId.value = null
        }

        fun beginEdit(messageId: String) {
            val message = messages.firstOrNull { it.id == messageId && wroteMessage(it) } ?: return
            _editingMessageId.value = messageId
            _replyingTo.value = null
            _composerText.value = message.resolvedText
        }

        fun cancelMessageAction() {
            _replyingTo.value = null
            _editingMessageId.value = null
        }

        /**
         * Edit and delete are for the person who wrote a message: their own, or one they wrote for the business they
         * answer as here (the server names its writer only to them). A teammate's message for the same business stays
         * theirs; the API refuses it.
         */
        fun canDiscardMessage(messageId: String): Boolean {
            val id = messageId.removePrefix("client_")
            return id in outboxClientIds && id in failedClientIds
        }

        fun discardMessage(messageId: String) {
            if (canDiscardMessage(messageId)) outbox?.discard(messageId.removePrefix("client_"))
        }

        fun canManageMessage(messageId: String): Boolean = messages.any { it.id == messageId && wroteMessage(it) }

        private fun wroteMessage(message: ChatMessageDto): Boolean =
            message.userId == currentUserId ||
                (message.userId == messageIdentityId && message.actorUserId == currentUserId)

        fun delete(messageId: String) {
            if (!canManageMessage(messageId)) return
            viewModelScope.launch {
                when (val result = repo.deleteMessage(messageId)) {
                    is NetworkResult.Success -> {
                        rememberDeletion(messageId)
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        _actionFailure.value = "Couldn't delete the message. Try again."
                        Timber.w("chat delete failed: ${result.error.message}")
                    }
                }
            }
        }

        fun dismissActionFailure() {
            _actionFailure.value = null
        }

        /**
         * Download [attachment] into [directory] and hand it to the screen to
         * open in another app (a PDF viewer, video player, …).
         */
        fun openAttachment(
            attachment: ChatBubbleBody.Attachment,
            directory: File,
        ) {
            val fileId =
                attachment.fileUrl
                    ?.substringAfter("/api/chat/files/", "")
                    ?.substringBefore('?')
                    ?.takeIf { it.isNotBlank() }
            if (fileId == null) {
                _actionFailure.value = "This file can't be opened."
                return
            }
            if (openAttachmentJob?.isActive == true) return
            openAttachmentJob =
                viewModelScope.launch {
                    val name = File(attachment.filename).name.takeUnless { it.isBlank() || it == "." || it == ".." }
                    val previewDirectory = File(directory, UUID.randomUUID().toString()).apply { mkdirs() }
                    val target = File(previewDirectory, name ?: "attachment")
                    when (val result = repo.downloadFile(fileId, target)) {
                        is NetworkResult.Success -> {
                            val clip = attachment.liveVideoFileId?.let { File(previewDirectory, "live.mp4") }
                            if (
                                clip != null &&
                                repo.downloadFile(checkNotNull(attachment.liveVideoFileId), clip) is NetworkResult.Failure
                            ) {
                                previewDirectory.deleteRecursively()
                                _actionFailure.value = "Couldn't open the Live Photo. Try again."
                            } else {
                                _openFile.value = ChatOpenFile(target, attachment.mimeType ?: "application/octet-stream", clip)
                            }
                        }
                        is NetworkResult.Failure -> {
                            previewDirectory.deleteRecursively()
                            _actionFailure.value = "Couldn't open the file. Try again."
                            Timber.w("chat file download failed: ${result.error.message}")
                        }
                    }
                }
        }

        fun consumeOpenFile() {
            _openFile.value = null
        }

        fun dismissSendLimitNotice() {
            _sendLimitNotice.value = null
        }

        /**
         * Block the person counterparty via `POST /api/users/:userId/block`
         * (route `backend/routes/blocks.js:13`). Person threads only — on
         * success the caller dismisses the details sheet and leaves the
         * thread via [onBlocked]; on failure [onFailed] lets it say so,
         * because the details sheet covers the screen's snackbar.
         */
        fun blockUser(
            onFailed: () -> Unit = {},
            onBlocked: () -> Unit = {},
        ) {
            val target = mode as? ChatThreadMode.Person ?: return
            if (_isBlocking.value) return
            viewModelScope.launch {
                _isBlocking.value = true
                try {
                    when (val result = blocksRepo.block(target.otherUserId)) {
                        is NetworkResult.Success -> onBlocked()
                        is NetworkResult.Failure -> {
                            Timber.w("block user failed: ${result.error.message}")
                            onFailed()
                        }
                    }
                } finally {
                    _isBlocking.value = false
                }
            }
        }

        /**
         * Report the person counterparty via `POST /api/users/:userId/report`
         * (route `backend/routes/users.js:4153`, Joi validator `:4137` —
         * `reason` must be one of `spam · harassment · inappropriate ·
         * misinformation · safety · other`, `details` optional, max 1000).
         * Person threads only, mirroring [blockUser]. On success the
         * caller dismisses the report sheet via [onReported] and the
         * success toast is published through [reportNotice]. Failures go
         * to [onFailed] instead: the report sheet stays open over the
         * snackbar, so the caller shows its own alert.
         */
        fun reportUser(
            reason: String,
            details: String?,
            onFailed: () -> Unit = {},
            onReported: () -> Unit = {},
        ) {
            val target = mode as? ChatThreadMode.Person ?: return
            if (_isReporting.value) return
            viewModelScope.launch {
                _isReporting.value = true
                try {
                    val body =
                        UserReportRequest(
                            reason = reason,
                            details = details?.trim()?.takeIf { it.isNotEmpty() }?.take(MAX_REPORT_DETAILS),
                        )
                    when (val result = reportsRepo.report(target.otherUserId, body)) {
                        is NetworkResult.Success -> {
                            _reportNotice.value = "Report submitted — thanks for keeping the neighborhood safe"
                            onReported()
                        }
                        is NetworkResult.Failure -> {
                            Timber.w("report user failed: ${result.error.message}")
                            onFailed()
                        }
                    }
                } finally {
                    _isReporting.value = false
                }
            }
        }

        fun dismissReportNotice() {
            _reportNotice.value = null
        }

        /**
         * Resolve link-preview metadata for [url] once (in-flight and
         * resolved URLs are skipped) and publish it into [linkPreviews].
         * Failures are recorded as null so the bubble renders no card.
         */
        fun resolveLinkPreview(url: String) {
            if (_linkPreviews.value.containsKey(url) || !linkPreviewsInFlight.add(url)) return
            viewModelScope.launch {
                val preview = linkPreviewRepo.preview(url)
                _linkPreviews.value = _linkPreviews.value + (url to preview)
                linkPreviewsInFlight.remove(url)
            }
        }

        // MARK: - Selection mode (bulk delete)

        /** Only rows you wrote are selectable — optimistic `client_` rows have no server id yet. */
        private fun isSelectable(messageId: String): Boolean = !messageId.startsWith("client_") && canManageMessage(messageId)

        fun enterSelectionMode(messageId: String) {
            if (!isSelectable(messageId)) return
            _isSelectionMode.value = true
            _selectedMessageIds.value = setOf(messageId)
        }

        fun toggleSelection(messageId: String) {
            if (!_isSelectionMode.value || !isSelectable(messageId)) return
            val current = _selectedMessageIds.value
            _selectedMessageIds.value = if (messageId in current) current - messageId else current + messageId
        }

        fun exitSelectionMode() {
            _isSelectionMode.value = false
            _selectedMessageIds.value = emptySet()
        }

        /**
         * Delete every selected message through the existing per-message
         * endpoint (no bulk route exists), drop the deleted rows, and exit
         * selection mode.
         */
        fun deleteSelected() {
            val ids = _selectedMessageIds.value
            if (ids.isEmpty()) {
                exitSelectionMode()
                return
            }
            viewModelScope.launch {
                var failed = 0
                ids.forEach { id ->
                    when (val result = repo.deleteMessage(id)) {
                        is NetworkResult.Success -> {
                            rememberDeletion(id)
                        }
                        is NetworkResult.Failure -> {
                            failed++
                            Timber.w("bulk delete failed for $id: ${result.error.message}")
                        }
                    }
                }
                if (failed > 0) {
                    _actionFailure.value =
                        "Couldn't delete $failed ${if (failed == 1) "message" else "messages"}. Try again."
                }
                rebuild()
                exitSelectionMode()
            }
        }

        fun setForeground(foreground: Boolean) {
            if (isForeground == foreground) return
            isForeground = foreground
            if (foreground) {
                publishViewedRooms()
                catchUpMessages()
                scheduleMarkRead()
                if (socket.connectionState.value != SocketManager.ConnectionState.Connected) startFallbackPollingIfNeeded()
            } else {
                activeChatThread.clear()
                markReadJob?.cancel()
                stopFallbackPolling()
            }
        }

        fun markVisibleMessageRead(messageId: String) {
            val visible = messages.firstOrNull { it.id == messageId } ?: return
            val previous = messages.firstOrNull { it.id == visibleReadThroughId }
            if (previous != null && messageOrder.compare(visible, previous) < 0) return
            visibleReadThroughId = messageId
            scheduleMarkRead()
        }

        fun scheduleMarkRead() {
            if (!isForeground || _selectedTopicId.value != null) return
            val throughId = visibleReadThroughId ?: return
            if (throughId == lastReadMessageId || messages.none { it.id == throughId } || throughId.startsWith("client_")) return
            val context = historyContext()
            markReadJob?.cancel()
            markReadJob =
                viewModelScope.launch {
                    delay(600)
                    if (!isForeground || context != historyContext()) return@launch
                    val result =
                        when (val target = context.mode) {
                            is ChatThreadMode.Room -> repo.markRoomRead(target.id, target.asBusinessUserId, throughId)
                            is ChatThreadMode.Person -> repo.markConversationRead(target.otherUserId, throughId)
                            ChatThreadMode.Ai -> return@launch
                        }
                    if (result is NetworkResult.Success && context == historyContext()) lastReadMessageId = throughId
                }
        }

        fun teardown() {
            outboxJob?.cancel()
            outboxJob = null
            outboxAcceptedJob?.cancel()
            outboxAcceptedJob = null
            historyGeneration++
            resetRoomSubscriptions()
            // Don't leave the counterparty staring at a stale "typing…" row.
            emitTypingStop()
            // Leaving the screen — chat pushes for these rooms notify again.
            activeChatThread.clear()
            markReadJob?.cancel()
            connectionJob?.cancel()
            messageJob?.cancel()
            updateJob?.cancel()
            deleteJob?.cancel()
            reactJob?.cancel()
            readReceiptJob?.cancel()
            presenceOnlineJob?.cancel()
            presenceOfflineJob?.cancel()
            reactionRefetchJob?.cancel()
            fallbackPollJob?.cancel()
            catchUpJob?.cancel()
            topicsRefreshRequested = false
            topicsJob?.cancel()
            topicsJob = null
            typingUserJob?.cancel()
            typingStoppedJob?.cancel()
            typingClearJob?.cancel()
            aiStreamJob?.cancel()
            markReadJob = null
            connectionJob = null
            messageJob = null
            updateJob = null
            deleteJob = null
            reactJob = null
            readReceiptJob = null
            presenceOnlineJob = null
            presenceOfflineJob = null
            reactionRefetchJob = null
            fallbackPollJob = null
            catchUpJob = null
            typingUserJob = null
            typingStoppedJob = null
            typingClearJob = null
            aiStreamJob = null
        }

        override fun onCleared() {
            super.onCleared()
            teardown()
        }

        // MARK: - Fetch

        private data class HistoryReadContext(
            val generation: Long,
            val mode: ChatThreadMode,
            val user: String?,
            val topicId: String?,
        )

        private fun historyContext() = HistoryReadContext(historyGeneration, mode, currentUserId, _selectedTopicId.value)

        /**
         * [quiet]: refetch the newest page under the messages on screen instead of clearing them first. The page
         * replaces what it covers; older pages the reader loaded and rows newer than the page (a send that landed
         * meanwhile) stay. A failed quiet read keeps the thread as it is.
         */
        private fun fetch(
            initial: Boolean,
            before: String? = null,
            quiet: Boolean = false,
            force: Boolean = false,
        ) {
            val context = historyContext()
            val requestKey = context to before
            if (!historyReadsInFlight.add(requestKey)) return
            if (initial || context != historyCopyContext) followHistoryCopy(context)
            val copied = initial && !quiet && showHistoryCopy()
            val keepMessages = quiet || copied || pendingByClientId.isNotEmpty()
            viewModelScope.launch {
                try {
                    if (initial && !keepMessages) {
                        _state.value = ChatConversationUiState.Loading
                        messages = mutableListOf()
                        // Pending / failed optimistic rows survive refetches —
                        // socket fallbacks refetch the thread, and eating an
                        // in-flight or failed send here would lose the message
                        // and its retry CTA. Confirmed rows are retired below by
                        // `client_message_id` match.
                        oldestCursor = null
                        hasMore = false
                    }
                    if (mode is ChatThreadMode.Ai) {
                        // The assistant's transcript lives in this view model; a quiet read leaves it alone.
                        if (!keepMessages) _state.value = ChatConversationUiState.Empty
                        return@launch
                    }
                    val response =
                        when (val target = context.mode) {
                            is ChatThreadMode.Room ->
                                repo.roomMessages(
                                    target.id,
                                    before,
                                    force = force,
                                    asBusinessUserId = target.asBusinessUserId,
                                )
                            is ChatThreadMode.Person ->
                                repo.conversationMessages(target.otherUserId, before, topicId = context.topicId, force = force)
                            ChatThreadMode.Ai -> return@launch
                        }
                    // The topic changed while this page was in flight (the opening topic
                    // resolves alongside the first fetch); the fetch for it owns the thread.
                    if (context != historyContext()) return@launch
                    publishHistoryPage(response, keepMessages, initial, firstPage = before == null)
                    recoverRetainedHistory(response, initial, keepMessages)
                } finally {
                    historyReadsInFlight.remove(requestKey)
                }
            }
        }

        private fun recoverRetainedHistory(
            response: NetworkResult<ChatMessagesResponse>,
            initial: Boolean,
            retained: Boolean,
        ) {
            if (initial && retained && response is NetworkResult.Success) catchUpMessages()
        }

        /** A first-page read (or a new thread or topic): the copy writer follows the read's context. */
        private fun followHistoryCopy(context: HistoryReadContext) {
            if (context != historyCopyContext) {
                historyPage = null
                deletedMessageVersions.clear()
            }
            historyCopyContext = context
            updateHistoryCopy =
                when (val target = context.mode) {
                    is ChatThreadMode.Room -> repo.roomHistoryUpdater(target.id, target.asBusinessUserId)
                    is ChatThreadMode.Person -> repo.conversationHistoryUpdater(target.otherUserId, context.topicId)
                    ChatThreadMode.Ai -> null
                }
        }

        private fun publishHistoryPage(
            response: NetworkResult<ChatMessagesResponse>,
            keepMessages: Boolean,
            initial: Boolean,
            firstPage: Boolean,
        ) {
            when (response) {
                is NetworkResult.Success -> {
                    historyRefusal = null
                    if (firstPage) {
                        val anchor = historyPage?.syncCursors.orEmpty().takeIf { keepMessages && it.isNotEmpty() }
                        historyPage = response.data.copy(syncCursors = anchor ?: response.data.syncCursors)
                    }
                    _composerClosedNote.value = response.data.sendRefusal?.error
                    val keptOlder = placePage(response.data.messages, keepMessages)
                    retireConfirmedSends(response.data.messages)
                    refreshUnknownTopics(response.data.messages)
                    updateActiveRooms(response.data)
                    // Older pages kept under a quiet read keep their own cursor.
                    if (!keptOlder) {
                        hasMore = response.data.hasMore ?: false
                        oldestCursor =
                            response.data.nextCursor
                                ?: paginationCursor(messages.firstOrNull())
                    }
                    rebuild()
                    joinActiveRoomsIfPossible()
                    scheduleMarkRead()
                    if (initial) prefetchDirectRoomIfNeeded()
                }
                is NetworkResult.Failure -> {
                    if (historyAccessEnded(response.error)) {
                        refuseHistory(response.error)
                    } else if (initial && !keepMessages && pendingByClientId.isEmpty()) {
                        _state.value = ChatConversationUiState.Error(response.error.message)
                    } else {
                        Timber.w("chat refresh or pagination failed: ${response.error.message}")
                    }
                }
            }
        }

        private fun refuseHistory(error: NetworkError) {
            historyGeneration++
            historyRefusal = error.message
            historyPage = null
            messages.clear()
            activeRoomIds = emptySet()
            directRoomDeferred?.cancel()
            directRoomDeferred = null
            directRoomId = null
            teardown()
            _state.value = ChatConversationUiState.Error(error.message)
        }

        /** The newest hundred server messages, restored from the account-scoped encrypted recent-history cache. */
        private fun showHistoryCopy(): Boolean {
            val copy =
                when (val target = mode) {
                    is ChatThreadMode.Room -> repo.roomMessagesCopy(target.id, target.asBusinessUserId)
                    is ChatThreadMode.Person -> repo.conversationMessagesCopy(target.otherUserId, _selectedTopicId.value)
                    ChatThreadMode.Ai -> null
                } ?: return false
            historyPage = copy
            deletedMessageVersions.putAll(copy.deletedMessageVersions)
            messages = copy.messages.filterNot { it.id in deletedMessageVersions }.toMutableList()
            _composerClosedNote.value = copy.sendRefusal?.error
            hasMore = copy.hasMore ?: false
            oldestCursor = copy.nextCursor ?: paginationCursor(messages.firstOrNull())
            updateActiveRooms(copy)
            rebuild()
            return true
        }

        /** Puts a fetched [page] into [messages]; true when a quiet read kept older pages (they keep their cursor). */
        private fun placePage(
            page: List<ChatMessageDto>,
            quiet: Boolean,
        ): Boolean {
            if (quiet) return mergeNewestPage(page)
            page.filter(::canMerge).forEach { incoming ->
                val index = messages.indexOfFirst { it.id == incoming.id }
                if (index >= 0) messages[index] = keepingWriter(incoming, messages[index]) else messages.add(incoming)
            }
            messages.sortWith(messageOrder)
            return false
        }

        /**
         * Quiet refetch: the newest [page] replaces the rows it covers, so edits and deletions inside it show;
         * rows older than the page (pages the reader loaded) and newer than it (a send that landed while the page
         * was in flight) stay. Returns true when older rows were kept.
         */
        private fun mergeNewestPage(page: List<ChatMessageDto>): Boolean {
            val pageIds = page.mapTo(HashSet()) { it.id }
            val oldest = page.minWithOrNull(messageOrder)
            val newest = page.maxWithOrNull(messageOrder)
            val older = messages.filter { it.id !in pageIds && oldest != null && messageOrder.compare(it, oldest) < 0 }
            val newer = messages.filter { it.id !in pageIds && newest != null && messageOrder.compare(it, newest) > 0 }
            val existing = messages.associateBy { it.id }
            val fresh = page.filter(::canMerge).map { incoming -> existing[incoming.id]?.let { keepingWriter(incoming, it) } ?: incoming }
            messages = (older + fresh + newer).filter(::canMerge).sortedWith(messageOrder).toMutableList()
            return older.isNotEmpty()
        }

        /**
         * Resolve the room to send into. Room threads use their fixed id.
         * Person threads always send to the pair's direct room — found or
         * created via `POST /api/chat/direct` and cached — never to a
         * shared gig/group room surfaced by the aggregated fetch, which
         * would misfile plain DMs and trip gig pre-bid send limits.
         */
        private suspend fun ensureRoomId(): String? =
            when (val target = mode) {
                is ChatThreadMode.Room -> target.id
                is ChatThreadMode.Person -> directRoomId ?: resolveDirectRoom(target.otherUserId)
                ChatThreadMode.Ai -> null
            }

        private suspend fun resolveDirectRoom(otherUserId: String): String? {
            val generation = historyGeneration
            val userId = currentUserId
            val deferred =
                directRoomDeferred ?: viewModelScope.async {
                    when (val result = repo.createDirectChat(otherUserId)) {
                        is NetworkResult.Success -> result.data.roomId
                        is NetworkResult.Failure -> {
                            Timber.w("create direct chat failed: ${result.error.message}")
                            directRoomFailure = result.error
                            null
                        }
                    }
                }.also { directRoomDeferred = it }
            val roomId = deferred.await()
            if (generation != historyGeneration || userId != currentUserId || historyRefusal != null) return null
            if (directRoomDeferred === deferred) directRoomDeferred = null
            if (roomId != null && directRoomId == null) {
                directRoomId = roomId
                // Join the freshly resolved room so the socket delivers
                // `message:new` for replies that land in it.
                if (!activeRoomIds.contains(roomId)) {
                    activeRoomIds = activeRoomIds + roomId
                    publishViewedRooms()
                    joinActiveRoomsIfPossible()
                }
            }
            return roomId
        }

        /**
         * Best-known room id for the optimistic row (cosmetic only — the
         * authoritative id is resolved by [ensureRoomId] at send time).
         */
        private fun knownRoomIdHint(): String =
            when (val target = mode) {
                is ChatThreadMode.Room -> target.id
                is ChatThreadMode.Person -> directRoomId ?: ""
                ChatThreadMode.Ai -> ""
            }

        /**
         * Resolve the person thread's direct room in the background so the
         * first send doesn't pay the find-or-create round trip. Only runs
         * when history exists — opening an empty thread must not create
         * rooms for conversations that never start.
         */
        private fun prefetchDirectRoomIfNeeded() {
            if (mode !is ChatThreadMode.Person) return
            if (directRoomId != null || messages.isEmpty()) return
            viewModelScope.launch { ensureRoomId() }
        }

        private fun loadTopicsIfNeeded() {
            val target = mode as? ChatThreadMode.Person ?: return
            if (topicsJob?.isActive == true) {
                topicsRefreshRequested = true
                return
            }
            val context = historyContext()
            topicsJob =
                viewModelScope.launch {
                    try {
                        val pendingInitial = initialTopic
                        if (pendingInitial != null && _selectedTopicId.value == null) {
                            when (
                                val result =
                                    repo.findOrCreateTopic(
                                        target.otherUserId,
                                        FindOrCreateTopicBody(
                                            topicType = pendingInitial.topicType,
                                            topicRefId = pendingInitial.topicRefId,
                                            title = pendingInitial.title,
                                        ),
                                    )
                            ) {
                                is NetworkResult.Success -> {
                                    if (context != historyContext()) return@launch
                                    historyGeneration++
                                    _selectedTopicId.value = result.data.topic.id
                                    // The first fetch may already have left unfiltered.
                                    fetch(initial = true)
                                }
                                is NetworkResult.Failure -> Timber.w("find/create topic failed: ${result.error.message}")
                            }
                            if (context.mode != mode || context.user != currentUserId) return@launch
                            initialTopic = null
                        }
                        val topicsContext = historyContext()
                        when (val result = repo.conversationTopics(target.otherUserId)) {
                            is NetworkResult.Success -> {
                                if (topicsContext != historyContext()) return@launch
                                _topics.value = topicRows(result.data.topics)
                                // Topic dividers are labeled from this list; relabel a card
                                // shared into a new topic (it read "General" until then).
                                if (messages.isNotEmpty()) rebuild()
                            }
                            is NetworkResult.Failure -> Timber.w("load topics failed: ${result.error.message}")
                        }
                    } finally {
                        finishTopicsRefresh(context, coroutineContext[Job])
                    }
                }
        }

        private fun finishTopicsRefresh(
            context: HistoryReadContext,
            job: Job?,
        ) {
            if (topicsJob !== job) return
            topicsJob = null
            if (topicsRefreshRequested && context.mode == mode && context.user == currentUserId) {
                topicsRefreshRequested = false
                loadTopicsIfNeeded()
            }
        }

        private fun topicRows(topics: List<ChatTopic>): List<ChatConversationTopic> =
            topics.mapNotNull { topic ->
                val id = topic.id ?: return@mapNotNull null
                ChatConversationTopic(id, topic.topicType ?: "general", topic.title ?: "Topic", topic.status)
            }

        private fun refreshUnknownTopics(rows: List<ChatMessageDto>) {
            if (rows.any { row -> row.topicId != null && _topics.value.none { it.id == row.topicId } }) loadTopicsIfNeeded()
        }

        private fun updateActiveRooms(response: ChatMessagesResponse) {
            activeRoomIds =
                buildSet {
                    response.roomIds?.forEach(::add)
                    response.messages.forEach { add(it.roomId) }
                    (mode as? ChatThreadMode.Room)?.id?.let(::add)
                    directRoomId?.let(::add)
                }
            publishViewedRooms()
        }

        /**
         * Tell the push layer which rooms are on screen so an incoming
         * `chat_message` FCM for one of them is suppressed while the user
         * is reading it ([ActiveChatThread]).
         */
        private fun publishViewedRooms() {
            if (isForeground) activeChatThread.viewedRoomIds = activeRoomIds
        }

        // MARK: - Realtime

        private fun subscribeToSockets() {
            if (connectionJob == null) {
                connectionJob =
                    viewModelScope.launch {
                        var connectedBefore = false
                        socket.connectionState.collect { state ->
                            if (state == SocketManager.ConnectionState.Connected) {
                                if (connectedBefore || messages.isNotEmpty()) catchUpMessages()
                                connectedBefore = true
                                stopFallbackPolling()
                                resetRoomSubscriptions()
                                joinActiveRoomsIfPossible()
                            } else {
                                resetRoomSubscriptions()
                                startFallbackPollingIfNeeded()
                            }
                        }
                    }
            }
            if (messageJob == null) {
                messageJob =
                    viewModelScope.launch {
                        socket.eventsOf("message:new").collect { handleIncoming(it) }
                    }
            }
            if (updateJob == null) {
                updateJob =
                    viewModelScope.launch {
                        socket.eventsOf("message:edited").collect { handleUpdate(it) }
                    }
            }
            if (deleteJob == null) {
                deleteJob =
                    viewModelScope.launch {
                        socket.eventsOf("message:deleted").collect { handleDelete(it) }
                    }
            }
            if (readReceiptJob == null) {
                readReceiptJob =
                    viewModelScope.launch {
                        socket.eventsOf("messages:read").collect { handleReadReceipt(it) }
                    }
            }
            if (reactJob == null) {
                reactJob =
                    viewModelScope.launch {
                        socket.eventsOf("message:reaction_updated").collect { handleReaction(it) }
                    }
            }
            // Typing indicator — backend/socket/chatSocketio.js:345-397
            // broadcasts `typing:user` / `typing:stopped` to joined rooms.
            if (typingUserJob == null) {
                typingUserJob =
                    viewModelScope.launch {
                        socket.eventsOf("typing:user").collect { handleTypingUser(it) }
                    }
            }
            if (typingStoppedJob == null) {
                typingStoppedJob =
                    viewModelScope.launch {
                        socket.eventsOf("typing:stopped").collect { handleTypingStopped(it) }
                    }
            }
            // Live presence — backend/socket/chatSocketio.js:240 + :646
            // broadcast `user:online` / `user:offline` with `{ userId }`.
            if (presenceOnlineJob == null) {
                presenceOnlineJob =
                    viewModelScope.launch {
                        socket.eventsOf("user:online").collect { handlePresence(it, online = true) }
                    }
            }
            if (presenceOfflineJob == null) {
                presenceOfflineJob =
                    viewModelScope.launch {
                        socket.eventsOf("user:offline").collect { handlePresence(it, online = false) }
                    }
            }
            joinActiveRoomsIfPossible()
        }

        /**
         * Flip the person counterparty's online flag when the presence
         * broadcast names the thread's other user — the header dot /
         * "Active now" line reacts live. Person mode only; group rooms
         * carry no single presence identity.
         */
        private fun handlePresence(
            json: JSONObject,
            online: Boolean,
        ) {
            val target = mode as? ChatThreadMode.Person ?: return
            val userId = json.optStringValue("userId") ?: json.optStringValue("user_id") ?: return
            if (userId != target.otherUserId) return
            val person = _counterparty.value as? ChatCounterparty.Person ?: return
            if (person.online == online) return
            _counterparty.value = person.copy(online = online)
        }

        /** Keep a visible conversation responsive when HTTP works but realtime is unavailable. */
        private fun startFallbackPollingIfNeeded() {
            if (fallbackPollJob != null || mode is ChatThreadMode.Ai || !isForeground) return
            fallbackPollJob =
                viewModelScope.launch(Dispatchers.Default) {
                    var interval = SOCKET_FALLBACK_INITIAL_MS
                    while (socket.connectionState.value != SocketManager.ConnectionState.Connected) {
                        // The opening history read already covers now; do not race it with an immediate duplicate.
                        delay(interval)
                        withContext(Dispatchers.Main.immediate) {
                            if (_state.value is ChatConversationUiState.Loaded || _state.value is ChatConversationUiState.Empty) {
                                catchUpMessages()
                            }
                        }
                        interval = (interval * 2).coerceAtMost(SOCKET_FALLBACK_POLL_MS)
                    }
                }
        }

        private fun stopFallbackPolling() {
            fallbackPollJob?.cancel()
            fallbackPollJob = null
        }

        /**
         * Person threads join EVERY shared room (the aggregated fetch's
         * `roomIds` includes gig/group rooms with extra members), so a
         * room match alone would let a third member's typing light the
         * 1:1 indicator. Person mode additionally requires the event to
         * come from the thread's counterparty; room mode keeps room-match.
         */
        private fun typingEventMatchesThread(
            roomId: String,
            userId: String,
        ): Boolean {
            if (!activeRoomIds.contains(roomId) || userId == currentUserId) return false
            val person = mode as? ChatThreadMode.Person ?: return true
            return userId == person.otherUserId
        }

        private fun handleTypingUser(json: JSONObject) {
            val roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId") ?: return
            val userId = json.optStringValue("user_id") ?: json.optStringValue("userId") ?: return
            if (!typingEventMatchesThread(roomId, userId)) return
            _isCounterpartyTyping.value = true
            // Auto-clear in case the counterparty's `typing:stop` is lost —
            // the backend's ChatTyping rows expire after 10s; 5s keeps the
            // indicator snappy.
            typingClearJob?.cancel()
            typingClearJob =
                viewModelScope.launch {
                    delay(TYPING_AUTO_CLEAR_MS)
                    _isCounterpartyTyping.value = false
                }
        }

        private fun handleTypingStopped(json: JSONObject) {
            val roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId") ?: return
            val userId = json.optStringValue("user_id") ?: json.optStringValue("userId") ?: return
            if (!typingEventMatchesThread(roomId, userId)) return
            typingClearJob?.cancel()
            typingClearJob = null
            _isCounterpartyTyping.value = false
        }

        /**
         * Re-read every loaded page after reconnect. New-message-only backfill cannot repair a missed edit,
         * reaction or deletion, and a fixed newest-page window can leave a gap after a busy disconnection.
         * Apply once at the end so the reader keeps the same timeline and scroll anchor during recovery.
         */
        private fun catchUpMessages() {
            if (catchUpJob?.isActive == true || mode is ChatThreadMode.Ai) return
            val context = historyContext()
            val oldest = messages.minWithOrNull(messageOrder)
            changedDuringCatchUp.clear()
            catchUpJob =
                viewModelScope.launch {
                    if (recoverChanges(context)) return@launch
                    var before: String? = null
                    val authoritative = LinkedHashMap<String, ChatMessageDto>()
                    var firstPage: ChatMessagesResponse? = null
                    do {
                        val result = readHistoryPage(context, before)
                        if (context != historyContext()) return@launch
                        when (result) {
                            is NetworkResult.Success -> {
                                val page = result.data
                                if (firstPage == null) firstPage = page
                                page.messages.forEach { authoritative[it.id] = it }
                                before = nextCatchUpCursor(page, before, oldest)
                                if (before == null) applyCaughtUpHistory(authoritative.values, oldest, page)
                            }
                            is NetworkResult.Failure -> {
                                if (historyAccessEnded(result.error)) refuseHistory(result.error)
                                return@launch
                            }
                        }
                    } while (before != null)
                    firstPage?.let { page ->
                        historyPage = page
                        _composerClosedNote.value = page.sendRefusal?.error
                        updateActiveRooms(page)
                    }
                    retireConfirmedSends(authoritative.values.toList())
                    rebuild()
                    joinActiveRoomsIfPossible()
                    scheduleMarkRead()
                }
        }

        /** Apply a complete, fixed server revision window before advancing the durable recovery anchor. */
        @Suppress("ReturnCount") // Scope changes, access refusal and server reset each end this recovery attempt.
        private suspend fun recoverChanges(context: HistoryReadContext): Boolean {
            var cursor = historyPage?.syncCursors.orEmpty()
            if (cursor.isEmpty()) return false
            var until: Map<String, Long>? = null
            val changes = linkedMapOf<String, ChatMessageDto>()
            val receipts = linkedMapOf<String, ChatReadReceipt>()
            var pages = 0
            while (pages++ < MAX_CHANGE_PAGES) {
                val result = readChanges(context, cursor, until)
                if (context != historyContext()) return true
                if (result is NetworkResult.Failure) {
                    if (historyAccessEnded(result.error)) refuseHistory(result.error)
                    return true
                }
                val page = (result as NetworkResult.Success).data
                if (page.resetRequired) return false
                collectChanges(page, changes, receipts)
                if (!page.hasMore) {
                    applyChanges(page, changes.values, receipts.values)
                    return true
                }
                if (page.syncCursors == cursor) return false
                cursor = page.syncCursors
                until = until ?: page.untilCursors
            }
            // A very old anchor can cost more than the loaded window. Reconcile that bounded window instead.
            return false
        }

        private suspend fun readChanges(
            context: HistoryReadContext,
            cursor: Map<String, Long>,
            until: Map<String, Long>?,
        ): NetworkResult<ChatChangesResponse> {
            val encodedCursor = JSONObject(cursor).toString()
            val encodedUntil = until?.let { JSONObject(it).toString() }
            return when (val target = context.mode) {
                is ChatThreadMode.Room -> repo.roomChanges(target.id, encodedCursor, encodedUntil, target.asBusinessUserId)
                is ChatThreadMode.Person -> repo.conversationChanges(target.otherUserId, encodedCursor, encodedUntil)
                ChatThreadMode.Ai -> NetworkResult.Success(ChatChangesResponse())
            }
        }

        private fun collectChanges(
            page: ChatChangesResponse,
            changes: MutableMap<String, ChatMessageDto>,
            receipts: MutableMap<String, ChatReadReceipt>,
        ) {
            page.messages.forEach { row ->
                if ((row.syncVersion ?: 0) >= (changes[row.id]?.syncVersion ?: 0)) changes[row.id] = row
            }
            page.readReceipts.forEach { receipts["${it.roomId}:${it.userId}"] = it }
        }

        private fun applyChanges(
            page: ChatChangesResponse,
            changes: Collection<ChatMessageDto>,
            receipts: Collection<ChatReadReceipt>,
        ) {
            val oldest = messages.minWithOrNull(messageOrder)
            val merged = messages.associateBy { it.id }.toMutableMap()
            changes.forEach { row ->
                if (row.deleted || row.deletedAt != null) {
                    rememberDeletion(row.id, row.syncVersion)
                } else if (belongsInRecoveredWindow(row, merged, oldest)) {
                    merged[row.id] = merged[row.id]?.let { keepingWriter(row, it) } ?: row
                    changedDuringCatchUp.add(row.id)
                }
            }
            messages =
                merged.values.filter { it.roomId !in page.removedRoomIds && canMerge(it) }
                    .sortedWith(messageOrder).toMutableList()
            historyPage = (historyPage ?: ChatMessagesResponse(emptyList())).copy(syncCursors = page.syncCursors, roomIds = page.roomIds)
            activeRoomIds = page.roomIds.toSet()
            retireConfirmedSends(changes.filterNot { it.deleted })
            refreshUnknownTopics(changes.filterNot { it.deleted })
            receipts.forEach(::applyReadReceipt)
            rebuild()
            publishViewedRooms()
            joinActiveRoomsIfPossible()
            scheduleMarkRead()
        }

        private fun belongsInRecoveredWindow(
            row: ChatMessageDto,
            held: Map<String, ChatMessageDto>,
            oldest: ChatMessageDto?,
        ): Boolean {
            if (!matchesTopicFilter(row) || !canMerge(row)) return false
            return row.id in held || oldest == null || messageOrder.compare(row, oldest) >= 0
        }

        private fun rememberDeletion(
            id: String,
            version: Long? = null,
        ) {
            val known = messages.firstOrNull { it.id == id }?.syncVersion ?: 0
            if (version != null && version < known) return
            deletedMessageVersions[id] = maxOf(deletedMessageVersions[id] ?: 0, version ?: (known + 1))
            while (deletedMessageVersions.size > MAX_TOMBSTONES) deletedMessageVersions.remove(deletedMessageVersions.keys.first())
            messages.removeAll { it.id == id }
            changedDuringCatchUp.add(id)
        }

        private fun canMerge(message: ChatMessageDto): Boolean =
            message.createdAt.isNotBlank() && !message.deleted && message.deletedAt == null && message.id !in deletedMessageVersions

        private suspend fun readHistoryPage(
            context: HistoryReadContext,
            before: String?,
        ): NetworkResult<ChatMessagesResponse> =
            when (val target = context.mode) {
                is ChatThreadMode.Room ->
                    repo.roomMessages(target.id, before = before, asBusinessUserId = target.asBusinessUserId, force = true)
                is ChatThreadMode.Person ->
                    repo.conversationMessages(target.otherUserId, before = before, topicId = context.topicId, force = true)
                ChatThreadMode.Ai -> NetworkResult.Success(ChatMessagesResponse(emptyList()))
            }

        private fun nextCatchUpCursor(
            page: ChatMessagesResponse,
            before: String?,
            oldest: ChatMessageDto?,
        ): String? {
            val earliest = page.messages.minWithOrNull(messageOrder)
            if (oldest == null || earliest == null || messageOrder.compare(earliest, oldest) <= 0) return null
            return page.nextCursor.takeIf { page.hasMore == true && it != before }
        }

        private fun applyCaughtUpHistory(
            authoritative: Collection<ChatMessageDto>,
            oldest: ChatMessageDto?,
            page: ChatMessagesResponse,
        ) {
            val olderLoadedMeanwhile = messages.filter { oldest != null && messageOrder.compare(it, oldest) < 0 }
            val liveRows = messages.filter { it.id in changedDuringCatchUp }
            val held = messages.associateBy { it.id }
            val refreshed =
                authoritative.filter { it.id !in changedDuringCatchUp && canMerge(it) }
                    .map { incoming -> held[incoming.id]?.let { keepingWriter(incoming, it) } ?: incoming }
            messages = (refreshed + liveRows + olderLoadedMeanwhile).distinctBy { it.id }.sortedWith(messageOrder).toMutableList()
            if (olderLoadedMeanwhile.isEmpty()) {
                hasMore = page.hasMore == true
                oldestCursor = page.nextCursor ?: paginationCursor(messages.firstOrNull())
            }
        }

        private fun historyAccessEnded(error: NetworkError): Boolean =
            error is NetworkError.Forbidden || error == NetworkError.NotFound || error == NetworkError.Unauthorized

        private fun resetRoomSubscriptions() {
            roomJoinJobs.values.forEach { it.cancel() }
            roomJoinJobs.clear()
            joinedRoomIds.clear()
        }

        private fun roomNeedsJoin(roomId: String): Boolean =
            roomId in activeRoomIds && roomId !in joinedRoomIds && socket.connectionState.value == SocketManager.ConnectionState.Connected

        private fun joinActiveRoomsIfPossible() {
            if (socket.connectionState.value != SocketManager.ConnectionState.Connected) return
            val pending = activeRoomIds - joinedRoomIds - roomJoinJobs.keys
            pending.forEach { roomId ->
                val context = historyContext()
                roomJoinJobs[roomId] =
                    viewModelScope.launch {
                        var retryDelay = ROOM_JOIN_RETRY_INITIAL_MS
                        while (context == historyContext() && roomNeedsJoin(roomId)) {
                            val ack = socket.emitWithAck("room:join", JSONObject().put("roomId", roomId))
                            if (context != historyContext() || roomId !in activeRoomIds) break
                            if (ack?.optBoolean("success") == true) {
                                joinedRoomIds.add(roomId)
                                mergeBackfill(parseMessages(ack.optJSONArray("messages")))
                            } else {
                                // A lost ACK must not leave this room permanently marked as joined.
                                delay(retryDelay)
                                retryDelay = (retryDelay * 2).coerceAtMost(ROOM_JOIN_RETRY_MAX_MS)
                            }
                        }
                        roomJoinJobs.remove(roomId)
                        if (context != historyContext()) joinActiveRoomsIfPossible()
                    }
            }
        }

        /**
         * Rows carrying one of our client ids mean those sends landed server-side
         * (e.g. the POST response was lost, then a socket refetch or backfill ran).
         * Retire every trace of each optimistic copy so a delivered message never
         * lingers as "failed" or renders next to a "Failed — Retry" twin.
         * Returns whether anything was retired.
         */
        private fun retireConfirmedSends(rows: List<ChatMessageDto>): Boolean {
            outbox?.acknowledge(rows)
            var retired = false
            rows.forEach { row ->
                val confirmedId = row.clientMessageId ?: return@forEach
                val held =
                    pendingByClientId.containsKey(confirmedId) ||
                        sendContextsByClientId.containsKey(confirmedId) ||
                        failedClientIds.contains(confirmedId)
                if (held) {
                    pendingByClientId.remove(confirmedId)
                    sendContextsByClientId.remove(confirmedId)
                    failedClientIds.remove(confirmedId)
                    retired = true
                }
            }
            return retired
        }

        private fun mergeBackfill(backfill: List<ChatMessageDto>) {
            // Backfill is exactly the gap a lost POST response plus a missed
            // `message:new` echo leaves, so confirmed sends are retired here too.
            refreshUnknownTopics(backfill)
            val retiredPending = retireConfirmedSends(backfill)
            val existing = messages.map { it.id }.toSet()
            // The room backfill carries every topic; a topic view keeps its own.
            val fresh = backfill.filter { !existing.contains(it.id) && matchesTopicFilter(it) && canMerge(it) }
            if (fresh.isEmpty()) {
                if (retiredPending) rebuild()
                return
            }
            changedDuringCatchUp.addAll(fresh.map { it.id })
            messages.addAll(fresh)
            messages.sortWith(messageOrder)
            rebuild()
            scheduleMarkRead()
        }

        private fun applyUpdatedMessage(updated: ChatMessageDto) {
            if (!canMerge(updated)) return
            changedDuringCatchUp.add(updated.id)
            val index = messages.indexOfFirst { it.id == updated.id }
            if (index >= 0) {
                messages[index] = keepingWriter(updated, messages[index])
            } else {
                messages.add(updated)
            }
            rebuild()
        }

        /**
         * A room broadcast never names who wrote for a business (only the writer's own REST reads do), and a message's
         * writer doesn't change, so a broadcast copy keeps the writer this row already had.
         */
        private fun keepingWriter(
            incoming: ChatMessageDto,
            existing: ChatMessageDto,
        ): ChatMessageDto {
            if ((incoming.syncVersion ?: 0) < (existing.syncVersion ?: 0)) return existing
            return incoming.copy(actorUserId = incoming.actorUserId ?: existing.actorUserId, readAt = incoming.readAt ?: existing.readAt)
        }

        private fun applyReactions(
            messageId: String,
            reactions: List<app.pantopus.android.data.api.models.chats.ChatReactionSummary>,
            revision: Long? = null,
        ) {
            val index = messages.indexOfFirst { it.id == messageId }
            if (index < 0) return
            if (revision != null && revision < (messages[index].syncVersion ?: 0)) return
            changedDuringCatchUp.add(messageId)
            messages[index] = messages[index].copy(reactions = reactions, syncVersion = revision ?: messages[index].syncVersion)
            rebuild()
        }

        /**
         * The event's `reactions` carry each reaction's full `users` list; its
         * `reacted_by_me` is the reactor's, so derive it for this viewer and
         * patch the row in place. A full refetch here flipped the thread to a
         * spinner and dropped older pages. Payloads without `users` still fall
         * back to the debounced (300ms) refetch.
         */
        private fun handleReaction(json: JSONObject) {
            val id =
                json.optString("message_id").takeIf { it.isNotEmpty() }
                    ?: json.optString("messageId").takeIf { it.isNotEmpty() } ?: return
            if (messages.none { it.id == id }) return
            val summaries = json.optJSONArray("reactions")?.let(::viewerReactions)
            if (summaries != null) {
                applyReactions(id, summaries, json.optLong("sync_version").takeIf { it > 0 })
                return
            }
            reactionRefetchJob?.cancel()
            reactionRefetchJob =
                viewModelScope.launch {
                    delay(REACTION_REFETCH_DEBOUNCE_MS)
                    fetch(initial = true, quiet = true, force = true)
                }
        }

        /** This viewer's reaction summaries, or null when a reaction carries no `users` list. */
        private fun viewerReactions(array: JSONArray): List<ChatReactionSummary>? {
            val rows = (0 until array.length()).mapNotNull { array.optJSONObject(it) }
            if (rows.any { !it.has("users") }) return null
            return rows.mapNotNull { row ->
                val reaction = row.optString("reaction").takeIf { it.isNotEmpty() } ?: return@mapNotNull null
                val users = row.optJSONArray("users")
                val mine = users != null && (0 until users.length()).any { users.optJSONObject(it)?.optString("id") == currentUserId }
                ChatReactionSummary(reaction = reaction, count = row.optInt("count"), reactedByMe = mine)
            }
        }

        /**
         * `message:new` broadcasts the full serialized message
         * (`backend/routes/chats.js:1771` — serializeChatMessageForViewer
         * spread, the same snake_case shape the REST list returns), so the
         * row merges incrementally instead of refetching the whole page —
         * no Loading flicker. Decode failure falls back to the refetch.
         */
        private fun handleIncoming(json: JSONObject) {
            val roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId")
            if (roomId != null && !activeRoomIds.contains(roomId)) return
            val decoded = decodeSocketMessage(json)
            decoded?.let {
                outbox?.acknowledge(listOf(it))
                refreshUnknownTopics(listOf(it))
            }
            val clientId = json.optString("client_message_id").takeIf { it.isNotEmpty() }
            if (clientId != null && pendingByClientId.containsKey(clientId)) {
                // Echo of our own in-flight send (the broadcast can beat
                // the POST response) — retire the optimistic copy and land
                // the server row directly; no refetch needed.
                pendingByClientId.remove(clientId)
                sendContextsByClientId.remove(clientId)
                failedClientIds.remove(clientId)
                if (decoded != null) {
                    if (matchesTopicFilter(decoded)) insertIncoming(decoded) else rebuild()
                } else {
                    fetch(initial = true, quiet = true, force = true)
                }
                return
            }
            // Our own REST response usually lands first — skip the merge
            // when the broadcast echoes a message we already hold.
            val id = decoded?.id ?: json.optStringValue("id")
            if (id != null && messages.any { it.id == id }) return
            if (decoded != null) {
                // A topic-filtered person view only shows that topic's
                // messages — the old filtered refetch excluded the rest,
                // so the incremental merge must too.
                if (matchesTopicFilter(decoded)) insertIncoming(decoded)
            } else {
                fetch(initial = true, quiet = true, force = true)
            }
        }

        /**
         * Whether [message] belongs in the current view: always true with
         * no topic filter; under a filter, only the selected topic's rows.
         */
        private fun matchesTopicFilter(message: ChatMessageDto): Boolean {
            val selected = _selectedTopicId.value ?: return true
            return message.topicId == selected
        }

        /** Dedupe by id, insert sorted by createdAt, rebuild, mark read. */
        private fun insertIncoming(message: ChatMessageDto) {
            if (!canMerge(message)) return
            changedDuringCatchUp.add(message.id)
            val index = messages.indexOfFirst { it.id == message.id }
            if (index >= 0) {
                messages[index] = keepingWriter(message, messages[index])
            } else {
                messages.add(message)
                messages.sortWith(messageOrder)
            }
            rebuild()
            scheduleMarkRead()
        }

        /**
         * `message:edited` carries `{ messageId, message }` with the full
         * serialized row (`backend/routes/chats.js:1900`) — apply it in
         * place; refetch only if decoding fails.
         */
        private fun handleUpdate(json: JSONObject) {
            val roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId")
            if (roomId != null && !activeRoomIds.contains(roomId)) return
            val id =
                json.optStringValue("id")
                    ?: json.optStringValue("message_id")
                    ?: json.optStringValue("messageId")
                    ?: json.optJSONObject("message")?.optStringValue("id")
                    ?: return
            if (messages.none { it.id == id }) return
            val decoded = json.optJSONObject("message")?.let { decodeSocketMessage(it) }
            if (decoded != null) {
                applyUpdatedMessage(decoded)
            } else {
                fetch(initial = true, quiet = true, force = true)
            }
        }

        /**
         * Decode one socket payload into a [ChatMessageDto] via the same
         * Moshi codegen adapter the REST layer uses (CLAUDE.md: "pass
         * through Moshi with the same @Json annotations"). Null on any
         * decode failure — callers fall back to a full refetch.
         */
        private fun decodeSocketMessage(json: JSONObject): ChatMessageDto? =
            runCatching { socketMessageAdapter.fromJson(json.toString()) }
                .onFailure { Timber.w(it, "socket message decode failed") }
                .getOrNull()

        private fun handleReadReceipt(json: JSONObject) {
            val person = mode as? ChatThreadMode.Person ?: return
            val roomId = json.optStringValue("roomId")
            val reader = json.optStringValue("userId")
            val throughId = json.optStringValue("throughMessageId")
            val readAt = json.optStringValue("readAt")
            if (roomId == null || throughId == null || readAt == null) return
            if (roomId != directRoomId || reader != person.otherUserId) return
            // The last-read cursor is needed: a server clock timestamp alone could mark a newer send as read.
            val through = messages.firstOrNull { it.id == throughId && it.roomId == roomId } ?: return
            messages.replaceAll { message ->
                if (message.roomId == roomId && message.userId == messageIdentityId && messageOrder.compare(message, through) <= 0) {
                    changedDuringCatchUp.add(message.id)
                    message.copy(readAt = message.readAt ?: readAt)
                } else {
                    message
                }
            }
            rebuild()
        }

        private fun applyReadReceipt(receipt: ChatReadReceipt) {
            val person = mode as? ChatThreadMode.Person ?: return
            if (receipt.roomId != directRoomId || receipt.userId != person.otherUserId) return
            val through =
                ChatMessageDto(id = receipt.throughMessageId, roomId = receipt.roomId, createdAt = receipt.throughCreatedAt)
            messages.replaceAll { message ->
                if (message.roomId == receipt.roomId && message.userId == messageIdentityId &&
                    messageOrder.compare(message, through) <= 0
                ) {
                    message.copy(readAt = message.readAt ?: receipt.readAt)
                } else {
                    message
                }
            }
        }

        private fun handleDelete(json: JSONObject) {
            val roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId")
            if (roomId != null && !activeRoomIds.contains(roomId)) return
            val id =
                json.optStringValue("id")
                    ?: json.optStringValue("message_id")
                    ?: json.optStringValue("messageId")
                    ?: return
            rememberDeletion(id, json.optLong("sync_version").takeIf { it > 0 })
            rebuild()
        }

        private suspend fun uploadQueuedAttachmentsIfNeeded(
            roomId: String,
            clientId: String,
        ): List<String> {
            val files =
                _queuedAttachments.value.mapNotNull { attachment ->
                    val bytes = attachment.bytes ?: return@mapNotNull null
                    UploadFile(
                        filename = attachment.filename,
                        mimeType = attachment.mimeType,
                        bytes = bytes,
                    )
                }
            if (files.isEmpty()) return emptyList()
            return when (val result = uploadRepo.uploadChatMedia(roomId, files, clientRequestId = clientId)) {
                is NetworkResult.Success -> result.data.media.map { it.id }
                is NetworkResult.Failure -> throw IllegalStateException(result.error.message)
            }
        }

        /**
         * The person's photos and PDFs, uploaded first: their references, or null when the upload failed. Then nothing
         * went, and the composer keeps the words and the files for another try, except a file the server refused: that
         * one leaves, and the server's reason stays above the composer.
         */
        private suspend fun uploadAIMessageFiles(
            text: String,
            queued: List<ChatQueuedAttachment>,
        ): List<String>? {
            val error =
                when (val upload = uploadAIMedia(queued)) {
                    is NetworkResult.Success -> return upload.data
                    is NetworkResult.Failure -> upload.error
                }
            if (_composerText.value.isEmpty()) _composerText.value = text
            val refusal = aiUploadRefusal(error)
            if (refusal == null) {
                _actionFailure.value = error.displayMessage("Couldn't send your files. Try again.")
                return null
            }
            // Sent again, it would be refused again: it leaves the queue. A snackbar would be gone before the reason is read.
            refusedAIFile(refusal, queued)?.let { refused ->
                _queuedAttachments.value = _queuedAttachments.value.filterNot { it.id == refused.id }
            }
            _sendLimitNotice.value = refusal.message
            return null
        }

        /**
         * [attachments]' photos and PDFs through `POST /api/upload/ai-media`, as the references the chat's `images`
         * carries (AI assistant phase 2 §7.1); nothing to send needs no request.
         */
        private suspend fun uploadAIMedia(attachments: List<ChatQueuedAttachment>): NetworkResult<List<String>> {
            val files =
                attachments.mapNotNull { attachment ->
                    val bytes = attachment.bytes ?: return@mapNotNull null
                    if (!attachment.mimeType.startsWith("image/") && attachment.mimeType != PDF_MIME) return@mapNotNull null
                    UploadFile(
                        filename = attachment.filename,
                        mimeType = attachment.mimeType,
                        bytes = bytes,
                    )
                }
            if (files.isEmpty()) return NetworkResult.Success(emptyList())
            return when (val result = uploadRepo.uploadAIMedia(files)) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.images.map { it.url })
                is NetworkResult.Failure -> result
            }
        }

        // MARK: - Projection

        private fun rebuild() {
            historyRefusal?.let {
                _state.value = ChatConversationUiState.Error(it)
                return
            }
            if (historyCopyContext == historyContext()) {
                // In the server's shape (no cursor without older messages, its room list), so unchanged is equal.
                val page = historyPage
                updateHistoryCopy?.invoke(
                    ChatMessagesResponse(
                        messages = messages.toList(),
                        hasMore = hasMore,
                        nextCursor = oldestCursor.takeIf { hasMore },
                        roomIds = if (page != null) page.roomIds else activeRoomIds.toList(),
                        sendRefusal = page?.sendRefusal,
                        syncCursors = page?.syncCursors.orEmpty(),
                        deletedMessageVersions = deletedMessageVersions.toMap(),
                    ),
                )
            }
            val combined = messages + pendingByClientId.values.filter(::matchesTopicFilter)
            val messagesById = combined.associateBy { it.id }
            if (combined.isEmpty()) {
                _state.value = ChatConversationUiState.Empty
                return
            }
            val rows = mutableListOf<ChatTimelineRow>()
            var lastDayKey: String? = null
            // Topic dividers mark where the thread switches topics — only on
            // the unfiltered ("All") person view, where messages from every
            // topic interleave. A topic filter or room thread stays clean.
            val showTopicDividers =
                mode is ChatThreadMode.Person && _selectedTopicId.value == null && _topics.value.isNotEmpty()
            val topicTitlesById = _topics.value.associate { it.id to it.title }
            combined.forEachIndexed { index, message ->
                val dayKey = dayKey(message.createdAt)
                if (dayKey != lastDayKey) {
                    rows.add(ChatTimelineRow.DayDivider(ChatDayDivider(id = dayKey, label = dayLabel(message.createdAt))))
                    lastDayKey = dayKey
                }
                if (showTopicDividers && index > 0 && combined[index - 1].topicId != message.topicId) {
                    rows.add(
                        ChatTimelineRow.TopicDivider(
                            id = message.id,
                            label = message.topicId?.let { topicTitlesById[it] } ?: "General",
                        ),
                    )
                }
                if (message.resolvedType == "broadcast_reference") {
                    rows.add(ChatTimelineRow.BroadcastReference(broadcastReferenceOf(message)))
                    return@forEachIndexed
                }
                if (message.resolvedType == "system") {
                    rows.add(ChatTimelineRow.SystemNote(message.id, message.resolvedText))
                    return@forEachIndexed
                }
                val side = if (message.userId == messageIdentityId) ChatMessageSide.Outgoing else ChatMessageSide.Incoming
                val previousSameSide = sharesBubbleGroup(message, combined.getOrNull(index - 1))
                val nextSameSide = sharesBubbleGroup(message, combined.getOrNull(index + 1))
                val hasTail = !nextSameSide
                val deliveryState =
                    if (side != ChatMessageSide.Outgoing) {
                        null
                    } else if (message.clientMessageId != null && failedClientIds.contains(message.clientMessageId)) {
                        if (refusedClientIds.contains(message.clientMessageId)) {
                            ChatDeliveryState.Refused
                        } else {
                            ChatDeliveryState.Failed
                        }
                    } else if (message.id.startsWith("client_")) {
                        ChatDeliveryState.Sending
                    } else if (message.readAt != null) {
                        ChatDeliveryState.Read
                    } else {
                        ChatDeliveryState.Sent
                    }
                // The stamp row is the ONLY surface for "Failed to send" +
                // Retry and the "Sending..." spinner — force it for in-flight
                // and failed sends even when a same-sender follow-up strips
                // the group tail. Tail visuals stay driven by [hasTail].
                val showStamp =
                    hasTail ||
                        deliveryState == ChatDeliveryState.Failed ||
                        deliveryState == ChatDeliveryState.Refused ||
                        deliveryState == ChatDeliveryState.Sending
                val stamp = if (showStamp) stampLabel(message) else null
                val body = bodyOf(message)
                val replyPreview = replyPreviewOf(message, messagesById)
                val reactions =
                    message.reactions.map {
                        ChatBubbleReaction(
                            reaction = it.reaction,
                            count = it.count,
                            reactedByMe = it.reactedByMe,
                        )
                    }
                rows.add(
                    ChatTimelineRow.Bubble(
                        ChatBubbleContent(
                            id = message.id,
                            side = side,
                            body = body,
                            replyPreview = replyPreview,
                            reactions = reactions,
                            hasTail = hasTail,
                            stamp = stamp,
                            deliveryState = deliveryState,
                            lockedTier = lockedTierOf(message),
                            sentSupportTier = sentSupportTierOf(message),
                            isContinuation = previousSameSide,
                            senderName =
                                if (mode is ChatThreadMode.Room && side == ChatMessageSide.Incoming) {
                                    message.sender?.displayLabel?.takeIf { it.isNotBlank() } ?: "Participant"
                                } else {
                                    null
                                },
                            attachments = message.attachments,
                        ),
                    ),
                )
            }
            _state.value = ChatConversationUiState.Loaded(rows)
            resolveScrollTarget(rows)
        }

        /**
         * Resolve the Chat Search scroll target once: if the deep-linked
         * message is in the loaded page, publish its row id for the screen
         * to scroll to. The match is guaranteed present because search
         * indexes the same most-recent page the conversation loads.
         */
        private fun resolveScrollTarget(rows: List<ChatTimelineRow>) {
            if (didResolveScrollTarget) return
            val target = scrollToMessageId ?: return
            val rowId = "bubble_$target"
            if (rows.none { it.rowId == rowId }) return
            didResolveScrollTarget = true
            _pendingScrollTarget.value = rowId
        }

        /**
         * Photos and files keep the text sent with them as a caption, and every
         * photo in the message shows, not just the first attachment.
         */
        private fun attachmentBodyOf(message: ChatMessageDto): ChatBubbleBody? {
            val attachments = message.attachments
            if (attachments.isEmpty()) return null
            val caption = message.resolvedText.trim().takeIf { it.isNotEmpty() && !ATTACHMENT_PLACEHOLDER.matches(it) }
            val photoUrls =
                attachments
                    .filter { it.mimeType.orEmpty().startsWith("image/") }
                    .mapNotNull { ChatMediaUrl.resolve(it.fileUrl) }
            if (photoUrls.isNotEmpty()) {
                return ChatBubbleBody.Image(url = photoUrls.first(), caption = caption, moreUrls = photoUrls.drop(1))
            }
            val file = attachments.first()
            return ChatBubbleBody.Attachment(
                filename = file.originalFilename ?: "Attachment",
                sizeLabel = file.fileSize?.let(::fileSizeLabel),
                caption = caption,
                fileUrl = file.fileUrl,
                mimeType = file.mimeType,
            )
        }

        private fun bodyOf(message: ChatMessageDto): ChatBubbleBody =
            attachmentBodyOf(message) ?: when (message.resolvedType) {
                "ai_reply" ->
                    ChatBubbleBody.AiReply(
                        text = message.resolvedText,
                        estimate = null,
                        drafts = aiDraftsByMessageId[message.id].orEmpty(),
                        status = aiStatus.takeIf { message.id == streamingAssistantId },
                        // A link this version can't open shows no button.
                        links = aiLinksByMessageId[message.id].orEmpty().filter { DeepLinkRouter.canRoute(it.url) },
                    )
                "text" -> {
                    val imageUrls =
                        aiSentPhotos[message.id]
                            ?: (message.metadata?.get("image_urls") as? List<*>)
                                ?.filterIsInstance<String>()
                                ?.mapNotNull(ChatMediaUrl::resolve)
                                .orEmpty()
                    val files = aiSentFiles[message.id].orEmpty()
                    if (imageUrls.isNotEmpty() || files.isNotEmpty()) {
                        ChatBubbleBody.TextWithImages(message.resolvedText, imageUrls, files)
                    } else {
                        ChatBubbleBody.Text(message.resolvedText)
                    }
                }
                "image" ->
                    ChatBubbleBody.Image(
                        ChatMediaUrl.resolve(message.metadata?.get("image_url") as? String),
                    )
                "file", "audio" ->
                    ChatBubbleBody.Attachment(
                        filename = (message.metadata?.get("filename") as? String) ?: "Attachment",
                    )
                "gig_offer" -> {
                    val meta = message.metadata
                    val gigId =
                        metadataString(meta, "gigId", "gig_id")
                            ?: extractEntityId(message.resolvedText, "gigs")
                    val title = metadataString(meta, "title") ?: message.resolvedText.ifEmpty { null } ?: "Shared gig"
                    ChatBubbleBody.GigOfferCard(
                        ChatGigOfferCard(
                            gigId = gigId.orEmpty(),
                            title = title,
                            category = metadataString(meta, "category"),
                            priceLabel = metadataPriceLabel(meta),
                            status = metadataString(meta, "status"),
                        ),
                    )
                }
                "listing_offer" -> {
                    val meta = message.metadata
                    val listingId =
                        metadataString(meta, "listingId", "listing_id")
                            ?: extractEntityId(message.resolvedText, "listings")
                    val title = metadataString(meta, "title") ?: message.resolvedText.ifEmpty { null } ?: "Shared listing"
                    val isFree = metadataBool(meta, "isFree", "is_free") == true
                    ChatBubbleBody.ListingOfferCard(
                        ChatListingOfferCard(
                            listingId = listingId.orEmpty(),
                            title = title,
                            category = metadataString(meta, "category"),
                            priceLabel = metadataListingPriceLabel(meta, isFree),
                            condition = metadataString(meta, "condition"),
                            imageUrl = metadataString(meta, "imageUrl", "image_url"),
                        ),
                    )
                }
                "location" -> {
                    val meta = message.metadata
                    ChatBubbleBody.LocationCard(
                        ChatLocationCard(
                            latitude = metadataDouble(meta, "latitude", "lat") ?: 0.0,
                            longitude = metadataDouble(meta, "longitude", "lng", "lon") ?: 0.0,
                            address = metadataString(meta, "address") ?: message.resolvedText.ifEmpty { null } ?: "Pinned location",
                        ),
                    )
                }
                else -> ChatBubbleBody.Text(message.resolvedText)
            }

        private fun fileSizeLabel(bytes: Int): String =
            when {
                bytes >= 1_000_000 -> String.format("%.1f MB", bytes.toDouble() / 1_000_000)
                bytes >= 1_000 -> "${bytes / 1_000} KB"
                else -> "$bytes B"
            }

        private fun replyPreviewOf(
            message: ChatMessageDto,
            allMessages: Map<String, ChatMessageDto>,
        ): ChatReplyPreview? {
            val replyToId = message.replyToId ?: return null
            val original = allMessages[replyToId] ?: return null
            return ChatReplyPreview(
                messageId = original.id,
                senderName = replyNameOf(original),
                text = original.resolvedText,
            )
        }

        /**
         * Who a reply quotes: "You" for a message sent as this viewer's identity (the business in its inbox),
         * as those bubbles and stamps carry no name, else the sender's name.
         */
        private fun replyNameOf(message: ChatMessageDto): String =
            if (message.userId == messageIdentityId) "You" else message.sender?.displayLabel ?: "Message"

        private fun lockedTierOf(message: ChatMessageDto): String? {
            val metadata = message.metadata ?: return null
            val isLocked =
                metadata["tier_locked"] as? Boolean
                    ?: metadata["is_locked"] as? Boolean
                    ?: metadata["locked"] as? Boolean
                    ?: false
            if (!isLocked) return null
            return metadata["required_tier"] as? String
                ?: metadata["locked_tier"] as? String
                ?: metadata["tier"] as? String
                ?: "Silver"
        }

        private fun sentSupportTierOf(message: ChatMessageDto): String? {
            val metadata = message.metadata ?: return null
            return metadata["sent_support_tier"] as? String
                ?: metadata["support_tier"] as? String
                ?: metadata["paid_support_tier"] as? String
        }

        private fun broadcastReferenceOf(message: ChatMessageDto): ChatBroadcastReference =
            ChatBroadcastReference(
                id = message.id,
                title = (message.metadata?.get("title") as? String) ?: "Broadcast referenced",
                subtitle =
                    (message.metadata?.get("subtitle") as? String)
                        ?: "This conversation started from a creator broadcast.",
                metric = (message.metadata?.get("metric") as? String) ?: "Audience update",
            )

        /**
         * Optimistic local row. Its `id` keeps the `client_` prefix — the
         * projection and screen key "still sending" off that — while
         * `clientMessageId` stays a bare UUID for the wire. A reply quotes its
         * original while it sends, when the send will carry that reply.
         */
        private fun optimistic(
            text: String,
            clientId: String,
            roomId: String,
            replyToId: String?,
        ): ChatMessageDto =
            ChatMessageDto(
                id = "client_$clientId",
                roomId = roomId,
                userId = messageIdentityId,
                messageText = text,
                messageType = "text",
                topicId = _selectedTopicId.value,
                replyToId = sanitizedReplyToId(replyToId, roomId),
                clientMessageId = clientId,
                createdAt = Instant.now().toString(),
                sender =
                    ChatMessageSender(
                        id = messageIdentityId,
                        username = null,
                        name = null,
                        profilePictureUrl = null,
                    ),
            )

        /** An assistant-thread message, dated now unless it was restored with its time. */
        private fun localMessage(
            id: String,
            text: String,
            userId: String,
            type: String,
            createdAt: String? = null,
        ): ChatMessageDto =
            ChatMessageDto(
                id = id,
                roomId = "ai",
                userId = userId,
                messageText = text,
                messageType = type,
                createdAt = createdAt ?: Instant.now().toString(),
            )

        private fun replaceLocalMessage(
            id: String,
            text: String,
            type: String,
            userId: String,
        ) {
            val index = messages.indexOfFirst { it.id == id }
            if (index < 0) return
            messages[index] = localMessage(id = id, text = text, userId = userId, type = type)
            rebuild()
        }

        private fun parseMessages(array: JSONArray?): List<ChatMessageDto> {
            if (array == null) return emptyList()
            return buildList {
                for (index in 0 until array.length()) {
                    val json = array.optJSONObject(index) ?: continue
                    val decoded = decodeSocketMessage(json)
                    if (decoded != null) {
                        add(decoded)
                        continue
                    }
                    add(
                        ChatMessageDto(
                            id = json.optStringValue("id") ?: continue,
                            roomId = json.optStringValue("room_id") ?: json.optStringValue("roomId") ?: continue,
                            userId = json.optStringValue("user_id") ?: json.optStringValue("userId"),
                            messageText =
                                json.optStringValue("message_text")
                                    ?: json.optStringValue("messageText")
                                    ?: json.optStringValue("message"),
                            message =
                                json.optStringValue("message")
                                    ?: json.optStringValue("message_text")
                                    ?: json.optStringValue("messageText"),
                            messageType =
                                json.optStringValue("message_type")
                                    ?: json.optStringValue("messageType")
                                    ?: json.optStringValue("type"),
                            type =
                                json.optStringValue("type")
                                    ?: json.optStringValue("message_type")
                                    ?: json.optStringValue("messageType"),
                            topicId = json.optStringValue("topic_id") ?: json.optStringValue("topicId"),
                            clientMessageId = json.optStringValue("client_message_id") ?: json.optStringValue("clientMessageId"),
                            createdAt = json.optStringValue("created_at") ?: json.optStringValue("createdAt") ?: continue,
                        ),
                    )
                }
            }
        }

        private fun messageInstant(iso: String): Instant =
            messageTimes.get(iso) ?: runCatching { Instant.parse(iso.replace("+00:00", "Z")) }
                .getOrDefault(Instant.EPOCH).also {
                    if (messageTimes.size >= 2_048) messageTimes.remove(messageTimes.keys.first())
                    messageTimes[iso] = it
                }

        private fun dayKey(iso: String): String =
            runCatching { Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate().toString() }
                .getOrDefault(iso)

        private fun dayLabel(iso: String): String =
            runCatching {
                val date = Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()
                val today = java.time.LocalDate.now()
                when (date) {
                    today -> "Today"
                    today.minusDays(1) -> "Yesterday"
                    else -> date.format(dayFormatter).uppercase()
                }
            }.getOrDefault(iso)

        /** System notices break message groups even when they carry the same actor id. */
        private fun sharesBubbleGroup(
            message: ChatMessageDto,
            neighbor: ChatMessageDto?,
        ): Boolean =
            neighbor != null && neighbor.resolvedType !in setOf("system", "broadcast_reference") &&
                neighbor.userId == message.userId && dayKey(neighbor.createdAt) == dayKey(message.createdAt)

        private fun stampLabel(message: ChatMessageDto): String? =
            runCatching {
                val time =
                    Instant
                        .parse(message.createdAt)
                        .atZone(ZoneId.systemDefault())
                        .format(stampFormatter)
                // Replies sent as the business are this viewer's own outgoing messages here.
                if (message.userId == messageIdentityId) {
                    time
                } else {
                    val sender = message.sender?.displayLabel?.takeIf { it.isNotEmpty() }
                    sender?.let { "$it · $time" } ?: time
                }
            }.getOrNull()

        private fun metadataString(
            metadata: Map<String, Any>?,
            vararg keys: String,
        ): String? {
            if (metadata == null) return null
            for (key in keys) {
                val value = metadata[key] as? String
                if (!value.isNullOrBlank()) return value
            }
            return null
        }

        private fun metadataDouble(
            metadata: Map<String, Any>?,
            vararg keys: String,
        ): Double? {
            if (metadata == null) return null
            for (key in keys) {
                when (val value = metadata[key]) {
                    is Number -> return value.toDouble()
                    is String -> value.toDoubleOrNull()?.let { return it }
                }
            }
            return null
        }

        private fun metadataBool(
            metadata: Map<String, Any>?,
            vararg keys: String,
        ): Boolean? {
            if (metadata == null) return null
            for (key in keys) {
                when (val value = metadata[key]) {
                    is Boolean -> return value
                }
            }
            return null
        }

        private fun metadataPriceLabel(metadata: Map<String, Any>?): String? {
            val raw = metadataDouble(metadata, "price") ?: return null
            return "$${raw.toInt()}"
        }

        private fun metadataListingPriceLabel(
            metadata: Map<String, Any>?,
            isFree: Boolean,
        ): String {
            if (isFree) return "FREE"
            val raw = metadataDouble(metadata, "price") ?: return "Make Offer"
            return "$${raw.toInt()}"
        }

        private fun extractEntityId(
            text: String?,
            collection: String,
        ): String? {
            if (text.isNullOrBlank()) return null
            val pattern = Regex("""/$collection/([A-Za-z0-9-]+)""")
            return pattern.find(text)?.groupValues?.getOrNull(1)
        }

        /** Stable `(created_at|id)` cursor — avoids `+` offsets mangled in query strings. */
        private fun paginationCursor(message: ChatMessageDto?): String? {
            val createdAt = message?.createdAt ?: return null
            val id = message.id
            val timestamp =
                createdAt
                    .replace("+00:00", "Z")
                    .replace("+0000", "Z")
            return "$timestamp|$id"
        }
    }

// A JSON null is absent: optString() alone returns the text "null" for it.
private fun JSONObject.optStringValue(key: String): String? = if (isNull(key)) null else optString(key).takeIf { it.isNotEmpty() }

/** Banner copy for the pre-bid gig-room send limit (429 `PRE_BID_LIMIT`). */
private const val PRE_BID_LIMIT_NOTICE =
    "Message limit reached — place a bid or wait for acceptance to keep chatting."

/** Launch cut #4 (Open Gigs): bidding is hidden, so the limit banner doesn't suggest a bid. */
private const val PRE_BID_LIMIT_NOTICE_NO_BIDS = "Message limit reached — wait for acceptance to keep chatting."

private fun preBidLimitNotice(): String = if (LaunchFeatures.openGigs) PRE_BID_LIMIT_NOTICE else PRE_BID_LIMIT_NOTICE_NO_BIDS

private const val SEND_REFUSED_NOTICE = "You can't send messages in this conversation."

/**
 * Text the server fills in for a message that is only attachments ("Photo",
 * "Document"), or an older client's "[1 attachment]"; not a caption.
 */
private val ATTACHMENT_PLACEHOLDER = Regex("""^(\[.+ attachments?]|Photo|Video|Document|Media)$""", RegexOption.IGNORE_CASE)

/** The documents the assistant reads (AI assistant phase 2 §7.1). */
private const val PDF_MIME = "application/pdf"

/**
 * Min gap between `typing:start` emits. The backend rate-limits the event
 * to 10/min per socket and silently drops the excess
 * (backend/socket/chatSocketio.js:23), so the throttle must be ≥6s to
 * bound continuous typing at the cap.
 */
// Backend Joi cap for report `details` (`backend/routes/users.js:4140`).
private const val MAX_REPORT_DETAILS = 1000

private const val TYPING_EMIT_THROTTLE_MS = 6_000L

/** Clear a stale counterparty typing indicator after this long. */
private const val TYPING_AUTO_CLEAR_MS = 5_000L

/** Collapse `message:reaction_updated` bursts into one refetch. */
private const val REACTION_REFETCH_DEBOUNCE_MS = 300L

/** Refresh cadence while the socket is disconnected (fallback polling). */
private const val SOCKET_FALLBACK_INITIAL_MS = 2_000L
private const val SOCKET_FALLBACK_POLL_MS = 15_000L
private const val ROOM_JOIN_RETRY_INITIAL_MS = 1_000L
private const val ROOM_JOIN_RETRY_MAX_MS = 15_000L

private val dayFormatter = DateTimeFormatter.ofPattern("MMM d")
private val stampFormatter = DateTimeFormatter.ofPattern("h:mm a")

/** How many lists of 50 "Delete conversation" works through before it gives up. */
private const val AI_DELETE_ROUNDS = 20

private const val AI_DELETE_FAILED = "Couldn't delete the conversation. Try again."

private const val AI_DELETE_TOO_MANY = "Couldn't delete it all yet. Try again in a minute."

private const val HTTP_TOO_MANY_REQUESTS = 429

private const val HTTP_REQUEST_TIMEOUT = 408

/**
 * `ai-media` turning the upload down for what was sent (a locked PDF, a file that isn't what it says), not a lost
 * connection, a busy server or too many uploads, which another Send may get past.
 */
private class AIUploadRefusal(
    /** The server's own sentence. */
    val message: String,
    /** `PDF_ENCRYPTED`, … */
    val code: String?,
    /** Its `error` text, which names the file when the refusal is about one. */
    val error: String?,
)

private fun aiUploadRefusal(error: NetworkError): AIUploadRefusal? {
    if (error !is NetworkError.ClientError || error.code == HTTP_REQUEST_TIMEOUT || error.code == HTTP_TOO_MANY_REQUESTS) return null
    val json = error.body?.let { runCatching { JSONObject(it) }.getOrNull() }
    return AIUploadRefusal(message = error.message, code = json?.optStringValue("code"), error = json?.optStringValue("error"))
}

/**
 * The file a refusal is about: the one it names (`File "name" …`), else, for a PDF the server can't read (`PDF_…`),
 * the only PDF sent; null when it can't tell (two PDFs, say), and then every file stays.
 */
private fun refusedAIFile(
    refusal: AIUploadRefusal,
    among: List<ChatQueuedAttachment>,
): ChatQueuedAttachment? {
    val named = refusal.error?.let { error -> among.firstOrNull { error.contains("File \"${it.filename}\"") } }
    if (named != null || refusal.code?.startsWith("PDF_") != true) return named
    return among.filter { it.mimeType == PDF_MIME }.singleOrNull()
}

/** The body, or the failure thrown, for a run of calls that stops at the first one. */
private fun <T> NetworkResult<T>.orThrow(): T =
    when (this) {
        is NetworkResult.Success -> data
        is NetworkResult.Failure -> throw error
    }

private const val MAX_CHANGE_PAGES = 100
private const val MAX_TOMBSTONES = 2000
