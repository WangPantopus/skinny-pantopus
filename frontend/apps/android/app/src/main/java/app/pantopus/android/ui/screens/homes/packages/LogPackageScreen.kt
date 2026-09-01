@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.packages

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.3d (P14) — "Log a package" form. Posts to
 * `POST /api/homes/:id/packages` (route `backend/routes/home.js:4706`).
 *
 * Intentionally a single-page form (not a multi-step Wizard) — the
 * carrier + tracking + description + drop fields are short enough to
 * fit one screen.
 *
 * @param onClose Pops back to the Packages list.
 * @param onCreated Fired with the new package id after a successful POST.
 */
@Composable
fun LogPackageScreen(
    onClose: () -> Unit,
    onCreated: (String) -> Unit,
    viewModel: LogPackageViewModel = hiltViewModel(),
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val event by viewModel.event.collectAsStateWithLifecycle()

    LaunchedEffect(event) {
        when (val current = event) {
            null -> Unit
            LogPackageEvent.Dismiss -> {
                viewModel.consumeEvent()
                onClose()
            }
            is LogPackageEvent.Created -> {
                viewModel.consumeEvent()
                onCreated(current.packageId)
            }
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("logPackageSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s10),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            TopRow(onClose = viewModel::cancel)
            Text(
                text = "Track an incoming delivery so the household can see what's arriving and where to leave it.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
            PantopusTextField(
                label = "Carrier",
                value = form.carrier,
                onValueChange = viewModel::updateCarrier,
                placeholder = "Amazon · UPS · USPS · FedEx",
                modifier = Modifier.fillMaxWidth().testTag("logPackage_carrier"),
            )
            PantopusTextField(
                label = "Tracking number",
                value = form.trackingNumber,
                onValueChange = viewModel::updateTracking,
                placeholder = "1Z9X4… or TBA303…",
                modifier = Modifier.fillMaxWidth().testTag("logPackage_tracking"),
            )
            PantopusTextField(
                label = "What's inside",
                value = form.description,
                onValueChange = viewModel::updateDescription,
                placeholder = "Side table · Lego set · Dog food",
                modifier = Modifier.fillMaxWidth().testTag("logPackage_description"),
            )
            PantopusTextField(
                label = "Drop instructions",
                value = form.deliveryInstructions,
                onValueChange = viewModel::updateDrop,
                placeholder = "Front porch · Side door · Mailbox",
                modifier = Modifier.fillMaxWidth().testTag("logPackage_drop"),
            )
            form.submitError?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("logPackage_error"),
                )
            }
            PrimaryButton(
                title = "Log package",
                onClick = viewModel::submit,
                isLoading = form.isSubmitting,
                isEnabled = form.canSubmit && !form.isSubmitting,
                modifier = Modifier.fillMaxWidth().testTag("logPackage_submit"),
            )
        }
    }
}

@Composable
private fun TopRow(onClose: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = "Log a package",
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Cancel",
            style = PantopusTextStyle.small,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clickable(onClick = onClose)
                    .padding(Spacing.s2)
                    .testTag("logPackage_cancel"),
        )
    }
}
