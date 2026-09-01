@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.audience_profile.edit_persona

import androidx.activity.compose.LocalActivityResultRegistryOwner
import androidx.activity.result.ActivityResultRegistry
import androidx.activity.result.ActivityResultRegistryOwner
import androidx.activity.result.contract.ActivityResultContract
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.core.app.ActivityOptionsCompat
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for A13.12 Edit Beacon. Two frames mirror the two
 * real states the editor can open in: an empty create form (no Beacon yet)
 * and a filled edit form for an existing Beacon. State is built by hand —
 * these are render fixtures for the snapshot, never a data source the
 * shipped screen reads.
 */
class EditPersonaSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun edit_persona_create() {
        paparazzi.snapshot {
            Frame {
                EditPersonaScaffold(
                    state =
                        EditPersonaUiState.Editing(
                            mode = EditPersonaMode.Create,
                            form = EditPersonaForm(),
                        ),
                )
            }
        }
    }

    @Test
    fun edit_persona_edit() {
        paparazzi.snapshot {
            Frame {
                EditPersonaScaffold(
                    state =
                        EditPersonaUiState.Editing(
                            mode = EditPersonaMode.Edit("p_1"),
                            form =
                                EditPersonaForm(
                                    handle = "elmpark.watch",
                                    displayName = "Elm Park Watch",
                                    bio = "Neighborhood updates, twice a week.",
                                    category = "community_leader",
                                    audienceLabel = PersonaAudienceLabel.Members,
                                    audienceMode = PersonaAudienceMode.ApprovalRequired,
                                    links =
                                        listOf(
                                            PersonaLinkDraft(
                                                id = "link_1",
                                                label = "Site",
                                                url = "https://elmpark.org",
                                            ),
                                        ),
                                ),
                            isDirty = true,
                        ),
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        // The editor's avatar / banner pickers call
        // rememberLauncherForActivityResult, which reads
        // LocalActivityResultRegistryOwner. Paparazzi renders without an
        // Activity, so supply an inert registry — nothing is ever launched
        // from a snapshot.
        CompositionLocalProvider(LocalActivityResultRegistryOwner provides NoOpRegistryOwner) {
            PantopusTheme {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .background(PantopusColors.appBg),
                ) {
                    content()
                }
            }
        }
    }

    private companion object {
        val NoOpRegistryOwner =
            object : ActivityResultRegistryOwner {
                override val activityResultRegistry =
                    object : ActivityResultRegistry() {
                        override fun <I, O> onLaunch(
                            requestCode: Int,
                            contract: ActivityResultContract<I, O>,
                            input: I,
                            options: ActivityOptionsCompat?,
                        ) = Unit
                    }
            }
    }
}
