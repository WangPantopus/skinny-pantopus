//
//  ProfessionalProfileSampleData.swift
//  Pantopus
//
//  A.5 (A13.11) — deterministic fixtures for the Professional Profile
//  editor. Backend was removed from the repo, so the view-model hydrates
//  from here; previews and snapshot tests reuse the same data so both
//  designed frames render identically every run.
//
//  `published`    → FRAME 1 (verified, strength 92, no unsaved edits).
//  `pendingEdits` → FRAME 2 (strength 68, company switched + a fresh cert,
//                   skill, and portfolio link added → 5 edits, 2 pending
//                   claims awaiting verification).
//

import Foundation

public enum ProfessionalProfileSampleData {
    /// FRAME 1 — the live, published profile. Clean (no unsaved edits),
    /// company verified, all certs verified or expiring.
    public static var published: ProfessionalProfileContent {
        makePublished()
    }

    /// FRAME 2 — the same profile after this session's edits: company
    /// switched to a co-op (pending), a Tile-Installer cert + Behance link
    /// + "Tile work" skill added, hourly-rate visibility toggled off.
    public static var pendingEdits: ProfessionalProfileContent {
        makePending()
    }

    // MARK: - Builders

    private static func makePublished() -> ProfessionalProfileContent {
        ProfessionalProfileContent(
            proName: "Maria Kovács",
            strength: 92,
            title: FormFieldState(id: "title", originalValue: "Licensed General Handyman"),
            yearsInRole: FormFieldState(id: "yearsInRole", originalValue: "9"),
            company: CompanyClaim(
                name: "Kovács & Co Handywork",
                locality: "Elm Park, NY",
                status: .verified
            ),
            skills: publishedSkills,
            certifications: publishedCertifications,
            portfolio: publishedPortfolio,
            visibility: publishedVisibility,
            categories: ["carpentry", "plumber", "electrician"],
            serviceCity: FormFieldState(id: "serviceCity", originalValue: "Elm Park"),
            serviceState: FormFieldState(id: "serviceState", originalValue: "NY"),
            serviceRadiusKm: FormFieldState(id: "serviceRadiusKm", originalValue: "25"),
            hourlyRate: FormFieldState(id: "hourlyRate", originalValue: "85"),
            verification: ProVerificationSummary(status: .verified, tier: 2)
        )
    }

    private static var publishedSkills: [ProSkill] {
        [
            ProSkill(id: "carpentry", label: "Carpentry", icon: .hammer),
            ProSkill(id: "plumbing", label: "Plumbing", icon: .droplet),
            ProSkill(id: "electrical", label: "Electrical", icon: .zap),
            ProSkill(id: "locksmith", label: "Locksmith", icon: .keyRound),
            ProSkill(id: "floors", label: "Floors", icon: .square)
        ]
    }

    private static var publishedCertifications: [Certification] {
        [
            Certification(
                id: "ny-gc",
                name: "NY State General Contractor",
                issuer: "New York State Dept. of Labor",
                issued: "Mar 2021",
                expires: "Mar 2027",
                status: .verified
            ),
            Certification(
                id: "osha-30",
                name: "OSHA 30-Hour General Industry",
                issuer: "OSHA Training Institute",
                issued: "Aug 2023",
                expires: "Aug 2028",
                status: .verified
            ),
            Certification(
                id: "epa-lead",
                name: "EPA Lead-Safe Renovator",
                issuer: "U.S. Environmental Protection Agency",
                issued: "Jan 2022",
                expires: "Jan 2027",
                status: .expiring
            )
        ]
    }

    private static var publishedPortfolio: [PortfolioLink] {
        [
            PortfolioLink(
                id: "site",
                host: "kovacsco.work",
                title: "kovacsco.work · Past projects",
                url: "https://kovacsco.work",
                state: .resolved
            ),
            PortfolioLink(
                id: "instagram",
                host: "instagram",
                title: "@kovacs.handywork",
                url: "instagram.com/kovacs.handywork",
                state: .resolved
            ),
            PortfolioLink(
                id: "youtube",
                host: "youtube",
                title: "Hardwood floor repair walk-through",
                url: "youtu.be/_2j8…",
                state: .resolved
            )
        ]
    }

    private static var publishedVisibility: [ProVisibilityRow] {
        [
            ProVisibilityRow(
                id: "neighborSearch",
                label: "Show on neighbor search",
                sub: "Verified neighbors searching Pulse find your pro profile.",
                isOn: true,
                scope: "Elm Park · 0.6 mi radius"
            ),
            ProVisibilityRow(
                id: "publicProfile",
                label: "Public profile",
                sub: "Neighbors can open your professional profile from search and gigs.",
                isOn: true,
                scope: "Pantopus neighbors"
            ),
            ProVisibilityRow(
                id: "showCertifications",
                label: "Show certifications",
                sub: "Display verified and pending certificates on your public profile.",
                isOn: true
            ),
            ProVisibilityRow(
                id: "hourlyRate",
                label: "Show hourly rate publicly",
                sub: "$85/hr · weekday daytime. Hides on gig posts when off.",
                isOn: true
            )
        ]
    }

    private static func makePending() -> ProfessionalProfileContent {
        var content = makePublished()
        content.strength = 68
        // Company switched to a co-op this session — needs admin confirmation.
        content.company = CompanyClaim(
            name: "Elm Park Trades Co-op",
            locality: "Elm Park, NY",
            status: .pending,
            isDirty: true,
            hint: "We'll email the co-op admin to confirm you're a member."
        )
        // Added a fresh trade chip.
        content.skills.append(
            ProSkill(id: "tile", label: "Tile work", icon: .grid3x3, isFresh: true)
        )
        // Uploaded a new cert (pending) — slots before the expiring EPA card.
        content.certifications.insert(
            Certification(
                id: "cti",
                name: "Certified Tile Installer (CTI)",
                issuer: "Ceramic Tile Education Foundation",
                issued: "May 2026",
                expires: "May 2031",
                status: .pending,
                isFresh: true
            ),
            at: 2
        )
        // Added a new portfolio link whose preview is still resolving.
        content.portfolio.append(
            PortfolioLink(
                id: "behance",
                host: "behance",
                title: "",
                url: "behance.net/mariak/tile-bathroom-2026",
                state: .loading,
                isFresh: true
            )
        )
        // Toggled hourly-rate visibility off — `originalOn` stays true, so the
        // row reads as dirty.
        if let index = content.visibility.firstIndex(where: { $0.id == "hourlyRate" }) {
            content.visibility[index].isOn = false
        }
        return content
    }
}
