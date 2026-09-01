@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.compose.pulse

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * P2.1 — Paparazzi baselines for the Pulse compose form. Locks the
 * five filled intent variants plus the empty `.ask` baseline so a CTA
 * relabel, dropped field, or wrong identity chip is caught by a diff.
 *
 * Record baselines with `./gradlew paparazziRecord`.
 */
class PulseComposeSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3000,
                    softButtons = false,
                ),
        )

    @Test fun pulse_compose_ask_empty() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Ask, filled = false)) }
        }
    }

    @Test fun pulse_compose_ask_filled() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Ask, filled = true)) }
        }
    }

    @Test fun pulse_compose_recommend_filled() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Recommend, filled = true)) }
        }
    }

    @Test fun pulse_compose_event_filled() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Event, filled = true)) }
        }
    }

    @Test fun pulse_compose_lost_filled() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Lost, filled = true)) }
        }
    }

    @Test fun pulse_compose_announce_filled() {
        paparazzi.snapshot {
            Frame { Body(state = fixture(PulseComposeIntent.Announce, filled = true)) }
        }
    }

    /**
     * Edit-mode prefill — the form opens with every field already seeded
     * from the saved post and the intent picker locked. Mirror of the
     * iOS `test_pulse_compose_edit_prefilled_renders` fixture.
     */
    @Test fun pulse_compose_edit_prefilled() {
        paparazzi.snapshot {
            Frame { Body(state = editPrefilledFixture()) }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }

    @Composable
    private fun Body(state: PulseComposeContentState) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            PulseComposeBody(
                state = state,
                actions =
                    PulseComposeActions(
                        selection =
                            PulseComposeSelectionActions(
                                onSelectIntent = {},
                                onSelectIdentity = {},
                                onSelectVisibility = {},
                                onSelectLostFoundKind = {},
                                onSelectContactPref = {},
                                onSelectDealExpires = {},
                                onSelectAnnounceAudience = {},
                                onSelectSafetyAlertKind = {},
                                onSelectAskCategory = {},
                                onSelectRecommendRating = {},
                            ),
                        onUpdateField = { _, _ -> },
                        onPickPhotos = {},
                        onRemovePhoto = {},
                    ),
            )
        }
    }

    /** Build a content state for the requested intent. */
    private fun fixture(
        intent: PulseComposeIntent,
        filled: Boolean,
    ): PulseComposeContentState {
        if (!filled) {
            return PulseComposeContentState(
                activeIntent = intent,
                fields = blankFields(),
            )
        }
        return when (intent) {
            PulseComposeIntent.Ask ->
                PulseComposeContentState(
                    activeIntent = PulseComposeIntent.Ask,
                    fields =
                        seedFields(
                            title = "Need a plumber",
                            body = "Pipe leaking under the kitchen sink. Anyone know someone reliable?",
                        ),
                )
            PulseComposeIntent.Recommend ->
                PulseComposeContentState(
                    activeIntent = PulseComposeIntent.Recommend,
                    recommendRating = 4,
                    fields =
                        seedFields(
                            body = "Best lattes on the block — really friendly staff.",
                            recommendBusiness = "Joe's Coffee",
                        ),
                )
            PulseComposeIntent.Event ->
                PulseComposeContentState(
                    activeIntent = PulseComposeIntent.Event,
                    identity = PulseComposeIdentity.Home,
                    fields =
                        seedFields(
                            title = "Summer block party",
                            body = "Bring chairs, snacks, and good vibes. Music starts at 6.",
                            eventDate = "2030-08-15",
                            eventLocation = "Elm Park, near the fountain",
                            eventCapacity = "60",
                        ),
                )
            PulseComposeIntent.Lost ->
                PulseComposeContentState(
                    activeIntent = PulseComposeIntent.Lost,
                    fields =
                        seedFields(
                            body = "Tortoiseshell cat, blue collar, answers to Mochi.",
                            lostLastSeenLocation = "Corner of 5th and Elm",
                            lostLastSeenDate = "2026-05-12",
                        ),
                )
            PulseComposeIntent.Announce ->
                PulseComposeContentState(
                    activeIntent = PulseComposeIntent.Announce,
                    identity = PulseComposeIdentity.Business,
                    announceAudience = PulseAnnounceAudience.Followers,
                    fields =
                        seedFields(
                            title = "Street closure Saturday",
                            body = "Elm between 4th and 6th will be closed 10-2 for the spring parade.",
                        ),
                )
        }
    }

    /**
     * Edit-mode fixture for the Ask intent. The intent picker is locked
     * (`isIntentLocked = true`) and every field arrives with a
     * non-empty `originalValue` so dirty tracking starts at false.
     */
    private fun editPrefilledFixture(): PulseComposeContentState =
        PulseComposeContentState(
            activeIntent = PulseComposeIntent.Ask,
            identity = PulseComposeIdentity.Personal,
            askCategory = PulseAskCategory.Handyman,
            fields =
                seedFields(
                    title = "Need a plumber",
                    body = "Pipe leaking under the kitchen sink. Anyone know someone reliable?",
                ),
            isIntentLocked = true,
        )

    private fun blankFields(): Map<PulseComposeField, FormFieldState> =
        PulseComposeField.entries.associateWith { FormFieldState(id = it.key) }

    @Suppress("LongParameterList")
    private fun seedFields(
        title: String = "",
        body: String = "",
        recommendBusiness: String = "",
        eventDate: String = "",
        eventLocation: String = "",
        eventCapacity: String = "",
        lostLastSeenLocation: String = "",
        lostLastSeenDate: String = "",
    ): Map<PulseComposeField, FormFieldState> {
        val map = blankFields().toMutableMap()
        map[PulseComposeField.Title] = FormFieldState(id = PulseComposeField.Title.key, value = title, originalValue = title)
        map[PulseComposeField.Body] = FormFieldState(id = PulseComposeField.Body.key, value = body, originalValue = body)
        map[PulseComposeField.RecommendBusiness] =
            FormFieldState(id = PulseComposeField.RecommendBusiness.key, value = recommendBusiness, originalValue = recommendBusiness)
        map[PulseComposeField.EventDate] =
            FormFieldState(id = PulseComposeField.EventDate.key, value = eventDate, originalValue = eventDate)
        map[PulseComposeField.EventLocation] =
            FormFieldState(id = PulseComposeField.EventLocation.key, value = eventLocation, originalValue = eventLocation)
        map[PulseComposeField.EventCapacity] =
            FormFieldState(id = PulseComposeField.EventCapacity.key, value = eventCapacity, originalValue = eventCapacity)
        map[PulseComposeField.LostLastSeenLocation] =
            FormFieldState(
                id = PulseComposeField.LostLastSeenLocation.key,
                value = lostLastSeenLocation,
                originalValue = lostLastSeenLocation,
            )
        map[PulseComposeField.LostLastSeenDate] =
            FormFieldState(
                id = PulseComposeField.LostLastSeenDate.key,
                value = lostLastSeenDate,
                originalValue = lostLastSeenDate,
            )
        return map
    }
}
