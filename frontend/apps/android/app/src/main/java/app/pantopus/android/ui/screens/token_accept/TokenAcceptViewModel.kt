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
import app.pantopus.android.data.homes.HomeInvitationPreview
import app.pantopus.android.data.homes.homeTaskUUID
import app.pantopus.android.data.token_accept.TokenAcceptRepository
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
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
        private val invitations: HomeInvitationDecisionFactory,
    ) : ViewModel() {
        private val token: String = savedStateHandle.get<String>(TOKEN_KEY) ?: ""

        private val _state = MutableStateFlow<TokenAcceptUiState>(TokenAcceptUiState.Loading)
        val state: StateFlow<TokenAcceptUiState> = _state.asStateFlow()

        /** Increments when the user finishes the screen so the host
         *  can pop the back stack / dismiss. */
        private val _dismissEvents = MutableStateFlow(0)
        val dismissEvents: StateFlow<Int> = _dismissEvents.asStateFlow()

        private var generation = 0L
        private var visible = false
        private var lifetime: Job? = null
        private var session: HomeClaimSessionScope? = null

        fun pause() {
            generation++
            visible = false
            lifetime?.cancel()
            lifetime = null
            session = null
            _state.value = TokenAcceptUiState.Loading
        }

        fun load() {
            pause()
            visible = true
            val revision = generation
            val job = SupervisorJob(viewModelScope.coroutineContext[Job])
            lifetime = job
            val scope = CoroutineScope(viewModelScope.coroutineContext + job)
            val current = invitations.session(scope)
            session = current
            if (token.isBlank() || token.length > 512) {
                _state.value = TokenAcceptUiState.Expired("Missing or invalid invitation link.")
                return
            }
            scope.launch {
                current.invalidated.collect { invalidated ->
                    if (invalidated && visible && generation == revision) {
                        pause()
                        _state.value = TokenAcceptUiState.Error("Your session changed. Reopen the invitation to continue.")
                    }
                }
            }
            scope.launch {
                try {
                    current.requireCurrent()
                    val original =
                        try {
                            invitations.hasOriginal(current)
                        } catch (
                            cancelled: CancellationException,
                        ) {
                            throw cancelled
                        } catch (_: Exception) {
                            true
                        }
                    current.requireCurrent()
                    if (!isCurrent(revision)) return@launch
                    if (original) {
                        _state.value = TokenAcceptUiState.HomeInvitation
                        return@launch
                    }
                    val resolved = resolveOffer()
                    current.requireCurrent()
                    if (isCurrent(revision)) _state.value = resolved
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    if (visible && generation == revision) {
                        _state.value = TokenAcceptUiState.Error("The invitation could not be checked right now. Try again.")
                    }
                }
            }
        }

        private suspend fun resolveOffer(): TokenAcceptUiState =
            coroutineScope {
                val homeAsync = async { invitations.preview(token) }
                val seatAsync = async { repository.businessSeatInvite(token) }
                val guestAsync = async { repository.guestPass(token) }
                val home = homeAsync.await()
                val seat = seatAsync.await()
                val guest = guestAsync.await()
                when {
                    home == HomeInvitationPreview.Found -> TokenAcceptUiState.HomeInvitation
                    seat is NetworkResult.Success && homeTaskUUID(seat.data.seatId) ->
                        TokenAcceptUiState.Ready(makeSeatOffer(seat.data, identityChip()))
                    guest is NetworkResult.Success && guest.data.pass != null ->
                        TokenAcceptUiState.Ready(makeGuestOffer(guest.data.pass, identityChip()))
                    home == HomeInvitationPreview.Missing && missing(seat) && missing(guest) ->
                        TokenAcceptUiState.Expired("This invitation could not be found. Check the complete link with the sender.")
                    else -> TokenAcceptUiState.Error("The invitation could not be checked right now. Try again.")
                }
            }

        private fun isCurrent(revision: Long): Boolean = visible && generation == revision && session?.isCurrent == true

        private fun missing(result: NetworkResult<*>): Boolean = result is NetworkResult.Failure && result.error.code == 404

        fun accept() {
            val ready = _state.value as? TokenAcceptUiState.Ready ?: return
            val revision = generation
            if (!isCurrent(revision)) return
            val offer = ready.offer
            if (offer.inviteType == InviteType.HomeInvite) {
                _state.value = TokenAcceptUiState.HomeInvitation
                return
            }
            _state.value = TokenAcceptUiState.Accepting(offer)
            viewModelScope.launch {
                val result =
                    when (offer.inviteType) {
                        InviteType.BusinessSeat -> repository.acceptBusinessSeat(token)
                        else -> NetworkResult.Success(Unit)
                    }
                if (!isCurrent(revision)) return@launch
                _state.value =
                    when (result) {
                        is NetworkResult.Success<*> ->
                            TokenAcceptUiState.Accepted(
                                offer,
                                if (offer.inviteType == InviteType.GuestPass) {
                                    "Your guest pass is ready to view."
                                } else {
                                    "Your business seat acceptance is saved."
                                },
                            )
                        is NetworkResult.Failure ->
                            TokenAcceptUiState.Error(
                                "The acceptance could not be confirmed. Retry to check the invitation's current status.",
                            )
                    }
            }
        }

        fun decline() {
            val ready = _state.value as? TokenAcceptUiState.Ready ?: return
            val revision = generation
            if (!isCurrent(revision)) return
            val offer = ready.offer
            if (offer.inviteType == InviteType.HomeInvite) {
                _state.value = TokenAcceptUiState.HomeInvitation
                return
            }
            _state.value = TokenAcceptUiState.Accepting(offer)
            viewModelScope.launch {
                val result =
                    if (offer.inviteType == InviteType.BusinessSeat) {
                        repository.declineBusinessSeat(
                            token,
                        )
                    } else {
                        NetworkResult.Success(Unit)
                    }
                if (!isCurrent(revision)) return@launch
                _state.value =
                    when (result) {
                        is NetworkResult.Success<*> -> TokenAcceptUiState.Declined
                        is NetworkResult.Failure ->
                            TokenAcceptUiState.Error(
                                "The decline could not be confirmed. Retry to check the invitation's current status.",
                            )
                    }
            }
        }

        fun dismiss() {
            pause()
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
