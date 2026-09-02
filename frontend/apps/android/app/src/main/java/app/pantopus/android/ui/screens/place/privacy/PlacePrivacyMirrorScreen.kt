package app.pantopus.android.ui.screens.place.privacy

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.identity.HomeMirrorDto
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

// ============================================================
// The privacy mirror (Wedge v2 §2): your home exactly as a neighbor
// outside your household sees it. Not a mock-up — the backend renders it
// through the same serializer that answers a real outsider. Parity twin
// of the web `/app/homes/[id]/privacy` page and the iOS
// `PlacePrivacyMirrorView`.
// ============================================================

@Composable
fun PlacePrivacyMirrorScreen(
    onBack: () -> Unit,
    viewModel: PlacePrivacyMirrorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("place.privacyMirror.screen")) {
        PlaceDetailHeader(title = "What neighbors see", address = "", onBack = onBack)
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "This is your address as someone outside your household sees it, rendered by the same code that serves them. " +
                    "If it looks wrong here, it is wrong for them too.",
                fontSize = 14.sp,
                lineHeight = 20.sp,
                color = PantopusColors.appTextSecondary,
            )
            when (val current = state) {
                PrivacyMirrorUiState.Loading -> Placeholders()
                is PrivacyMirrorUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
                is PrivacyMirrorUiState.Loaded -> {
                    NeighborCard(current.mirror)
                    HiddenList(current.mirror)
                    PromiseCard()
                }
            }
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}

@Composable
private fun Placeholders() {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        listOf(88.dp, 160.dp).forEach { h ->
            Box(modifier = Modifier.fillMaxWidth().height(h).clip(RoundedCornerShape(16.dp)).background(PantopusColors.appSurfaceSunken))
        }
    }
}

@Composable
private fun NeighborCard(mirror: HomeMirrorDto) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            mirror.viewerLabel.uppercase(),
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.8.sp,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(44.dp).clip(CircleShape).background(PantopusColors.homeBg),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    mirror.owner?.name?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "·",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.home,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(mirror.owner?.name ?: "A resident", fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    PantopusIconImage(PantopusIcon.MapPin, null, size = 13.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextSecondary)
                    Text(
                        mirror.addressLine,
                        fontSize = 13.5.sp,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.testTag("place.privacyMirror.address"),
                    )
                }
            }
        }
        Text(
            if (mirror.discoverable) {
                "Street only, no house number. That is the whole card."
            } else {
                "Your home is not discoverable right now, so neighbors see nothing unless you share it. " +
                    "This is what they would see if you did."
            },
            fontSize = 12.5.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun HiddenList(mirror: HomeMirrorDto) {
    Column(modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(PantopusIcon.EyeOff, null, size = 15.dp, strokeWidth = 2.25f, tint = PantopusColors.appTextSecondary)
            Text(
                "NEVER SHOWN TO NEIGHBORS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        mirror.hidden.forEach { item ->
            Text(item.label, fontSize = 14.sp, color = PantopusColors.appText, modifier = Modifier.padding(vertical = 4.dp))
        }
    }
}

@Composable
private fun PromiseCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.appSurfaceSunken)
                .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 15.dp, strokeWidth = 2.25f, tint = PantopusColors.home)
            Text(
                "WHAT WE DO WITH YOUR ADDRESS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PRIVACY_PROMISE_LINES.forEach { line ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
                Box(modifier = Modifier.padding(top = 7.dp).size(4.dp).clip(CircleShape).background(PantopusColors.home))
                Text(line, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appText)
            }
        }
    }
}
