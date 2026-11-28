package app.pantopus.android.ui.screens.settings

import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.fieldcard.MomentFieldCardRepository
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * "Pulse, reinvented" phase 2 (CONTRACT 7d; PHASE-2 section 3), as the iPhone's `SettingsPantopusAI.swift`: the person's
 * own Pantopus AI switch, one row in Settings' Privacy group, drawn only while `pulse_reinvented` is on for them
 * (otherwise nothing is read and Settings is today's). Off: no new field cards for them, and none of their photos go to
 * the model; the safety checks stay on.
 */
@Singleton
class SettingsPantopusAi
    @Inject
    constructor(
        private val feature: PulseReinventedFeature,
        private val cards: MomentFieldCardRepository,
    ) {
        /** The choice, read only while the switch is on (null otherwise, or when it can't be read: no row). */
        suspend fun read(): Boolean? = if (feature.on.value) (cards.pantopusAi() as? NetworkResult.Success)?.data else null

        /** The row, while the switch is on and the choice was read. */
        fun rows(on: Boolean?): List<GroupedListRow> {
            if (!feature.on.value || on == null) return emptyList()
            return listOf(
                GroupedListRow(
                    id = ROW,
                    label = "Pantopus AI",
                    subtext = "Names things in photos with a source, and suggests. Safety checks stay on.",
                    control = RowControl.Toggle(on),
                    testTag = "settings.pantopusAI",
                ),
            )
        }

        /**
         * The row's switch flipped to [isOn]: [show] gets it at once, then what was saved (the server's answer), or the
         * choice as it was when the server says no. Another row's switch: nothing.
         */
        fun toggle(
            scope: CoroutineScope,
            rowId: String,
            isOn: Boolean,
            show: (Boolean) -> Unit,
        ) {
            if (rowId != ROW) return
            show(isOn)
            scope.launch {
                when (val saved = cards.setPantopusAi(isOn)) {
                    is NetworkResult.Success -> show(saved.data)
                    else -> show(!isOn)
                }
            }
        }

        companion object {
            const val ROW = "pantopusAI"
        }
    }
