@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.token_accept

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.token_accept.GuestPassDto
import app.pantopus.android.data.api.models.token_accept.HomeInviteDetailsDto
import app.pantopus.android.data.api.models.token_accept.HomeInviteResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.token_accept.TokenAcceptRepository
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import kotlin.math.ceil

/**
 * Resolves an invite token into one of three offers, then drives
 * accept / decline via the matching route. Mirrors iOS exactly.
 */
@HiltViewModel
class TokenAcceptViewModel
    @Inject
    constructor(
        private val repository: TokenAcceptRepository,
        private val auth: AuthRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val token: String = savedStateHandle.get<String>(TOKEN_KEY) ?: ""

        private val _state = MutableStateFlow<TokenAcceptUiState>(TokenAcceptUiState.Loading)
        val state: StateFlow<TokenAcceptUiState> = _state.asStateFlow()

        /** Increments when the user finishes the screen so the host
         *  can pop the back stack / dismiss. */
        private val _dismissEvents = MutableStateFlow(0)
        val dismissEvents: StateFlow<Int> = _dismissEvents.asStateFlow()

        fun load() {
            if (token.isBlank()) {
                _state.value = TokenAcceptUiState.Expired("Missing invite token.")
                return
            }
            _state.value = TokenAcceptUiState.Loading
            viewModelScope.launch {
                val identity = identityChip()
                val homeAsync = async { repository.homeInvite(token) }
                val seatAsync = async { repository.businessSeatInvite(token) }
                val guestAsync = async { repository.guestPass(token) }
                val home = homeAsync.await()
                val seat = seatAsync.await()
                val guest = guestAsync.await()

                if (home is NetworkResult.Success && home.data.invitation != null) {
                    val response = home.data
                    val invitation = response.invitation
                    if (response.expired == true || invitation?.status == "expired") {
                        _state.value =
                            TokenAcceptUiState.Expired("This invitation has expired. Ask the sender for a new link.")
                        return@launch
                    }
                    if (response.alreadyUsed == true || invitation?.status == "accepted") {
                        _state.value = TokenAcceptUiState.Expired("This invitation has already been used.")
                        return@launch
                    }
                    if (invitation != null) {
                        _state.value =
                            TokenAcceptUiState.Ready(makeHomeOffer(response, invitation, identity))
                        return@launch
                    }
                }
                if (seat is NetworkResult.Success && seat.data.seatId != null) {
                    _state.value = TokenAcceptUiState.Ready(makeSeatOffer(seat.data, identity))
                    return@launch
                }
                if (guest is NetworkResult.Success && guest.data.pass != null) {
                    _state.value = TokenAcceptUiState.Ready(makeGuestOffer(guest.data.pass, identity))
                    return@launch
                }
                _state.value =
                    TokenAcceptUiState.Expired("We couldn't find this invitation. It might have expired or been used.")
            }
        }

        fun accept() {
            val ready = _state.value as? TokenAcceptUiState.Ready ?: return
            val offer = ready.offer
            _state.value = TokenAcceptUiState.Accepting(offer)
            viewModelScope.launch {
                val result =
                    when (offer.inviteType) {
                        InviteType.HomeInvite -> repository.acceptHomeInvite(token)
                        InviteType.BusinessSeat -> repository.acceptBusinessSeat(token)
                        InviteType.GuestPass -> NetworkResult.Success(Unit)
                    }
                when (result) {
                    is NetworkResult.Success<*> -> {
                        val message =
                            when (offer.inviteType) {
                                InviteType.HomeInvite ->
                                    "You're now a member of ${offer.venue}."
                                InviteType.BusinessSeat ->
                                    "Welcome to ${offer.venue} — your seat is active."
                                InviteType.GuestPass ->
                                    "Your guest pass is active. Welcome to ${offer.venue}."
                            }
                        _state.value = TokenAcceptUiState.Accepted(offer, message)
                    }
                    is NetworkResult.Failure ->
                        _state.value = TokenAcceptUiState.Error("Couldn't accept this invitation.")
                }
            }
        }

        fun decline() {
            val ready = _state.value as? TokenAcceptUiState.Ready ?: return
            val offer = ready.offer
            viewModelScope.launch {
                when (offer.inviteType) {
                    InviteType.HomeInvite ->
                        offer.invitationId?.let { repository.declineHomeInvite(it) }
                    InviteType.BusinessSeat ->
                        repository.declineBusinessSeat(token)
                    InviteType.GuestPass -> Unit
                }
                _state.value = TokenAcceptUiState.Declined
            }
        }

        fun dismiss() {
            _dismissEvents.value = _dismissEvents.value + 1
        }

        // MARK: - Projection

        private fun identityChip(): IdentityChipContent {
            val signed = auth.state.value as? AuthRepository.State.SignedIn
            val user = signed?.user
            val label = user?.displayName?.takeIf { it.isNotEmpty() } ?: user?.email ?: "Accepting as guest"
            return IdentityChipContent(label = label)
        }

        companion object {
            const val TOKEN_KEY = "token"

            internal fun makeHomeOffer(
                home: HomeInviteResponse,
                invitation: HomeInviteDetailsDto,
                identity: IdentityChipContent,
            ): TokenAcceptOffer {
                val homeName = home.home?.name ?: "this home"
                val city = home.home?.city
                val venue =
                    listOfNotNull(homeName.takeIf { it.isNotBlank() }, city?.takeIf { it.isNotBlank() })
                        .joinToString(" · ")
                val sender = home.inviter?.name ?: home.inviter?.username ?: "Someone"
                val role = humanRole(invitation.proposedRole ?: "member")
                return TokenAcceptOffer(
                    invitationId = invitation.id,
                    inviteType = InviteType.HomeInvite,
                    title = "Join a home",
                    sender = "$sender invited you",
                    roleOffered = role,
                    venue = venue.ifEmpty { homeName },
                    benefits = homeBenefits(invitation.proposedRole),
                    expiry = formatExpiry(invitation.expiresAt),
                    safetyBand =
                        SafetyBand(
                            icon = PantopusIcon.Lock,
                            text = "Your email and personal account stay private — $sender only sees your accepted role.",
                        ),
                    primaryCtaLabel = "Join $homeName",
                    secondaryCtaLabel = "Decline",
                    identityChip = identity,
                )
            }

            internal fun makeSeatOffer(
                seat: app.pantopus.android.data.api.models.token_accept.BusinessSeatInviteResponse,
                identity: IdentityChipContent,
            ): TokenAcceptOffer {
                val venue = seat.business?.name ?: seat.business?.username ?: "this business"
                val sender = seat.business?.name ?: "The team"
                val role = humanRole(seat.roleBase ?: "member")
                return TokenAcceptOffer(
                    invitationId = seat.seatId,
                    inviteType = InviteType.BusinessSeat,
                    title = "Accept a business seat",
                    sender = "$sender offered you a seat",
                    roleOffered = role,
                    venue = venue,
                    benefits = seatBenefits(seat.roleBase),
                    expiry = null,
                    safetyBand =
                        SafetyBand(
                            icon = PantopusIcon.ShieldCheck,
                            text = "Your seat is firewalled — coworkers see your business profile, not your local identity.",
                        ),
                    primaryCtaLabel = "Add me to $venue",
                    secondaryCtaLabel = "Decline",
                    identityChip = identity,
                )
            }

            internal fun makeGuestOffer(
                pass: GuestPassDto,
                identity: IdentityChipContent,
            ): TokenAcceptOffer {
                val venue = pass.homeName ?: pass.customTitle ?: "the host's place"
                val kind = (pass.kind ?: "guest").replace('_', ' ')
                val label = pass.label ?: pass.customTitle ?: "Guest pass"
                return TokenAcceptOffer(
                    invitationId = null,
                    inviteType = InviteType.GuestPass,
                    title = label,
                    sender = "Welcome to $venue",
                    roleOffered = humanRole(kind),
                    venue = venue,
                    benefits = guestBenefits(pass.welcomeMessage, pass.expiresAt),
                    expiry = formatExpiry(pass.expiresAt),
                    safetyBand =
                        SafetyBand(
                            icon = PantopusIcon.Lock,
                            text = "Guest passes never reveal your account email — you stay anonymous to the host.",
                        ),
                    primaryCtaLabel = "View guest pass",
                    secondaryCtaLabel = "Not now",
                    identityChip = identity,
                )
            }

            internal fun humanRole(raw: String): String {
                val normalized = raw.replace('_', ' ').trim()
                if (normalized.isEmpty()) return "Member"
                return normalized.first().uppercaseChar() + normalized.drop(1)
            }

            internal fun homeBenefits(role: String?): List<String> {
                val lower = role?.lowercase().orEmpty()
                return when {
                    lower.contains("owner") || lower.contains("co_owner") ->
                        listOf(
                            "Co-manage occupants, ownership, and home settings",
                            "Share home docs, wi-fi, and entry info with guests",
                            "See all home activity in your Hub",
                        )
                    lower.contains("renter") || lower.contains("tenant") ->
                        listOf(
                            "See house docs, wi-fi, and entry info",
                            "Get notified about home updates and tasks",
                            "Mark yourself as a resident in your local profile",
                        )
                    else ->
                        listOf(
                            "See house docs, wi-fi, and entry info",
                            "Get home updates in your Hub",
                            "Privately label yourself a resident if you want",
                        )
                }
            }

            internal fun seatBenefits(role: String?): List<String> {
                val lower = role?.lowercase().orEmpty()
                val list =
                    mutableListOf<String>(
                        "Post and respond as ${humanRole(role ?: "member")}",
                        "Access the business dashboard and team feed",
                    )
                if (lower.contains("admin") || lower.contains("manager")) {
                    list.add("Invite teammates and manage seats")
                } else {
                    list.add("Switch identities anytime in the You tab")
                }
                return list
            }

            internal fun guestBenefits(
                welcomeMessage: String?,
                expiresAt: String?,
            ): List<String> {
                val list = mutableListOf<String>()
                welcomeMessage?.takeIf { it.isNotBlank() }?.let(list::add)
                list.add("See wi-fi, parking, and entry info during your stay")
                daysFromNow(expiresAt)?.let { days ->
                    list.add("Valid for $days day${if (days == 1) "" else "s"}")
                }
                return list
            }

            internal fun formatExpiry(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
                val zoned = instant.atZone(java.time.ZoneId.systemDefault())
                val formatter = java.time.format.DateTimeFormatter.ofPattern("MMM d, yyyy h:mm a")
                return "Expires ${zoned.format(formatter)}"
            }

            internal fun daysFromNow(iso: String?): Int? {
                if (iso.isNullOrBlank()) return null
                val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return null
                val seconds = Duration.between(Instant.now(), instant).seconds
                if (seconds <= 0) return null
                return ceil(seconds.toDouble() / 86400.0).toInt()
            }
        }
    }
