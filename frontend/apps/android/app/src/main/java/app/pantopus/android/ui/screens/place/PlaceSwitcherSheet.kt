package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceChevron
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing

/**
 * C2 — "Your homes", the sheet behind the address (and the avatar) on Your Place. Lists every Home the person can
 * open, then the entries still waiting on verification, with Add a home and Manage homes. Parity twin of the iOS
 * `PlaceSwitcherSheet`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaceSwitcherSheet(
    activeHomeId: String,
    onSelect: (String) -> Unit,
    onAddPlace: () -> Unit,
    onDismiss: () -> Unit,
    onManageHomes: () -> Unit = {},
    viewModel: PlaceSwitcherViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Your homes",
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.28).sp,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                Box(
                    modifier =
                        Modifier
                            .size(30.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(PantopusColors.appSurfaceSunken)
                            .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close",
                        size = 17.dp,
                        strokeWidth = 2.25f,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
            }

            when (val current = state) {
                PlaceSwitcherUiState.Loading ->
                    Column(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        repeat(2) { Shimmer(width = 320.dp, height = 66.dp, cornerRadius = 14.dp) }
                    }
                is PlaceSwitcherUiState.Error ->
                    ErrorState(message = current.message, onRetry = viewModel::load)
                is PlaceSwitcherUiState.Loaded ->
                    Column(modifier = Modifier.padding(horizontal = 12.dp)) {
                        current.rows.forEach { row ->
                            PlaceSwitcherRowView(
                                row = row,
                                isActive = row.id == activeHomeId,
                                onTap = {
                                    when (row.kind) {
                                        PlaceSwitcherRow.Kind.HOME -> onSelect(row.id)
                                        PlaceSwitcherRow.Kind.PENDING -> onManageHomes()
                                    }
                                },
                            )
                        }
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                                    .height(1.dp)
                                    .background(PantopusColors.appBorderSubtle),
                        )
                        AddPlaceRow(onTap = onAddPlace)
                        ManageHomesButton(onTap = onManageHomes)
                    }
            }
        }
    }
}

@Composable
private fun PlaceSwitcherRowView(
    row: PlaceSwitcherRow,
    isActive: Boolean,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(if (isActive) PantopusColors.infoBg else PantopusColors.appSurface)
                .border(
                    width = if (isActive) 1.5.dp else 0.dp,
                    color = if (isActive) PantopusColors.primary200 else PantopusColors.appSurface,
                    shape = RoundedCornerShape(14.dp),
                )
                .clickable(onClick = onTap)
                .semantics { selected = isActive }
                .padding(vertical = 13.dp, horizontal = 14.dp)
                .testTag("place.switcher.row.${row.id}"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(if (isActive) PantopusColors.primary100 else PantopusColors.appSurfaceSunken),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (row.kind == PlaceSwitcherRow.Kind.PENDING) PantopusIcon.Clock else PantopusIcon.Home,
                contentDescription = null,
                size = 21.dp,
                strokeWidth = 2f,
                tint = if (isActive) PantopusColors.primary600 else PantopusColors.appTextSecondary,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = row.line1,
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = row.subtitle,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (isActive) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.primary600,
            )
        } else {
            PlaceChevron()
        }
    }
}

@Composable
private fun AddPlaceRow(onTap: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .clickable(onClick = onTap)
                .padding(vertical = 13.dp, horizontal = 14.dp)
                .testTag("place.switcher.add"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(11.dp))
                    .background(PantopusColors.primary100),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plus,
                contentDescription = null,
                size = 21.dp,
                strokeWidth = 2.25f,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Add a home",
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.primary600,
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Claim or verify another address",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
            )
        }
        PlaceChevron()
    }
}

/** My homes: every entry with its status and its actions (Home tools, tasks, verification). */
@Composable
private fun ManageHomesButton(onTap: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = Spacing.s1)
                .heightIn(min = Spacing.s12)
                .clip(RoundedCornerShape(14.dp))
                .clickable(role = Role.Button, onClick = onTap)
                .testTag("place.switcher.manage"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Manage homes",
            fontSize = 14.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
        )
    }
}
