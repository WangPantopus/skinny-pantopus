@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.businesses

import androidx.compose.ui.graphics.Color
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.businesses.BusinessMembership
import app.pantopus.android.data.api.models.businesses.BusinessProfileDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.businesses.BusinessesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/**
 * ViewModel for My businesses (A08) — wraps `GET /api/businesses/my-businesses`.
 *
 * Projects the enriched response (stats / team / verification) into
 * [BusinessCard]s for the bespoke A08 row. Mirrors the iOS
 * `MyBusinessesViewModel`. The "Primary" badge from the design is omitted
 * (no primary-business concept exists in the backend).
 */
@HiltViewModel
class MyBusinessesViewModel
    @Inject
    constructor(
        private val repo: BusinessesRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow<MyBusinessesUiState>(MyBusinessesUiState.Loading)
        val state: StateFlow<MyBusinessesUiState> = _state.asStateFlow()

        private var onOpenBusiness: (String) -> Unit = {}
        var onRegister: () -> Unit = {}
            private set
        var onClaim: () -> Unit = {}
            private set

        fun configureNavigation(
            onOpenBusiness: (String) -> Unit,
            onRegister: () -> Unit,
            onClaim: () -> Unit,
        ) {
            this.onOpenBusiness = onOpenBusiness
            this.onRegister = onRegister
            this.onClaim = onClaim
        }

        fun openBusiness(id: String) = onOpenBusiness(id)

        fun load() {
            if (_state.value is MyBusinessesUiState.Loaded) return
            refresh()
        }

        fun refresh() {
            _state.value = MyBusinessesUiState.Loading
            viewModelScope.launch {
                when (val result = repo.myBusinesses()) {
                    is NetworkResult.Success -> {
                        val cards = result.data.businesses.map(::cardFor)
                        _state.value =
                            if (cards.isEmpty()) {
                                MyBusinessesUiState.Empty
                            } else {
                                MyBusinessesUiState.Loaded(cards)
                            }
                    }
                    is NetworkResult.Failure ->
                        _state.value = MyBusinessesUiState.Error(result.error.displayMessage("Couldn't load your businesses."))
                }
            }
        }

        private fun cardFor(m: BusinessMembership): BusinessCard {
            val name =
                m.business.name?.takeIf { it.isNotEmpty() }
                    ?: m.business.username?.takeIf { it.isNotEmpty() }
                    ?: "Untitled business"
            val category = categoryStyle(m.profile)
            val place =
                listOfNotNull(m.business.city, m.business.state)
                    .filter { it.isNotEmpty() }
                    .joinToString(", ")
            val verified = isVerified(m.profile?.identityVerificationTier)
            val rating = m.business.averageRating
            val reviews = m.business.reviewCount ?: 0
            return BusinessCard(
                id = m.businessUserId,
                name = name,
                category = category,
                locality = place.ifEmpty { "Online only" },
                localityIsPlaceholder = place.isEmpty(),
                logoUrl = m.business.profilePictureUrl,
                role = roleStyle(m.roleBase),
                teamCount = m.team?.count ?: 0,
                teamInitials = (m.team?.members ?: emptyList()).take(3).map { it.initials?.takeIf { s -> s.isNotEmpty() } ?: "?" },
                verified = verified,
                pending = !verified,
                openChats = m.stats?.openChats ?: 0,
                bookingsThisWeek = m.stats?.bookingsThisWeek ?: 0,
                // Locale.US so the decimal separator matches iOS ("4.9", never "4,9").
                ratingText = if (rating != null && reviews > 0) String.format(Locale.US, "%.1f", rating) else "New",
                reviewCount = reviews,
            )
        }

        private fun categoryStyle(profile: BusinessProfileDto?): CategoryStyle {
            val raw =
                profile?.categories?.firstOrNull { it.isNotEmpty() }
                    ?: profile?.businessType
            val key = raw?.lowercase().orEmpty()
            // Mirror Swift String.capitalized: lowercase each word, upcase its first letter.
            val label =
                raw?.replace('_', ' ')
                    ?.split(' ')
                    ?.joinToString(" ") { word -> word.lowercase().replaceFirstChar { c -> c.uppercase() } }
                    ?.takeIf { it.isNotEmpty() }
            return when {
                key.contains("handy") || key.contains("repair") || key.contains("contractor") ->
                    CategoryStyle(label, PantopusIcon.Hammer, PantopusColors.warning)
                key.contains("pet") || key.contains("dog") || key.contains("vet") ->
                    CategoryStyle(label, PantopusIcon.PawPrint, PantopusColors.error)
                key.contains("tutor") || key.contains("educat") || key.contains("class") || key.contains("school") ->
                    CategoryStyle(label, PantopusIcon.GraduationCap, PantopusColors.personal)
                key.contains("clean") ->
                    CategoryStyle(label, PantopusIcon.Sparkles, PantopusColors.success)
                else ->
                    CategoryStyle(label, PantopusIcon.Building2, PantopusColors.business)
            }
        }

        private fun roleStyle(roleBase: String?): RoleStyle? =
            when (roleBase?.lowercase()?.takeIf { it.isNotEmpty() }) {
                "owner" -> RoleStyle("Owner", PantopusIcon.Crown, StatusChipVariant.Business)
                "admin" -> RoleStyle("Admin", PantopusIcon.ShieldCheck, StatusChipVariant.Business)
                "manager" -> RoleStyle("Manager", PantopusIcon.Briefcase, StatusChipVariant.Personal)
                "editor" -> RoleStyle("Editor", PantopusIcon.Briefcase, StatusChipVariant.Personal)
                "staff" -> RoleStyle("Staff", PantopusIcon.User, StatusChipVariant.Neutral)
                "viewer" -> RoleStyle("Viewer", PantopusIcon.User, StatusChipVariant.Neutral)
                null -> null
                // Mirror iOS: lowercase then capitalize (role.capitalized over a lowercased base).
                else -> RoleStyle(roleBase!!.lowercase().replaceFirstChar { it.uppercase() }, PantopusIcon.User, StatusChipVariant.Neutral)
            }

        companion object {
            /** Anything above `bi0_unverified` (and non-null) earns the verified mark. */
            fun isVerified(tier: String?): Boolean = !tier.isNullOrEmpty() && tier != "bi0_unverified"
        }
    }

/** Bespoke A08 render states. Mirrors iOS `MyBusinessesViewModel.ViewState`. */
sealed interface MyBusinessesUiState {
    data object Loading : MyBusinessesUiState

    data class Loaded(val cards: List<BusinessCard>) : MyBusinessesUiState

    data object Empty : MyBusinessesUiState

    data class Error(val message: String) : MyBusinessesUiState
}

/** Fully-projected display row for the A08 business card. */
data class BusinessCard(
    val id: String,
    val name: String,
    val category: CategoryStyle,
    val locality: String,
    val localityIsPlaceholder: Boolean,
    val logoUrl: String?,
    val role: RoleStyle?,
    val teamCount: Int,
    val teamInitials: List<String>,
    val verified: Boolean,
    val pending: Boolean,
    val openChats: Int,
    val bookingsThisWeek: Int,
    val ratingText: String,
    val reviewCount: Int,
) {
    val categoryLabel: String? get() = category.label
}

/** Role chip styling. */
data class RoleStyle(
    val label: String,
    val icon: PantopusIcon,
    val variant: StatusChipVariant,
)

/** Logo-tile color + glyph + category label (token-only, no hex). */
data class CategoryStyle(
    val label: String?,
    val icon: PantopusIcon,
    val color: Color,
)
