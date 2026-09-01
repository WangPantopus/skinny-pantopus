@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.businesses.legal

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessNonprofitVerificationDto
import app.pantopus.android.data.api.models.businesses.BusinessPrivateDto
import app.pantopus.android.data.api.models.businesses.BusinessVerificationStatusResponse
import app.pantopus.android.data.api.models.businesses.UpdateBusinessPrivateRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.businesses.BusinessFinanceRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.businesses.invoices.BusinessInvoicesViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/** Nav arg key for the business id consumed via [SavedStateHandle]. */
const val BUSINESS_LEGAL_ID_KEY = "businessId"

/**
 * Verification tiers the backend can report
 * (`backend/utils/businessConstants.js` `VERIFICATION_RANK`).
 */
enum class BusinessVerificationTier(
    val raw: String,
    val label: String,
    val blurb: String,
) {
    Unverified(
        "unverified",
        "Unverified",
        "Neighbors see no verification badge yet. Attest to your legal details to get started.",
    ),
    SelfAttested(
        "self_attested",
        "Self-attested",
        "You've attested to your legal name and address. Upload a document to reach the next tier.",
    ),
    DocumentVerified(
        "document_verified",
        "Document verified",
        "A reviewer approved your documents. Your page shows a verified badge.",
    ),
    GovernmentVerified(
        "government_verified",
        "Government verified",
        "Verified against a government registry — the highest tier.",
    ),
    ;

    companion object {
        fun from(raw: String?): BusinessVerificationTier = entries.firstOrNull { it.raw == raw } ?: Unverified
    }
}

/**
 * Document types the backend accepts for evidence upload
 * (`businessVerification.js:27`). `self_attestation` is not uploadable.
 */
enum class BusinessEvidenceType(
    val raw: String,
    val label: String,
) {
    BusinessLicense("business_license", "Business license"),
    EinLetter("ein_letter", "EIN letter"),
    UtilityBill("utility_bill", "Utility bill"),
    StateRegistration("state_registration", "State registration"),
    EinVerification("ein_verification", "EIN verification"),
    TaxExemptLetter("tax_exempt_letter", "501(c)(3) determination letter"),
    ;

    companion object {
        /**
         * Human label for any evidence row, including `self_attestation`
         * which the ledger can carry but the picker can't offer.
         */
        fun labelForRaw(raw: String): String {
            entries.firstOrNull { it.raw == raw }?.let { return it.label }
            if (raw == "self_attestation") return "Self-attestation"
            return raw
                .replace('_', ' ')
                .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() }
        }
    }
}

/** One evidence row projected for display. */
data class BusinessEvidenceRow(
    val id: String,
    val title: String,
    /** `pending | approved | rejected`. */
    val status: String,
    val dateLabel: String?,
)

/** Loaded payload for the Legal screen. */
data class BusinessLegalContent(
    val tier: BusinessVerificationTier,
    val verifiedDateLabel: String?,
    val evidence: List<BusinessEvidenceRow>,
    val canSelfAttest: Boolean,
    val selfAttestBlockedReason: String?,
    val canUploadEvidence: Boolean,
    val nonprofit: BusinessNonprofitVerificationDto?,
    /** True once the `BusinessPrivate` row exists (Save vs. Update copy). */
    val hasPrivateRecord: Boolean,
    /**
     * Set when `/private` answered 403 — the viewer is staff without
     * `sensitive.view`, so the form is hidden rather than shown empty.
     */
    val privateAccessDenied: Boolean,
)

/** Render state for the Legal screen. */
sealed interface BusinessLegalUiState {
    data object Loading : BusinessLegalUiState

    data class Loaded(val content: BusinessLegalContent) : BusinessLegalUiState

    data class Error(val message: String) : BusinessLegalUiState
}

/** Transient result of a mutation. */
sealed interface BusinessLegalAction {
    data object Idle : BusinessLegalAction

    data object Saving : BusinessLegalAction

    data object Attesting : BusinessLegalAction

    data object Uploading : BusinessLegalAction

    data class Succeeded(val message: String) : BusinessLegalAction

    data class Failed(val message: String) : BusinessLegalAction
}

/** A picked document — bytes are held only until the upload completes. */
data class PickedEvidenceFile(
    val filename: String,
    val mimeType: String,
    val bytes: ByteArray,
) {
    override fun equals(other: Any?): Boolean =
        this === other ||
            (
                other is PickedEvidenceFile &&
                    filename == other.filename &&
                    mimeType == other.mimeType &&
                    bytes.contentEquals(other.bytes)
            )

    override fun hashCode(): Int = (filename.hashCode() * 31 + mimeType.hashCode()) * 31 + bytes.contentHashCode()
}

