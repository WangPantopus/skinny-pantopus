@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusIcon
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for every shared component. Committed baseline PNGs
 * live under `app/src/test/snapshots/`; `./gradlew paparazziVerify` fails
 * when any component drifts.
 */
class ComponentsSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun component_gallery() {
        paparazzi.snapshot { ComponentGallery() }
    }
}

@Composable
private fun ComponentGallery() {
    Column(
        modifier = Modifier.background(Color.White).padding(16.dp),
        verticalArrangement =
            androidx.compose.foundation.layout.Arrangement
                .spacedBy(12.dp),
    ) {
        Text("Shimmer")
        Shimmer(width = 180.dp, height = 16.dp)

        Text("Buttons")
        PrimaryButton(title = "Continue", onClick = {})
        GhostButton(title = "Skip", onClick = {})
        DestructiveButton(title = "Delete", onClick = {})

        Text("ActionChip")
        androidx.compose.foundation.layout.Row(
            horizontalArrangement =
                androidx.compose.foundation.layout.Arrangement
                    .spacedBy(8.dp),
        ) {
            ActionChip(PantopusIcon.PlusCircle, "Post", onClick = {}, isActive = true)
            ActionChip(PantopusIcon.Search, "Search", onClick = {})
        }

        Text("Avatars")
        androidx.compose.foundation.layout.Row(
            horizontalArrangement =
                androidx.compose.foundation.layout.Arrangement
                    .spacedBy(16.dp),
        ) {
            AvatarWithIdentityRing("Alice Doe", IdentityPillar.Personal, 0.25f)
            AvatarWithIdentityRing("Bob Roy", IdentityPillar.Home, 0.65f)
            AvatarWithIdentityRing("Carmen Lee", IdentityPillar.Business, 1.0f, size = 56.dp)
        }

        Text("Verified")
        androidx.compose.foundation.layout.Row(
            horizontalArrangement =
                androidx.compose.foundation.layout.Arrangement
                    .spacedBy(8.dp),
        ) {
            VerifiedBadge()
            VerifiedBadge(size = 20.dp)
            VerifiedBadge(size = 28.dp)
        }

        Text("Status chips")
        androidx.compose.foundation.layout.Row(
            horizontalArrangement =
                androidx.compose.foundation.layout.Arrangement
                    .spacedBy(8.dp),
        ) {
            StatusChip("Paid", StatusChipVariant.Success, icon = PantopusIcon.Check)
            StatusChip("Due", StatusChipVariant.Warning)
            StatusChip("Overdue", StatusChipVariant.ErrorVariant)
        }

        Text("Key facts")
        KeyFactsPanel(
            rows =
                listOf(
                    KeyFactRow("Order ID", "PAN-48291", isCode = true),
                    KeyFactRow("Placed", "Mar 18"),
                ),
        )

        Text("Timeline")
        TimelineStepper(
            steps =
                listOf(
                    TimelineStep("Placed", TimelineStepState.Done),
                    TimelineStep("In transit", TimelineStepState.Current),
                    TimelineStep("Delivered", TimelineStepState.Upcoming),
                ),
        )

        Text("TextField states")
        PantopusTextField(
            label = "Email",
            value = "",
            onValueChange = {},
            placeholder = "you@pantopus.app",
        )
        PantopusTextField(
            label = "Email",
            value = "alice@pantopus.app",
            onValueChange = {},
            state = PantopusFieldState.Valid,
        )
        PantopusTextField(
            label = "Email",
            value = "nope",
            onValueChange = {},
            state = PantopusFieldState.Error("Please enter a valid email address"),
        )

        Text("Segmented progress")
        SegmentedProgressBar(currentStep = 2, totalSteps = 4)

        Text("Section header")
        SectionHeader("Neighbors", actionTitle = "See all", onAction = {})

        Text("Empty state (compact)")
        androidx.compose.foundation.layout.Box(modifier = Modifier.padding(16.dp)) {
            Text("(rendered in gallery screen)")
        }
    }
}

@Suppress("unused")
@Preview(showBackground = true, widthDp = 360, heightDp = 2400)
@Composable
private fun ComponentGalleryPreview() {
    ComponentGallery()
}
