package app.pantopus.android.ui.screens.place.launch

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlaceArrivalState
import app.pantopus.android.ui.screens.place.PlaceSectionView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/** Bookmark confirmation with an independently retryable public preview. */
@Composable
fun PendingPlaceScreen(
    state: PlaceArrivalState,
    onSave: () -> Unit,
    onDone: () -> Unit,
    onSavedPlaces: () -> Unit,
    onSetUpHome: () -> Unit,
    onRetryPreview: () -> Unit,
) {
    Column(
        modifier =
            Modifier.fillMaxSize().background(PantopusColors.appBg)
                .verticalScroll(rememberScrollState()).padding(Spacing.s4).testTag("place.arrival"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Text(
            if (state.saved == null) "Keep this address handy" else "Saved privately",
            style = MaterialTheme.typography.headlineSmall,
            color = PantopusColors.appText,
        )
        Text(state.draft?.label.orEmpty(), style = MaterialTheme.typography.bodyLarge, color = PantopusColors.appText)
        Text(
            "A private bookmark for your account. Setting up and verifying a Home is a separate step.",
            color = PantopusColors.appTextSecondary,
        )
        state.error?.let { Text(it, color = PantopusColors.appTextSecondary, modifier = Modifier.testTag("place.arrival.error")) }
        if (state.saved != null) {
            PrimaryButton(title = "View saved places", onClick = onSavedPlaces, modifier = Modifier.fillMaxWidth())
            TextButton(onClick = onSetUpHome) { Text("Set up a Home") }
            TextButton(onClick = onDone) { Text("Continue exploring") }
        } else {
            PrimaryButton(
                title = if (state.error == null) "Save privately" else "Try saving again",
                isLoading = state.isSaving,
                onClick = onSave,
                modifier = Modifier.fillMaxWidth().testTag("place.arrival.save"),
            )
            TextButton(onClick = onDone, enabled = !state.isSaving) { Text("Not now") }
            Text(
                "This unfinished preview stays on this device for up to 24 hours.",
                style = MaterialTheme.typography.bodySmall,
                color = PantopusColors.appTextMuted,
            )
        }
        HorizontalDivider()
        Text("Public address preview", style = MaterialTheme.typography.titleMedium, color = PantopusColors.appText)
        when {
            state.previewError -> {
                Text(
                    if (state.saved == null) {
                        "The preview is temporarily unavailable. You can still save the address."
                    } else {
                        "Your address is saved. Try the preview again in a moment."
                    },
                )
                TextButton(onClick = onRetryPreview) { Text("Retry preview") }
            }
            state.preview != null -> {
                state.preview.aha?.takeIf { it.isRenderable }?.let {
                    Text(it.headline, style = MaterialTheme.typography.titleMedium)
                    Text(it.detail)
                }
                state.preview.sections.orEmpty().forEach {
                    PlaceSectionView(env = it, onOpen = null, onVerify = null, onClaim = null)
                }
            }
            else -> CircularProgressIndicator()
        }
    }
}
