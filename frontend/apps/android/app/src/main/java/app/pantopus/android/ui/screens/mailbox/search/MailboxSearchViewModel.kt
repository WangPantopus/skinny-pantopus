@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.MailAddressBook
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * Mailbox search, on the server (SRV-3): every piece the person can read (Me, Home once proven, Biz), filed and
 * archived included, newest first. Typing searches after a short pause; each result is drawn as its piece (a sealed
 * letter with its subject in the line under it). A failed search says why and offers Try again.
 */
@HiltViewModel
class MailboxSearchViewModel
    @Inject
    constructor(
        private val repo: MailboxRepository,
        private val auth: AuthRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _results = MutableStateFlow<List<MailPieceModel>>(emptyList())
        val results: StateFlow<List<MailPieceModel>> = _results.asStateFlow()

        private val _isLoading = MutableStateFlow(false)
        val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

        private val _error = MutableStateFlow<String?>(null)

        /** Why the last search failed, said plainly; null when it worked. */
        val error: StateFlow<String?> = _error.asStateFlow()

        private var onOpenMail: (String) -> Unit = {}
        private var book = MailAddressBook(personName = null)
        private var zone: ZoneId = ZoneId.systemDefault()
        private var search: Job? = null

        fun configureNavigation(onOpenMail: (String) -> Unit = {}) {
            this.onOpenMail = onOpenMail
        }

        fun openMail(mailId: String) = onOpenMail(mailId)

        /** Who the person's mail is addressed to, for the drawn pieces; search works without it. */
        fun load() {
            viewModelScope.launch {
                val name = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.displayName
                when (val result = repo.drawers()) {
                    is NetworkResult.Success -> {
                        book = MailAddressBook(personName = name, homes = result.data.homes.orEmpty())
                        zone = MailPieceMapper.zoneOf(result.data.delivery)
                    }
                    is NetworkResult.Failure -> book = MailAddressBook(personName = name)
                }
            }
        }

        fun onQueryChange(value: String) {
            _query.value = value
            search?.cancel()
            _error.value = null
            if (value.isBlank()) {
                _results.value = emptyList()
                _isLoading.value = false
                return
            }
            _isLoading.value = true
            search =
                viewModelScope.launch {
                    delay(TYPING_PAUSE_MS)
                    run(value.trim())
                }
        }

        fun retry() {
            val text = _query.value.trim()
            if (text.isEmpty()) return
            search?.cancel()
            _error.value = null
            _isLoading.value = true
            search = viewModelScope.launch { run(text) }
        }

        private suspend fun run(text: String) {
            when (val result = repo.search(text, limit = PAGE, offset = 0)) {
                is NetworkResult.Success ->
                    _results.value =
                        result.data.mail.map { row ->
                            val piece = MailPieceMapper.piece(row, book, zone)
                            // A sealed letter shows only who sent it, so its subject goes in the line under it; other
                            // pieces already carry theirs on the paper.
                            val subject =
                                (row.displayTitle?.takeIf { it.isNotBlank() } ?: row.subject?.takeIf { it.isNotBlank() })
                                    .takeIf { piece.note == null }
                            piece.copy(meta = listOfNotNull(subject, piece.meta.takeIf { it.isNotBlank() }).joinToString(" · "))
                        }
                is NetworkResult.Failure -> {
                    _results.value = emptyList()
                    _error.value = result.error.mailMessage(online = network.isOnline.value, doing = "search your mail")
                }
            }
            _isLoading.value = false
        }

        private companion object {
            const val TYPING_PAUSE_MS = 350L

            /** The server's most per search; the newest matches first. */
            const val PAGE = 50
        }
    }