/**
 * A10.7 owner surface — "Legal & verification". Two things live here: the
 * business's private record (legal name, tax-id last four, support email)
 * and verification (status + evidence ledger, self-attestation, document
 * evidence upload).
 *
 * PII discipline: the private values live in this view-model's memory for
 * the lifetime of the screen and nowhere else. Nothing is logged, persisted
 * or put in a query string; [clearSensitive] wipes the fields on exit.
 * Mirrors iOS `BusinessLegalViewModel`.
 */
@HiltViewModel
class BusinessLegalViewModel
    @Inject
    constructor(
        private val repository: BusinessFinanceRepository,
        private val filesRepository: FilesRepository,
        networkMonitor: NetworkMonitor,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val businessId: String = savedStateHandle.get<String>(BUSINESS_LEGAL_ID_KEY).orEmpty()

        private val _state = MutableStateFlow<BusinessLegalUiState>(BusinessLegalUiState.Loading)
        val state: StateFlow<BusinessLegalUiState> = _state.asStateFlow()

        private val _action = MutableStateFlow<BusinessLegalAction>(BusinessLegalAction.Idle)
        val action: StateFlow<BusinessLegalAction> = _action.asStateFlow()

        // Private-record form (PII — memory only, cleared on exit).
        private val _legalName = MutableStateFlow("")
        val legalName: StateFlow<String> = _legalName.asStateFlow()

        private val _taxIdLast4 = MutableStateFlow("")
        val taxIdLast4: StateFlow<String> = _taxIdLast4.asStateFlow()

        private val _supportEmail = MutableStateFlow("")
        val supportEmail: StateFlow<String> = _supportEmail.asStateFlow()

        /** The self-attestation checkbox — the route rejects anything but true. */
        private val _addressConfirmed = MutableStateFlow(false)
        val addressConfirmed: StateFlow<Boolean> = _addressConfirmed.asStateFlow()

        val isOnline: StateFlow<Boolean> = networkMonitor.isOnline

        fun load() {
            viewModelScope.launch {
                _state.value = BusinessLegalUiState.Loading
                fetch()
            }
        }

        fun refresh() {
            viewModelScope.launch { fetch() }
        }

        private suspend fun fetch() {
            // Verification status is the spine of the screen — a failure there
            // is a screen-level error.
            val verification =
                when (val result = repository.verificationStatus(businessId)) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> {
                        _state.value = BusinessLegalUiState.Error(result.error.message)
                        return
                    }
                }

            // `/private` 403s for staff without `sensitive.view`; that's a
            // legitimate, renderable outcome rather than a screen failure.
            var privateDenied = false
            var privateRecord: BusinessPrivateDto? = null
            when (val result = repository.privateRecord(businessId)) {
                is NetworkResult.Success -> privateRecord = result.data.privateRecord
                is NetworkResult.Failure ->
                    if (result.error is NetworkError.Forbidden) privateDenied = true
            }

            privateRecord?.let {
                _legalName.value = it.legalName.orEmpty()
                _taxIdLast4.value = it.taxIdLast4.orEmpty()
                _supportEmail.value = it.supportEmail.orEmpty()
            }

            _state.value =
                BusinessLegalUiState.Loaded(
                    contentFrom(
                        verification = verification,
                        privateRecord = privateRecord,
                        privateAccessDenied = privateDenied,
                    ),
                )
        }

        // ─── Form ─────────────────────────────────────────────────────

        fun setLegalName(value: String) {
            _legalName.value = value
        }

        /** Digits only, at most four — the server stores nothing longer. */
        fun setTaxIdLast4(value: String) {
            _taxIdLast4.value = value.filter { it.isDigit() }.take(TAX_ID_DIGITS)
        }

        fun setSupportEmail(value: String) {
            _supportEmail.value = value
        }

        fun setAddressConfirmed(value: Boolean) {
            _addressConfirmed.value = value
        }

        // ─── Private record ───────────────────────────────────────────

        /** `PATCH /private`. Only the three fields this screen owns are sent. */
        fun savePrivateRecord() {
            viewModelScope.launch {
                _action.value = BusinessLegalAction.Saving
                val name = _legalName.value.trim()
                val last4 = _taxIdLast4.value.filter { it.isDigit() }.takeLast(TAX_ID_DIGITS)
                val email = _supportEmail.value.trim()
                val result =
                    repository.updatePrivateRecord(
                        businessId,
                        UpdateBusinessPrivateRequest(
                            legalName = name.ifEmpty { null },
                            taxIdLast4 = last4.ifEmpty { null },
                            supportEmail = email.ifEmpty { null },
                        ),
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        _taxIdLast4.value = last4
                        _action.value = BusinessLegalAction.Succeeded("Legal information updated.")
                        fetch()
                    }
                    is NetworkResult.Failure ->
                        _action.value = BusinessLegalAction.Failed(result.error.message)
                }
            }
        }

        // ─── Verification ─────────────────────────────────────────────

        /**
         * `POST /verify/self-attest`. Requires a legal name and an explicit
         * address confirmation; the route also demands at least one geocoded
         * location and answers 400 `NO_VERIFIED_LOCATION` otherwise.
         */
        fun selfAttest() {
            viewModelScope.launch {
                val name = _legalName.value.trim()
                if (name.isEmpty()) {
                    _action.value =
                        BusinessLegalAction.Failed("Enter your registered legal business name first.")
                    return@launch
                }
                if (!_addressConfirmed.value) {
                    _action.value = BusinessLegalAction.Failed("Confirm your registered address to attest.")
                    return@launch
                }
                _action.value = BusinessLegalAction.Attesting
                when (val result = repository.selfAttest(businessId, name)) {
                    is NetworkResult.Success -> {
                        _action.value =
                            BusinessLegalAction.Succeeded(
                                result.data.message ?: "Business self-attestation complete.",
                            )
                        fetch()
                    }
                    is NetworkResult.Failure ->
                        _action.value = BusinessLegalAction.Failed(result.error.message)
                }
            }
        }

        /**
         * Upload a document, then register it as verification evidence. Two
         * hops: `POST api/files/upload` for the `File` UUID, then
         * `POST /verify/upload-evidence`.
         */
        fun uploadEvidence(
            type: BusinessEvidenceType,
            file: PickedEvidenceFile,
        ) {
            viewModelScope.launch {
                _action.value = BusinessLegalAction.Uploading
                val upload =
                    filesRepository.uploadFile(
                        filename = file.filename,
                        mimeType = file.mimeType,
                        bytes = file.bytes,
                        fileType = "business_verification",
                        visibility = "private",
                    )
                val fileId =
                    when (upload) {
                        is NetworkResult.Success -> upload.data.file.id
                        is NetworkResult.Failure -> {
                            _action.value = BusinessLegalAction.Failed(upload.error.message)
                            return@launch
                        }
                    }
                when (val result = repository.uploadVerificationEvidence(businessId, type.raw, fileId)) {
                    is NetworkResult.Success -> {
                        _action.value = BusinessLegalAction.Succeeded("Document submitted for review.")
                        fetch()
                    }
                    is NetworkResult.Failure ->
                        _action.value = BusinessLegalAction.Failed(result.error.message)
                }
            }
        }

        fun clearAction() {
            _action.value = BusinessLegalAction.Idle
        }

        /**
         * Wipe the PII fields when the screen goes away so the values don't
         * outlive the surface that needed them.
         */
        fun clearSensitive() {
            _legalName.value = ""
            _taxIdLast4.value = ""
            _supportEmail.value = ""
            _addressConfirmed.value = false
        }

        override fun onCleared() {
            clearSensitive()
            super.onCleared()
        }

        companion object {
            private const val TAX_ID_DIGITS = 4

            /** Pure projection — the unit-test surface. */
            fun contentFrom(
                verification: BusinessVerificationStatusResponse,
                privateRecord: BusinessPrivateDto?,
                privateAccessDenied: Boolean,
            ): BusinessLegalContent =
                BusinessLegalContent(
                    tier = BusinessVerificationTier.from(verification.verificationStatus),
                    verifiedDateLabel = BusinessInvoicesViewModel.shortDate(verification.verifiedAt),
                    evidence =
                        verification.evidence.map { row ->
                            BusinessEvidenceRow(
                                id = row.id,
                                title = BusinessEvidenceType.labelForRaw(row.type),
                                status = row.status.lowercase(Locale.US),
                                dateLabel =
                                    BusinessInvoicesViewModel.shortDate(row.reviewedAt ?: row.createdAt),
                            )
                        },
                    canSelfAttest = verification.canSelfAttest,
                    selfAttestBlockedReason = verification.canSelfAttestReason,
                    canUploadEvidence = verification.canUploadEvidence,
                    nonprofit = verification.nonprofitVerification,
                    hasPrivateRecord = privateRecord?.businessUserId != null,
                    privateAccessDenied = privateAccessDenied,
                )
        }
    }
