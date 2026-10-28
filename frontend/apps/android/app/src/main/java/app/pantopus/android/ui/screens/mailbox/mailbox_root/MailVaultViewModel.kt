@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.data.api.models.mailbox.v2.MailHome
import app.pantopus.android.data.api.models.mailbox.vault.VaultFolderDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.data.mailbox.MailboxVaultRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A Vault folder as the cabinet shows it: its name and how many filed pieces in it this person can read. */
data class MailVaultFolder(
    val id: String,
    val label: String,
    val count: Int,
)

/** One drawer of folders: the person's own (no title), or one Home's shared cabinet, titled when there are several. */
data class MailVaultCabinet(
    val key: String,
    val title: String?,
    val folders: List<MailVaultFolder>,
)

/** The Vault's folders for the open drawer. */
sealed interface MailVaultFolders {
    data object Loading : MailVaultFolders

    data class Loaded(
        val cabinets: List<MailVaultCabinet>,
    ) : MailVaultFolders

    data class Error(
        val message: String,
    ) : MailVaultFolders
}

/** Searching what's filed: the filed and archived pieces that match, or why the search failed. */
data class MailVaultSearch(
    val text: String,
    val results: List<DrawerMail>,
    val searching: Boolean,
    val error: String?,
    /** The server has more matches to look through. */
    val canLoadMore: Boolean,
)

/**
 * The Vault tab's cabinet (Mail tab drawings, `R10-Vault`): the server's folders for the open drawer (the person's own
 * for Me and Biz, each readable Home's shared cabinet for Home), and search through everything filed or archived
 * (`GET /api/mailbox/v2/search`, kept to filed and archived pieces). The filed pieces themselves page in the Mailbox's
 * own list.
 */
