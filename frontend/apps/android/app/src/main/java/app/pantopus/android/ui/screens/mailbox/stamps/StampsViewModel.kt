@file:Suppress("PackageNaming", "TooManyFunctions")

package app.pantopus.android.ui.screens.mailbox.stamps

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.mailbox.p3.MailboxStampsResponse
import app.pantopus.android.data.api.models.mailbox.p3.SeasonalThemesResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxKeepsakeRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/** Initial seed for the screen — which frame the route lands on. */
enum class StampsSeed {
    Populated,
    Empty,
}

/**
 * A17.11 — Stamps view-model. Mirrors iOS `StampsViewModel.swift`. Drives
 * three surfaces:
 *
 *  1. the postage *wallet* frame ([state]) — the A17.11 book / sheet /
 *     denomination rail / usage ledger. No backend route models a postage
 *     wallet, so this frame still projects the deterministic
 *     [StampsSampleData] fixtures (the same no-backend pattern as
 *     `VacationHold` / `MailDay`).
 *  2. the stamp **collection** ([collection]) — live from
 *     `GET api/mailbox/v2/p3/stamps` (`mailboxV2Phase3.js:1204`).
 *  3. the seasonal **themes** view ([themes]) — live from
 *     `GET api/mailbox/v2/p3/themes` (`:1249`), applied with
 *     `POST api/mailbox/v2/p3/themes/apply` (`:1285`).
 *
 * RN drives 2 + 3 from the same screen and flips between them with a
 * header toggle (`src/app/mailbox/stamps.tsx:107-112`); [mode] mirrors
 * that.
 *
 * Buy actions are stubs per the brief (no Stripe).
 */
