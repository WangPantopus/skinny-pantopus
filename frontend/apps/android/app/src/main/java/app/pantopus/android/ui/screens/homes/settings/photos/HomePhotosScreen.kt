@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.settings.photos

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusIcon

@Composable
fun HomePhotosScreen(
    onBack: () -> Unit,
    onOpenDocuments: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().testTag("homePhotos")) {
        ContentDetailShell(
            title = "Photos",
            onBack = onBack,
            header = {},
            body = {
                EmptyState(
                    icon = PantopusIcon.Image,
                    headline = "Home photos",
                    subcopy =
                        "Store exterior and room photos in your home documents vault " +
                            "for insurance and maintenance records.",
                    ctaTitle = "Open documents",
                    onCta = onOpenDocuments,
                )
            },
            cta = {
                PrimaryButton(title = "Upload in documents", onClick = onOpenDocuments)
            },
        )
    }
}
