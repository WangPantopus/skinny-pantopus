@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.profile.ProfileInsightsRepository
import app.pantopus.android.ui.components.InviteLinks
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * What the share sheet asks the server: the person's invite code for the card's page link, so a sign-up from it credits
 * them, and a count of what got shared. Nothing about the card's note or names leaves the phone.
 */
@HiltViewModel
class CardShareViewModel
    @Inject
    constructor(
        private val insights: ProfileInsightsRepository,
        private val cards: HolidayCardsRepository,
    ) : ViewModel() {
        /** `{web}/cards/{slug}?ref={invite code}`; a sealed card must not give away its picture, so its link is `/cards`. */
        suspend fun cardPageLink(card: CardOnTable): String {
            val code = insights.inviteCodeStored().data?.inviteCode?.takeIf { it.isNotBlank() }
            val path = card.slug?.takeIf { !card.sealed && it.isNotBlank() }?.let { "/cards/${Uri.encode(it)}" } ?: "/cards"
            return InviteLinks.publicPageUrl(path + (code?.let { "?ref=${Uri.encode(it)}" }.orEmpty()))
        }

        /** Tells the server's counts what was shared, if it can; a failure here never gets in the way. */
        fun shared(
            design: String,
            kind: String,
            format: String,
            withNote: Boolean,
        ) {
            viewModelScope.launch { cards.cardShared(design, kind, format, withNote) }
        }
    }
