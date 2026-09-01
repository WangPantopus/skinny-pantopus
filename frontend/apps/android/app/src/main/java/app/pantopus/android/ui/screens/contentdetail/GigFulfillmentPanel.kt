@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.contentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStatus
import app.pantopus.android.data.api.models.gigs.GigFulfillmentStep
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Live fulfillment stepper for urgent / starts-asap tasks — the native
 * counterpart of RN's `ActiveTaskPanel` timeline
 * (`components/gig-detail-v2/ActiveTaskPanel.tsx:204`). Reads
 * `GET /api/gigs/:gigId/active-status` and advances via
 * `POST /api/gigs/:gigId/status`; the view-model owns both calls.
 *
 * Renders under the generic Phase-5 "Task progress" strip: that one
 * tracks the *gig* lifecycle (assigned → confirmed), this one the
 * helper's *live* position inside it.
 */
@Composable
fun GigFulfillmentPanel(
    status: GigFulfillmentStatus?,
    etaLabel: String?,
    nextAction: Pair<GigFulfillmentStatus, String>?,
    isBusy: Boolean,
    onAdvance: (GigFulfillmentStatus) -> Unit,
) {
    val currentStepIndex = status?.stepIndex ?: -1
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5, vertical = Spacing.s3)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("gigDetail.fulfillmentPanel"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Zap,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.warning,
            )
            Text(
                text = "Live status",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            // RN's `getStatusBadge` — "Waiting" until the helper moves.
            Text(
                text = status?.badgeLabel ?: "Waiting",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (status == null) PantopusColors.appTextSecondary else PantopusColors.primary700,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(
                            if (status == null) PantopusColors.appSurfaceSunken else PantopusColors.primary50,
                        )
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .testTag("gigDetail.fulfillmentBadge"),
            )
        }

        if (etaLabel != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary50)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("gigDetail.fulfillmentEta"),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Navigation,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.primary600,
                )
                Text(
                    text = etaLabel,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.primary700,
                )
            }
        }

        FulfillmentTimeline(currentStepIndex = currentStepIndex, badgeLabel = status?.badgeLabel ?: "Waiting")

        if (nextAction != null) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.primary600)
                        .alpha(if (isBusy) 0.6f else 1f)
                        .clickable(enabled = !isBusy) { onAdvance(nextAction.first) }
                        .testTag("gigDetail.fulfillmentAdvance"),
            ) {
                PantopusIconImage(
                    icon = advanceIcon(nextAction.first),
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = nextAction.second,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun FulfillmentTimeline(
    currentStepIndex: Int,
    badgeLabel: String,
) {
    val steps = GigFulfillmentStep.entries
    Row(
        verticalAlignment = Alignment.Top,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Live status: $badgeLabel" }
                .testTag("gigDetail.fulfillmentTimeline"),
    ) {
        steps.forEachIndexed { index, step ->
            val reached = currentStepIndex >= step.index
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
                modifier = Modifier.weight(1f),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(22.dp)
                            .clip(CircleShape)
                            .background(
                                if (reached) PantopusColors.success else PantopusColors.appSurfaceSunken,
                            ),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = if (reached) PantopusIcon.Check else stepIcon(step),
                        contentDescription = null,
                        size = 11.dp,
                        tint = if (reached) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                    )
                }
                Text(
                    text = step.label,
                    fontSize = 9.sp,
                    fontWeight = if (reached) FontWeight.Bold else FontWeight.Medium,
                    color = if (reached) PantopusColors.appText else PantopusColors.appTextSecondary,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
            if (index < steps.lastIndex) {
                Box(
                    modifier =
                        Modifier
                            .padding(top = 10.dp)
                            .width(18.dp)
                            .height(2.dp)
                            .background(
                                if (currentStepIndex > step.index) {
                                    PantopusColors.success
                                } else {
                                    PantopusColors.appBorder
                                },
                            ),
                )
            }
        }
    }
}

private fun stepIcon(step: GigFulfillmentStep): PantopusIcon =
    when (step) {
        GigFulfillmentStep.OnTheWay -> PantopusIcon.Car
        GigFulfillmentStep.Arrived -> PantopusIcon.MapPin
        GigFulfillmentStep.InProgress -> PantopusIcon.Hammer
        GigFulfillmentStep.Completed -> PantopusIcon.CheckCircle
    }

private fun advanceIcon(status: GigFulfillmentStatus): PantopusIcon =
    when (status) {
        GigFulfillmentStatus.OnTheWay -> PantopusIcon.Car
        GigFulfillmentStatus.Arrived, GigFulfillmentStatus.PickedUp -> PantopusIcon.MapPin
        GigFulfillmentStatus.DroppedOff, GigFulfillmentStatus.InProgress -> PantopusIcon.Check
    }
