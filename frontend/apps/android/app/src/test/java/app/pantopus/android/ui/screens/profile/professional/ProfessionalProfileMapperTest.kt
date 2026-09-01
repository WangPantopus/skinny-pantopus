@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.profile.professional

import app.pantopus.android.data.api.models.professional.ProfessionalProfileDto
import app.pantopus.android.data.api.models.professional.ProfessionalServiceAreaDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P1-F — pure projection of the backend professional record (mirrors iOS
 * `ProfessionalProfileMappingTests`).
 */
class ProfessionalProfileMapperTest {
    private fun dto(
        headline: String? = "Licensed General Handyman",
        bio: String? = "20 years of trade work.",
        categories: List<String>? = listOf("handyman", "carpentry"),
        isPublic: Boolean? = true,
        isActive: Boolean? = false,
        status: String? = "verified",
    ) = ProfessionalProfileDto(
        headline = headline,
        bio = bio,
        categories = categories,
        serviceArea = ProfessionalServiceAreaDto(city = "Elm Park", state = "NY"),
        isPublic = isPublic,
        isActive = isActive,
        verificationTier = 2,
        verificationStatus = status,
    )

    @Test
    fun maps_overlapping_fields() {
        val content = ProfessionalProfileMapper.build(dto(), null, proName = "Maria K.")
        assertEquals("Maria K.", content.proName)
        assertEquals("Licensed General Handyman", content.title.value)
        assertEquals(listOf("Handyman", "Carpentry"), content.skills.map { it.label })
        assertEquals("Elm Park, NY", content.company.locality)
        assertEquals(ProVerificationStatus.Verified, content.company.status)
        assertTrue(content.certifications.isEmpty())
        assertTrue(content.portfolio.isEmpty())
        assertEquals(true, content.visibility.first { it.id == "publicProfile" }.isOn)
        assertEquals(false, content.visibility.first { it.id == "activeForHire" }.isOn)
        assertEquals(0, content.dirtyCount)
    }

    @Test
    fun null_profile_is_empty_and_clean() {
        val content = ProfessionalProfileMapper.build(null, null)
        assertEquals("", content.title.value)
        assertTrue(content.skills.isEmpty())
        assertEquals(ProVerificationStatus.Unverified, content.company.status)
        assertEquals(0, content.strength)
        assertEquals(0, content.dirtyCount)
    }

    @Test
    fun verification_status_mapping() {
        assertEquals(ProVerificationStatus.Verified, ProfessionalProfileMapper.verificationStatus("verified"))
        assertEquals(ProVerificationStatus.Pending, ProfessionalProfileMapper.verificationStatus("pending"))
        assertEquals(ProVerificationStatus.Unverified, ProfessionalProfileMapper.verificationStatus(null))
    }

    @Test
    fun category_label_humanizes() {
        assertEquals("Pet Care", ProfessionalProfileMapper.categoryLabel("pet_care"))
        assertEquals("Handyman", ProfessionalProfileMapper.categoryLabel("handyman"))
    }

    @Test
    fun strength_rewards_completeness() {
        val bare =
            ProfessionalProfileMapper.strength(
                dto(headline = "", bio = "", categories = emptyList(), status = "unverified"),
            )
        val full = ProfessionalProfileMapper.strength(dto())
        assertEquals(40, bare)
        assertTrue(full > bare)
        assertTrue(full <= 100)
    }
}
