@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.handshake

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.audience.PersonaSummaryDto
import app.pantopus.android.data.api.models.audience.PersonaTierDto
import app.pantopus.android.data.api.models.handshake.HandshakeBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.handshake.HandshakeError
import app.pantopus.android.data.handshake.HandshakeOutcome
import app.pantopus.android.data.handshake.PrivacyHandshakeRepository
import app.pantopus.android.ui.screens.shared.wizard.WizardChrome
import app.pantopus.android.ui.screens.shared.wizard.WizardLeadingControl
import app.pantopus.android.ui.screens.shared.wizard.WizardModel
import app.pantopus.android.ui.screens.shared.wizard.WizardProgressLabel
import app.pantopus.android.ui.screens.shared.wizard.WizardSecondaryCta
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Privacy Handshake VM — conforms to [WizardModel] so it plugs into
 * the shared `WizardShell`. Mirrors iOS:
 *   - load(): fetch persona / tiers / suggestion / follow-status
 *   - handle entry → tier selection (free preselected)
 *   - submit → completedFree, opensCheckout, or stay on handle entry
 *     with a typed error
 */
@HiltViewModel
class PrivacyHandshakeViewModel
    @Inject
    constructor(
        private val repository: PrivacyHandshakeRepository,
        private val savedStateHandle: SavedStateHandle,
    ) : ViewModel(), WizardModel {
        private val _state = MutableStateFlow<HandshakeUiState>(HandshakeUiState.Loading)
        val state: StateFlow<HandshakeUiState> = _state.asStateFlow()

        /** Emit once when the user closes / completes the wizard. The
         *  composable collects this and pops the back stack. */
        private val _dismissEvents = MutableStateFlow(0)
        val dismissEvents: StateFlow<Int> = _dismissEvents.asStateFlow()

        /** Latest checkout URL the host should open in a browser
         *  intent. Cleared after consumption. */
        private val _openCheckoutUrl = MutableStateFlow<String?>(null)
        val openCheckoutUrl: StateFlow<String?> = _openCheckoutUrl.asStateFlow()

        private val personaHandle: String =
            savedStateHandle.get<String>(HANDLE_KEY) ?: ""

        private val preselectedTierRank: Int? =
            savedStateHandle.get<String>(PRESELECTED_TIER_RANK_KEY)?.toIntOrNull()

        private var ready: HandshakeReadyContent? = null
        private var isSubmitting: Boolean = false

        fun load() {
            _state.value = HandshakeUiState.Loading
            if (personaHandle.isBlank()) {
                _state.value = HandshakeUiState.Error("Missing persona handle.")
                return
            }
            viewModelScope.launch { fetchAndProject() }
        }

        private suspend fun fetchAndProject() {
            val personaResp =
                when (val r = repository.persona(personaHandle)) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = HandshakeUiState.Error("Couldn't open Privacy Handshake.")
                        return
                    }
                }
            val persona = personaResp.persona
            if (persona == null) {
                _state.value = HandshakeUiState.Error("Public Profile not found.")
                return
            }
            val tiers =
                when (val r = repository.tiers(personaHandle)) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = HandshakeUiState.Error("Couldn't open Privacy Handshake.")
                        return
                    }
                }
            val suggestion =
                when (val r = repository.fanHandleSuggestion(personaHandle)) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = HandshakeUiState.Error("Couldn't open Privacy Handshake.")
                        return
                    }
                }
            val followStatus =
                when (val r = repository.followStatus(persona.id)) {
                    is NetworkResult.Success -> r.data
                    is NetworkResult.Failure -> {
                        _state.value = HandshakeUiState.Error("Couldn't open Privacy Handshake.")
                        return
                    }
                }
            val isMember = followStatus.following == true || followStatus.status == "active"
            val preview = previewFrom(persona)
            val options = tiers.tiers.map(::option)
            val defaultRank =
                preselectedTierRank
                    ?: options.firstOrNull { it.rank == 1 }?.rank
                    ?: options.firstOrNull()?.rank
                    ?: 1
            val content =
                HandshakeReadyContent(
                    persona = preview,
                    tierOptions = options,
                    step = if (isMember) HandshakeStep.AlreadyMember else HandshakeStep.HandleEntry,
                    handle =
                        HandshakeHandleState(
                            value = suggestion.suggestion.orEmpty(),
                            locked = suggestion.locked == true,
                        ),
                    selectedTierRank = defaultRank,
                )
            ready = content
            _state.value = HandshakeUiState.Ready(content)
        }

        // MARK: - User actions

        fun setHandle(value: String) {
            val current = ready ?: return
            val handle = current.handle.copy(value = value, error = null, matchesUsername = false)
            update(current.copy(handle = handle))
        }

        fun setAcknowledgedUsingUsername(value: Boolean) {
            val current = ready ?: return
            update(current.copy(handle = current.handle.copy(acknowledgedUsingUsername = value)))
        }

        fun selectTier(rank: Int) {
            val current = ready ?: return
            update(current.copy(selectedTierRank = rank))
        }

        fun consumeCheckoutUrl() {
            _openCheckoutUrl.value = null
        }

        // MARK: - WizardModel

        override val chrome: WizardChrome
            get() {
                val current = ready
                if (current == null) {
                    return WizardChrome(
                        title = "Privacy Handshake",
                        progressLabel = WizardProgressLabel.StepOf(current = 1, total = 2),
                        progressFraction = 0f,
                        leading = WizardLeadingControl.Close,
                        primaryCtaLabel = "Continue",
                        primaryCtaEnabled = false,
                        isSubmitting = false,
                        dirty = false,
                        showsProgressBar = true,
                    )
                }
                return when (val step = current.step) {
                    HandshakeStep.HandleEntry ->
                        WizardChrome(
                            title = "Privacy Handshake",
                            progressLabel = WizardProgressLabel.StepOf(1, 2),
                            progressFraction = 0.5f,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Continue",
                            primaryCtaEnabled =
                                current.handle.isValid &&
                                    (!current.handle.matchesUsername || current.handle.acknowledgedUsingUsername),
                            isSubmitting = false,
                            dirty = false,
                            showsProgressBar = true,
                        )
                    HandshakeStep.TierSelection, HandshakeStep.Submitting -> {
                        val tier = current.selectedTier
                        val label =
                            when {
                                tier == null -> "Continue"
                                tier.isFree -> "Become a ${singularize(current.persona.audienceLabel)}"
                                else -> "Continue · ${tier.priceLabel}"
                            }
                        WizardChrome(
                            title = "Privacy Handshake",
                            progressLabel = WizardProgressLabel.StepOf(2, 2),
                            progressFraction = 1f,
                            leading = WizardLeadingControl.Back,
                            primaryCtaLabel = label,
                            primaryCtaEnabled = tier != null,
                            isSubmitting = step == HandshakeStep.Submitting,
                            dirty = false,
                            showsProgressBar = true,
                        )
                    }
                    is HandshakeStep.OpensCheckout ->
                        WizardChrome(
                            title = "Opening Checkout",
                            progressLabel = WizardProgressLabel.Hidden,
                            progressFraction = null,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Opening Checkout…",
                            primaryCtaEnabled = false,
                            isSubmitting = true,
                            dirty = false,
                            showsProgressBar = false,
                        )
                    HandshakeStep.CompletedFree ->
                        WizardChrome(
                            title = "You're following",
                            progressLabel = WizardProgressLabel.Hidden,
                            progressFraction = null,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Done",
                            primaryCtaEnabled = true,
                            secondaryCta =
                                WizardSecondaryCta(
                                    label = "Manage notifications",
                                    testTag = "handshakeManageNotifications",
                                ),
                            isSubmitting = false,
                            dirty = false,
                            showsProgressBar = false,
                        )
                    HandshakeStep.AlreadyMember ->
                        WizardChrome(
                            title = "Already a follower",
                            progressLabel = WizardProgressLabel.Hidden,
                            progressFraction = null,
                            leading = WizardLeadingControl.Close,
                            primaryCtaLabel = "Done",
                            primaryCtaEnabled = true,
                            secondaryCta =
                                WizardSecondaryCta(
                                    label = "Manage notifications",
                                    testTag = "handshakeManageNotifications",
                                ),
                            isSubmitting = false,
                            dirty = false,
                            showsProgressBar = false,
                        )
                }
            }

        override fun onLeading() {
            val current = ready
            if (current == null || current.step != HandshakeStep.TierSelection) {
                _dismissEvents.value = _dismissEvents.value + 1
                return
            }
            update(current.copy(step = HandshakeStep.HandleEntry))
        }

        override fun onDiscard() {
            _dismissEvents.value = _dismissEvents.value + 1
        }

        override fun onPrimary() {
            val current = ready ?: return
            when (current.step) {
                HandshakeStep.HandleEntry -> update(current.copy(step = HandshakeStep.TierSelection))
                HandshakeStep.TierSelection -> submitHandshake()
                HandshakeStep.Submitting, is HandshakeStep.OpensCheckout -> Unit
                HandshakeStep.CompletedFree, HandshakeStep.AlreadyMember ->
                    _dismissEvents.value = _dismissEvents.value + 1
            }
        }

        override fun onSecondary() {
            _dismissEvents.value = _dismissEvents.value + 1
        }

        // MARK: - Submit

        private fun submitHandshake() {
            if (isSubmitting) return
            val current = ready ?: return
            val tier = current.selectedTier ?: return
            if (!current.handle.isValid) {
                update(
                    current.copy(
                        handle =
                            current.handle.copy(
                                error = "Handle must be 3–40 letters, numbers, dots, dashes, or underscores.",
                            ),
                    ),
                )
                return
            }
            isSubmitting = true
            update(current.copy(step = HandshakeStep.Submitting))
            val body =
                HandshakeBody(
                    tierRank = tier.rank,
                    fanHandle = current.handle.value.trim(),
                    fanDisplayName = null,
                    fanAvatarUrl = null,
                    acknowledgedPlatformTrust = true,
                    acknowledgedUsingPantopusUsername =
                        if (current.handle.matchesUsername) current.handle.acknowledgedUsingUsername else null,
                )
            viewModelScope.launch {
                when (val outcome = repository.submit(current.persona.id, body)) {
                    is HandshakeOutcome.Success -> {
                        isSubmitting = false
                        val response = outcome.response
                        if (response.requiresPayment == true && response.subscribeUrl != null) {
                            update(current.copy(step = HandshakeStep.OpensCheckout(response.subscribeUrl)))
                            _openCheckoutUrl.value = response.subscribeUrl
                        } else {
                            update(current.copy(step = HandshakeStep.CompletedFree))
                        }
                    }
                    is HandshakeOutcome.Error -> {
                        isSubmitting = false
                        applyError(outcome.error)
                    }
                }
            }
        }

        private fun applyError(error: HandshakeError) {
            val current = ready ?: return
            val handle =
                when (error) {
                    HandshakeError.HandleTaken ->
                        current.handle.copy(error = "That handle is already taken. Try another.")
                    HandshakeError.UsernameRequiresAck ->
                        current.handle.copy(
                            matchesUsername = true,
                            error = "Confirm you want to reuse your Pantopus username.",
                        )
                    is HandshakeError.Validation ->
                        current.handle.copy(error = error.message ?: "That handle isn't valid.")
                    is HandshakeError.Other ->
                        current.handle.copy(error = error.message)
                }
            update(current.copy(step = HandshakeStep.HandleEntry, handle = handle))
        }

        private fun update(content: HandshakeReadyContent) {
            ready = content
            _state.value = HandshakeUiState.Ready(content)
        }

        companion object {
            const val HANDLE_KEY = "personaHandle"
            const val PRESELECTED_TIER_RANK_KEY = "preselectedTierRank"

            internal fun previewFrom(persona: PersonaSummaryDto): HandshakePersonaPreview =
                HandshakePersonaPreview(
                    id = persona.id,
                    handle = persona.handle.orEmpty(),
                    displayName = persona.displayName ?: persona.handle ?: "Public Profile",
                    avatarUrl = persona.avatarUrl,
                    bio = persona.bio,
                    audienceLabel = persona.audienceLabel ?: "Followers",
                    followerCount = persona.followerCount ?: 0,
                )

            internal fun option(dto: PersonaTierDto): HandshakeTierOption =
                HandshakeTierOption(
                    id = dto.id,
                    rank = dto.rank,
                    name = dto.name,
                    description = dto.description,
                    priceCents = dto.priceCents ?: 0,
                    currency = dto.currency ?: "usd",
                )

            /** "followers" → "follower"; "Members" → "member". */
            internal fun singularize(label: String): String {
                val lower = label.lowercase()
                return if (lower.endsWith("s")) lower.dropLast(1) else lower
            }
        }
    }
