@file:Suppress("MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

// §1C-b — Context-aware navigation drawer (LAUNCHER variant / Option A).
// Design: docs/design/new/Navigation Drawer - Launcher.html
//         (+ nav-drawer-launcher-frames.jsx)
//
// A Material 3 ModalNavigationDrawer body. The context pill opens the existing
// Identity Center to switch context; the body rows dispatch semantic
// destinations the host (RootTabScreen) maps to existing routes. Three context
// variants — Personal / Home / Business — render from NavigationDrawerContext.
// Content is deterministic from the active context, so there are no
// network-bound loading / empty / error states (the design shows none).

// MARK: - Models

/** The active hub context the drawer renders for. */
sealed interface NavigationDrawerContext {
    data class Personal(val name: String) : NavigationDrawerContext

    data class Home(val id: String, val title: String, val subtitle: String) : NavigationDrawerContext

    data class Business(val id: String, val title: String, val subtitle: String) : NavigationDrawerContext
}

/** Identity pillar tint applied to the context header. */
enum class NavigationDrawerPillar { Personal, Home, Business }

/**
 * A semantic destination dispatched when a row is tapped. The host maps each
 * onto an existing route — no new screens. Destinations with no shipped native
 * route fall back to the NotYetAvailable placeholder host-side. Home / Business
 * destinations read the active id from [NavigationDrawerContext].
 */
enum class NavigationDrawerDestination {
    // Personal
    MyHomes,
    MyBusinesses,
    Connections,
    Mailbox,
    ProfileAndPrivacy,
    BeaconUpdates,
    Search,
    DiscoverNeighbors,
    MyBeacon,
    MyListings,
    MyPulse,
    MyTasks,
    MyBids,
    OffersAndBids,
    PostTask,
    WalletAndPayments,
    Settings,
    HelpSupport,

    // Home
    HomeProperty,
    HomeOverview,
    HomeTasks,
    HomeIssues,
    HomeBills,
    HomeMembers,
    HomeMailbox,
    HomePackages,
    HomeDocuments,
    HomeVendors,
    HomeEmergency,
    HomeSettings,

    // Business
    BusinessOverview,
    BusinessProfileRow,
    BusinessLocations,
    BusinessCatalog,
    BusinessPages,
    BusinessPostTask,
    BusinessChat,
    BusinessTeam,
    BusinessReviews,
    BusinessPayments,
    BusinessSettings,
}

/** A full-width menu row. [slug] drives the `navDrawer.item.<slug>` test tag. */
data class NavigationDrawerItem(
    val slug: String,
    val icon: PantopusIcon,
    val label: String,
    val isActive: Boolean,
    val destination: NavigationDrawerDestination,
)

/** A labelled group of rows. `overline == null` renders the leading group. */
data class NavigationDrawerSection(
    val id: String,
    val overline: String?,
    val items: List<NavigationDrawerItem>,
)

// MARK: - Projection (pure — mirrors iOS NavigationDrawerViewModel)

/**
 * Kebab-cases a label into the `navDrawer.item.<slug>` suffix. Mirrors the iOS
 * `NavigationDrawerViewModel.slug` helper verbatim so the tag contract matches.
 */
fun navDrawerSlug(label: String): String =
    label
        .replace("&", "and")
        .lowercase()
        .split(Regex("[^a-z0-9]+"))
        .filter { it.isNotEmpty() }
        .joinToString("-")

fun NavigationDrawerContext.pillar(): NavigationDrawerPillar =
    when (this) {
        is NavigationDrawerContext.Personal -> NavigationDrawerPillar.Personal
        is NavigationDrawerContext.Home -> NavigationDrawerPillar.Home
        is NavigationDrawerContext.Business -> NavigationDrawerPillar.Business
    }

fun NavigationDrawerContext.headerTitle(): String =
    when (this) {
        is NavigationDrawerContext.Personal -> "Personal"
        is NavigationDrawerContext.Home -> title
        is NavigationDrawerContext.Business -> title
    }

fun NavigationDrawerContext.headerSubtitle(): String =
    when (this) {
        is NavigationDrawerContext.Personal ->
            if (name.isBlank()) "Your profile" else "$name · Your profile"
        is NavigationDrawerContext.Home -> subtitle
        is NavigationDrawerContext.Business -> subtitle
    }

fun NavigationDrawerContext.showsBackToHub(): Boolean = this !is NavigationDrawerContext.Personal

private fun item(
    icon: PantopusIcon,
    label: String,
    destination: NavigationDrawerDestination,
    active: Boolean = false,
): NavigationDrawerItem =
    NavigationDrawerItem(
        slug = navDrawerSlug(label),
        icon = icon,
        label = label,
        isActive = active,
        destination = destination,
    )

fun NavigationDrawerContext.sections(): List<NavigationDrawerSection> =
    when (this) {
        is NavigationDrawerContext.Personal -> personalSections
        is NavigationDrawerContext.Home -> homeSections
        is NavigationDrawerContext.Business -> businessSections
    }

private val personalSections: List<NavigationDrawerSection> =
    listOf(
        NavigationDrawerSection(
            id = "manage",
            overline = "Manage",
            items =
                listOf(
                    item(PantopusIcon.Home, "My Homes", NavigationDrawerDestination.MyHomes),
                    item(PantopusIcon.Building2, "My Businesses", NavigationDrawerDestination.MyBusinesses),
                    item(PantopusIcon.Users, "Connections", NavigationDrawerDestination.Connections),
                    item(PantopusIcon.Mail, "Mailbox", NavigationDrawerDestination.Mailbox),
                    item(PantopusIcon.Shield, "Profile & Privacy", NavigationDrawerDestination.ProfileAndPrivacy),
                ),
        ),
        NavigationDrawerSection(
            id = "discover",
            overline = "Discover",
            items =
                listOf(
                    item(PantopusIcon.Rss, "Beacon Updates", NavigationDrawerDestination.BeaconUpdates),
                    item(PantopusIcon.Search, "Search", NavigationDrawerDestination.Search),
                    item(PantopusIcon.Compass, "Discover Neighbors", NavigationDrawerDestination.DiscoverNeighbors),
                ),
        ),
        NavigationDrawerSection(
            id = "your-stuff",
            overline = "Your Stuff",
            items =
                listOf(
                    item(PantopusIcon.Radio, "My Beacon", NavigationDrawerDestination.MyBeacon),
                    item(PantopusIcon.Tag, "My Listings", NavigationDrawerDestination.MyListings),
                    item(PantopusIcon.FileText, "My Pulse", NavigationDrawerDestination.MyPulse),
                    item(PantopusIcon.ListChecks, "My Tasks", NavigationDrawerDestination.MyTasks),
                    item(PantopusIcon.Hand, "My Bids", NavigationDrawerDestination.MyBids),
                    item(PantopusIcon.Gavel, "Offers & Bids", NavigationDrawerDestination.OffersAndBids),
                    item(PantopusIcon.PlusCircle, "Post Task", NavigationDrawerDestination.PostTask),
                    item(PantopusIcon.CreditCard, "Wallet & Payments", NavigationDrawerDestination.WalletAndPayments),
                ),
        ),
        NavigationDrawerSection(
            id = "settings",
            overline = "Settings",
            items =
                listOf(
                    item(PantopusIcon.SlidersHorizontal, "Settings", NavigationDrawerDestination.Settings),
                    item(PantopusIcon.HelpCircle, "Help & Support", NavigationDrawerDestination.HelpSupport),
                ),
        ),
    )

private val homeSections: List<NavigationDrawerSection> =
    listOf(
        NavigationDrawerSection(
            id = "home",
            overline = null,
            items =
                listOf(
                    item(PantopusIcon.Info, "Property Details", NavigationDrawerDestination.HomeProperty),
                    item(PantopusIcon.BarChart3, "Overview", NavigationDrawerDestination.HomeOverview, active = true),
                    item(PantopusIcon.CheckCircle, "Tasks", NavigationDrawerDestination.HomeTasks),
                    item(PantopusIcon.Wrench, "Issues", NavigationDrawerDestination.HomeIssues),
                    item(PantopusIcon.CreditCard, "Bills", NavigationDrawerDestination.HomeBills),
                    item(PantopusIcon.Users, "Members", NavigationDrawerDestination.HomeMembers),
                    item(PantopusIcon.Mail, "Mailbox", NavigationDrawerDestination.HomeMailbox),
                ),
        ),
        NavigationDrawerSection(
            id = "more",
            overline = "More",
            items =
                listOf(
                    item(PantopusIcon.Package, "Packages", NavigationDrawerDestination.HomePackages),
                    item(PantopusIcon.FileText, "Documents", NavigationDrawerDestination.HomeDocuments),
                    item(PantopusIcon.Hammer, "Vendors", NavigationDrawerDestination.HomeVendors),
                    item(PantopusIcon.AlertTriangle, "Emergency", NavigationDrawerDestination.HomeEmergency),
                ),
        ),
        NavigationDrawerSection(
            id = "settings",
            overline = "Settings",
            items =
                listOf(
                    item(PantopusIcon.SlidersHorizontal, "Home Settings", NavigationDrawerDestination.HomeSettings),
                ),
        ),
    )

private val businessSections: List<NavigationDrawerSection> =
    listOf(
        NavigationDrawerSection(
            id = "business",
            overline = null,
            items =
                listOf(
                    item(PantopusIcon.BarChart3, "Overview", NavigationDrawerDestination.BusinessOverview, active = true),
                    item(PantopusIcon.UserRound, "Profile", NavigationDrawerDestination.BusinessProfileRow),
                    item(PantopusIcon.MapPin, "Locations & Hours", NavigationDrawerDestination.BusinessLocations),
                    item(PantopusIcon.Tag, "Catalog", NavigationDrawerDestination.BusinessCatalog),
                    item(PantopusIcon.File, "Pages", NavigationDrawerDestination.BusinessPages),
                    item(PantopusIcon.PlusCircle, "Post Task", NavigationDrawerDestination.BusinessPostTask),
                    item(PantopusIcon.MessageSquare, "Business Chat", NavigationDrawerDestination.BusinessChat),
                ),
        ),
        NavigationDrawerSection(
            id = "manage",
            overline = "Manage",
            items =
                listOf(
                    item(PantopusIcon.Users, "Team", NavigationDrawerDestination.BusinessTeam),
                    item(PantopusIcon.Star, "Reviews", NavigationDrawerDestination.BusinessReviews),
                    item(PantopusIcon.CreditCard, "Payments", NavigationDrawerDestination.BusinessPayments),
                ),
        ),
        NavigationDrawerSection(
            id = "settings",
            overline = "Settings",
            items =
                listOf(
                    item(PantopusIcon.SlidersHorizontal, "Settings", NavigationDrawerDestination.BusinessSettings),
                ),
        ),
    )

// MARK: - Pillar tints

private fun NavigationDrawerPillar.tint(): Color =
    when (this) {
        NavigationDrawerPillar.Personal -> PantopusColors.primary600
        NavigationDrawerPillar.Home -> PantopusColors.home
        NavigationDrawerPillar.Business -> PantopusColors.business
    }

private fun NavigationDrawerPillar.tintBackground(): Color =
    when (this) {
        NavigationDrawerPillar.Personal -> PantopusColors.personalBg
        NavigationDrawerPillar.Home -> PantopusColors.homeBg
        NavigationDrawerPillar.Business -> PantopusColors.businessBg
    }

private fun NavigationDrawerPillar.icon(): PantopusIcon =
    when (this) {
        NavigationDrawerPillar.Personal -> PantopusIcon.User
        NavigationDrawerPillar.Home -> PantopusIcon.Home
        NavigationDrawerPillar.Business -> PantopusIcon.Building2
    }

// MARK: - Composable

@Composable
fun NavigationDrawer(
    context: NavigationDrawerContext,
    onSelect: (NavigationDrawerDestination) -> Unit,
    onOpenIdentityCenter: () -> Unit,
    onBackToHub: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth(0.82f)
                .fillMaxHeight()
                .clip(RoundedCornerShape(topEnd = Radii.xl2, bottomEnd = Radii.xl2))
                .background(PantopusColors.appSurface)
                .statusBarsPadding()
                .testTag("navDrawer"),
    ) {
        ContextPill(context = context, onClick = onOpenIdentityCenter)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
        ) {
            context.sections().forEach { section ->
                DrawerSection(section = section, onSelect = onSelect)
            }
            if (context.showsBackToHub()) {
                BackToHubRow(onClick = onBackToHub)
            }
            Spacer(Modifier.height(Spacing.s4))
        }
    }
}

