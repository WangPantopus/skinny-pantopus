@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.core.routing.PendingDeepLinkStore
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * "Joined for a card" (TABCARD §3, drawing CardArrival): the first time an account's tabs show on this phone, the app
 * asks once whether a Christmas card is waiting for it (`GET /api/mailbox/cards/waiting`: a card sent before they
 * joined, while the account is under 14 days old). A card opens on the Mail tab exactly as a tap on it in the Mailbox
 * does (the card-table reader, or its sealed envelope while sealed), after Mail's "who's holding the phone" check. The
 * account counts as asked once an answer comes, a card or none; a failed read asks again next launch. A link already
 * opening (an invitation, a notification, any deep link) wins, and the account still counts as asked. Parity twin of
 * iOS `WaitingCardLanding`.
 */
@HiltViewModel
class WaitingCardLandingViewModel
    @Inject
    constructor(
        private val auth: AuthRepository,
        private val cards: HolidayCardsRepository,
    ) : ViewModel() {
        private val _open = MutableStateFlow<String?>(null)

        /** The waiting card to open, by its mail id, once; [opened] clears it. */
        val open: StateFlow<String?> = _open.asStateFlow()

        /** The account a link opened something for in these tabs. */
        private var linkFor: String? = null

        init {
            viewModelScope.launch {
                DeepLinkRouter.pending.collect { link -> if (link != null && opensInTabs(link)) linkFor = signedInAccount() }
            }
            viewModelScope.launch {
                auth.state.map { (it as? AuthRepository.State.SignedIn)?.user?.id }.distinctUntilChanged().collectLatest { account ->
                    _open.value = null
                    if (account != null) land(account)
                }
            }
        }

        fun opened() {
            _open.value = null
        }

        private suspend fun land(account: String) {
            if (!LaunchFeatures.holidayCards || !LaunchFeatures.mailbox || cards.waitingAsked(account)) return
            if (linkWaiting(account)) {
                cards.markWaitingAsked(account)
                return
            }
            // A failed read is not an answer: asked again next launch. Signed out or another account meanwhile: not this
            // one's answer.
            val answer = cards.waiting() as? NetworkResult.Success
            if (answer == null || signedInAccount() != account) return
            cards.markWaitingAsked(account)
            val card = answer.data
            if (card != null && !linkWaiting(account)) _open.value = card.mailId
        }

        /** A link is waiting to open (parked through sign-in, or pending now), or one already opened for [account]. */
        private fun linkWaiting(account: String): Boolean =
            linkFor == account || DeepLinkRouter.pending.value?.let(::opensInTabs) == true || PendingDeepLinkStore.peek() != null

        private fun signedInAccount(): String? = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        private companion object {
            /** Links that open something in the signed-in tabs (a join link, a password or email link, or one the app can't read don't). */
            fun opensInTabs(link: DeepLinkRouter.Destination): Boolean =
                when (link) {
                    is DeepLinkRouter.Destination.JoinInvite,
                    is DeepLinkRouter.Destination.ResetPassword,
                    is DeepLinkRouter.Destination.VerifyEmail,
                    is DeepLinkRouter.Destination.Unknown,
                    -> false
                    else -> true
                }
        }
    }
