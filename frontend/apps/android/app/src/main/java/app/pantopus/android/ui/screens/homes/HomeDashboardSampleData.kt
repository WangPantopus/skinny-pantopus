@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.homes

import app.pantopus.android.ui.screens.shared.content_detail.GridTabsTab
import app.pantopus.android.ui.screens.shared.content_detail.HomeHeroStat
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTile
import app.pantopus.android.ui.screens.shared.content_detail.QuickActionTone
import app.pantopus.android.ui.theme.PantopusIcon

/** Deterministic fixtures for Home dashboard previews and snapshots. */
object HomeDashboardSampleData {
    const val POPULATED_HOME_ID = "sample-home-populated"
    const val EMPTY_HOME_ID = "sample-home-empty"
    const val NEEDS_ATTENTION_HOME_ID = "sample-home-needs-attention"

    /** Static chrome, not a fixture — owned by [HomeDashboardProjection]. */
    val tabs: List<GridTabsTab> = HomeDashboardProjection.tabs

    val populatedQuickActions =
        listOf(
            QuickActionTile("view_tasks", "Tasks", PantopusIcon.ListChecks, QuickActionTone.Warning, badge = "7"),
            QuickActionTile("view_bills", "Bills", PantopusIcon.Receipt, QuickActionTone.Error),
            QuickActionTile("view_packages", "Packages", PantopusIcon.Package, QuickActionTone.Business, badge = "4"),
            QuickActionTile("add_member", "Members", PantopusIcon.Users, QuickActionTone.Home),
        )

    val emptyQuickActions =
        listOf(
            QuickActionTile("view_tasks", "Tasks", PantopusIcon.ListChecks, QuickActionTone.Home, isMuted = true),
            QuickActionTile("view_bills", "Bills", PantopusIcon.Receipt, QuickActionTone.Home, isMuted = true),
            QuickActionTile("view_packages", "Packages", PantopusIcon.Package, QuickActionTone.Home, isMuted = true),
            QuickActionTile("add_member", "Members", PantopusIcon.Users, QuickActionTone.Home, isMuted = true),
        )

    val needsAttentionQuickActions =
        listOf(
            QuickActionTile("view_tasks", "Tasks", PantopusIcon.ListChecks, QuickActionTone.Warning, badge = "9"),
            QuickActionTile("view_bills", "Bills", PantopusIcon.Receipt, QuickActionTone.Error, badge = "1"),
            QuickActionTile("view_packages", "Packages", PantopusIcon.Package, QuickActionTone.Business, badge = "4"),
            QuickActionTile("add_member", "Members", PantopusIcon.Users, QuickActionTone.Home),
        )

    val populatedOverview =
        HomeDashboardOverviewContent(
            upcoming =
                listOf(
                    HomeDashboardTimelineItem(
                        id = "plumber",
                        icon = PantopusIcon.Droplet,
                        tone = QuickActionTone.Personal,
                        title = "Plumber - kitchen sink",
                        subtitle = "Jorge - Elm St Plumbing",
                        trailing = "Today - 4pm",
                    ),
                    HomeDashboardTimelineItem(
                        id = "coned",
                        icon = PantopusIcon.Receipt,
                        tone = QuickActionTone.Error,
                        title = "ConEd bill due",
                        subtitle = "\$142.80 - split 3 ways",
                        trailing = "Fri",
                    ),
                    HomeDashboardTimelineItem(
                        id = "packages",
                        icon = PantopusIcon.Package,
                        tone = QuickActionTone.Business,
                        title = "Amazon - waiting pickup",
                        subtitle = "4 packages - building lobby",
                        trailing = null,
                    ),
                ),
            activity =
                listOf(
                    HomeDashboardActivityItem(
                        id = "maria-task",
                        initials = "MK",
                        tone = QuickActionTone.Personal,
                        title = "Maria marked Take out trash done",
                        detail = "Household task completed",
                        time = "18m ago",
                    ),
                    HomeDashboardActivityItem(
                        id = "alex-package",
                        initials = "AK",
                        tone = QuickActionTone.Home,
                        title = "Alex logged a new package from Uniqlo",
                        detail = "Package tracker updated",
                        time = "2h ago",
                    ),
                ),
            emergency =
                HomeDashboardEmergencyInfo(
                    title = "Emergency info",
                    body = "Tap to access shut-off valves, landlord contacts, insurance.",
                    isConfigured = true,
                ),
        )

    val emptyOverview =
        HomeDashboardOverviewContent(
            upcoming = emptyList(),
            activity = emptyList(),
            emergency =
                HomeDashboardEmergencyInfo(
                    title = "Emergency info",
                    body = "Add shut-off valves, landlord contacts, insurance - for when it matters.",
                    isConfigured = false,
                ),
        )

