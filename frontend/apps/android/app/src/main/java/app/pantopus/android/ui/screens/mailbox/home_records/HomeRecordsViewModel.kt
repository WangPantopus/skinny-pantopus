@file:Suppress("PackageNaming", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.home_records

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.p3.AssetDetectionDto
import app.pantopus.android.data.api.models.mailbox.p3.AssetLinkedMailDto
import app.pantopus.android.data.api.models.mailbox.p3.HomeAssetSummaryDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.data.mailbox.MailboxRecordsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import kotlin.math.roundToInt

/**
 * Asset category → glyph. Backend column values are `appliance` /
 * `structure` / `system` / `vehicle` / `other` (`HomeAsset.category`,
 * defaulted at `backend/routes/mailboxV2Phase3.js:217`).
 */
enum class RecordAssetCategory(
    val slug: String,
    val icon: PantopusIcon,
) {
    APPLIANCE("appliance", PantopusIcon.Refrigerator),
    STRUCTURE("structure", PantopusIcon.Home),
    SYSTEM("system", PantopusIcon.Wrench),
    VEHICLE("vehicle", PantopusIcon.Car),
    OTHER("other", PantopusIcon.Package),
    ;

    companion object {
        fun fromRaw(raw: String?): RecordAssetCategory = entries.firstOrNull { it.slug == raw } ?: OTHER
    }
}

/**
 * Server-computed warranty state (`warrantyStatus`,
 * `backend/routes/mailboxV2Phase3.js:167`).
 */
enum class RecordWarrantyStatus(
    val slug: String,
    val label: String,
) {
    ACTIVE("active", "Active"),
    EXPIRING_SOON("expiring_soon", "Expiring soon"),
    EXPIRED("expired", "Expired"),
    NONE("none", "None"),
    ;

    companion object {
        fun fromRaw(raw: String?): RecordWarrantyStatus = entries.firstOrNull { it.slug == raw } ?: NONE
    }
}

/** One row in the asset index. */
data class HomeRecordAsset(
    val id: String,
    val name: String,
    val category: RecordAssetCategory,
    val room: String?,
    val manufacturer: String?,
    val modelNumber: String?,
    val purchasedLabel: String?,
    val warranty: RecordWarrantyStatus,
    val linkedMailCount: Int,
)

/** A mail item linked to an asset. */
data class HomeRecordMailRow(
    val id: String,
    val subject: String,
    val senderName: String?,
    val deliveredLabel: String?,
)

/** One auto-detect hit / link suggestion. */
data class HomeRecordSuggestion(
    /** Source mail id — the natural key and the `mailId` sent to the link route. */
    val id: String,
    val candidateName: String,
    val candidateBrand: String?,
    /** 0…100, rounded from the backend's 0…1 `confidence`. */
    val confidencePercent: Int,
)

/**
 * The most recent link result, kept so the screen can offer an Undo. The
 * asset-mail drill-down does not return the `MailAssetLink` primary key,
 * so the link response is the only place the id needed by the unlink
 * route is exposed.
 */
data class HomeRecordUndoableLink(
    val linkId: String,
    val assetName: String,
)

/** Render states for the asset index. */
sealed interface HomeRecordsUiState {
    data object Loading : HomeRecordsUiState

    data class Loaded(
        val assets: List<HomeRecordAsset>,
        val rooms: List<String>,
    ) : HomeRecordsUiState

    data object Empty : HomeRecordsUiState

    data class Error(
        val message: String,
    ) : HomeRecordsUiState
}

/** Render states for the per-asset mail drill-down. */
sealed interface AssetDetailUiState {
    data object Loading : AssetDetailUiState

    data class Loaded(
        val mail: List<HomeRecordMailRow>,
        val photoCount: Int,
    ) : AssetDetailUiState

    data class Error(
        val message: String,
    ) : AssetDetailUiState
}

/**
 * Home Records view-model — the linked-asset hub behind the Mailbox.
 * Backed by `backend/routes/mailboxV2Phase3.js`:
 * `GET records/assets` (182), `GET records/asset/:id/mail` (238),
 * `POST records/auto-detect` (338), `GET records/suggestions` (380),
 * `POST records/link` (296), `DELETE records/unlink/:id` (323).
 *
 * Mirrors iOS `HomeRecordsViewModel`.
 */
@HiltViewModel
class HomeRecordsViewModel
    @Inject
    constructor(
        private val repository: MailboxRecordsRepository,
        private val homesRepository: HomesRepository,
        networkMonitor: NetworkMonitor,
    ) : ViewModel() {
        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        private val _state = MutableStateFlow<HomeRecordsUiState>(HomeRecordsUiState.Loading)
        val state: StateFlow<HomeRecordsUiState> = _state.asStateFlow()

        /** Selected room chip; null is "All". */
        private val _roomFilter = MutableStateFlow<String?>(null)
        val roomFilter: StateFlow<String?> = _roomFilter.asStateFlow()

        private val _isScanning = MutableStateFlow(false)
        val isScanning: StateFlow<Boolean> = _isScanning.asStateFlow()

        private val _detections = MutableStateFlow<List<HomeRecordSuggestion>>(emptyList())
        val detections: StateFlow<List<HomeRecordSuggestion>> = _detections.asStateFlow()

        private val _showsSuggestions = MutableStateFlow(false)
        val showsSuggestions: StateFlow<Boolean> = _showsSuggestions.asStateFlow()

        private val _isLoadingSuggestions = MutableStateFlow(false)
        val isLoadingSuggestions: StateFlow<Boolean> = _isLoadingSuggestions.asStateFlow()

        private val _suggestions = MutableStateFlow<List<HomeRecordSuggestion>>(emptyList())
        val suggestions: StateFlow<List<HomeRecordSuggestion>> = _suggestions.asStateFlow()

        /** Mail id awaiting an asset choice in the "link to…" picker. */
        private val _pendingLinkMailId = MutableStateFlow<String?>(null)
        val pendingLinkMailId: StateFlow<String?> = _pendingLinkMailId.asStateFlow()

        private val _undoableLink = MutableStateFlow<HomeRecordUndoableLink?>(null)
        val undoableLink: StateFlow<HomeRecordUndoableLink?> = _undoableLink.asStateFlow()

        /** In-screen asset drill-down, matching RN `records.tsx:109`. */
        private val _selectedAsset = MutableStateFlow<HomeRecordAsset?>(null)
        val selectedAsset: StateFlow<HomeRecordAsset?> = _selectedAsset.asStateFlow()

        private val _detailState = MutableStateFlow<AssetDetailUiState>(AssetDetailUiState.Loading)
        val detailState: StateFlow<AssetDetailUiState> = _detailState.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var onOpenMail: (String) -> Unit = {}
        private var onBack: () -> Unit = {}

        /**
         * Resolved from `GET api/homes/my-homes`; required by the
         * auto-detect validator (`backend/routes/mailboxV2Phase3.js:26`).
         */
        private var homeId: String? = null

        fun configureNavigation(
            onOpenMail: (String) -> Unit = {},
            onBack: () -> Unit = {},
        ) {
            this.onOpenMail = onOpenMail
            this.onBack = onBack
        }

        /** Back walks out of the drill-down first, then off the screen. */
        fun tapBack() {
            if (_selectedAsset.value != null) {
                _selectedAsset.value = null
            } else {
                onBack()
            }
        }

        fun openMail(mailId: String) = onOpenMail(mailId)

        fun consumeToast() {
            _toast.value = null
        }

        // ─── Index ─────────────────────────────────────────────────

        fun load() {
            if (_state.value is HomeRecordsUiState.Loaded) return
            _state.value = HomeRecordsUiState.Loading
            viewModelScope.launch { fetchAssets() }
        }

        fun refresh() {
            viewModelScope.launch { fetchAssets() }
        }

        fun selectRoom(room: String?) {
            _roomFilter.value = room
        }

        /** Assets after the room chip filter (RN `records.tsx:94`). */
        fun filteredAssets(): List<HomeRecordAsset> {
            val loaded = _state.value as? HomeRecordsUiState.Loaded ?: return emptyList()
            val room = _roomFilter.value ?: return loaded.assets
            return loaded.assets.filter { it.room == room }
        }

        /** Every loaded asset, ignoring the room chip — the link picker needs all. */
        fun allAssets(): List<HomeRecordAsset> = (_state.value as? HomeRecordsUiState.Loaded)?.assets ?: emptyList()

        private suspend fun fetchAssets() {
            resolveHomeIdIfNeeded()
            when (val result = repository.assets(homeId)) {
                is NetworkResult.Success -> {
                    val assets = result.data.assets.map(::project)
                    val rooms = result.data.rooms.orEmpty().sorted()
                    if (_roomFilter.value != null && !rooms.contains(_roomFilter.value)) {
                        _roomFilter.value = null
                    }
                    _state.value =
                        if (assets.isEmpty()) {
                            HomeRecordsUiState.Empty
                        } else {
                            HomeRecordsUiState.Loaded(assets, rooms)
                        }
                }

                is NetworkResult.Failure ->
                    _state.value = HomeRecordsUiState.Error(result.error.message)
            }
        }

        private suspend fun resolveHomeIdIfNeeded() {
            if (homeId != null) return
            // Non-fatal: the assets route falls back to every accessible
            // home when homeId is omitted. Only auto-detect strictly needs it.
            homeId = (homesRepository.myHomes() as? NetworkResult.Success)?.data?.homes?.firstOrNull()?.id
        }

        // ─── Asset drill-down ──────────────────────────────────────

        fun openAsset(asset: HomeRecordAsset) {
            _selectedAsset.value = asset
            _detailState.value = AssetDetailUiState.Loading
            viewModelScope.launch { fetchAssetDetail(asset.id) }
        }

        fun closeAsset() {
            _selectedAsset.value = null
        }

        fun retryAssetDetail() {
            val assetId = _selectedAsset.value?.id ?: return
            _detailState.value = AssetDetailUiState.Loading
            viewModelScope.launch { fetchAssetDetail(assetId) }
        }

        private suspend fun fetchAssetDetail(assetId: String) {
            _detailState.value =
                when (val result = repository.assetMail(assetId)) {
                    is NetworkResult.Success ->
                        AssetDetailUiState.Loaded(
                            mail = result.data.mail.orEmpty().map(::projectMail),
                            photoCount = result.data.photos.orEmpty().size,
                        )

                    is NetworkResult.Failure -> AssetDetailUiState.Error(result.error.message)
                }
        }

        // ─── Auto-detect scan ──────────────────────────────────────

        /**
         * RN `records.tsx:60` — scans recent mail for appliance / warranty
         * mentions. The validator requires a home id, so a user with no home
         * is told rather than shown a 400.
         */
        fun runAutoDetect() {
            if (_isScanning.value) return
            viewModelScope.launch {
                _isScanning.value = true
                resolveHomeIdIfNeeded()
                val home = homeId
                if (home == null) {
                    _toast.value = "Add a home before scanning for assets."
                    _isScanning.value = false
                    return@launch
                }
                when (val result = repository.autoDetect(home)) {
                    is NetworkResult.Success -> {
                        val found = result.data.detections.orEmpty().map(::projectDetection)
                        _detections.value = found
                        if ((result.data.count ?: found.size) == 0) {
                            _toast.value = "No new asset mentions found in recent mail."
                        }
                    }

                    is NetworkResult.Failure -> _toast.value = "Auto-detect failed."
                }
                _isScanning.value = false
            }
        }

        // ─── Suggestions → link ────────────────────────────────────

        fun openSuggestions() {
            _showsSuggestions.value = true
            viewModelScope.launch {
                _isLoadingSuggestions.value = true
                resolveHomeIdIfNeeded()
                when (val result = repository.suggestions(homeId)) {
                    is NetworkResult.Success ->
                        _suggestions.value =
                            result.data.suggestions.orEmpty().map { suggestion ->
                                val detection = suggestion.detections?.firstOrNull()
                                HomeRecordSuggestion(
                                    id = suggestion.mail.id,
                                    candidateName =
                                        detection?.candidateName?.takeIf { it.isNotBlank() }
                                            ?: suggestion.mail.subject?.takeIf { it.isNotBlank() }
                                            ?: "Unknown item",
                                    candidateBrand =
                                        detection?.candidateBrand?.takeIf { it.isNotBlank() }
                                            ?: suggestion.mail.senderName?.takeIf { it.isNotBlank() },
                                    confidencePercent =
                                        ((detection?.confidence ?: 0.0) * 100).roundToInt(),
                                )
                            }

                    is NetworkResult.Failure -> {
                        _suggestions.value = emptyList()
                        _toast.value = "Couldn't load link suggestions."
                    }
                }
                _isLoadingSuggestions.value = false
            }
        }

        fun dismissSuggestions() {
            _showsSuggestions.value = false
        }

        /** Stage the asset picker for a suggestion; closes the suggestions sheet. */
        fun requestLink(mailId: String) {
            _showsSuggestions.value = false
            _pendingLinkMailId.value = mailId
        }

        fun cancelLink() {
            _pendingLinkMailId.value = null
        }

        /**
         * `POST records/link`. `auto_detected` is the honest link type for a
         * scan-sourced suggestion (validator at
         * `backend/routes/mailboxV2Phase3.js:20`).
         */
        fun linkPendingMail(asset: HomeRecordAsset) {
            val mailId = _pendingLinkMailId.value ?: return
            _pendingLinkMailId.value = null
            viewModelScope.launch {
                when (val result = repository.link(mailId, asset.id, LINK_TYPE_AUTO_DETECTED)) {
                    is NetworkResult.Success -> {
                        _suggestions.value = _suggestions.value.filterNot { it.id == mailId }
                        _detections.value = _detections.value.filterNot { it.id == mailId }
                        result.data.link?.id?.let { linkId ->
                            _undoableLink.value = HomeRecordUndoableLink(linkId, asset.name)
                        }
                        _toast.value = "Linked to ${asset.name}."
                        fetchAssets()
                        if (_selectedAsset.value?.id == asset.id) fetchAssetDetail(asset.id)
                    }

                    is NetworkResult.Failure -> _toast.value = "Couldn't link that mail."
                }
            }
        }

        /** `DELETE records/unlink/:id` — undoes the link just created. */
        fun undoLastLink() {
            val undo = _undoableLink.value ?: return
            _undoableLink.value = null
            viewModelScope.launch {
                when (val result = repository.unlink(undo.linkId)) {
                    is NetworkResult.Success -> {
                        _toast.value = result.data.message ?: "Unlinked"
                        fetchAssets()
                        _selectedAsset.value?.id?.let { fetchAssetDetail(it) }
                    }

                    is NetworkResult.Failure -> _toast.value = "Couldn't undo that link."
                }
            }
        }

        fun dismissUndo() {
            _undoableLink.value = null
        }

        // ─── Projection ────────────────────────────────────────────

        private fun project(dto: HomeAssetSummaryDto): HomeRecordAsset =
            HomeRecordAsset(
                id = dto.id,
                name = dto.name?.takeIf { it.isNotBlank() } ?: "Untitled asset",
                category = RecordAssetCategory.fromRaw(dto.category),
                room = dto.room?.takeIf { it.isNotBlank() },
                manufacturer = dto.manufacturer?.takeIf { it.isNotBlank() },
                modelNumber = dto.modelNumber?.takeIf { it.isNotBlank() },
                purchasedLabel = formatDate(dto.purchasedAt, MEDIUM_DATE_PATTERN),
                warranty = RecordWarrantyStatus.fromRaw(dto.warrantyStatus),
                linkedMailCount = dto.linkedMailCount ?: 0,
            )

        private fun projectMail(dto: AssetLinkedMailDto): HomeRecordMailRow =
            HomeRecordMailRow(
                id = dto.id,
                subject = dto.subject?.takeIf { it.isNotBlank() } ?: "Mail item",
                senderName = dto.senderName?.takeIf { it.isNotBlank() },
                deliveredLabel = formatDate(dto.deliveredAt, SHORT_DATE_PATTERN),
            )

        private fun projectDetection(dto: AssetDetectionDto): HomeRecordSuggestion =
            HomeRecordSuggestion(
                id = dto.sourceMailId,
                candidateName = dto.candidateName?.takeIf { it.isNotBlank() } ?: "Unknown item",
                candidateBrand = dto.candidateBrand?.takeIf { it.isNotBlank() },
                confidencePercent = ((dto.confidence ?: 0.0) * 100).roundToInt(),
            )

        companion object {
            private const val LINK_TYPE_AUTO_DETECTED = "auto_detected"
            private const val MEDIUM_DATE_PATTERN = "MMM d, yyyy"
            private const val SHORT_DATE_PATTERN = "MMM d"

            fun formatDate(
                iso: String?,
                pattern: String,
            ): String? {
                if (iso.isNullOrBlank()) return null
                val instant =
                    runCatching { Instant.parse(iso) }.getOrNull()
                        ?: runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()
                        ?: return null
                return DateTimeFormatter
                    .ofPattern(pattern, Locale.US)
                    .withZone(ZoneId.systemDefault())
                    .format(instant)
            }
        }
    }
