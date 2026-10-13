package app.pantopus.android.ui.screens.plans

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansFlags
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/** Lets a screen ask whether Nearby Plans is on for the signed-in person (the two flags), and whether it is online. */
@HiltViewModel
class PlansGateViewModel
    @Inject
    constructor(
        feature: PlansFeature,
        network: NetworkMonitor,
    ) : ViewModel() {
        val flags: StateFlow<PlansFlags> = feature.flags

        /** For the offline strip on the Plans screens. */
        val online: StateFlow<Boolean> = network.isOnline
    }