@Composable
private fun ContextPill(
    context: NavigationDrawerContext,
    onClick: () -> Unit,
) {
    val pillar = context.pillar()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3)
                .padding(top = Spacing.s5, bottom = Spacing.s3)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(pillar.tintBackground())
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("navDrawer.contextPill"),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(38.dp).clip(CircleShape).background(pillar.tint()),
        ) {
            PantopusIconImage(
                icon = pillar.icon(),
                contentDescription = null,
                size = 19.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f).padding(start = Spacing.s3)) {
            Text(
                text = context.headerTitle(),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = context.headerSubtitle(),
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = pillar.tint(),
                maxLines = 1,
            )
        }
        SwitchChip(tint = pillar.tint())
    }
}

@Composable
private fun SwitchChip(tint: Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s3, end = Spacing.s2, top = 4.dp, bottom = 4.dp),
    ) {
        Text(text = "Switch", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = tint)
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2.8f,
            tint = tint,
        )
    }
}

@Composable
private fun DrawerSection(
    section: NavigationDrawerSection,
    onSelect: (NavigationDrawerDestination) -> Unit,
) {
    if (section.overline != null) {
        Text(
            text = section.overline.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.9.sp,
            color = PantopusColors.appTextMuted,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s5)
                    .padding(top = Spacing.s4, bottom = Spacing.s2),
        )
    } else {
        Spacer(Modifier.height(Spacing.s2))
    }
    section.items.forEach { row -> DrawerRow(item = row, onSelect = onSelect) }
}

