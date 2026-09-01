@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.trusted_neighbors

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusIcon

@Composable
fun TrustedNeighborsScreen(onBack: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().testTag("trustedNeighbors")) {
        ContentDetailShell(
            title = "Trusted neighbors",
            onBack = onBack,
            header = {},
            body = {
                EmptyState(
                    icon = PantopusIcon.Users,
                    headline = "No trusted neighbors yet",
                    subcopy =
                        "Trusted neighbors can receive packages and help with access when you're away. " +
                            "Approved neighbors will appear here.",
                )
            },
        )
    }
}
