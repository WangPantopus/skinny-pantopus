@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.gigs.tasks_map

import app.pantopus.android.ui.screens.gigs.GigsCategory
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapAnchor
import app.pantopus.android.ui.screens.shared.map_list_hybrid.MapPinState

/**
 * Deterministic preview/snapshot seed for the Tasks map. Mirrors the iOS
 * `TasksMapSampleData`: nine items reproducing the design's nine pins —
 * handyman ×2, cleaning ×2, pet care ×2, plus moving / child care /
 * tutoring (moving + tutoring are pending). The first three mirror the
 * design's rail cards verbatim. Coordinates cluster inside the camera span
 * around the anchor so every pin lands on screen.
 */
object TasksMapSampleData {
    val anchor = MapAnchor(latitude = 40.7484, longitude = -73.9857)

    val items: List<TaskMapItem> =
        listOf(
            TaskMapItem(
                id = "handyman-1",
                category = GigsCategory.Handyman,
                state = MapPinState.Confirmed,
                latitude = 40.7499,
                longitude = -73.9881,
                title = "Hang 3 floating shelves",
                price = "$60",
                distanceLabel = "0.2 mi",
                bidCount = 4,
                body = "Three 24-inch floating shelves, hardware included. Drywall anchors needed — no studs where they're going.",
            ),
            TaskMapItem(
                id = "cleaning-1",
                category = GigsCategory.Cleaning,
                state = MapPinState.Confirmed,
                latitude = 40.7515,
                longitude = -73.9845,
                title = "Deep clean 2BR before move-out",
                price = "$180",
                distanceLabel = "0.5 mi",
                bidCount = 7,
                body = "Two-bedroom apartment, move-out deep clean before the walkthrough. Oven + fridge included.",
            ),
            TaskMapItem(
                id = "petcare-1",
                category = GigsCategory.PetCare,
                state = MapPinState.Confirmed,
                latitude = 40.7468,
                longitude = -73.9832,
                title = "Midday dog walks Tue/Thu",
                price = "$22/walk",
                distanceLabel = "0.3 mi",
                bidCount = 2,
                body = "Friendly golden retriever needs 30-minute midday walks every Tuesday and Thursday.",
            ),
            TaskMapItem(
                id = "moving-1",
                category = GigsCategory.Moving,
                state = MapPinState.Pending,
                latitude = 40.7526,
                longitude = -73.9808,
                title = "Help move a couch up 2 flights",
                price = "$90",
                distanceLabel = "0.6 mi",
                bidCount = 1,
            ),
            TaskMapItem(
                id = "childcare-1",
                category = GigsCategory.ChildCare,
                state = MapPinState.Confirmed,
                latitude = 40.7455,
                longitude = -73.9869,
                title = "After-school pickup + sitting",
                price = "$25/hr",
                distanceLabel = "0.4 mi",
                bidCount = 3,
            ),
            TaskMapItem(
                id = "handyman-2",
                category = GigsCategory.Handyman,
                state = MapPinState.Confirmed,
                latitude = 40.7441,
                longitude = -73.9819,
                title = "Mount a 55\" TV on drywall",
                price = "$75",
                distanceLabel = "0.7 mi",
                bidCount = 5,
            ),
            TaskMapItem(
                id = "tutoring-1",
                category = GigsCategory.Tutoring,
                state = MapPinState.Pending,
                latitude = 40.7432,
                longitude = -73.9795,
                title = "Algebra tutoring, twice weekly",
                price = "$40/hr",
                distanceLabel = "0.8 mi",
                bidCount = 0,
            ),
            TaskMapItem(
                id = "petcare-2",
                category = GigsCategory.PetCare,
                state = MapPinState.Confirmed,
                latitude = 40.7508,
                longitude = -73.9912,
                title = "Weekend cat sitting",
                price = "$30/day",
                distanceLabel = "0.5 mi",
                bidCount = 2,
            ),
            TaskMapItem(
                id = "cleaning-2",
                category = GigsCategory.Cleaning,
                state = MapPinState.Confirmed,
                latitude = 40.7462,
                longitude = -73.9788,
                title = "Weekly apartment tidy-up",
                price = "$70",
                distanceLabel = "0.6 mi",
                bidCount = 6,
            ),
        )
}