    val needsAttentionOverview =
        HomeDashboardOverviewContent(
            upcoming =
                listOf(
                    HomeDashboardTimelineItem(
                        id = "plumber",
                        icon = PantopusIcon.Droplet,
                        tone = QuickActionTone.Personal,
                        title = "Plumber - kitchen sink",
                        subtitle = "Jorge - Elm St Plumbing",
                        trailing = "Today - 4pm",
                    ),
                    HomeDashboardTimelineItem(
                        id = "packages",
                        icon = PantopusIcon.Package,
                        tone = QuickActionTone.Business,
                        title = "Amazon - waiting pickup",
                        subtitle = "4 packages - building lobby",
                        trailing = null,
                    ),
                ),
            activity =
                listOf(
                    HomeDashboardActivityItem(
                        id = "coned-overdue",
                        initials = "MK",
                        tone = QuickActionTone.Error,
                        title = "Maria flagged the ConEd bill as overdue",
                        detail = "Bill needs payment",
                        time = "6m ago",
                    ),
                    HomeDashboardActivityItem(
                        id = "maintenance-past-due",
                        initials = "PA",
                        tone = QuickActionTone.Warning,
                        title = "Pantopus marked maintenance past due",
                        detail = "2 open maintenance items",
                        time = "22m ago",
                    ),
                ),
            emergency =
                HomeDashboardEmergencyInfo(
                    title = "Emergency info",
                    body = "Tap to access shut-off valves, landlord contacts, insurance.",
                    isConfigured = true,
                ),
        )

    val populatedContent =
        HomeDashboardContent(
            address = "412 Elm St, Apt 3B",
            verified = true,
            isVerifiedOwner = true,
            stats = stats(packages = 4, accessCodes = 2, tasks = 7),
            quickActions = populatedQuickActions,
            tabs = tabs,
            overview = populatedOverview,
        )

    val brandNew =
        HomeDashboardBrandNewContent(
            content =
                HomeDashboardContent(
                    address = "412 Elm St, Apt 3B",
                    verified = true,
                    isVerifiedOwner = true,
                    stats = stats(packages = 0, accessCodes = 0, tasks = 0),
                    quickActions = emptyQuickActions,
                    tabs = tabs,
                    overview = emptyOverview,
                ),
            onboardingSteps =
                listOf(
                    HomeDashboardOnboardingStep(
                        id = "add-members",
                        title = "Add members",
                        body = "Invite household members so updates land with the right people.",
                        cta = "Add",
                        icon = PantopusIcon.Users,
                        tone = QuickActionTone.Home,
                        actionId = "add_member",
                    ),
                    HomeDashboardOnboardingStep(
                        id = "set-access-codes",
                        title = "Set access codes",
                        body = "Store Wi-Fi, alarm, lockbox, and gate codes in one secure place.",
                        cta = "Set",
                        icon = PantopusIcon.KeyRound,
                        tone = QuickActionTone.Personal,
                        actionId = "access_codes",
                    ),
                    HomeDashboardOnboardingStep(
                        id = "log-emergency-info",
                        title = "Log emergency info",
                        body = "Add shut-off valves, contacts, insurance, and evacuation notes.",
                        cta = "Log",
                        icon = PantopusIcon.Siren,
                        tone = QuickActionTone.Error,
                        actionId = "view_emergency",
                    ),
                ),
        )

    val needsAttentionContent =
        HomeDashboardContent(
            address = "412 Elm St, Apt 3B",
            verified = true,
            isVerifiedOwner = true,
            stats = stats(packages = 4, accessCodes = 2, tasks = 9),
            quickActions = needsAttentionQuickActions,
            tabs = tabs,
            overview = needsAttentionOverview,
            attentionSummary =
                HomeDashboardAttentionSummary(
                    message = "3 items need attention: 1 overdue bill, 2 maintenance items past due, 1 pending claim",
                    chips =
                        listOf(
                            HomeDashboardQuickJump(
                                id = "overdue-bill",
                                label = "Overdue bill",
                                icon = PantopusIcon.Receipt,
                                actionId = "view_bills",
                            ),
                            HomeDashboardQuickJump(
                                id = "maintenance-past-due",
                                label = "Maintenance",
                                icon = PantopusIcon.Hammer,
                                actionId = "view_maintenance",
                            ),
                            HomeDashboardQuickJump(
                                id = "pending-claim",
                                label = "Pending claim",
                                icon = PantopusIcon.ShieldAlert,
                                actionId = "view_claims",
                            ),
                        ),
                ),
        )

    fun stateFor(homeId: String): HomeDashboardUiState? =
        when (homeId) {
            POPULATED_HOME_ID -> HomeDashboardUiState.Loaded(populatedContent)
            EMPTY_HOME_ID -> HomeDashboardUiState.Empty(brandNew)
            NEEDS_ATTENTION_HOME_ID -> HomeDashboardUiState.NeedsAttention(needsAttentionContent)
            else -> null
        }

    fun stats(
        packages: Int,
        accessCodes: Int,
        tasks: Int,
    ): List<HomeHeroStat> =
        listOf(
            HomeHeroStat("packages", packages.toString(), "Packages"),
            HomeHeroStat("access_codes", accessCodes.toString(), "Access codes"),
            HomeHeroStat("tasks", tasks.toString(), "Tasks"),
        )
}
