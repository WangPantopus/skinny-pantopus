@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.package_gig

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxPackageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** Nav-arg keys for the A17.8 package-gig route (`mailbox/gig?…`). */
const val PACKAGE_GIG_MAIL_ID_KEY = "mailId"
const val PACKAGE_GIG_MODE_KEY = "mode"

/** Route value for the pre-delivery frame; anything else is post-delivery. */
const val PACKAGE_GIG_MODE_PRE = "pre"

/** Route value for the post-delivery frame (the default). */
const val PACKAGE_GIG_MODE_POST = "post"

/**
 * Sentinel the route builder uses when no mail id is available. Navigation
 * requires every optional (query) argument to carry a default, so the leg
 * always travels — the screen just has nothing to post against.
 */
const val PACKAGE_GIG_MAIL_ID_NONE = "-"

/** Blocking alert (mirrors RN's `Alert.alert` failure paths). */
data class PackageGigAlert(
    val title: String,
    val message: String,
)

/** The gig the backend just created — drives the success frame. */
data class PackageGigCreated(
    val gigId: String,
    val title: String,
    val isPreDelivery: Boolean,
)

/**
 * A17.8 → "Ask a Neighbor". Backs the package-gig form reached from the
 * package detail overflow and from the mail-task create frame. Ports RN
 * `src/app/mailbox/gig.tsx` (:41 create, :63 success frame):
 *
 *  - `POST api/mailbox/v2/p2/package/:mailId/gig`
 *    (`backend/routes/mailboxV2Phase2.js:1280`, mounted at
 *    `api/mailbox/v2/p2` — `backend/app.js:316`)
 *
 * The route takes `{ gigType, title?, description?, suggestedStart?,
 * compensation? }` and answers `{ message, gigId, title, preDelivery }`.
 * The screen has no read — RN posts straight from the form and the backend
 * pre-fills the gig from the `MailPackage` row — so there is no
 * load/empty/error fetch cycle here, only the submit path.
 *
 * Mirrors `PackageGigViewModel.swift` on iOS.
 */
@HiltViewModel
class PackageGigViewModel
    @Inject
    constructor(
        private val repository: MailboxPackageRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        /** The originating mail item — the gig is pre-filled from its package row. */
        val mailId: String =
            savedStateHandle.get<String>(PACKAGE_GIG_MAIL_ID_KEY)
                ?.takeIf { it.isNotBlank() && it != PACKAGE_GIG_MAIL_ID_NONE }
                .orEmpty()

        /**
         * `true` while the package is still in transit. RN passes this as
         * `?mode=pre|post`; the backend re-derives it from the package status
         * and echoes the truth back as `preDelivery`.
         */
        val isPreDelivery: Boolean =
            savedStateHandle.get<String>(PACKAGE_GIG_MODE_KEY) == PACKAGE_GIG_MODE_PRE

        private val _created = MutableStateFlow<PackageGigCreated?>(null)
        val created: StateFlow<PackageGigCreated?> = _created.asStateFlow()

        private val _selectedType = MutableStateFlow<PackageGigType?>(null)
        val selectedType: StateFlow<PackageGigType?> = _selectedType.asStateFlow()

        private val _draftTitle = MutableStateFlow("")
        val draftTitle: StateFlow<String> = _draftTitle.asStateFlow()

        private val _draftDescription = MutableStateFlow("")
        val draftDescription: StateFlow<String> = _draftDescription.asStateFlow()

        /**
         * Free text so the field can be empty; parsed with [String.toDoubleOrNull]
         * on submit exactly like RN's `parseFloat`.
         */
        private val _draftCompensation = MutableStateFlow("")
        val draftCompensation: StateFlow<String> = _draftCompensation.asStateFlow()

        private val _isCreating = MutableStateFlow(false)
        val isCreating: StateFlow<Boolean> = _isCreating.asStateFlow()

        private val _alert = MutableStateFlow<PackageGigAlert?>(null)
        val alert: StateFlow<PackageGigAlert?> = _alert.asStateFlow()

        val options: List<PackageGigOption> = PackageGigOption.options(isPreDelivery)

        val eyebrow: String = if (isPreDelivery) "PRE-DELIVERY GIG" else "POST-DELIVERY GIG"

        val contextSubcopy: String =
            if (isPreDelivery) {
                "Carrier info and ETA attached to gig automatically"
            } else {
                "Delivery photo, tracking, and item details included"
            }

        fun select(type: PackageGigType) {
            _selectedType.value = type
        }

        fun updateDraftTitle(value: String) {
            _draftTitle.value = value
        }

        fun updateDraftDescription(value: String) {
            _draftDescription.value = value
        }

        fun updateDraftCompensation(value: String) {
            _draftCompensation.value = value
        }

        fun dismissAlert() {
            _alert.value = null
        }

        /**
         * `POST …/p2/package/:mailId/gig`. RN blocks on an unselected type with
         * its own alert before it ever calls the API (`gig.tsx:42-45`).
         */
        fun create() {
            val type = _selectedType.value
            if (type == null) {
                _alert.value =
                    PackageGigAlert(
                        title = "Select a type",
                        message = "Please choose what kind of help you need",
                    )
                return
            }
            if (mailId.isBlank()) {
                _alert.value =
                    PackageGigAlert(
                        title = "No Package",
                        message = "This request must be linked to a mailbox package.",
                    )
                return
            }
            if (_isCreating.value) return
            _isCreating.value = true
            viewModelScope.launch {
                try {
                    val title = _draftTitle.value.trim()
                    val description = _draftDescription.value.trim()
                    val compensation = _draftCompensation.value.trim()
                    val request =
                        PackageGigRequest(
                            gigType = type.wire,
                            title = title.ifBlank { null },
                            description = description.ifBlank { null },
                            compensation = compensation.ifBlank { null }?.toDoubleOrNull(),
                        )
                    when (val result = repository.createPackageGig(mailId, request)) {
                        is NetworkResult.Success ->
                            onCreated(
                                gigId = result.data.gigId,
                                title = result.data.title,
                                preDelivery = result.data.preDelivery,
                                type = type,
                            )
                        is NetworkResult.Failure -> _alert.value = errorAlert()
                    }
                } finally {
                    _isCreating.value = false
                }
            }
        }

        private fun onCreated(
            gigId: String?,
            title: String?,
            preDelivery: Boolean?,
            type: PackageGigType,
        ) {
            // The route always returns an id; a body without one means we have
            // nothing to deep-link into, so surface the failure rather than
            // faking a success frame.
            if (gigId.isNullOrBlank()) {
                _alert.value = errorAlert()
                return
            }
            _created.value =
                PackageGigCreated(
                    gigId = gigId,
                    title = title ?: fallbackTitle(type),
                    isPreDelivery = preDelivery ?: isPreDelivery,
                )
        }

        private fun errorAlert() = PackageGigAlert(title = "Error", message = "Could not create gig request")

        /**
         * Mirrors the backend's own default title
         * (`backend/routes/mailboxV2Phase2.js:1295`) for the (impossible in
         * practice) case where the response omits it.
         */
        private fun fallbackTitle(type: PackageGigType): String {
            if (!isPreDelivery) return "Help with my package"
            return when (type) {
                PackageGigType.Hold -> "Hold my package"
                PackageGigType.Inside -> "Bring inside my package"
                PackageGigType.Sign -> "Sign for my package"
                PackageGigType.Assembly, PackageGigType.Custom -> "Help with my package"
            }
        }
    }
