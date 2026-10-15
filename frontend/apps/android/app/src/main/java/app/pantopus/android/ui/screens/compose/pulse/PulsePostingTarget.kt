package app.pantopus.android.ui.screens.compose.pulse

/**
 * Destination chosen in step 1 of the Pulse compose flow.
 * Mirrors iOS `PulsePostingTarget` / RN `PostTargetPicker`. There is no business destination: businesses reply in
 * Pulse; they don't post to the Place feed (Pulse S1, `BUSINESS_CANNOT_POST`).
 */
sealed class PulsePostingTarget {
    abstract val displayLabel: String

    data class CurrentLocation(
        val lat: Double,
        val lng: Double,
        override val displayLabel: String,
    ) : PulsePostingTarget()

    data class Home(
        val homeId: String,
        val lat: Double,
        val lng: Double,
        override val displayLabel: String,
    ) : PulsePostingTarget()

    data object Connections : PulsePostingTarget() {
        override val displayLabel: String = "Connections"
    }

    val isPlaceTarget: Boolean
        get() = this !is Connections

    val isNetworkTarget: Boolean
        get() = this is Connections

    val postAs: String
        get() =
            when (this) {
                is Home -> PulseComposeIdentity.Home.key
                else -> PulseComposeIdentity.Personal.key
            }

    val targetLatitude: Double?
        get() =
            when (this) {
                is CurrentLocation -> lat
                is Home -> lat
                Connections -> null
            }

    val targetLongitude: Double?
        get() =
            when (this) {
                is CurrentLocation -> lng
                is Home -> lng
                Connections -> null
            }

    val targetHomeId: String?
        get() = (this as? Home)?.let { it.homeId }
}