@HiltViewModel
class MailVaultViewModel
    @Inject
    constructor(
        private val vault: MailboxVaultRepository,
        private val repo: MailboxRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _folders = MutableStateFlow<MailVaultFolders>(MailVaultFolders.Loading)
        val folders: StateFlow<MailVaultFolders> = _folders.asStateFlow()

        private val _query = MutableStateFlow("")
        val query: StateFlow<String> = _query.asStateFlow()

        private val _search = MutableStateFlow<MailVaultSearch?>(null)

        /** Null while the Vault isn't being searched. */
        val search: StateFlow<MailVaultSearch?> = _search.asStateFlow()

        private var drawer: MailboxDrawer? = null
        private var homes: List<MailHome> = emptyList()
        private var foldersJob: Job? = null
        private var searchJob: Job? = null
        private var searchOffset = 0

        init {
            // Filing, taking out or shredding from a letter's page changes the folders' counts.
            viewModelScope.launch {
                merge(MailboxRepository.mailLeftList, MailboxRepository.mailChanged).collect { if (drawer != null) refresh() }
            }
        }

        /**
         * The Vault tab is showing [drawer]'s cabinet; [homes] name the Home cabinets. The folders are read again each
         * time it shows (a bill paid elsewhere lands in Receipts), keeping the last ones on screen meanwhile.
         */
        fun show(
            drawer: MailboxDrawer,
            homes: List<MailHome>,
        ) {
            this.homes = homes
            if (this.drawer != drawer) {
                this.drawer = drawer
                _folders.value = MailVaultFolders.Loading
            }
            refresh()
        }

        /** Pull to refresh, Try again, or a piece moved: the folders read again, what's shown kept meanwhile. */
        fun refresh() {
            val open = drawer ?: return
            foldersJob?.cancel()
            foldersJob =
                viewModelScope.launch {
                    when (val result = vault.folders(open.backendKey)) {
                        is NetworkResult.Success -> _folders.value = MailVaultFolders.Loaded(cabinets(open, result.data.folders))
                        is NetworkResult.Failure ->
                            if (_folders.value !is MailVaultFolders.Loaded) {
                                _folders.value =
                                    MailVaultFolders.Error(result.error.mailMessage(network.isOnline.value, doing = "open your Vault"))
                            }
                    }
                }
        }

        /** The name of the folder a filed piece is in, when it's one of the open drawer's. */
        fun folderName(id: String?): String? =
            id?.let { wanted ->
                (_folders.value as? MailVaultFolders.Loaded)?.cabinets?.firstNotNullOfOrNull { cabinet ->
                    cabinet.folders.firstOrNull { it.id == wanted }?.label
                }
            }

        fun onQueryChange(text: String) {
            _query.value = text.take(MAX_QUERY)
            if (text.isBlank()) clearSearch()
        }

        /** Search what's filed for the words typed (on the keyboard's search key). */
        fun submitSearch() {
            val text = _query.value.trim()
            if (text.isEmpty()) return clearSearch()
            searchOffset = 0
            _search.value = MailVaultSearch(text, emptyList(), searching = true, error = null, canLoadMore = false)
            runSearch(text)
        }

        /** The next matches, after Show more, or Try again after a failed search. */
        fun loadMoreResults() {
            val current = _search.value ?: return
            if (current.searching) return
            _search.value = current.copy(searching = true, error = null)
            runSearch(current.text)
        }

        fun clearSearch() {
            searchJob?.cancel()
            _query.value = ""
            _search.value = null
        }

        private fun runSearch(text: String) {
            searchJob?.cancel()
            searchJob =
                viewModelScope.launch {
                    val found = mutableListOf<DrawerMail>()
                    var more = true
                    var failure: NetworkError? = null
                    // Matches come newest first from all the person's mail; look through a few pages for what's filed.
                    var pages = 0
                    while (more && found.size < ENOUGH_RESULTS && pages < PAGES_PER_LOOK) {
                        when (val result = repo.search(text, SEARCH_PAGE, searchOffset)) {
                            is NetworkResult.Success -> {
                                searchOffset += result.data.mail.size
                                found += result.data.mail.filter(::isFiled)
                                more = result.data.mail.size >= SEARCH_PAGE && searchOffset < result.data.total
                            }
                            is NetworkResult.Failure -> {
                                failure = result.error
                                more = false
                            }
                        }
                        pages++
                    }
                    val current = _search.value?.takeIf { it.text == text } ?: return@launch
                    _search.value =
                        current.copy(
                            results = (current.results + found).distinctBy { it.id },
                            searching = false,
                            error = failure?.mailMessage(network.isOnline.value, doing = "search your Vault"),
                            canLoadMore = failure == null && more,
                        )
                }
        }

        private fun cabinets(
            drawer: MailboxDrawer,
            folders: List<VaultFolderDto>,
        ): List<MailVaultCabinet> {
            val sorted = folders.sortedWith(compareBy({ it.sortOrder ?: Int.MAX_VALUE }, { it.label }))
            if (drawer != MailboxDrawer.Home) {
                val own = sorted.filter { it.homeId == null && it.drawer == drawer.backendKey }
                return listOf(MailVaultCabinet(drawer.backendKey, null, own.map(::folder)))
            }
            // Home mail: each Home whose mail opens has its own cabinet, shared by everyone who reads that Home's mail.
            val byHome = sorted.filter { it.homeId != null }.groupBy { it.homeId.orEmpty() }
            return byHome.map { (homeId, homeFolders) ->
                val home = homes.firstOrNull { it.homeId == homeId }
                val title = if (byHome.size > 1) home?.name?.takeIf { it.isNotBlank() } ?: home?.addressLine ?: "Your home" else null
                MailVaultCabinet(homeId, title, homeFolders.map(::folder))
            }
        }

        private fun folder(dto: VaultFolderDto) = MailVaultFolder(dto.id, dto.label, dto.itemCount ?: 0)

        companion object {
            /** In the Vault: filed (in a folder or not), or archived. */
            fun isFiled(row: DrawerMail): Boolean = row.lifecycle == "filed" || row.vaultFolderId != null || row.archived

            /** The server takes at most 100 characters of search text. */
            private const val MAX_QUERY = 100
            private const val SEARCH_PAGE = 50
            private const val ENOUGH_RESULTS = 10
            private const val PAGES_PER_LOOK = 4
        }
    }
