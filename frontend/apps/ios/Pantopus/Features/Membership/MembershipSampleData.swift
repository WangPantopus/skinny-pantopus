//
//  MembershipSampleData.swift
//  Pantopus
//
//  Deterministic sample membership used by previews, the view-model's
//  stub load, and the snapshot tests. The backend has been removed from
//  the repo, so the membership detail surface renders from these fixtures
//  rather than a network fetch. Shapes mirror the eventual
//  `/api/audience/membership/:personaId` projection.
//

import Foundation

public enum MembershipSampleData {
    /// Stable persona id used by the Audience Profile footer entry point
    /// and the membership detail route.
    public static let personaId = "persona_lara_chen"

    public static let persona = MembershipPersona(
        id: personaId,
        name: "Lara Chen",
        initials: "LC",
        subtitle: "Elm Park Eats · food critic · 1,240 members",
        pillar: .business,
        pillarLabel: "Business",
        verified: true
    )

    public static let benefits: [MembershipBenefit] = [
        MembershipBenefit(
            id: "newsletter",
            icon: .mail,
            label: "Weekly newsletter",
            meta: "Sunday mornings"
        ),
        MembershipBenefit(
            id: "ama",
            icon: .messageCircle,
            label: "Monthly inbox AMA",
            meta: "Reply within 48h · SLA"
        ),
        MembershipBenefit(
            id: "bts",
            icon: .camera,
            label: "Behind-the-scenes photos",
            meta: "~6 posts / month"
        ),
        MembershipBenefit(
            id: "discount",
            icon: .tag,
            label: "10% off Lara's tastings",
            meta: "Code auto-applied"
        )
    ]

    static let policyFootnote =
        "Cancel anytime — unused days are prorated and refunded to your card. "
            + "Receipts are emailed by Stripe."

    /// Frame 1 — Silver tier, renews in 22 days, happy path.
    public static let populated = MembershipDetailContent(
        persona: persona,
        tier: .silver,
        priceLabel: "$8",
        periodLabel: "month",
        renewalLabel: "Renews on Nov 12 · 22 days from now",
        paymentLabel: "Visa •••• 4242",
        benefits: benefits,
        policyFootnote: policyFootnote,
        slaAlert: nil
    )

    public static let slaAlert = MembershipSLAAlert(
        title: "Lara owes you a reply",
        message: "You've been waiting for 5 days. "
            + "You're eligible for a one-month refund.",
        refundCtaLabel: "Request refund",
        dismissCtaLabel: "Give it a week"
    )

    /// Frame 2 — same membership, with the refund-eligible banner pinned
    /// above the fold and the renewal row in warn tone.
    public static let slaMissed = MembershipDetailContent(
        persona: persona,
        tier: .silver,
        priceLabel: "$8",
        periodLabel: "month",
        renewalLabel: "Renews on Nov 12 · 22 days from now",
        paymentLabel: "Visa •••• 4242",
        benefits: benefits,
        policyFootnote: policyFootnote,
        slaAlert: slaAlert
    )

    /// "You're a member" footer descriptor for the Audience Profile entry
    /// point — coherent with the membership detail it opens.
    public static let audienceFooter = AudienceMemberFooter(
        personaId: personaId,
        personaName: persona.name,
        tierName: MembershipTier.silver.displayName
    )
}
