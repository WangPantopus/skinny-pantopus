@file:Suppress("LongMethod", "MagicNumber", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the A19 legal scaffold primitives — [LegalTOCCard]
 * (expanded + collapsed), [DocMetaStrip], [LegalSection], and [BackToTopFab].
 * The fab renders its static (frame-zero) layout; the fade/slide isn't
 * exercised by Paparazzi.
 *
 * Baselines live under `app/src/test/snapshots/images/`; regenerate via
 * `./gradlew paparazziRecord`.
 */
class LegalPrimitivesSnapshotTest {
    private val tocItems =
        listOf(
            "Overview",
            "Information we collect",
            "How we use it",
            "Identity pillars & privacy",
            "Sharing & disclosure",
            "Your rights & controls",
            "Data retention",
            "Children & teens",
            "International transfers",
            "Changes to this policy",
        )

    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun doc_meta_strip() {
        paparazzi.snapshot {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(PantopusColors.appSurface),
            ) {
                DocMetaStrip(lastUpdated = "October 1, 2025", version = "3.2")
                DocMetaStrip(lastUpdated = "February 14, 2026", version = "5.0")
            }
        }
    }

    @Test
    fun legal_toc_card_expanded() {
        paparazzi.snapshot {
            PreviewSurface {
                LegalTOCCard(items = tocItems, isOpen = true, onToggle = {}, onJump = {})
            }
        }
    }

    @Test
    fun legal_toc_card_collapsed() {
        paparazzi.snapshot {
            PreviewSurface {
                LegalTOCCard(items = tocItems, isOpen = false, onToggle = {}, onJump = {})
            }
        }
    }

    @Test
    fun legal_sections() {
        paparazzi.snapshot {
            PreviewSurface {
                Column {
                    tocItems.forEachIndexed { index, title ->
                        LegalSection(number = index + 1, title = title)
                    }
                }
            }
        }
    }

    @Test
    fun back_to_top_fab_visible() {
        paparazzi.snapshot {
            Box(
                modifier =
                    Modifier
                        .background(PantopusColors.appSurface)
                        .padding(Spacing.s5),
            ) {
                BackToTopFab(isVisible = true, onTap = {})
            }
        }
    }

    @Test
    fun legal_scaffold_composition() {
        paparazzi.snapshot {
            Box(modifier = Modifier.background(PantopusColors.appSurface)) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    DocMetaStrip(lastUpdated = "October 1, 2025", version = "3.2")
                    Column(
                        modifier = Modifier.padding(horizontal = Spacing.s5),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s0),
                    ) {
                        LegalTOCCard(items = tocItems, isOpen = true, onToggle = {}, onJump = {})
                        LegalSection(number = 1, title = "Overview")
                        Text(
                            text =
                                "Pantopus is a neighborhood platform that lets you keep separate " +
                                    "Personal, Home, and Business identities.",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appText,
                        )
                    }
                }
                BackToTopFab(
                    isVisible = true,
                    onTap = {},
                    modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s4),
                )
            }
        }
    }
}

@Composable
private fun PreviewSurface(content: @Composable () -> Unit) {
    Box(
        modifier =
            Modifier
                .background(PantopusColors.appSurface)
                .padding(Spacing.s5),
    ) {
        content()
    }
}
