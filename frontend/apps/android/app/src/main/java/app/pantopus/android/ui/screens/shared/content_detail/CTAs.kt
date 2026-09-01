@file:Suppress("MagicNumber", "PackageNaming", "UnusedPrivateMember", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.shared.content_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/** Bottom-sheet action payload. */
data class FabSheetAction(
    val id: String,
    val title: String,
    val icon: PantopusIcon,
)

/** Test tag on the FAB. */
const val FAB_CREATE_TAG = "homeDashboardFab"

/**
 * 56dp primary-filled plus button that opens a bottom-sheet menu.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FabCreateCTA(
    actions: List<FabSheetAction>,
    onSelect: (String) -> Unit,
) {
    var sheetVisible by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState()

    Box(
        modifier =
            Modifier
                .size(56.dp)
                .pantopusShadow(PantopusElevations.primary, CircleShape)
                .clip(CircleShape)
                .background(PantopusColors.primary600)
                .clickable { sheetVisible = true }
                .testTag(FAB_CREATE_TAG)
                .semantics { contentDescription = "Create" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PlusCircle,
            contentDescription = null,
            size = 26.dp,
            tint = PantopusColors.appTextInverse,
        )
    }

    if (sheetVisible) {
        ModalBottomSheet(
            onDismissRequest = { sheetVisible = false },
            sheetState = sheetState,
            containerColor = PantopusColors.appBg,
        ) {
            FabSheetContent(
                actions = actions,
                onSelect = {
                    sheetVisible = false
                    onSelect(it)
                },
            )
        }
    }
}

@Composable
private fun FabSheetContent(
    actions: List<FabSheetAction>,
    onSelect: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text("Create", style = PantopusTextStyle.h3, color = PantopusColors.appText)
        actions.forEach { action ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(action.id) }
                        .heightIn(min = 56.dp)
                        .padding(horizontal = Spacing.s3)
                        .semantics { contentDescription = action.title },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.primary100),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = action.icon,
                        contentDescription = null,
                        size = Radii.xl2,
                        tint = PantopusColors.primary600,
                    )
                }
                Text(action.title, style = PantopusTextStyle.body, color = PantopusColors.appText)
                Spacer(Modifier.weight(1f))
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/** Sticky bottom action row — stubbed until a screen needs it. */
@Composable
fun StickyBottomActionStub() {
    // Intentionally empty.
}

/** No-op CTA slot. */
@Composable
fun NoCta() {
    // Intentionally empty.
}
