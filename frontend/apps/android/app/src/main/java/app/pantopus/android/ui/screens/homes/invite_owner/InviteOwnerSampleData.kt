@file:Suppress("MagicNumber", "PackageNaming", "UnusedParameter")

package app.pantopus.android.ui.screens.homes.invite_owner

/** Deterministic A13.2 sample data for Invite Owner previews and snapshots. */
object InviteOwnerSampleData {
    const val NOTE_MAX_LENGTH = 240

    fun homeContext(homeId: String): InviteOwnerHomeContext =
        InviteOwnerHomeContext(title = "412 Elm St · Apt 3B", subtitle = "Kovács household")

    fun draftFor(homeId: String): InviteOwnerDraft =
        when (homeId) {
            "home-valid" -> Valid
            "home-conflict" -> Conflict
            "home-empty" -> Empty
            else -> initialDraft(homeId)
        }

    fun initialDraft(homeId: String): InviteOwnerDraft =
        InviteOwnerDraft(
            homeContext = homeContext(homeId),
            owners =
                listOf(
                    InviteOwnerOwnerShare(
                        id = "you",
                        initials = "MK",
                        name = "You",
                        sharePercent = 75,
                        tone = InviteOwnerTone.Personal,
                    ),
                ),
            grantPercent = 25,
            autoBalancesSoleOwner = true,
        )

    val Valid: InviteOwnerDraft =
        InviteOwnerDraft(
            homeContext = homeContext("home-valid"),
            owners =
                listOf(
                    InviteOwnerOwnerShare(
                        id = "you",
                        initials = "MK",
                        name = "You",
                        sharePercent = 75,
                        tone = InviteOwnerTone.Personal,
                    ),
                ),
            email = "maya.fortune@pantopus.app",
            phone = "(415) 555-0198",
            role = "Books — invoices, bill splits, taxes. Co-signer on the lease renewal in March.",
            grantPercent = 25,
            autoBalancesSoleOwner = true,
        )

    val Conflict: InviteOwnerDraft =
        InviteOwnerDraft(
            homeContext = homeContext("home-conflict"),
            owners =
                listOf(
                    InviteOwnerOwnerShare(
                        id = "maria",
                        initials = "MK",
                        name = "Maria",
                        sharePercent = 50,
                        tone = InviteOwnerTone.Personal,
                    ),
                    InviteOwnerOwnerShare(
                        id = "marcus",
                        initials = "MK",
                        name = "Marcus",
                        sharePercent = 30,
                        tone = InviteOwnerTone.Home,
                    ),
                ),
            email = "priya.shah@pantopus.app",
            grantPercent = 30,
            autoBalancesSoleOwner = false,
        )

    val Empty: InviteOwnerDraft =
        InviteOwnerDraft(
            homeContext = homeContext("home-empty"),
            owners = emptyList(),
            grantPercent = 0,
            autoBalancesSoleOwner = false,
        )
}

data class InviteOwnerHomeContext(
    val title: String,
    val subtitle: String,
)

enum class InviteOwnerTone {
    Personal,
    Home,
    Business,
}

data class InviteOwnerOwnerShare(
    val id: String,
    val initials: String,
    val name: String,
    val sharePercent: Int,
    val tone: InviteOwnerTone,
)

data class InviteOwnershipSummary(
    val owners: List<InviteOwnerOwnerShare>,
    val availablePercent: Int,
    val grantPercent: Int,
    val totalAfterGrant: Int,
    val conflictOverage: Int,
) {
    val hasConflict: Boolean get() = conflictOverage > 0
}

data class InviteOwnerDraft(
    val homeContext: InviteOwnerHomeContext,
    val owners: List<InviteOwnerOwnerShare>,
    val email: String = "",
    val phone: String = "",
    val role: String = "",
    val grantPercent: Int,
    val autoBalancesSoleOwner: Boolean,
)
