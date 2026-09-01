@file:Suppress("PackageNaming", "ReturnCount", "TooManyFunctions")

package app.pantopus.android.ui.screens.homes.guests

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.GuestPassDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomeGuestPassesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowSection
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime
import javax.inject.Inject

/** Nav-arg key for the home id consumed via [SavedStateHandle]. */
const val GUEST_PASSES_HOME_ID_KEY = "homeId"

/** Stable section ids — mirrored by iOS `GuestPassesSection`. */
object GuestPassesSection {
    const val ACTIVE = "guestPasses.active"
    const val PAST = "guestPasses.past"
}

/** Surfaced to the screen so it can push / confirm without VM view state. */
sealed interface GuestPassesEvent {
    /** Open the Add Guest form (issue a new pass). */
    data object OpenAddGuest : GuestPassesEvent

    /** Ask the user to confirm revoking [passId] (labelled [label]). */
    data class ConfirmRevoke(
        val passId: String,
        val label: String,
    ) : GuestPassesEvent
}

/**
 * A13.6 — Guest-pass management for a home. RN parity target:
 * `src/app/homes/[id]/share.tsx:37-90,152-190` (Active / Past sections
 * with time-remaining and a revoke action).
 *
 * Endpoints (verified against the tree):
 *  - `GET    /api/homes/:id/guest-passes`         backend/routes/homeIam.js:783
 *  - `DELETE /api/homes/:id/guest-passes/:passId` backend/routes/homeIam.js:860
 *
 * The list is fetched with `include_revoked=true` so a pass the user just
 * revoked stays visible under "Past" (the handler otherwise filters
 * `revoked_at IS NULL` — homeIam.js:797-799). The GET enriches every row
 * with a computed `status` of `active | expired | revoked`.
 *
 * Mirrors iOS `GuestPassesListViewModel.swift` row-for-row.
 */
