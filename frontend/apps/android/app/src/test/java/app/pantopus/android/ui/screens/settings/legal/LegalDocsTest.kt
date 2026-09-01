@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.legal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * B6.1 — content-contract test for the A19 long-form legal docs. Validates the
 * structured copy behind the Privacy + Terms viewers (the data the four design
 * frames render): section counts, TOC titles, meta strip, and contact footer.
 *
 * Pixel snapshots of the rendered frames live in `LegalDocumentSnapshotTest`
 * (Paparazzi); this JVM test guards the data contract without a golden image.
 * The iOS mirror is the `LegalDocs` model exercised by `LegalDocumentSnapshotTests`.
 */
class LegalDocsTest {
    @Test
    fun privacyHasTenSectionsMatchingTheToc() {
        val doc = LegalDocs.model(LegalDocument.Privacy)
        assertEquals("October 1, 2025", doc.lastUpdated)
        assertEquals("3.2", doc.version)
        assertEquals("privacy@pantopus.com", doc.contactEmail)
        assertEquals("Questions about this policy?", doc.contactLabel)
        assertEquals(
            listOf(
                "Overview",
                "Information we collect",
                "How we use it",
                "Identity pillars & privacy",
                "Sharing & disclosure",
                "Your rights & controls",
                "Data retention",
                "Children & teens",
                "International transfers",
                "Changes to this policy",
            ),
            doc.sectionTitles,
        )
    }

    @Test
    fun termsHasTwelveSectionsMatchingTheToc() {
        val doc = LegalDocs.model(LegalDocument.Terms)
        assertEquals("February 14, 2026", doc.lastUpdated)
        assertEquals("5.0", doc.version)
        assertEquals("legal@pantopus.com", doc.contactEmail)
        assertEquals("Questions about these terms?", doc.contactLabel)
        assertEquals(
            listOf(
                "Acceptance of these terms",
                "Eligibility & accounts",
                "Identity pillars",
                "Acceptable use",
                "Content & licenses",
                "Tokens, invites & access",
                "Payments & gigs",
                "Termination",
                "Disclaimers",
                "Limitation of liability",
                "Governing law & disputes",
                "Changes to these terms",
            ),
            doc.sectionTitles,
        )
    }

    @Test
    fun overviewBoldsTheThreeIdentityPillars() {
        val overview = LegalDocs.privacy.sections.first()
        val rich = overview.blocks.filterIsInstance<LegalBlock.Rich>().first()
        val boldTerms = rich.runs.filter { it.bold }.map { it.text }
        assertEquals(listOf("Personal", "Home", "Business"), boldTerms)
    }

    @Test
    fun everySectionOpensWithAtLeastOneBlock() {
        (LegalDocs.privacy.sections + LegalDocs.terms.sections).forEach { section ->
            assertTrue("section '${section.title}' has no blocks", section.blocks.isNotEmpty())
        }
    }
}
