package app.pantopus.android.ui.screens.moments

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.moments.MomentsFeature
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/** Lets the tab bar ask whether Moments is on for the signed-in person (the `moments` flag), as Plans' gate does. */
@HiltViewModel
class MomentsGateViewModel
    @Inject
    constructor(
        feature: MomentsFeature,
    ) : ViewModel() {
        val on: StateFlow<Boolean> = feature.on

        /** False until [on] holds the signed-in person's answer ([MomentsFeature.settled]). */
        val settled: StateFlow<Boolean> = feature.settled
    }
