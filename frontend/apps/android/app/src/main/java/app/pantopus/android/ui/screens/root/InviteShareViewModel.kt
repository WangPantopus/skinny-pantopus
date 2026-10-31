package app.pantopus.android.ui.screens.root

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.profile.ProfileInsightsRepository
import app.pantopus.android.ui.components.InviteLinks
import app.pantopus.android.ui.components.shareText
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Every invite shares the person's own link (`GET /api/users/me/invite-code`, pantopus.com/join/<code>): a friend who
 * opens it sees who invited them over the address lookup, and signing up there credits the person who sent it. The
 * link comes through the screens' store (cached per account); when it can't be read, the address lookup at /start
 * goes out instead, which works for everyone. Mirrors iOS `PersonalInviteLink`.
 */
@HiltViewModel
class InviteShareViewModel
    @Inject
    constructor(
        private val insights: ProfileInsightsRepository,
    ) : ViewModel() {
        /** Opens the share sheet with [message] followed by the person's own invite link. */
        fun share(
            context: Context,
            message: String,
            chooserTitle: String,
        ) = withLink { link -> context.shareText("$message $link", chooserTitle) }

        /** Runs [block] with the person's own invite link once it has been read (an email draft, a share). */
        fun withLink(block: (String) -> Unit) {
            viewModelScope.launch { block(link()) }
        }

        /** The person's own invite link, or the address lookup at /start. */
        suspend fun link(): String {
            val dto = insights.inviteCodeStored().data
            return dto?.inviteUrl?.takeIf { it.isNotBlank() }
                ?: dto?.inviteCode?.takeIf { it.isNotBlank() }?.let { InviteLinks.publicPageUrl("/join/${Uri.encode(it)}") }
                ?: InviteLinks.publicPageUrl("/start")
        }
    }
