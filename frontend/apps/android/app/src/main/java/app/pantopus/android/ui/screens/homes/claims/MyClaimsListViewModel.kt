@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claims

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
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
import java.time.temporal.ChronoUnit
import javax.inject.Inject

/**
 * ViewModel for "My claims" list — wraps
 * `GET /api/homes/my-ownership-claims`. Backend masks the internal
 * state to a generic `status` string; we map the three known values to
 * chip variants below.
 *
 * Row taps emit `onOpenClaim(claimId)`; the host (RootTabScreen)
 * currently pushes a placeholder until a claim-status detail screen
 * is designed.
 */
@HiltViewModel
class MyClaimsListViewModel
    @Inject
    constructor(
        private val repo: HomesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<ListOfRowsUiState>(ListOfRowsUiState.Loading)
        val state: StateFlow<ListOfRowsUiState> = _state.asStateFlow()

        private var onStartNewClaim: () -> Unit = {}
        private var onOpenClaim: (String) -> Unit = {}

        fun configureNavigation(
            onStartNewClaim: () -> Unit,
            onOpenClaim: (String) -> Unit = {},
        ) {
            this.onStartNewClaim = onStartNewClaim
            this.onOpenClaim = onOpenClaim
        }

        fun load() {
            // Unlike MyHomes, always refetch — claim status changes
            // server-side within hours (per the success-step copy) and
            // the user expects to see flips on return-nav, not only
            // via pull-to-refresh.
            refresh()
        }

        fun refresh() {
            _state.value = ListOfRowsUiState.Loading
            viewModelScope.launch {
                when (val result = repo.myOwnershipClaims()) {
                    is NetworkResult.Success -> applySuccess(result.data.claims)
                    is NetworkResult.Failure ->
                        _state.value = ListOfRowsUiState.Error(result.error.displayMessage("Couldn't load the list."))
                }
            }
        }

        private fun applySuccess(claims: List<OwnershipClaimDto>) {
            if (claims.isEmpty()) {
                _state.value =
                    ListOfRowsUiState.Empty(
                        icon = PantopusIcon.ShieldCheck,
                        headline = "No claims yet",
                        // CTA opens the AddHome wizard (which kicks off
                        // verification when the user picks "Owner" on
                        // the role step). Copy matches the wizard the
                        // CTA actually routes to so the user doesn't
                        // expect a claim-existing-home picker that
                        // doesn't exist.
                        subcopy = "Submit a claim from a home dashboard. New here? Add a home and pick the Owner role to start.",
                        ctaTitle = "Add a home",
                        onCta = onStartNewClaim,
                    )
                return
            }
            val rows = claims.map(::rowFor)
            _state.value =
                ListOfRowsUiState.Loaded(
                    sections = listOf(RowSection(id = "my-claims", rows = rows)),
                    hasMore = false,
                )
        }

        private fun rowFor(claim: OwnershipClaimDto): RowModel =
            RowModel(
                id = claim.id,
                title = "Claim ${claim.id.take(8)}",
                subtitle = subtitleFor(claim),
                template = RowTemplate.StatusChip,
                leading = RowLeading.Icon(PantopusIcon.ShieldCheck, PantopusColors.primary600),
                trailing =
                    RowTrailing.Status(
                        text = statusText(claim.status),
                        variant = statusVariant(claim.status),
                    ),
                onTap = { onOpenClaim(claim.id) },
            )

        private fun subtitleFor(claim: OwnershipClaimDto): String? {
            val parts =
                listOfNotNull(
                    friendlyMethod(claim.method),
                    relativeSubmitted(claim.createdAt),
                )
            return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
        }

        private fun friendlyMethod(method: String): String? =
            when (method) {
                "doc_upload" -> "Document upload"
                "fast_track" -> "Fast-track invite"
                "id_verification" -> "ID verification"
                else -> method.takeIf { it.isNotEmpty() }
            }

        private fun relativeSubmitted(iso: String): String? =
            runCatching {
                // Use `Instant.parse` rather than `ISO_OFFSET_DATE_TIME` —
                // the latter rejects the bare `Z` zone abbreviation that
                // backend `created_at` columns use. Capture `now` once
                // so the three threshold comparisons can't drift between
                // clock reads.
                val instant = Instant.parse(iso)
                val now = Instant.now()
                val days = ChronoUnit.DAYS.between(instant, now)
                val hours = ChronoUnit.HOURS.between(instant, now)
                val minutes = ChronoUnit.MINUTES.between(instant, now)
                "Submitted " +
                    when {
                        days >= 7L -> "${days / 7L}w ago"
                        days >= 1L -> "${days}d ago"
                        hours >= 1L -> "${hours}h ago"
                        minutes >= 1L -> "${minutes}m ago"
                        else -> "just now"
                    }
            }.getOrNull()

        private fun statusText(status: String): String =
            when (status) {
                "verified", "approved", "complete" -> "Verified"
                "rejected", "denied" -> "Not approved"
                "under_review", "pending", "submitted" -> "Under review"
                else -> status.replace('_', ' ').replaceFirstChar(Char::uppercase)
            }

        private fun statusVariant(status: String): StatusChipVariant =
            when (status) {
                "verified", "approved", "complete" -> StatusChipVariant.Success
                "rejected", "denied" -> StatusChipVariant.ErrorVariant
                "under_review", "pending", "submitted" -> StatusChipVariant.Info
                else -> StatusChipVariant.Neutral
            }
    }
