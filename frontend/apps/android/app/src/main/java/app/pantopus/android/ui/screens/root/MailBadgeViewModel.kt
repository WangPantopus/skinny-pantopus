package app.pantopus.android.ui.screens.root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.flow.stateIn
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
        /** Every drawers read updates it, the Mailbox's own included, so the badge and the Mailbox agree. */
        val unopened: StateFlow<Int> = repo.unopened.map { it ?: 0 }.stateIn(viewModelScope, SharingStarted.Eagerly, 0)

        private var refreshJob: Job? = null
        private var refreshAgain = false

        init {
            if (LaunchFeatures.mailbox) {
                viewModelScope.launch {
                    merge(
                        MailboxRepository.mailViewed,
                        MailboxRepository.mailLeftList,
                        MailboxRepository.mailChanged,
                        MailboxRepository.mailArrived,
                    ).collect {
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
                        // A read that works updates [unopened]; the badge is chrome and keeps its count until one does.
                        if (repo.drawers() is NetworkResult.Failure) {
                            Timber.w("Mail badge refresh failed: the mailbox's drawers are unavailable")
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
