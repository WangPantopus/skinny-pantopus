@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.ui.components.shareFile
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.4b / P17 — Concrete Emergency info list screen wired to
 * `GET /api/homes/:id/emergencies` (route `backend/routes/home.js:5406`).
 *
 * The standing red "Emergency? Call 911" bar rides the shell's
 * `customHeader` slot, directly under the chip strip — the same place RN
 * pins it under the header (`emergency.tsx:106-110`). It dials, as does
 * every stored contact's phone number.
 *
 * @param onAction Invoked when an emergency row's circular action (or
 *     the row tap itself) fires for a row with no dialable number —
 *     view-photo / open-in-maps / open detail. Rows carrying a phone
 *     dial instead.
 * @param onAdd Invoked when the FAB or empty-state CTA fires.
 * @param onBack Optional back handler.
 */
@Composable
fun EmergencyInfoScreen(
    onAction: (HomeEmergencyDto) -> Unit,
    onAdd: () -> Unit,
    onBack: (() -> Unit)? = null,
    viewModel: EmergencyInfoViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedFilter by viewModel.selectedFilter.collectAsStateWithLifecycle()
    val chipStrip by viewModel.chipStrip.collectAsStateWithLifecycle()
    val banner by viewModel.banner.collectAsStateWithLifecycle()
    val dialRequest by viewModel.dialRequest.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onAction = onAction,
            onAdd = onAdd,
            // P6.6 — share / print are owned by the screen (it has the data
            // + a Context); no host route needed.
            onShare = {
                viewModel.shareSummaryText()?.let { context.shareText(it, "Share emergency info") }
            },
            onPrintCard = {
                viewModel.printableCard()?.let { card ->
                    EmergencyCardPdf.render(context, card)?.let { uri ->
                        context.shareFile(uri, "application/pdf", "Print emergency card")
                    }
                }
            },
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenEmergencyInfoViewed)
    }

    LaunchedEffect(dialRequest) {
        val number = dialRequest ?: return@LaunchedEffect
        viewModel.consumeDialRequest()
        telUri(number)?.let { uri ->
            runCatching {
                context.startActivity(
                    Intent(Intent.ACTION_DIAL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag("emergencyInfoList")) {
        ListOfRowsScreen(
            title = "Emergency info",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { },
            chipStrip = chipStrip.copy(selectedId = selectedFilter),
            topBarAction = viewModel.topBarAction,
            fab = viewModel.fab(),
            onBack = onBack,
            banner = banner,
            customHeader = { EmergencyCall911Banner(onCall = viewModel::dialEmergencyNumber) },
        )
    }
}

/**
 * Full-bleed red call bar. RN keeps it visible above the list at all
 * times (`emergency.tsx:106-110`) so the fastest action on the screen is
 * always one tap away.
 */
@Composable
internal fun EmergencyCall911Banner(onCall: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.error)
                .clickable(onClick = onCall)
                .padding(vertical = Spacing.s3)
                .semantics { contentDescription = "Emergency. Call 911" }
                .testTag("emergencyCall911Banner"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PhoneCall,
            contentDescription = null,
            tint = PantopusColors.appTextInverse,
        )
        Text(
            text = EmergencyInfoViewModel.EMERGENCY_BANNER_TITLE,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

/**
 * `tel:` URI for a stored number. Strips formatting so "(415) 555-0134"
 * still dials. Mirrors the iOS `telURL(for:)` helper.
 */
private fun telUri(number: String): Uri? {
    val digits = number.filter { it.isDigit() || it == '+' }
    if (digits.isEmpty()) return null
    return Uri.parse("tel:$digits")
}
