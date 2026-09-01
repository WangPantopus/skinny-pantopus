@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.posts

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.content_detail.bodies.quickReplyPrompts
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostAuthorHeader
import app.pantopus.android.ui.screens.shared.content_detail.headers.PostIntent
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

/** A10.4 Paparazzi snapshots for Pulse post detail. */
class PulsePostDetailSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1200,
                    softButtons = false,
                ),
        )

    @Test fun a10_4_populated_resolved_thread() {
        paparazzi.snapshot {
            Frame {
                PulsePostDetailLoadedContent(
                    content = PulsePostDetailSampleData.populated,
                    composerText = "",
                    onComposerTextChange = {},
                    isSending = false,
                )
            }
        }
    }

    @Test fun a10_4_empty_ask_quick_replies() {
        paparazzi.snapshot {
            Frame {
                PulsePostDetailLoadedContent(
                    content = PulsePostDetailSampleData.empty(PostIntent.Ask),
                    composerText = "",
                    onComposerTextChange = {},
                    isSending = false,
                )
            }
        }
        assertEquals(
            listOf("Try a question reply", "Share a tip", "Suggest a resource"),
            PostIntent.Ask.quickReplyPrompts.map { it.label },
        )
    }

    @Test fun a10_4_empty_lost_found_quick_replies_are_intent_shaped() {
        assertEquals(
            listOf("I've seen it", "Have you checked X?", "DM me about details"),
            PostIntent.LostFound.quickReplyPrompts.map { it.label },
        )
    }

    @Test fun all_intent_chips_render_with_expected_palette() {
        paparazzi.snapshot {
            Frame {
                Column(
                    modifier = Modifier.padding(vertical = Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    PostIntent.entries.forEach { intent ->
                        PostAuthorHeader(
                            displayName = "Nadia Velez",
                            avatarUrl = null,
                            isVerified = true,
                            identity = app.pantopus.android.ui.components.IdentityPillar.Personal,
                            timeAndLocality = "22m · Elm Park",
                            intent = intent,
                        )
                    }
                }
            }
        }

        assertEquals(StatusChipVariant.ErrorVariant, PostIntent.LostFound.chipVariant)
        assertEquals(StatusChipVariant.Info, PostIntent.Ask.chipVariant)
        assertEquals(StatusChipVariant.Success, PostIntent.Offer.chipVariant)
        assertEquals(StatusChipVariant.Personal, PostIntent.Event.chipVariant)
        assertEquals(StatusChipVariant.Home, PostIntent.Share.chipVariant)
        assertEquals(StatusChipVariant.Warning, PostIntent.Alert.chipVariant)
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier = Modifier.fillMaxSize().background(PantopusColors.appBg),
            ) {
                content()
            }
        }
    }
}
