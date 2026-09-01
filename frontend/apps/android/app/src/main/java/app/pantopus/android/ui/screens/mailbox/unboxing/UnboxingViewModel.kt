@file:Suppress("MagicNumber", "PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.unboxing

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageUnboxingRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/** Nav-arg key for the A17.14 unboxing route (`mailbox/unboxing?mailId=…`). */
const val UNBOXING_MAIL_ID_KEY = "mailId"

/** Sentinel the route builder uses when the leg carries no mail id. */
const val UNBOXING_MAIL_ID_NONE = "-"

/**
 * A17.14 — Backs the Unboxing capture flow for a delivered package.
 * Everything on this screen now round-trips to
 * `backend/routes/mailboxV2Phase2.js` (mounted at `api/mailbox/v2/p2`):
 *
 *  - [load]             → `GET api/mailbox/v2/package/:mailId`
 *    (`backend/routes/mailboxV2.js:634`) — the real `MailPackage` row
 *    drives the item name, carrier, saved-doc flags, and which phase the
 *    screen opens in.
 *  - [capture]          → `POST api/files/upload` (`files.js:781`) for the
 *    condition photo, then `POST …/p2/package/:mailId/unboxing` (:1217)
 *    with the returned S3 URL.
 *  - [confirm]          → `POST …/p2/package/:mailId/save-warranty` (:1246)
 *    with `{ "type": "warranty" }` — files to Home › Warranties.
 *  - [saveManual]       → the same route with `{ "type": "manual" }`.
 *  - [postAssemblyGig]  → `POST …/p2/package/:mailId/gig` (:1280) with
 *    `{ "gigType": "assembly" }`.
 *
 * There is no OCR / classification route, so the facts list is projected
 * from the package row itself (see [UnboxingProjection]) — never invented.
 *
 * Mirrors `UnboxingViewModel` on iOS.
 */
@HiltViewModel
class UnboxingViewModel
    @Inject
    constructor(
        private val repository: MailboxPackageRepository,
        private val filesRepository: FilesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /**
         * The originating package mail. Null → the screen was opened
         * without one and cannot persist anything (see
         * [UnboxingUiState.Unavailable]).
         */
        val mailId: String? =
            savedStateHandle
                .get<String>(UNBOXING_MAIL_ID_KEY)
                ?.takeIf { it.isNotBlank() && it != UNBOXING_MAIL_ID_NONE }

        private val _state =
            MutableStateFlow<UnboxingUiState>(
                if (mailId == null) UnboxingUiState.Unavailable else UnboxingUiState.Loading,
            )
        val state: StateFlow<UnboxingUiState> = _state.asStateFlow()

        private val _isBusy = MutableStateFlow(false)
        val isBusy: StateFlow<Boolean> = _isBusy.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var content: UnboxingContent = UnboxingProjection.placeholder
        private var phase: UnboxingPhase = UnboxingPhase.Capture

        private var onScanNext: () -> Unit = {}
        private var onOpenDrawer: () -> Unit = {}

        fun configure(
            onScanNext: () -> Unit,
            onOpenDrawer: () -> Unit,
        ) {
            this.onScanNext = onScanNext
            this.onOpenDrawer = onOpenDrawer
        }

        fun consumeToast() {
            _toast.value = null
        }

        // ── Lifecycle ────────────────────────────────────────────

        fun load() {
            val mail = mailId
            if (mail == null) {
                _state.value = UnboxingUiState.Unavailable
                return
            }
            if (_state.value is UnboxingUiState.Capture || _state.value is UnboxingUiState.Filed) return
            fetch(mail)
        }

        fun retry() {
            val mail = mailId ?: return
            fetch(mail)
        }

        private fun fetch(mail: String) {
            _state.value = UnboxingUiState.Loading
            viewModelScope.launch {
                when (val result = repository.packageDetail(mail)) {
                    is NetworkResult.Success -> {
                        content = UnboxingProjection.live(result.data.packageRow, result.data.sender?.display)
                        phase =
                            if (result.data.packageRow.warrantySaved == true) {
                                UnboxingPhase.Filed
                            } else {
                                UnboxingPhase.Capture
                            }
                        restate()
                    }
                    is NetworkResult.Failure ->
                        _state.value =
                            UnboxingUiState.Error(
                                "We couldn't load this package. Check your connection and try again.",
                            )
                }
            }
        }

        private fun restate() {
            _state.value =
                when (phase) {
                    UnboxingPhase.Capture -> UnboxingUiState.Capture(content)
                    UnboxingPhase.Filed -> UnboxingUiState.Filed(content)
                }
        }

        // ── Capture ──────────────────────────────────────────────

        /**
         * Record a condition photo: upload the JPEG the user just picked,
         * then attach the resulting URL to the package with
         * `POST …/p2/package/:mailId/unboxing`.
         */
        fun capture(bytes: ByteArray) {
            val mail = mailId ?: return
            if (bytes.isEmpty() || _isBusy.value) return
            _isBusy.value = true
            viewModelScope.launch {
                try {
                    val upload =
                        filesRepository.uploadFile(
                            filename = "unboxing-${UUID.randomUUID().toString().take(8)}.jpg",
                            mimeType = "image/jpeg",
                            bytes = bytes,
                            fileType = "mailbox_unboxing",
                        )
                    if (upload !is NetworkResult.Success) {
                        _toast.value = "Couldn't upload the photo — try again"
                        return@launch
                    }
                    val url = upload.data.file.url
                    val recorded =
                        repository.recordUnboxing(mail, PackageUnboxingRequest(conditionPhotoUrl = url))
                    if (recorded !is NetworkResult.Success) {
                        _toast.value = "Couldn't attach the photo — try again"
                        return@launch
                    }
                    content =
                        content.copy(
                            shots =
                                content.shots +
                                    UnboxingShot(
                                        id = upload.data.file.id,
                                        tag = "CONDITION",
                                        label = "Condition photo",
                                        isMain = content.shots.isEmpty(),
                                    ),
                        )
                    content = content.copy(photosSavedLabel = UnboxingProjection.photosLabel(content.shots.size))
                    restate()
                    _toast.value = "Condition photo saved to this package"
                } finally {
                    _isBusy.value = false
                }
            }
        }

        // ── Filing ───────────────────────────────────────────────

        /**
         * "Confirm — file to Home". Persists the warranty document to the
         * caller's Home › Warranties vault folder and advances to `Filed`.
         */
        fun confirm() {
            val mail = mailId ?: return
            if (phase != UnboxingPhase.Capture || _isBusy.value) return
            _isBusy.value = true
            viewModelScope.launch {
                try {
                    when (repository.saveWarranty(mail, "warranty")) {
                        is NetworkResult.Success -> {
                            phase = UnboxingPhase.Filed
                            content = content.copy(filedSubtitle = "Confirmed by you · Just now")
                            restate()
                            _toast.value = "Filed to Home › Warranties"
                        }
                        is NetworkResult.Failure -> _toast.value = "Couldn't file this — try again"
                    }
                } finally {
                    _isBusy.value = false
                }
            }
        }

        /**
         * "Save manual" — the second quick-save RN offers
         * (`unboxing.tsx:34`), same route with `type: "manual"`.
         */
        fun saveManual() {
            val mail = mailId ?: return
            if (_isBusy.value) return
            _isBusy.value = true
            viewModelScope.launch {
                try {
                    _toast.value =
                        when (repository.saveWarranty(mail, "manual")) {
                            is NetworkResult.Success -> "Manual saved to Home › Warranties"
                            is NetworkResult.Failure -> "Couldn't save the manual — try again"
                        }
                } finally {
                    _isBusy.value = false
                }
            }
        }

        /**
         * Filed-banner "Undo" chip. There is no un-file route on the backend
         * (`mailboxV2Phase2.js` only ever sets `warranty_saved` to true), so
         * this returns the screen to the capture frame — it does not claim
         * to have removed the vault entry.
         */
        fun undo() {
            if (phase != UnboxingPhase.Filed) return
            phase = UnboxingPhase.Capture
            restate()
            _toast.value = "Back to capture · the saved document stays in your vault"
        }

        /** "Scan the next item" — re-arms the capture frame and hands off. */
        fun scanNext() {
            phase = UnboxingPhase.Capture
            restate()
            onScanNext()
        }

        /** "View in Home drawer" — hands off to the host. */
        fun openDrawer() {
            onOpenDrawer()
        }

        // ── Assembly gig ─────────────────────────────────────────

        /**
         * "Need help assembling?" — posts the package help gig
         * (`gigType = "assembly"`), mirroring RN `unboxing.tsx:44-56`.
         */
        fun postAssemblyGig() {
            val mail = mailId ?: return
            if (_isBusy.value) return
            _isBusy.value = true
            viewModelScope.launch {
                try {
                    when (val result = repository.createPackageGig(mail, PackageGigRequest(gigType = "assembly"))) {
                        is NetworkResult.Success -> _toast.value = result.data.title ?: "Task created"
                        is NetworkResult.Failure -> _toast.value = "Could not create gig"
                    }
                } finally {
                    _isBusy.value = false
                }
            }
        }
    }
