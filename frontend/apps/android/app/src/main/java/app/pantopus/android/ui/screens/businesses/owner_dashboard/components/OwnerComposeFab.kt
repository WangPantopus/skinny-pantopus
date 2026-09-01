@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.owner_dashboard.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * C2 — "Post as this business". React Native floats the same circular
 * composer FAB over the owner dashboard
 * (`src/app/businesses/[id]/index.tsx:371-379`), gated on
 * `access.role_base ∈ owner | admin | editor`. Tapping it opens the shared
 * Pulse composer pointed at `POST /api/businesses/:businessId/posts`.
 *
 * iOS twin: `Features/Businesses/OwnerDashboard/Components/OwnerComposeFab.swift`.
 */
@Composable
fun OwnerComposeFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(52.dp)
                .shadow(elevation = 8.dp, shape = CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.business)
                .clickable(onClick = onClick)
                .semantics { contentDescription = "Post as this business" }
                .testTag("businessOwner.composePost"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Edit2,
            contentDescription = null,
            size = 20.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.appTextInverse,
        )
    }
}
