@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile.professional

import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusIcon

object ProfessionalProfileSampleData {
    val published: ProfessionalProfileContent
        get() = makePublished()

    val pendingEdits: ProfessionalProfileContent
        get() = makePending()

    private fun field(
        id: String,
        value: String,
    ): FormFieldState = FormFieldState(id = id, value = value, originalValue = value)

    private fun makePublished(): ProfessionalProfileContent =
        ProfessionalProfileContent(
            proName = "Maria Kovács",
            strength = 92,
            title = field("title", "Licensed General Handyman"),
            yearsInRole = field("yearsInRole", "9"),
            company =
                CompanyClaim(
                    name = "Kovács & Co Handywork",
                    locality = "Elm Park, NY",
                    status = ProVerificationStatus.Verified,
                ),
            skills = publishedSkills,
            certifications = publishedCertifications,
            portfolio = publishedPortfolio,
            visibility = publishedVisibility,
            categories = listOf("carpentry", "plumber", "electrician"),
            serviceCity = field("serviceCity", "Elm Park"),
            serviceState = field("serviceState", "NY"),
            serviceRadiusKm = field("serviceRadiusKm", "25"),
            hourlyRate = field("hourlyRate", "85"),
            verification = ProVerificationSummary(status = ProVerificationStatus.Verified, tier = 2),
        )

    private val publishedSkills: List<ProSkill>
        get() =
            listOf(
                ProSkill(id = "carpentry", label = "Carpentry", icon = PantopusIcon.Hammer),
                ProSkill(id = "plumbing", label = "Plumbing", icon = PantopusIcon.Droplet),
                ProSkill(id = "electrical", label = "Electrical", icon = PantopusIcon.Zap),
                ProSkill(id = "locksmith", label = "Locksmith", icon = PantopusIcon.KeyRound),
                ProSkill(id = "floors", label = "Floors", icon = PantopusIcon.Square),
            )

    private val publishedCertifications: List<Certification>
        get() =
            listOf(
                Certification(
                    id = "ny-gc",
                    name = "NY State General Contractor",
                    issuer = "New York State Dept. of Labor",
                    issued = "Mar 2021",
                    expires = "Mar 2027",
                    status = ProVerificationStatus.Verified,
                ),
                Certification(
                    id = "osha-30",
                    name = "OSHA 30-Hour General Industry",
                    issuer = "OSHA Training Institute",
                    issued = "Aug 2023",
                    expires = "Aug 2028",
                    status = ProVerificationStatus.Verified,
                ),
                Certification(
                    id = "epa-lead",
                    name = "EPA Lead-Safe Renovator",
                    issuer = "U.S. Environmental Protection Agency",
                    issued = "Jan 2022",
                    expires = "Jan 2027",
                    status = ProVerificationStatus.Expiring,
                ),
            )

    private val publishedPortfolio: List<PortfolioLink>
        get() =
            listOf(
                PortfolioLink(
                    id = "site",
                    host = "kovacsco.work",
                    title = "kovacsco.work · Past projects",
                    url = "https://kovacsco.work",
                    state = PortfolioLinkState.Resolved,
                ),
                PortfolioLink(
                    id = "instagram",
                    host = "instagram",
                    title = "@kovacs.handywork",
                    url = "instagram.com/kovacs.handywork",
                    state = PortfolioLinkState.Resolved,
                ),
                PortfolioLink(
                    id = "youtube",
                    host = "youtube",
                    title = "Hardwood floor repair walk-through",
                    url = "youtu.be/_2j8…",
                    state = PortfolioLinkState.Resolved,
                ),
            )

    private val publishedVisibility: List<VisibilityRow>
        get() =
            listOf(
                VisibilityRow(
                    id = "neighborSearch",
                    label = "Show on neighbor search",
                    sub = "Verified neighbors searching Pulse find your pro profile.",
                    isOn = true,
                    scope = "Elm Park · 0.6 mi radius",
                ),
                VisibilityRow(
                    id = "publicProfile",
                    label = "Public profile",
                    sub = "Neighbors can open your professional profile from search and gigs.",
                    isOn = true,
                    scope = "Pantopus neighbors",
                ),
                VisibilityRow(
                    id = "showCertifications",
                    label = "Show certifications",
                    sub = "Display verified and pending certificates on your public profile.",
                    isOn = true,
                ),
                VisibilityRow(
                    id = "hourlyRate",
                    label = "Show hourly rate publicly",
                    sub = "$85/hr · weekday daytime. Hides on gig posts when off.",
                    isOn = true,
                ),
            )

    private fun makePending(): ProfessionalProfileContent {
        val published = makePublished()
        val withFresh =
            published.copy(
                strength = 68,
                company =
                    CompanyClaim(
                        name = "Elm Park Trades Co-op",
                        locality = "Elm Park, NY",
                        status = ProVerificationStatus.Pending,
                        isDirty = true,
                        hint = "We'll email the co-op admin to confirm you're a member.",
                    ),
                skills =
                    published.skills +
                        ProSkill(
                            id = "tile",
                            label = "Tile work",
                            icon = PantopusIcon.Grid3x3,
                            isFresh = true,
                        ),
                portfolio =
                    published.portfolio +
                        PortfolioLink(
                            id = "behance",
                            host = "behance",
                            title = "",
                            url = "behance.net/mariak/tile-bathroom-2026",
                            state = PortfolioLinkState.Loading,
                            isFresh = true,
                        ),
            )
        return withFresh.copy(
            certifications =
                withFresh.certifications.toMutableList().apply {
                    add(
                        2,
                        Certification(
                            id = "cti",
                            name = "Certified Tile Installer (CTI)",
                            issuer = "Ceramic Tile Education Foundation",
                            issued = "May 2026",
                            expires = "May 2031",
                            status = ProVerificationStatus.Pending,
                            isFresh = true,
                        ),
                    )
                },
            visibility =
                withFresh.visibility.map {
                    if (it.id == "hourlyRate") it.copy(isOn = false) else it
                },
        )
    }
}