@Composable
private fun DrawerRow(
    item: NavigationDrawerItem,
    onSelect: (NavigationDrawerDestination) -> Unit,
) {
    val labelColor = if (item.isActive) PantopusColors.primary700 else PantopusColors.appText
    val iconTint = if (item.isActive) PantopusColors.primary600 else PantopusColors.appTextSecondary
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .padding(horizontal = Spacing.s2)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (item.isActive) PantopusColors.primary50 else Color.Transparent)
                .clickable { onSelect(item.destination) }
                .defaultMinSize(minHeight = 46.dp)
                .padding(horizontal = Spacing.s3)
                .testTag("navDrawer.item.${item.slug}"),
    ) {
        PantopusIconImage(
            icon = item.icon,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 2f,
            tint = iconTint,
        )
        Text(
            text = item.label,
            fontSize = 14.5.sp,
            fontWeight = if (item.isActive) FontWeight.Bold else FontWeight.Medium,
            color = labelColor,
            modifier = Modifier.weight(1f),
        )
        if (item.isActive) {
            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.primary600))
        }
    }
}

@Composable
private fun BackToHubRow(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .padding(top = Spacing.s2)
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorderSubtle),
    )
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("navDrawer.backToHub"),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(32.dp).clip(CircleShape).background(PantopusColors.appSurface),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ArrowLeft,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Back to Hub",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
            Text(
                text = "Return to your personal hub",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.Undo2,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
    }
}

// MARK: - Previews

@Preview(showBackground = true, widthDp = 360, heightDp = 720)
@Composable
private fun NavigationDrawerPersonalPreview() {
    PantopusTheme {
        NavigationDrawer(
            context = NavigationDrawerContext.Personal(name = "Maria Lopez"),
            onSelect = {},
            onOpenIdentityCenter = {},
            onBackToHub = {},
            modifier = Modifier.width(296.dp),
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 720)
@Composable
private fun NavigationDrawerHomePreview() {
    PantopusTheme {
        NavigationDrawer(
            context = NavigationDrawerContext.Home(id = "h1", title = "Maple Street", subtitle = "123 Maple St"),
            onSelect = {},
            onOpenIdentityCenter = {},
            onBackToHub = {},
            modifier = Modifier.width(296.dp),
        )
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 720)
@Composable
private fun NavigationDrawerBusinessPreview() {
    PantopusTheme {
        NavigationDrawer(
            context = NavigationDrawerContext.Business(id = "b1", title = "Cortado Coffee", subtitle = "Coffee shop · Downtown"),
            onSelect = {},
            onOpenIdentityCenter = {},
            onBackToHub = {},
            modifier = Modifier.width(296.dp),
        )
    }
}
