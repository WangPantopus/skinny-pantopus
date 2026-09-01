@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.membership

import app.pantopus.android.ui.components.PersonaPillar
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Deterministic sample membership used by previews, the view-model's stub
 * load, and the Paparazzi snapshots. The backend has been removed from the
 * repo, so the membership detail surface renders from these fixtures rather
 * than a network fetch. Shapes mirror the eventual
 * `/api/audience/membership/:personaId` projection.
 */
object MembershipSampleData {
    /** Stable persona id used by the Audience Profile footer + the route. */
    const val PERSONA_ID = "persona_lara_chen"

    val persona =
        MembershipPersona(
            id = PERSONA_ID,
            name = "Lara Chen",
            initials = "LC",
            subtitle = "Elm Park Eats · food critic · 1,240 members",
            pillar = PersonaPillar.Business,
            pillarLabel = "Business",
            verified = true,
        )

    val benefits =
        listOf(
            MembershipBenefit(
                id = "newsletter",
                icon = PantopusIcon.Mail,
                label = "Weekly newsletter",
                meta = "Sunday mornings",
            ),
            MembershipBenefit(
                id = "ama",
                icon = PantopusIcon.MessageCircle,
                label = "Monthly inbox AMA",
                meta = "Reply within 48h · SLA",
            ),
            MembershipBenefit(
                id = "bts",
                icon = PantopusIcon.Camera,
                label = "Behind-the-scenes photos",
                meta = "~6 posts / month",
            ),
            MembershipBenefit(
                id = "discount",
                icon = PantopusIcon.Tag,
                label = "10% off Lara's tastings",
                meta = "Code auto-applied",
            ),
        )

    const val POLICY_FOOTNOTE =
        "Cancel anytime — unused days are prorated and refunded to your card. " +
            "Receipts are emailed by Stripe."

    /** Frame 1 — Silver tier, renews in 22 days, happy path. */
    val populated =
        MembershipDetailContent(
            persona = persona,
            tier = MembershipTier.Silver,
            priceLabel = "$8",
            periodLabel = "month",
            renewalLabel = "Renews on Nov 12 · 22 days from now",
            paymentLabel = "Visa •••• 4242",
            benefits = benefits,
            policyFootnote = POLICY_FOOTNOTE,
            slaAlert = null,
        )

    val slaAlert =
        MembershipSLAAlert(
            title = "Lara owes you a reply",
            message =
                "You've been waiting for 5 days. " +
                    "You're eligible for a one-month refund.",
            refundCtaLabel = "Request refund",
            dismissCtaLabel = "Give it a week",
        )

    /** Frame 2 — same membership, refund-eligible banner + warn-tone renewal. */
    val slaMissed = populated.copy(slaAlert = slaAlert)

    /** "You're a member" footer descriptor for the Audience Profile entry. */
    val audienceFooter =
        AudienceMemberFooter(
            personaId = PERSONA_ID,
            personaName = persona.name,
            tierName = MembershipTier.Silver.displayName,
        )
}