@HiltViewModel
class StampsViewModel
    @Inject
    constructor(
        private val repository: MailboxKeepsakeRepository,
    ) : ViewModel() {
        internal constructor(
            repository: MailboxKeepsakeRepository,
            seed: StampsSeed,
        ) : this(repository) {
            this.seed = seed
        }

        private var seed: StampsSeed = StampsSeed.Populated

        private val _state = MutableStateFlow<StampsUiState>(StampsUiState.Loading)
        val state: StateFlow<StampsUiState> = _state.asStateFlow()

        private val _mode = MutableStateFlow(StampsViewMode.Stamps)
        val mode: StateFlow<StampsViewMode> = _mode.asStateFlow()

        private val _collection =
            MutableStateFlow<StampCollectionUiState>(StampCollectionUiState.Loading)
        val collection: StateFlow<StampCollectionUiState> = _collection.asStateFlow()

        private val _themes = MutableStateFlow<StampThemesUiState>(StampThemesUiState.Loading)
        val themes: StateFlow<StampThemesUiState> = _themes.asStateFlow()

        /** A theme apply is in flight; disables the rows while it runs. */
        private val _applyingThemeId = MutableStateFlow<String?>(null)
        val applyingThemeId: StateFlow<String?> = _applyingThemeId.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private var onBack: () -> Unit = {}

        fun configureNavigation(onBack: () -> Unit) {
            this.onBack = onBack
        }

        /** Re-seed the screen (e.g. an empty deep link / preview). */
        fun configureSeed(seed: StampsSeed) {
            this.seed = seed
        }

        fun load() {
            _state.value = StampsUiState.Loading
            viewModelScope.launch {
                _state.value = projected()
            }
            fetchCollection()
            fetchThemes()
        }

        fun refresh() = load()

        private fun projected(): StampsUiState =
            when (seed) {
                StampsSeed.Populated -> StampsUiState.Loaded(StampsSampleData.populated)
                StampsSeed.Empty -> StampsUiState.Empty(StampsSampleData.empty)
            }

        fun tapBack() = onBack()

        /** Flip between the collection and the seasonal-themes view. */
        fun toggleMode() {
            _mode.value = _mode.value.toggled
        }

        fun consumeToast() {
            _toast.value = null
        }

        /**
         * "Buy more stamps" (populated dock). Stub: refills the featured
         * book to full in local state — no purchase flow (out of scope).
         */
        fun buyMore() {
            val current = _state.value as? StampsUiState.Loaded ?: return
            _state.value =
                StampsUiState.Loaded(
                    current.content.copy(book = current.content.book.copy(used = 0)),
                )
        }

        /**
         * "Buy stamps" / "Get book" (empty state). Stub: acquires the
         * starter book and flips to the populated wallet — no purchase flow.
         */
        fun purchaseStarterBook() {
            _state.value = StampsUiState.Loaded(StampsSampleData.populated)
        }

        // ─── Collection (GET /p3/stamps) ───────────────────────────

        fun fetchCollection() {
            _collection.value = StampCollectionUiState.Loading
            viewModelScope.launch {
                _collection.value =
                    when (val result = repository.stamps()) {
                        is NetworkResult.Success -> {
                            val content = projectCollection(result.data)
                            if (content.earned.isEmpty() && content.locked.isEmpty()) {
                                StampCollectionUiState.Empty
                            } else {
                                StampCollectionUiState.Loaded(content)
                            }
                        }

                        is NetworkResult.Failure ->
                            StampCollectionUiState.Error(
                                result.error.displayMessage("We couldn't load your stamp collection."),
                            )
                    }
            }
        }

        // ─── Themes (GET /p3/themes · POST /p3/themes/apply) ───────

        fun fetchThemes() {
            _themes.value = StampThemesUiState.Loading
            viewModelScope.launch {
                _themes.value =
                    when (val result = repository.themes()) {
                        is NetworkResult.Success -> {
                            val content = projectThemes(result.data)
                            if (content.themes.isEmpty()) {
                                StampThemesUiState.Empty
                            } else {
                                StampThemesUiState.Loaded(content)
                            }
                        }

                        is NetworkResult.Failure ->
                            StampThemesUiState.Error(
                                result.error.displayMessage("We couldn't load your mailbox themes."),
                            )
                    }
            }
        }

        /**
         * Apply an unlocked theme. Optimistic — swaps the active id locally
         * and rolls back when the write fails. Mirrors RN `handleApplyTheme`
         * (`src/app/mailbox/stamps.tsx:69-79`).
         */
        fun applyTheme(id: String) {
            val current = _themes.value as? StampThemesUiState.Loaded ?: return
            val theme = current.content.themes.firstOrNull { it.id == id } ?: return
            if (!theme.isUnlocked || _applyingThemeId.value != null) return
            _applyingThemeId.value = id
            _themes.value = StampThemesUiState.Loaded(current.content.copy(activeThemeId = id))
            viewModelScope.launch {
                when (val result = repository.applyTheme(id)) {
                    is NetworkResult.Success -> _toast.value = "${theme.name} applied"
                    is NetworkResult.Failure -> {
                        _themes.value = current
                        _toast.value = result.error.displayMessage("Could not apply theme")
                    }
                }
                _applyingThemeId.value = null
            }
        }

        companion object {
            fun projectCollection(response: MailboxStampsResponse): StampCollectionContent =
                StampCollectionContent(
                    earned =
                        response.earned.map { row ->
                            CollectedStamp(
                                id = row.id,
                                name = row.name ?: row.stampType ?: "Stamp",
                                detail = row.description?.takeIf { it.isNotBlank() },
                                rarity = StampRarity.fromRaw(row.rarity),
                                earnedLabel = earnedLabel(row.earnedAt),
                                isLocked = false,
                            )
                        },
                    locked =
                        response.locked.map { row ->
                            CollectedStamp(
                                id = row.stampType,
                                name = row.name ?: row.stampType,
                                detail = row.description?.takeIf { it.isNotBlank() },
                                rarity = StampRarity.fromRaw(row.rarity),
                                earnedLabel = null,
                                isLocked = true,
                            )
                        },
                    totalEarned = response.totalEarned,
                    totalAvailable = response.totalAvailable,
                )

            fun projectThemes(response: SeasonalThemesResponse): StampThemesContent =
                StampThemesContent(
                    themes =
                        response.themes.map { row ->
                            MailboxTheme(
                                id = row.id,
                                name = row.name?.takeIf { it.isNotBlank() } ?: "Theme",
                                season = MailboxThemeSeason.fromRaw(row.season),
                                isUnlocked = row.unlocked ?: false,
                                autoApplies = !row.activeFrom.isNullOrBlank(),
                            )
                        },
                    activeThemeId = response.active?.takeIf { it.isNotBlank() },
                )

            /** "Earned May 4, 2026" from an ISO-8601 `earned_at`. */
            fun earnedLabel(iso: String?): String? {
                if (iso.isNullOrBlank()) return null
                val instant =
                    runCatching { Instant.parse(iso) }.getOrNull()
                        ?: runCatching { OffsetDateTime.parse(iso).toInstant() }.getOrNull()
                        ?: return null
                val formatter =
                    DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US).withZone(ZoneId.systemDefault())
                return "Earned ${formatter.format(instant)}"
            }
        }
    }
