package app.pantopus.android.ui.screens.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.mailbox.v2.DrawerListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * The Mail tab's badge: how many delivered pieces are still unopened (the Mail tab, 2026-10-27). It reads the
 * mailbox's drawers when the app comes back, after a letter is opened or leaves its tab, and when a mail push
 * arrives. Nothing is read while Mailbox is off, when the Mail tab is the conversation list.
 */
@HiltViewModel
class MailBadgeViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
    ) : ViewModel() {
        private val _unopened = MutableStateFlow(0)
        val unopened: StateFlow<Int> = _unopened.asStateFlow()

        private var refreshJob: Job? = null
        private var refreshAgain = false

        init {
            if (LaunchFeatures.mailbox) {
                viewModelScope.launch {
                    merge(MailboxRepository.mailViewed, MailboxRepository.mailLeftList, MailboxRepository.mailArrived).collect {
                        refresh()
                    }
                }
            }
        }

        /** Reads the count again; a read already running is followed by one more, so the newest change shows. */
        fun refresh() {
            if (!LaunchFeatures.mailbox) return
            if (refreshJob?.isActive == true) {
                refreshAgain = true
                return
            }
            refreshJob =
                viewModelScope.launch {
                    try {
                        when (val result = repo.drawers()) {
                            is NetworkResult.Success -> _unopened.value = result.data.unopenedTotal()
                            // The badge is chrome: it keeps the last count it knew until a read works.
                            is NetworkResult.Failure -> Timber.w("Mail badge refresh failed: the mailbox's drawers are unavailable")
                        }
                    } finally {
                        refreshJob = null
                        if (refreshAgain) {
                            refreshAgain = false
                            refresh()
                        }
                    }
                }
        }
    }

/** The drawers the Mail badge counts: Me, Home and Biz. Earn stays out while Mail extras are off. */
private val MAIL_BADGE_DRAWERS = setOf("personal", "home", "business")

/** The server's `unread_total` once it sends one; until then the Me, Home and Biz drawers' unread counts. */
internal fun DrawerListResponse.unopenedTotal(): Int =
    (unreadTotal ?: drawers.filter { it.drawer in MAIL_BADGE_DRAWERS }.sumOf { it.unreadCount }).coerceAtLeast(0)
