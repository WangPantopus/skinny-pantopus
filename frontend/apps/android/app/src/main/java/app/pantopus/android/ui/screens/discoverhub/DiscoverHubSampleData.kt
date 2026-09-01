@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.discoverhub

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A11.3 Discover magazine sample data. Backend is intentionally not used
 * for this surface; the view-model seeds deterministic content so previews,
 * app renders, and snapshot tests stay stable.
 */
enum class DiscoverHubMagazineScenario {
    Loading,
    Empty,
    Populated,
    Error,
}

sealed interface DiscoverHubMagazineUiState {
    data object Loading : DiscoverHubMagazineUiState

    data object Empty : DiscoverHubMagazineUiState

    data class Populated(
        val content: DiscoverHubMagazineContent,
    ) : DiscoverHubMagazineUiState

    data class Error(
        val message: String,
    ) : DiscoverHubMagazineUiState
}

@Immutable
data class DiscoverHubMagazineContent(
    val pins: List<DiscoverHubMapPin>,
    val cluster: DiscoverHubMapCluster,
    val tasks: List<DiscoverHubTaskCard>,
    val marketplace: List<DiscoverHubMarketplaceCard>,
    val posts: List<DiscoverHubPostCard>,
)

enum class DiscoverHubMapKind(
    val key: String,
    val label: String,
    val pluralLabel: String,
    val color: Color,
    val softColor: Color,
    val icon: PantopusIcon,
) {
    Task(
        key = "task",
        label = "Task",
        pluralLabel = "Tasks",
        color = PantopusColors.handyman,
        softColor = PantopusColors.warningBg,
        icon = PantopusIcon.Hammer,
    ),
    Item(
        key = "item",
        label = "Item",
        pluralLabel = "Items",
        color = PantopusColors.goods,
        softColor = PantopusColors.businessBg,
        icon = PantopusIcon.Tag,
    ),
    Post(
        key = "post",
        label = "Post",
        pluralLabel = "Posts",
        color = PantopusColors.primary500,
        softColor = PantopusColors.primary50,
        icon = PantopusIcon.MessageCircle,
    ),
    Spot(
        key = "spot",
        label = "Spot",
        pluralLabel = "Spots",
        color = PantopusColors.home,
        softColor = PantopusColors.homeBg,
        icon = PantopusIcon.ShoppingBag,
    ),
    Event(
        key = "event",
        label = "Event",
        pluralLabel = "Events",
        color = PantopusColors.business,
        softColor = PantopusColors.businessBg,
        icon = PantopusIcon.Calendar,
    ),
}

@Immutable
data class DiscoverHubMapPin(
    val id: String,
    val kind: DiscoverHubMapKind,
    val x: Float,
    val y: Float,
    val pulses: Boolean = false,
)

@Immutable
data class DiscoverHubMapCluster(
    val count: Int,
    val x: Float,
    val y: Float,
)

@Immutable
data class DiscoverHubTaskCard(
    val id: String,
    val title: String,
    val price: String,
    val distance: String,
    val bids: String,
)

@Immutable
data class DiscoverHubMarketplaceCard(
    val id: String,
    val title: String,
    val price: String,
    val distance: String,
    val icon: PantopusIcon,
)

@Immutable
data class DiscoverHubPostCard(
    val id: String,
    val intent: String,
    val title: String,
    val body: String,
    val author: String,
    val replies: Int,
)

object DiscoverHubSampleData {
    val populated =
        DiscoverHubMagazineContent(
            pins =
                listOf(
                    DiscoverHubMapPin("pin-task-1", DiscoverHubMapKind.Task, x = 0.19f, y = 0.53f, pulses = true),
                    DiscoverHubMapPin("pin-item-1", DiscoverHubMapKind.Item, x = 0.42f, y = 0.26f),
                    DiscoverHubMapPin("pin-spot-1", DiscoverHubMapKind.Spot, x = 0.63f, y = 0.63f),
                    DiscoverHubMapPin("pin-post-1", DiscoverHubMapKind.Post, x = 0.82f, y = 0.39f),
                    DiscoverHubMapPin("pin-event-1", DiscoverHubMapKind.Event, x = 0.14f, y = 0.84f),
                    DiscoverHubMapPin("pin-task-2", DiscoverHubMapKind.Task, x = 0.86f, y = 0.84f),
                ),
            cluster = DiscoverHubMapCluster(count = 9, x = 0.56f, y = 0.82f),
            tasks =
                listOf(
                    DiscoverHubTaskCard("gig-shelves", "Hang 3 floating shelves", "$60", "0.2 mi", "4 bids"),
                    DiscoverHubTaskCard("gig-clean", "Deep clean 2BR before move-out", "$180", "0.5 mi", "7 bids"),
                    DiscoverHubTaskCard("gig-dog-walks", "Midday dog walks Tue/Thu", "$22/walk", "0.3 mi", "2 bids"),
                ),
            marketplace =
                listOf(
                    DiscoverHubMarketplaceCard("item-sideboard", "Mid-century walnut sideboard", "$420", "0.4 mi", PantopusIcon.Home),
                    DiscoverHubMarketplaceCard("item-bike", "Vintage Trek road bike, 56cm", "$240", "0.7 mi", PantopusIcon.Package),
                    DiscoverHubMarketplaceCard("item-skillet", "Cast-iron Lodge skillet set", "$45", "0.2 mi", PantopusIcon.Utensils),
                    DiscoverHubMarketplaceCard("item-kallax", "Ikea Kallax 4x4, white", "Free", "0.6 mi", PantopusIcon.Archive),
                ),
            posts =
                listOf(
                    DiscoverHubPostCard(
                        id = "post-cardiologist",
                        intent = "Ask",
                        title = "Anyone know a good cardiologist nearby?",
                        body = "Specifically near Hayes Valley - recently moved and looking for someone who takes Blue Shield.",
                        author = "Maya - 0.1 mi",
                        replies = 8,
                    ),
                    DiscoverHubPostCard(
                        id = "post-ramen",
                        intent = "Recommend",
                        title = "The new ramen place on Divisadero is fantastic",
                        body = "Went last night. Tonkotsu was excellent. They open at 5 and the line moves fast.",
                        author = "Dre - 0.3 mi",
                        replies = 14,
                    ),
                ),
        )

    val emptySkeletonRailTitles = listOf("Tasks near you", "Marketplace picks")
}
