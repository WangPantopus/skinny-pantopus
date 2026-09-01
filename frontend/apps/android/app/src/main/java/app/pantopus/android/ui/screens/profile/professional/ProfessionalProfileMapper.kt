@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.profile.professional

import app.pantopus.android.data.api.models.professional.ProfessionalProfileDto
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStatusResponse
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * P1-F — projects the backend professional record onto editor
 * [ProfessionalProfileContent] (mirrors the iOS `ProfessionalProfileViewModel`
 * mapping). The backend `profile/me` is thin, so only the overlapping fields
 * map: title ← headline, skills ← categories, the verification pill ←
 * verification_status, visibility ← is_public / is_active. Company name,
 * certifications, and portfolio start empty (no profile/me field).
 */
object ProfessionalProfileMapper {
    fun build(
        dto: ProfessionalProfileDto?,
        verification: ProfessionalVerificationStatusResponse?,
        proName: String = "",
    ): ProfessionalProfileContent {
        val status = verificationStatus(dto?.verificationStatus ?: verification?.status)
        val locality =
            listOfNotNull(dto?.serviceArea?.city, dto?.serviceArea?.state)
                .filter { it.isNotEmpty() }
                .joinToString(", ")
        val categories = dto?.categories ?: emptyList()
        val skills =
            categories.map {
                ProSkill(id = it, label = categoryLabel(it), icon = categoryIcon(it))
            }
        val rate = dto?.pricingMeta?.hourlyRate
        return ProfessionalProfileContent(
            proName = proName,
            strength = strength(dto),
            title = FormFieldState(id = "title", value = dto?.headline ?: "", originalValue = dto?.headline ?: ""),
            yearsInRole = FormFieldState(id = "yearsInRole"),
            company = CompanyClaim(name = "", locality = locality, status = status),
            skills = skills,
            certifications = emptyList(),
            portfolio = emptyList(),
            visibility = visibilityRows(dto?.isPublic ?: false, dto?.isActive ?: false),
            categories = categories,
            serviceCity = seeded("serviceCity", dto?.serviceArea?.city.orEmpty()),
            serviceState = seeded("serviceState", dto?.serviceArea?.state.orEmpty()),
            serviceRadiusKm = seeded("serviceRadiusKm", dto?.serviceArea?.radiusKm?.toInt()?.toString() ?: ""),
            hourlyRate =
                seeded(
                    "hourlyRate",
                    rate?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() } ?: "",
                ),
            verification =
                ProVerificationSummary(
                    status = status,
                    tier = dto?.verificationTier ?: verification?.tier,
                ),
        )
    }

    private fun seeded(
        id: String,
        value: String,
    ): FormFieldState = FormFieldState(id = id, value = value, originalValue = value)

    fun verificationStatus(raw: String?): ProVerificationStatus =
        when (raw) {
            "verified" -> ProVerificationStatus.Verified
            "pending" -> ProVerificationStatus.Pending
            else -> ProVerificationStatus.Unverified
        }

    /**
     * Seed an enable draft from an existing (disabled) backend record so
     * re-enabling keeps what the user already wrote.
     */
    fun draft(dto: ProfessionalProfileDto?): ProfessionalEnableDraft {
        if (dto == null) return ProfessionalEnableDraft()
        val rate = dto.pricingMeta?.hourlyRate
        return ProfessionalEnableDraft(
            headline = dto.headline.orEmpty(),
            bio = dto.bio.orEmpty(),
            categories = dto.categories ?: emptyList(),
            city = dto.serviceArea?.city.orEmpty(),
            state = dto.serviceArea?.state.orEmpty(),
            radiusKm = dto.serviceArea?.radiusKm?.toInt()?.toString() ?: "50",
            hourlyRate = rate?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() } ?: "",
            isPublic = dto.isPublic ?: true,
            isReEnable = true,
        )
    }

    /** `pet_care` → `Pet Care`, via the server's category catalogue. */
    fun categoryLabel(key: String): String = ProfessionalCategory.label(key)

    fun categoryIcon(key: String): PantopusIcon =
        when (key) {
            "plumber" -> PantopusIcon.Droplet
            "electrician" -> PantopusIcon.Zap
            "carpentry" -> PantopusIcon.Hammer
            "cleaning" -> PantopusIcon.Sparkles
            "pet_care", "childcare", "elder_care" -> PantopusIcon.Users
            else -> PantopusIcon.Wrench
        }

    /** Coarse 0–100 completeness heuristic — the record has no strength field. */
    fun strength(dto: ProfessionalProfileDto?): Int {
        if (dto == null) return 0
        var score = 40
        if (!dto.headline.isNullOrEmpty()) score += 15
        if (!dto.bio.isNullOrEmpty()) score += 10
        if (!dto.categories.isNullOrEmpty()) score += 15
        when (dto.verificationStatus) {
            "verified" -> score += 20
            "pending" -> score += 10
        }
        return minOf(score, 100)
    }

    private fun visibilityRows(
        isPublic: Boolean,
        isActive: Boolean,
    ): List<VisibilityRow> =
        listOf(
            VisibilityRow(
                id = "publicProfile",
                label = "Public profile",
                sub = "Neighbors can open your professional profile from search and gigs.",
                isOn = isPublic,
            ),
            VisibilityRow(
                id = "activeForHire",
                label = "Active for hire",
                sub = "Show as available to take on new work.",
                isOn = isActive,
            ),
        )
}
