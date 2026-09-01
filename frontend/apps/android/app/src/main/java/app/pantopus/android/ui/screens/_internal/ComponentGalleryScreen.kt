@file:Suppress("MagicNumber", "UnusedPrivateMember", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens._internal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.ActionChip
import app.pantopus.android.ui.components.AvatarWithIdentityRing
import app.pantopus.android.ui.components.DestructiveButton
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.components.KeyFactRow
import app.pantopus.android.ui.components.KeyFactsPanel
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.components.SegmentedProgressBar
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.StatusChip
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.components.TimelineStep
import app.pantopus.android.ui.components.TimelineStepState
import app.pantopus.android.ui.components.TimelineStepper
import app.pantopus.android.ui.components.VerifiedBadge
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the root gallery container — used by Paparazzi / UI tests. */
const val COMPONENT_GALLERY_TAG = "componentGallery"

/**
 * Debug-only screen rendering every shared component in every designed
 * state. Reached from the token gallery.
 */
@Composable
fun ComponentGalleryScreen() {
    PantopusTheme {
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            shimmerSection()
            emptyStateSection()
            sectionHeaderSection()
            buttonsSection()
            actionChipSection()
            avatarSection()
            verifiedBadgeSection()
            statusChipSection()
            keyFactsSection()
            timelineSection()
            textFieldSection()
            progressBarSection()
        }
    }
}

private fun LazyListScope.header(label: String) {
    item {
        Text(
            text = label.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun LazyListScope.shimmerSection() {
    header("Shimmer")
    item {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(width = 160.dp, height = 16.dp)
            Shimmer(width = 200.dp, height = 12.dp)
        }
    }
}

private fun LazyListScope.emptyStateSection() {
    header("EmptyState")
    item {
        androidx.compose.foundation.layout.Box(modifier = Modifier.height(240.dp)) {
            EmptyState(
                icon = PantopusIcon.Inbox,
                headline = "No mail yet",
                subcopy = "When a neighbor sends you something, it'll land here.",
            )
        }
    }
}

private fun LazyListScope.sectionHeaderSection() {
    header("SectionHeader")
    item {
        Column {
            SectionHeader("Bills due")
            SectionHeader("Neighbors", actionTitle = "See all", onAction = {})
        }
    }
}

private fun LazyListScope.buttonsSection() {
    header("Buttons")
    item {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PrimaryButton(title = "Continue", onClick = {})
            PrimaryButton(title = "Signing in…", onClick = {}, isLoading = true)
            PrimaryButton(title = "Disabled", onClick = {}, isEnabled = false)
            GhostButton(title = "Skip", onClick = {})
            DestructiveButton(title = "Delete home", onClick = {})
        }
    }
}

private fun LazyListScope.actionChipSection() {
    header("ActionChip")
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ActionChip(PantopusIcon.PlusCircle, "Post gig", onClick = {}, isActive = true)
            ActionChip(PantopusIcon.Search, "Search", onClick = {})
        }
    }
}

private fun LazyListScope.avatarSection() {
    header("Avatar + ring")
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            AvatarWithIdentityRing("Alice Doe", IdentityPillar.Personal, 0.25f)
            AvatarWithIdentityRing("Bob Roy", IdentityPillar.Home, 0.65f)
            AvatarWithIdentityRing("Carmen Lee", IdentityPillar.Business, 1.0f, size = 56.dp)
        }
    }
}

private fun LazyListScope.verifiedBadgeSection() {
    header("Verified badge")
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            VerifiedBadge()
            VerifiedBadge(size = Radii.xl2)
            VerifiedBadge(size = 28.dp)
        }
    }
}

private fun LazyListScope.statusChipSection() {
    header("Status chips")
    item {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatusChip("Paid", StatusChipVariant.Success, icon = PantopusIcon.Check)
                StatusChip("Due", StatusChipVariant.Warning)
                StatusChip("Overdue", StatusChipVariant.ErrorVariant, icon = PantopusIcon.AlertCircle)
                StatusChip("FYI", StatusChipVariant.Info)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                StatusChip("Personal", StatusChipVariant.Personal)
                StatusChip("Home", StatusChipVariant.Home)
                StatusChip("Business", StatusChipVariant.Business)
                StatusChip("Neutral")
            }
        }
    }
}

private fun LazyListScope.keyFactsSection() {
    header("Key facts")
    item {
        KeyFactsPanel(
            rows =
                listOf(
                    KeyFactRow("Order ID", "PAN-48291", isCode = true),
                    KeyFactRow("Placed", "Mar 18"),
                    KeyFactRow("Status", "Out for delivery"),
                ),
        )
    }
}

private fun LazyListScope.timelineSection() {
    header("Timeline stepper")
    item {
        TimelineStepper(
            steps =
                listOf(
                    TimelineStep("Order placed", TimelineStepState.Done, "Mar 17"),
                    TimelineStep("In transit", TimelineStepState.Done, "Mar 18"),
                    TimelineStep("Out for delivery", TimelineStepState.Current, "Today"),
                    TimelineStep("Delivered", TimelineStepState.Upcoming),
                ),
        )
    }
}

private fun LazyListScope.textFieldSection() {
    header("Text field")
    item {
        TextFieldShowcase()
    }
}

@Composable
private fun TextFieldShowcase() {
    var plain by remember { mutableStateOf("") }
    var valid by remember { mutableStateOf("alice@pantopus.app") }
    var errored by remember { mutableStateOf("not-an-email") }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        PantopusTextField("Email", plain, onValueChange = { plain = it }, placeholder = "you@pantopus.app")
        PantopusTextField(
            label = "Email",
            value = valid,
            onValueChange = { valid = it },
            state = PantopusFieldState.Valid,
        )
        PantopusTextField(
            label = "Email",
            value = errored,
            onValueChange = { errored = it },
            state = PantopusFieldState.Error("Please enter a valid email address"),
        )
    }
}

private fun LazyListScope.progressBarSection() {
    header("Progress bar")
    item {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            SegmentedProgressBar(currentStep = 0, totalSteps = 4)
            SegmentedProgressBar(currentStep = 2, totalSteps = 4)
            SegmentedProgressBar(currentStep = 4, totalSteps = 4)
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 2400)
@Composable
private fun ComponentGalleryScreenPreview() {
    ComponentGalleryScreen()
}