@HiltViewModel
class GuestPassesListViewModel
    @Inject
    constructor(
        private val repo: HomeGuestPassesRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val homeId: String = savedStateHandle[GUEST_PASSES_HOME_ID_KEY] ?: ""

        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private val _pendingEvent = MutableStateFlow<GuestPassesEvent?>(null)
        val pendingEvent: StateFlow<GuestPassesEvent?> = _pendingEvent.asStateFlow()

        private val _toast = MutableStateFlow<GuestToast?>(null)
        val toast: StateFlow<GuestToast?> = _toast.asStateFlow()

        private var passes: List<GuestPassDto> = emptyList()
        private var loadedOnce = false

        /** 52dp home-green secondary-create FAB → Add Guest form. */
        val fab: FabAction =
            FabAction(
                icon = PantopusIcon.UserPlus,
                contentDescription = "Add guest",
                variant = FabVariant.SecondaryCreate,
                tint = FabTint.Home,
                onClick = ::requestAddGuest,
            )

        /** Idempotent — re-running won't refetch once content is loaded.
         *  The shell's error banner retries through [load], so a
         *  previously-loaded-then-failed screen must still re-fetch. */
        fun load() {
            if (loadedOnce && _state.value !is ListOfRowsUiState.Error) return
            reload()
        }

        /** Pull-to-refresh / retry. */
        fun refresh() = reload()

        /**
         * Re-fetch when the screen comes back to the foreground after the
         * Add Guest form popped, so a brand-new pass shows up immediately.
         */
        fun refreshIfLoaded() {
            if (!loadedOnce) return
            reload(showLoading = false)
        }

        /** Backend doesn't paginate /guest-passes. */
        fun loadMoreIfNeeded() = Unit

        fun requestAddGuest() {
            _pendingEvent.value = GuestPassesEvent.OpenAddGuest
        }

        /** Screen calls this after dispatching a pending event. */
        fun acknowledgeEvent() {
            _pendingEvent.value = null
        }

        fun dismissToast() {
            _toast.value = null
        }

        /**
         * RN parity — `share.tsx:84-90`: revoke, then refetch so the row
         * moves from Active to Past. The confirm has already fired.
         */
        fun revoke(passId: String) {
            viewModelScope.launch {
                when (val result = repo.revoke(homeId, passId)) {
                    is NetworkResult.Success -> {
                        _toast.value = GuestToast("Pass revoked", isError = false)
                        // Silent refetch — the row moves Active → Past
                        // without flashing the skeleton (iOS parity).
                        reload(showLoading = false)
                    }
                    is NetworkResult.Failure -> {
                        _toast.value =
                            GuestToast(
                                result.error.displayMessage("Failed to revoke pass"),
                                isError = true,
                            )
                    }
                }
            }
        }

        private fun reload(showLoading: Boolean = true) {
            if (showLoading) _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.list(homeId, includeRevoked = true)) {
                    is NetworkResult.Success -> {
                        passes = result.data.passes
                        loadedOnce = true
                        applyState()
                    }
                    is NetworkResult.Failure -> {
                        _state.value =
                            ListOfRowsUiState.Error(
                                result.error.displayMessage("Couldn't load guest passes. Try again."),
                            )
                    }
                }
            }
        }

        // ─── State projection ─────────────────────────────────────

        private fun applyState() {
            val now = Instant.now()
            val active = passes.filter { isActive(it, now) }
            val past = passes.filterNot { isActive(it, now) }.take(PAST_LIMIT)
            if (active.isEmpty() && past.isEmpty()) {
                _state.value = emptyState()
                return
            }
            val sections = mutableListOf<RowSection>()
            if (active.isNotEmpty()) {
                sections +=
                    RowSection(
                        id = GuestPassesSection.ACTIVE,
                        header = "Active passes",
                        rows = active.map { activeRow(it, now) },
                        count = active.size,
                    )
            }
            if (past.isNotEmpty()) {
                sections +=
                    RowSection(
                        id = GuestPassesSection.PAST,
                        header = "Past passes",
                        rows = past.map { pastRow(it) },
                        count = past.size,
                    )
            }
            _state.value = ListOfRowsUiState.Loaded(sections = sections, hasMore = false)
        }

        private fun emptyState(): ListOfRowsUiState.Empty =
            ListOfRowsUiState.Empty(
                icon = PantopusIcon.KeyRound,
                headline = "No guest passes",
                subcopy =
                    "Issue a quick-share pass so a sitter, visitor, or contractor " +
                        "can reach the wi-fi and entry details while they're around.",
                ctaTitle = "Add a guest",
                onCta = ::requestAddGuest,
            )

        private fun activeRow(
            pass: GuestPassDto,
            now: Instant,
        ): RowModel {
            val label = displayLabel(pass)
            return RowModel(
                id = pass.id,
                title = label,
                subtitle = kindLabel(pass.kind),
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = PantopusIcon.KeyRound,
                        background = PantopusColors.homeBg,
                        foreground = PantopusColors.home,
                    ),
                trailing =
                    RowTrailing.CircularAction(
                        icon = PantopusIcon.XCircle,
                        accessibilityLabel = "Revoke $label",
                        background = PantopusColors.errorBg,
                        foreground = PantopusColors.error,
                        onClick = {
                            _pendingEvent.value = GuestPassesEvent.ConfirmRevoke(pass.id, label)
                        },
                    ),
                body = expiryLabel(pass.endAt, now),
                subtitleIcon = PantopusIcon.UserCheck,
                bodyIcon = PantopusIcon.Clock,
            )
        }

        private fun pastRow(pass: GuestPassDto): RowModel =
            RowModel(
                id = pass.id,
                title = displayLabel(pass),
                subtitle = kindLabel(pass.kind),
                template = RowTemplate.StatusChip,
                leading =
                    RowLeading.TypeIcon(
                        icon = PantopusIcon.KeyRound,
                        background = PantopusColors.appSurfaceSunken,
                        foreground = PantopusColors.appTextSecondary,
                    ),
                trailing =
                    RowTrailing.Status(
                        text = pastStatusLabel(pass),
                        variant = StatusChipVariant.Neutral,
                    ),
                subtitleIcon = PantopusIcon.UserCheck,
                highlight = RowHighlight.Muted,
            )

        companion object {
            /** RN parity — `share.tsx:172`: `expiredPasses.slice(0, 10)`. */
            private const val PAST_LIMIT = 10
            private const val SECONDS_PER_HOUR = 3600L
            private const val SECONDS_PER_MINUTE = 60L
            private const val HOURS_PER_DAY = 24L

            /**
             * RN parity — `share.tsx:47`: `status == 'active'` AND either no
             * end stamp or an end stamp still in the future.
             */
            fun isActive(
                pass: GuestPassDto,
                now: Instant,
            ): Boolean {
                if ((pass.status ?: "active") != "active") return false
                val end = parseInstant(pass.endAt) ?: return true
                return end.isAfter(now)
            }

            /** RN parity — `share.tsx:157`: `pass.label || 'Guest Pass'`. */
            fun displayLabel(pass: GuestPassDto): String = pass.label.trim().ifEmpty { "Guest Pass" }

            /**
             * Humanised `kind` — backend enum is
             * `wifi_only | guest | airbnb | vendor` (homeIam.js:643-668).
             */
            fun kindLabel(kind: String): String =
                when (kind) {
                    "wifi_only" -> "Wi-Fi only"
                    "airbnb" -> "Airbnb / Custom"
                    "vendor" -> "Vendor / Service"
                    "guest" -> "Guest"
                    else ->
                        kind
                            .replace('_', ' ')
                            .replaceFirstChar { it.uppercase() }
                }

            /**
             * RN parity — `share.tsx:167`: "Revoked" for a revoked pass,
             * "Expired" for everything else in the Past bucket.
             */
            fun pastStatusLabel(pass: GuestPassDto): String =
                if (pass.status == "revoked" || pass.revokedAt != null) "Revoked" else "Expired"

            /**
             * RN parity — `share.tsx:93-99` (`formatExpiry`). A null end
             * stamp renders "No expiry"; a past stamp renders "Expired";
             * otherwise m / h / d remaining.
             */
            fun expiryLabel(
                endAt: String?,
                now: Instant,
            ): String {
                val end = parseInstant(endAt) ?: return "No expiry"
                val seconds = end.epochSecond - now.epochSecond
                if (seconds < 0) return "Expired"
                val hours = seconds / SECONDS_PER_HOUR
                if (hours < 1) return "${seconds / SECONDS_PER_MINUTE}m remaining"
                if (hours < HOURS_PER_DAY) return "${hours}h remaining"
                return "${hours / HOURS_PER_DAY}d remaining"
            }

            /**
             * Backend stamps are Postgres `timestamptz` serialised by
             * Supabase — sometimes `…Z`, sometimes `…+00:00`, with or
             * without fractional seconds. Try the offset form first, then
             * the plain instant form; anything else means "no expiry".
             */
            fun parseInstant(value: String?): Instant? {
                if (value.isNullOrBlank()) return null
                return runCatching { OffsetDateTime.parse(value).toInstant() }
                    .recoverCatching { Instant.parse(value) }
                    .getOrNull()
            }
        }
    }
