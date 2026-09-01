@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.owners.transfer

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeDetail
import app.pantopus.android.data.api.models.homes.OwnerDto
import app.pantopus.android.data.api.models.homes.TransferOwnerRequest
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.homes.HomeOwnersRepository
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.screens.homes.owners.transfer.components.ConfirmSheetParty
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/** Nav-arg key for the home id consumed via [SavedStateHandle]. */
const val TRANSFER_HOME_ID_KEY = "homeId"

/** The literal the user must type to arm the CTA. */
const val TRANSFER_CONFIRMATION_PHRASE = "TRANSFER"

/** Tone + text payload the form turns into a transient toast. */
data class TransferToast(
    val text: String,
    val isError: Boolean,
)

/** Visibility states for the bottom confirmation sheet. */
enum class ConfirmSheetPhase {
    Hidden,
    Visible,
    Authenticating,
    Dismissing,
}

/** Fetch state for the home + roster context strip. */
sealed interface TransferContextState {
    data object Loading : TransferContextState

    data object Loaded : TransferContextState

    data class Error(val message: String) : TransferContextState
}

/**
 * Aggregate UI state for the Transfer Ownership form. Mirrors the iOS
 * `TransferOwnershipViewModel` projection so snapshot / VM tests align.
 */
data class TransferOwnershipUiState(
    val contextState: TransferContextState = TransferContextState.Loading,
    /** Home display name (falls back to the street address). */
    val homeTitle: String = "",
    /** Full street address used in the legal copy. */
    val homeAddress: String = "",
    /** "Mateo and Jin" — empty when the viewer is the sole owner. */
    val coOwnerNames: String = "",
    /** Count of owner rows other than the viewer. */
    val otherOwnerCount: Int = 0,
    /** The viewer's display name, shown on the "From" row. */
    val senderDisplayName: String = "You",
    val recipientField: FormFieldState = FormFieldState(id = "recipientEmail"),
    val confirmationField: FormFieldState = FormFieldState(id = "confirmation"),
    val sheetPhase: ConfirmSheetPhase = ConfirmSheetPhase.Hidden,
    val biometricErrorMessage: String? = null,
    val toast: TransferToast? = null,
    val shouldDismiss: Boolean = false,
    val biometryLabel: String = "Fingerprint",
    val confirmationTimestamp: String = "",
) {
    val confirmationPhrase: String get() = TRANSFER_CONFIRMATION_PHRASE

    /** Trimmed buyer email exactly as it goes on the wire. */
    val recipientEmail: String get() = recipientField.value.trim()

    /** Loose check — the backend enforces `Joi.string().email()`. */
    val recipientIsValid: Boolean get() = looksLikeEmail(recipientEmail)

    /** Local-part of the buyer email, used in CTA / warning copy. */
    val recipientShortName: String
        get() = recipientEmail.substringBefore('@').ifEmpty { "the buyer" }

    val recipientInitials: String
        get() =
            recipientEmail
                .substringBefore('@')
                .firstOrNull { it.isLetter() }
                ?.uppercase() ?: "?"

    val senderInitials: String
        get() {
            val initials =
                senderDisplayName
                    .split(" ")
                    .take(2)
                    .mapNotNull { it.firstOrNull()?.uppercase() }
                    .joinToString("")
            return initials.ifEmpty { "YOU" }
        }

    val confirmationMatches: Boolean
        get() = confirmationField.value == confirmationPhrase

    /**
     * Whether the sticky CTA is active. The context strip failing to
     * load doesn't block the mutation — the request only needs the home
     * id and the buyer's email.
     */
    val isReadyToCommit: Boolean
        get() = recipientIsValid && confirmationMatches

    val isDirty: Boolean
        get() = recipientField.value.isNotEmpty() || confirmationField.value.isNotEmpty()

    val confirmationFieldState: PantopusFieldState
        get() =
            when {
                confirmationField.value.isEmpty() -> PantopusFieldState.Default
                confirmationMatches -> PantopusFieldState.Valid
                else -> PantopusFieldState.Default
            }

    val recipientFieldState: PantopusFieldState
        get() =
            when {
                recipientField.value.isEmpty() -> PantopusFieldState.Default
                recipientIsValid -> PantopusFieldState.Valid
                else -> PantopusFieldState.Error("Enter a valid email address.")
            }

    val ctaLabel: String
        get() = if (recipientIsValid) "Transfer ownership to $recipientShortName" else "Initiate transfer"

    /**
     * Mirrors RN's confirm-dialog body (`owners/transfer.tsx:32`) plus
     * the co-owner-quorum note the backend applies at line 1547.
     */
    val warningCopy: String
        get() =
            buildString {
                append("The new owner must verify ownership before the transfer completes. ")
                append("Your owner record is revoked as soon as this is initiated.")
                if (otherOwnerCount > 0) {
                    val names = coOwnerNames.ifEmpty { "The other owners" }
                    append(" $names must approve before it takes effect.")
                }
            }

    val ownerSummary: String
        get() =
            when (otherOwnerCount) {
                0 -> "You're the only owner on record"
                1 -> "You + 1 co-owner"
                else -> "You + $otherOwnerCount co-owners"
            }

    val confirmSheetParties: List<ConfirmSheetParty>
        get() =
            listOf(
                ConfirmSheetParty(
                    id = "sender",
                    role = "From",
                    name = if (senderDisplayName == "You") "You" else "You · $senderDisplayName",
                    initials = senderInitials,
                    avatarStart = PantopusColors.primary500,
                    avatarEnd = PantopusColors.primary700,
                    fromPercent = 100,
                    toPercent = 0,
                ),
                ConfirmSheetParty(
                    id = "recipient",
                    role = "To",
                    name = recipientEmail.ifEmpty { "—" },
                    initials = recipientInitials,
                    avatarStart = PantopusColors.business,
                    avatarEnd = PantopusColors.businessDark,
                    fromPercent = 0,
                    toPercent = 100,
                ),
            )

    private companion object {
        fun looksLikeEmail(raw: String): Boolean {
            if (raw.contains(' ')) return false
            val parts = raw.split("@")
            if (parts.size != 2 || parts[0].isEmpty()) return false
            val domain = parts[1]
            return domain.contains('.') && !domain.startsWith('.') && !domain.endsWith('.')
        }
    }
}

