@file:Suppress("PackageNaming", "MagicNumber", "LongMethod")

package app.pantopus.android.ui.screens.settings.blocks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.settings.PrivacyBlockDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.privacy.PrivacyRepository
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
 * Reads `GET /api/privacy/blocks` (privacy.js:154) and unblocks via
 * `DELETE /api/privacy/blocks/:blockId` (privacy.js:251). Unblock is
 * optimistic: the row disappears immediately and re-appears if the
 * DELETE fails.
 */
@HiltViewModel
class BlockedUsersViewModel
    @Inject
    constructor(
        private val privacy: PrivacyRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        val title: String = "Blocked users"

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        /** A14.4 MonoFooter — signed-in user's name · short ID, same
         *  pattern as the Settings index / Payments mono footers. */
        val monoFooter: String?
            get() {
                val session = auth.state.value as? AuthRepository.State.SignedIn ?: return null
                val name = session.user.displayName ?: session.user.email
                return "$name · ID ${session.user.id.take(8)}"
            }

        private var blocks: MutableList<PrivacyBlockDto> = mutableListOf()

        fun load() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = privacy.blocks()) {
                    is NetworkResult.Success -> {
                        blocks = result.data.blocks.toMutableList()
                        rebuild()
                    }
                    is NetworkResult.Failure -> {
                        _state.value = ListOfRowsUiState.Error("Couldn't load your blocked list.")
                    }
                }
            }
        }

        fun refresh() = load()

        /** Optimistic unblock. Restores the row at its original index on
         *  failure so the user doesn't see a flicker on the wrong row. */
        fun unblock(blockId: String) {
            val index = blocks.indexOfFirst { it.id == blockId }
            if (index < 0) return
            val removed = blocks.removeAt(index)
            rebuild()
            viewModelScope.launch {
                when (privacy.deleteBlock(blockId)) {
                    is NetworkResult.Success -> Unit
                    is NetworkResult.Failure -> {
                        blocks.add(index.coerceAtMost(blocks.size), removed)
                        rebuild()
                    }
                }
            }
        }

        private fun rebuild() {
            if (blocks.isEmpty()) {
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
                blocks.map { block ->
                    val name =
                        block.blocked?.name
                            ?: block.blocked?.username?.let { "@$it" }
                            ?: "Blocked user"
                    val blockId = block.id
                    RowModel(
                        id = blockId,
                        title = name,
                        subtitle = blockedSubtitle(block.createdAt, block.blockScope),
                        template = RowTemplate.AvatarKebab,
                        leading =
                            RowLeading.AvatarWithBadge(
                                name = name,
                                imageUrl = block.blocked?.profilePictureUrl,
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
                                header = "Blocked · ${blocks.size}",
                                footer =
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
