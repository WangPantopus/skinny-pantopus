@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.settings.blocks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.privacy.PrivacyRepository
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBackground
import app.pantopus.android.ui.screens.shared.list_of_rows.AvatarBadgeSize
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowPillTone
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.screens.shared.list_of_rows.SectionStyle
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/**
 * P8 / T6.2c — Settings → Blocked users.
 *
 * N04: this is the only surface that lifts a block, so it reads BOTH
 * existing personal block contracts, which remain separate tables with
 * separate scopes:
 *  - `GET /api/users/blocked` (blocks.js:138) — the `UserBlock` rows that
 *    Block-on-a-profile and Block-in-a-chat write, and the ones
 *    `blockService.isBlocked` reads to deny direct messages. Lifted by
 *    `DELETE /api/users/:userId/block` (blocks.js:101).
 *  - `GET /api/privacy/blocks` (privacy.js:154) — the Identity Firewall's
 *    scoped `UserProfileBlock` rows. Lifted by
 *    `DELETE /api/privacy/blocks/:blockId` (privacy.js:251).
 * Before this the screen read only the second, so a block made from a
 * profile was invisible here and could never be undone in the app.
 *
 * Unblock is optimistic: the row disappears immediately and re-appears if
 * its DELETE fails.
 */
@HiltViewModel
class BlockedUsersViewModel
    @Inject
    constructor(
        private val privacy: PrivacyRepository,
        private val blocks: BlocksRepository,
        private val auth: AuthRepository,
        sessionFactory: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        val title: String = "Blocked users"

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<ToastMessage?>(null)

        /** Confirms an unblock, or says it failed and the row is back. */
        val toast: StateFlow<ToastMessage?> = _toast.asStateFlow()

        fun consumeToast() {
            _toast.value = null
        }

        /** A14.4 MonoFooter — signed-in user's name · short ID, same
         *  pattern as the Settings index / Payments mono footers. */
        val monoFooter: String?
            get() {
                if (!sessionScope.isCurrent || !active) return null
                val session = auth.state.value as? AuthRepository.State.SignedIn ?: return null
                val name = session.user.displayName ?: session.user.email
                return "$name · ID ${session.user.id.take(8)}"
            }

        private val sessionScope = sessionFactory.create(viewModelScope)
        private var active = true
        private var request = 0L
        private var snapshot = 0L
        private var mutation = 0L
        private var pending: String? = null
        private var complete = false
        private var entries: MutableList<BlockedEntry> = mutableListOf()

        init {
            viewModelScope.launch {
                sessionScope.invalidated.collect { if (it) retire() }
            }
        }

        fun retire() {
            active = false
            request++
            mutation++
            pending = null
            entries.clear()
            complete = false
            _state.value = ListOfRowsUiState.Error("Reopen blocked users to load your current list.")
        }

        private suspend fun current(): Boolean {
            if (!active) return false
            if (sessionScope.confirmCurrent()) return true
            retire()
            return false
        }

        /**
         * One row's worth of "someone you blocked", flattened from the two
         * separate existing block contracts the app can produce. They stay
         * separate tables with separate scopes; this screen is the one place
         * the owner sees and lifts both, so it has to know which DELETE
         * addresses which row.
         */
        private data class BlockedEntry(
            val id: String,
            val name: String,
            val avatarUrl: String?,
            val createdAt: String?,
            /**
             * Only `UserProfileBlock` carries a scope; personal blocks are
             * account-wide, which renders the same as the existing `full` case.
             */
            val scope: String?,
            /**
             * Non-null for a `UserBlock` row — the blocked person's id, which
             * addresses `DELETE /api/users/:userId/block`. Null for a
             * `UserProfileBlock` row, lifted by its own block id instead.
             */
            val personalUserId: String?,
        )

        fun load() {
            if (!sessionScope.isCurrent) {
                retire()
                return
            }
            active = true
            val loadRequest = ++request
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                if (!current() || loadRequest != request) return@launch
                // Sequential, not concurrent, so the request order stays
                // deterministic for the VM tests. Only one list has to answer:
                // a personal block must still be visible (and liftable) when
                // the Identity Firewall list is unavailable, and vice versa.
                val personal = blocks.blocked()
                if (!current() || loadRequest != request) return@launch
                val profile = privacy.blocks()
                if (!current() || loadRequest != request) return@launch
                snapshot++

                complete = personal is NetworkResult.Success && profile is NetworkResult.Success
                if (personal is NetworkResult.Failure && profile is NetworkResult.Failure) {
                    _state.value = ListOfRowsUiState.Error("Couldn't load your blocked list.")
                    return@launch
                }

                val personalEntries =
                    (personal as? NetworkResult.Success)?.data?.blocked.orEmpty().map { block ->
                        BlockedEntry(
                            id = block.id,
                            name = block.name ?: block.username?.let { "@$it" } ?: "Blocked user",
                            avatarUrl = block.profilePictureUrl,
                            createdAt = block.createdAt,
                            scope = null,
                            personalUserId = block.userId,
                        )
                    }
                val profileEntries =
                    (profile as? NetworkResult.Success)?.data?.blocks.orEmpty().map { block ->
                        BlockedEntry(
                            id = block.id,
                            name =
                                block.blocked?.name
                                    ?: block.blocked?.username?.let { "@$it" }
                                    ?: "Blocked user",
                            avatarUrl = block.blocked?.profilePictureUrl,
                            createdAt = block.createdAt,
                            scope = block.blockScope,
                            personalUserId = null,
                        )
                    }

                // Each route already orders its own rows newest-first, and the
                // screen has always rendered them in the order the server sent.
                // Keep that: concatenate rather than re-sort. Personal blocks
                // lead because they are the ones that gate direct messages.
                entries = (personalEntries + profileEntries).toMutableList()
                rebuild()
            }
        }

        fun refresh() = load()

        /** Optimistic unblock. Restores the row at its original index on
         *  failure so the user doesn't see a flicker on the wrong row. */
        fun unblock(blockId: String) {
            if (!active || !sessionScope.isCurrent || pending != null) return
            val index = entries.indexOfFirst { it.id == blockId }
            if (index < 0) return
            val removed = entries.removeAt(index)
            pending = blockId
            val action = ++mutation
            request++
            val openingSnapshot = snapshot
            rebuild()
            viewModelScope.launch {
                if (!current() || action != mutation) return@launch
                // The request is chosen by the row's own contract — a personal
                // block is lifted by user id, a profile block by block id.
                val result =
                    removed.personalUserId
                        ?.let { blocks.unblock(it) }
                        ?: privacy.deleteBlock(blockId)
                if (!current() || action != mutation || pending != blockId) return@launch
                pending = null
                when (result) {
                    is NetworkResult.Success -> {
                        request++ // Reads started before this success cannot restore the row.
                        entries.removeAll { it.id == blockId }
                        _toast.value = ToastMessage("${removed.name} unblocked", ToastKind.Success)
                    }
                    is NetworkResult.Failure -> {
                        if (openingSnapshot == snapshot) entries.add(index.coerceAtMost(entries.size), removed)
                        _toast.value = ToastMessage("Couldn't unblock ${removed.name}. Try again.", ToastKind.Error)
                    }
                }
                rebuild()
            }
        }

        private fun rebuild() {
            val visible = entries.filterNot { it.id == pending }
            if (visible.isEmpty() && !complete) {
                _state.value = ListOfRowsUiState.Error("Couldn't load your complete blocked list. Please retry.")
                return
            }
            if (visible.isEmpty()) {
                // A14.4 empty hero — neutral grey disc + user-minus glyph
                // (the design's `user-x`; `UserMinus` is the in-inventory
                // person-with-negation glyph) + reassurance about silence.
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.UserMinus,
                        headline = "No one blocked",
                        subcopy =
                            "When you block someone, they'll appear here. " +
                                "They won't be notified, and you can unblock them anytime.",
                        tint = PantopusColors.appSurfaceSunken,
                        accent = PantopusColors.appTextSecondary,
                    )
                return
            }
            val rows =
                visible.map { entry ->
                    val name = entry.name
                    val blockId = entry.id
                    RowModel(
                        id = blockId,
                        title = name,
                        subtitle = blockedSubtitle(entry.createdAt, entry.scope),
                        template = RowTemplate.AvatarKebab,
                        leading =
                            RowLeading.AvatarWithBadge(
                                name = name,
                                imageUrl = entry.avatarUrl,
                                background = AvatarBackground.Solid(PantopusColors.appSurfaceSunken),
                                size = AvatarBadgeSize.Small,
                                verified = false,
                            ),
                        trailing =
                            RowTrailing.PillButton(
                                label = "Unblock",
                                tone = RowPillTone.Neutral,
                                onClick = { unblock(blockId) },
                            ),
                    )
                }
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections =
                        listOf(
                            RowSection(
                                id = "blocked",
                                header = "Blocked · ${visible.size}",
                                footer =
                                    (if (complete) "" else "We couldn't load the complete list. Pull to refresh. ") +
                                        "Blocked people can't message you, see your profile, or bid on " +
                                        "your tasks. Unblocking doesn't notify them.",
                                rows = rows,
                                style = SectionStyle.Card,
                            ),
                        ),
                    hasMore = false,
                )
        }

        /**
         * `Blocked <date> · <context>` — the design's source-context line.
         * `created_at` drives the date; `block_scope` drives the context
         * suffix (the backend has no origin-surface column, so the scope
         * the block was created with is the "source" context we surface).
         */
        private fun blockedSubtitle(
            createdAt: String?,
            scope: String?,
        ): String {
            val date = formatBlockedDate(createdAt) ?: return scopeLabel(scope)
            val context = scopeContext(scope)
            return if (context != null) "Blocked $date · $context" else "Blocked $date"
        }

        /** Context suffix from `block_scope`. `full` / `null` carry no
         *  suffix (the block is account-wide); the scoped variants name
         *  where it applies. */
        private fun scopeContext(scope: String?): String? =
            when (scope) {
                "search_only" -> "Search only"
                "business_context" -> "Business contexts"
                "full", null -> null
                else -> scope.replaceFirstChar { it.uppercase() }
            }

        /** Standalone scope label — used only when there's no parseable date. */
        private fun scopeLabel(scope: String?): String =
            when (scope) {
                "search_only" -> "Hidden from search"
                "business_context" -> "Blocked in business contexts"
                "full", null -> "Blocked"
                else -> scope.replaceFirstChar { it.uppercase() }
            }

        private fun formatBlockedDate(iso: String?): String? {
            if (iso.isNullOrBlank()) return null
            val date =
                runCatching { OffsetDateTime.parse(iso).toLocalDate() }
                    .recoverCatching { LocalDate.parse(iso.take(10)) }
                    .getOrNull()
            return date?.format(BLOCKED_DATE_FORMATTER)
        }

        companion object {
            /** Locale-pinned so the rendered day is deterministic. */
            private val BLOCKED_DATE_FORMATTER: DateTimeFormatter =
                DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
        }
    }