/**
 * A13.4 — Transfer Ownership form view-model. Loads the home + its real
 * owner roster for the context strip, then commits
 * `POST /api/homes/:id/owners/transfer` (route
 * `backend/routes/homeOwnership.js:1526`) with the buyer's **email** —
 * the identifier RN uses and the one `executeOwnershipTransfer`
 * (line 2274-2281) resolves for buyers who aren't users yet.
 *
 * The endpoint transfers ownership in full and carries no share /
 * percentage field (`transferOwnerSchema`, line 74-79), so this screen
 * no longer renders one.
 *
 * Biometric authentication itself is owned by the host screen — the VM
 * exposes [requestBiometric] / [handleBiometricResult] entry points so
 * the platform [`androidx.biometric.BiometricPrompt`] lives at the
 * Activity layer where it has the FragmentManager it needs.
 */
@HiltViewModel
class TransferOwnershipViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val ownersRepo: HomeOwnersRepository,
        private val homesRepo: HomesRepository,
        authRepository: AuthRepository,
    ) : ViewModel() {
        private val homeId: String = savedStateHandle.get<String>(TRANSFER_HOME_ID_KEY) ?: ""

        private val currentUser = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user

        private val _state =
            MutableStateFlow(
                TransferOwnershipUiState(
                    senderDisplayName =
                        currentUser?.displayName?.takeIf { it.isNotBlank() }
                            ?: currentUser?.email?.substringBefore('@')?.takeIf { it.isNotBlank() }
                            ?: "You",
                    confirmationTimestamp = formatNow(),
                ),
            )
        val state: StateFlow<TransferOwnershipUiState> = _state.asStateFlow()

        /** Idempotent — re-running won't refetch once the strip loaded. */
        fun load() {
            if (_state.value.contextState is TransferContextState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.update { it.copy(contextState = TransferContextState.Loading) }
            viewModelScope.launch {
                when (val detail = homesRepo.detail(homeId)) {
                    is NetworkResult.Failure ->
                        _state.update {
                            it.copy(
                                contextState =
                                    TransferContextState.Error(
                                        detail.error.displayMessage("Couldn't load this home."),
                                    ),
                            )
                        }
                    is NetworkResult.Success ->
                        when (val owners = ownersRepo.list(homeId)) {
                            is NetworkResult.Failure ->
                                _state.update {
                                    it.copy(
                                        contextState =
                                            TransferContextState.Error(
                                                owners.error.displayMessage("Couldn't load the owner roster."),
                                            ),
                                    )
                                }
                            is NetworkResult.Success -> applyContext(detail.data.home, owners.data.owners)
                        }
                }
            }
        }

        private fun applyContext(
            detail: HomeDetail,
            owners: List<OwnerDto>,
        ) {
            val address =
                detail.address?.takeIf { it.isNotBlank() }
                    ?: detail.name?.takeIf { it.isNotBlank() }
                    ?: "this home"
            val viewerId = currentUser?.id
            val others = owners.filter { owner -> viewerId == null || owner.subjectId != viewerId }
            _state.update {
                it.copy(
                    contextState = TransferContextState.Loaded,
                    homeAddress = address,
                    homeTitle = detail.name?.takeIf { name -> name.isNotBlank() } ?: address,
                    otherOwnerCount = others.size,
                    coOwnerNames = joinNames(others.map(::displayName)),
                )
            }
        }

        fun updateRecipientEmail(value: String) {
            _state.update { current ->
                current.copy(recipientField = current.recipientField.copy(value = value, touched = true))
            }
        }

        fun clearRecipientEmail() {
            _state.update { current ->
                current.copy(recipientField = current.recipientField.copy(value = ""))
            }
        }

        fun updateConfirmation(value: String) {
            _state.update { current ->
                current.copy(confirmationField = current.confirmationField.copy(value = value, touched = true))
            }
        }

        fun presentConfirmSheet() {
            if (!_state.value.isReadyToCommit) return
            _state.update { it.copy(sheetPhase = ConfirmSheetPhase.Visible, biometricErrorMessage = null) }
        }

        fun dismissConfirmSheet() {
            if (_state.value.sheetPhase == ConfirmSheetPhase.Authenticating) return
            _state.update { it.copy(sheetPhase = ConfirmSheetPhase.Hidden, biometricErrorMessage = null) }
        }

        /**
         * Marks authentication as in-flight. The host calls this just
         * before invoking the platform BiometricPrompt.
         */
        fun requestBiometric() {
            val current = _state.value
            if (current.sheetPhase != ConfirmSheetPhase.Visible || !current.isReadyToCommit) return
            _state.update { it.copy(sheetPhase = ConfirmSheetPhase.Authenticating, biometricErrorMessage = null) }
        }

        /**
         * Drive the post-auth state machine. On success runs the
         * transfer; on failure surfaces an inline error and returns the
         * sheet to the Visible phase so the user can retry.
         */
        fun handleBiometricResult(
            success: Boolean,
            errorMessage: String? = null,
        ) {
            if (!success) {
                _state.update {
                    it.copy(
                        sheetPhase = ConfirmSheetPhase.Visible,
                        biometricErrorMessage = errorMessage ?: "Authentication failed. Try again.",
                    )
                }
                return
            }
            viewModelScope.launch {
                val current = _state.value
                if (!current.isReadyToCommit) return@launch
                // RN identifies the buyer by email so off-platform buyers
                // work too (`owners/transfer.tsx:41-43`); effective_date
                // is omitted so the transfer takes effect immediately.
                val result =
                    ownersRepo.transfer(
                        homeId,
                        TransferOwnerRequest(buyerEmail = current.recipientEmail),
                    )
                when (result) {
                    is NetworkResult.Success -> {
                        _state.update {
                            it.copy(
                                sheetPhase = ConfirmSheetPhase.Dismissing,
                                toast = TransferToast(text = result.data.message, isError = false),
                                shouldDismiss = true,
                            )
                        }
                    }
                    is NetworkResult.Failure -> {
                        _state.update {
                            it.copy(
                                sheetPhase = ConfirmSheetPhase.Visible,
                                biometricErrorMessage =
                                    result.error.displayMessage(
                                        "Couldn't complete the transfer. Try again.",
                                    ),
                            )
                        }
                    }
                }
            }
        }

        fun setBiometryLabel(label: String) {
            _state.update { it.copy(biometryLabel = label) }
        }

        fun dismissToast() {
            _state.update { it.copy(toast = null) }
        }

        fun acknowledgeDismiss() {
            _state.update { it.copy(shouldDismiss = false) }
        }

        private fun displayName(owner: OwnerDto): String {
            owner.user?.name?.takeIf { it.isNotBlank() }?.let { return it }
            owner.user?.username?.takeIf { it.isNotBlank() }?.let { return "@$it" }
            return "Owner · ${owner.subjectId.takeLast(4)}"
        }

        private fun joinNames(names: List<String>): String =
            when (names.size) {
                0 -> ""
                1 -> names[0]
                2 -> "${names[0]} and ${names[1]}"
                else -> "${names.dropLast(1).joinToString(", ")} and ${names.last()}"
            }

        private companion object {
            fun formatNow(): String = SimpleDateFormat("HH:mm MMM d", Locale.getDefault()).format(Date())
        }
    }
