package app.pantopus.android.ui.screens.place.today

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceTodayDetailContent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

private const val PLACEHOLDER_ROWS = 3

/**
 * The Today tab root (Wedge v2 D2). Four states: loading placeholders,
 * a claim prompt when there is no place yet, the Today group with the
 * address calendar, and an error with retry.
 */
@Composable
fun TodayTabScreen(
    onClaim: () -> Unit,
    viewModel: TodayTabViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag("todayTab")) {
        Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp)) {
            Text("Today", fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.4).sp, color = PantopusColors.appText)
            (state as? TodayTabUiState.Loaded)?.intelligence?.place?.label?.let {
                Text(it, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted, maxLines = 1)
            }
        }
        when (val current = state) {
            TodayTabUiState.Loading -> TodayPlaceholders()
            TodayTabUiState.NoPlace -> NoPlaceCard(onClaim)
            is TodayTabUiState.Error -> ErrorState(message = current.message, onRetry = viewModel::refresh)
            is TodayTabUiState.Loaded ->
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                ) {
                    PlaceTodayDetailContent(current.intelligence, viewModel)
                    Spacer(modifier = Modifier.height(96.dp))
                }
        }
    }
}

@Composable
private fun TodayPlaceholders() {
    Column(modifier = Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(PLACEHOLDER_ROWS) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(if (it == 0) 120.dp else 76.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(PantopusColors.appSurfaceSunken),
            )
        }
    }
}

@Composable
private fun NoPlaceCard(onClaim: () -> Unit) {
    Column(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth().placeCard().padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier = Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(PantopusColors.homeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(PantopusIcon.CloudSun, null, size = 28.dp, strokeWidth = 2f, tint = PantopusColors.home)
        }
        Text("Today starts at your address", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            "Weather, air, alerts, and the dates that matter at your address — pickup day, tax deadlines, council meetings. " +
                "Claim your address to start.",
            fontSize = 14.sp,
            lineHeight = 20.sp,
            textAlign = TextAlign.Center,
            color = PantopusColors.appTextSecondary,
        )
        PrimaryButton(title = "Claim your address", onClick = onClaim, modifier = Modifier.fillMaxWidth())
    }
}
