@file:Suppress("UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Shared error-state scaffold with an inline Retry — the canonical
 * "couldn't load" surface.
 *
 * Built on [EmptyState] so the geometry, hero circle, and CTA match the
 * empty state exactly; the only differences are the [PantopusIcon.AlertCircle]
 * glyph and the retry-wired CTA. Use this on every fetchable screen's `Error`
 * case instead of hand-rolling an `EmptyState(icon = AlertCircle, …)` so the
 * copy, icon, and retry affordance stay consistent app-wide (Block 2F state
 * rule). It renders identically to that call, so converting an existing
 * inline error block is a no-visual-change refactor.
 *
 * @param headline Bold H3 message, e.g. "Couldn't load Earn". Defaults to a
 *   generic "Something went wrong".
 * @param message Supporting sentence — usually the failure reason surfaced by
 *   the view-model. Defaults to a connectivity-oriented hint.
 * @param modifier Forwarded to the underlying [EmptyState] (e.g. a testTag).
 * @param retryTitle Primary CTA label. Defaults to "Try again".
 * @param onRetry Tap handler — wire to `viewModel.refresh()` / `retry()`.
 */
@Composable
fun ErrorState(
    headline: String = "Something went wrong",
    message: String = "We couldn't load this. Check your connection and try again.",
    modifier: Modifier = Modifier,
    retryTitle: String = "Try again",
    onRetry: () -> Unit,
) {
    EmptyState(
        icon = PantopusIcon.AlertCircle,
        headline = headline,
        subcopy = message,
        modifier = modifier,
        ctaTitle = retryTitle,
        onCta = onRetry,
    )
}

@Preview(showBackground = true)
@Composable
private fun ErrorStateDefaultPreview() {
    ErrorState(onRetry = {})
}

@Preview(showBackground = true)
@Composable
private fun ErrorStateScreenCopyPreview() {
    ErrorState(
        headline = "Couldn't load Earn",
        message = "We hit a snag reaching your earnings. Pull to refresh or try again.",
        onRetry = {},
    )
}
