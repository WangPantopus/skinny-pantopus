@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.profile.professional

import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusIcon

enum class ProVerificationStatus {
    Verified,
    Pending,
    Expiring,
    Unverified,
}

val ProVerificationStatus.isAwaitingReview: Boolean
    get() = this == ProVerificationStatus.Pending

data class CompanyClaim(
    val name: String,
    val locality: String,
    val status: ProVerificationStatus,
    val isDirty: Boolean = false,
    val hint: String? = null,
)

data class ProSkill(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val isFresh: Boolean = false,
)

data class Certification(
    val id: String,
    val name: String,
    val issuer: String,
    val issued: String,
    val expires: String,
    val status: ProVerificationStatus,
    val isFresh: Boolean = false,
)

enum class PortfolioLinkState { Resolved, Loading, Error }

data class PortfolioLink(
    val id: String,
    val host: String,
    val title: String,
    val url: String,
    val state: PortfolioLinkState,
    val isFresh: Boolean = false,
) {
    val icon: PantopusIcon
        get() =
            when {
                host.contains("behance", ignoreCase = true) -> PantopusIcon.Palette
                host.contains("youtube", ignoreCase = true) || host.contains("youtu.be", ignoreCase = true) ->
                    PantopusIcon.PlayCircle
                else -> PantopusIcon.Link
            }
}

data class VisibilityRow(
    val id: String,
    val label: String,
    val sub: String? = null,
    val isOn: Boolean,
    val scope: String? = null,
    val originalOn: Boolean = isOn,
) {
    val isDirty: Boolean
        get() = isOn != originalOn
}

/**
 * The professional record's verification leg — `verification_tier` +
 * `verification_status` (`professional.js:372`). [canStart] gates the
 * "Start verification" CTA exactly like RN (`professional.tsx:385`, which
 * shows it only when nothing has been submitted).
 */
data class ProVerificationSummary(
    val status: ProVerificationStatus,
    val tier: Int? = null,
    /** True while `POST /verification/start` is in flight. */
    val isStarting: Boolean = false,
) {
    /** One-line status copy — mirrors RN `professional.tsx:378`. */
    val summary: String
        get() =
            when (status) {
                ProVerificationStatus.Verified -> tier?.let { "Tier $it verified" } ?: "Verified"
                ProVerificationStatus.Pending -> "Pending"
                else -> "Not verified"
            }

    val canStart: Boolean
        get() = status != ProVerificationStatus.Verified && status != ProVerificationStatus.Pending
}

data class ProfessionalProfileContent(
    val proName: String,
    val strength: Int,
    val title: FormFieldState,
    val yearsInRole: FormFieldState,
    val company: CompanyClaim,
    val skills: List<ProSkill>,
    val certifications: List<Certification>,
    val portfolio: List<PortfolioLink>,
    val visibility: List<VisibilityRow>,
    /**
     * Selected backend category keys — written to `categories[]` on
     * `PATCH api/professional/profile/me`. Capped at
     * [ProfessionalCategory.SELECTION_LIMIT].
     */
    val categories: List<String> = emptyList(),
    /** Last-saved category baseline, used for dirty tracking. */
    val originalCategories: List<String> = categories,
    /** `service_area.city` / `.state` / `.radius_km`. */
    val serviceCity: FormFieldState = FormFieldState(id = "serviceCity"),
    val serviceState: FormFieldState = FormFieldState(id = "serviceState"),
    val serviceRadiusKm: FormFieldState = FormFieldState(id = "serviceRadiusKm"),
    /** `pricing_meta.hourly_rate` (currency is always USD, like RN). */
    val hourlyRate: FormFieldState = FormFieldState(id = "hourlyRate"),
    /** Verification tier + status, and whether a start call is in flight. */
    val verification: ProVerificationSummary = ProVerificationSummary(ProVerificationStatus.Unverified),
) {
    /** True when the category selection differs from the last-saved set. */
    val categoriesAreDirty: Boolean
        get() = categories != originalCategories

    /**
     * False once the server's 5-category cap is reached
     * (`professional.js:45`) — unselected chips go disabled.
     */
    val canSelectMoreCategories: Boolean
        get() = categories.size < ProfessionalCategory.SELECTION_LIMIT

    val dirtyCount: Int
        get() =
            listOf(
                title.isDirty,
                yearsInRole.isDirty,
                company.isDirty,
                categoriesAreDirty,
                serviceCity.isDirty,
                serviceState.isDirty,
                serviceRadiusKm.isDirty,
                hourlyRate.isDirty,
            ).count { it } +
                skills.count { it.isFresh } +
                certifications.count { it.isFresh } +
                portfolio.count { it.isFresh } +
                visibility.count { it.isDirty }

    val pendingCount: Int
        get() =
            (if (company.status.isAwaitingReview) 1 else 0) +
                certifications.count { it.status.isAwaitingReview }

    val isDirty: Boolean
        get() = dirtyCount > 0

    val strengthCaption: String
        get() =
            if (pendingCount == 0) {
                "All claims verified · ready for high-trust clients."
            } else {
                "$pendingCount ${if (pendingCount == 1) "claim" else "claims"} pending verification · finish to reach Pro+."
            }
}

/**
 * Working copy for the "professional mode is off" state — the fields
 * `POST api/professional/profile` accepts (`professional.js:42`). Mirrors
 * RN's create-mode form (`professional.tsx:123`) and the iOS
 * `ProfessionalEnableDraft`.
 */
data class ProfessionalEnableDraft(
    val headline: String = "",
    val bio: String = "",
    /** Selected backend category keys, capped at [ProfessionalCategory.SELECTION_LIMIT]. */
    val categories: List<String> = emptyList(),
    val city: String = "",
    val state: String = "",
    /** Digits only; blank falls back to 50 like RN. */
    val radiusKm: String = "50",
    /** Digits + one decimal separator; blank omits `pricing_meta`. */
    val hourlyRate: String = "",
    val isPublic: Boolean = true,
    /**
     * True when a soft-disabled row already exists, so the CTA re-enables it
     * (`PATCH is_active = true`) instead of creating a new one.
     */
    val isReEnable: Boolean = false,
    /** A create/re-enable request is in flight. */
    val isSubmitting: Boolean = false,
    /** Last failure from the enable call, shown inline above the CTA. */
    val errorMessage: String? = null,
) {
    /** False once the 5-category cap is reached. */
    val canSelectMoreCategories: Boolean
        get() = categories.size < ProfessionalCategory.SELECTION_LIMIT

    /** CTA label — "Enable" first time, "Re-enable" for a disabled record. */
    val ctaLabel: String
        get() = if (isReEnable) "Re-enable professional mode" else "Enable professional mode"
}

sealed interface ProfessionalProfileUiState {
    data object Loading : ProfessionalProfileUiState

    /**
     * Professional mode is **off** — either no record at all, or a
     * soft-disabled one. Renders the enable form + CTA.
     */
    data class Create(
        val draft: ProfessionalEnableDraft,
    ) : ProfessionalProfileUiState

    data class Verified(
        val content: ProfessionalProfileContent,
    ) : ProfessionalProfileUiState

    data class Pending(
        val content: ProfessionalProfileContent,
        val dirtyCount: Int,
        val pendingCount: Int,
    ) : ProfessionalProfileUiState

    data class Error(
        val message: String,
    ) : ProfessionalProfileUiState
}
