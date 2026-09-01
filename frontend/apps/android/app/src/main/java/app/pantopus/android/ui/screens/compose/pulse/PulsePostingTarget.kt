package app.pantopus.android.ui.screens.compose.pulse

/**
 * Destination chosen in step 1 of the Pulse compose flow.
 * Mirrors iOS `PulsePostingTarget` / RN `PostTargetPicker`.
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

    data class Business(
        val businessId: String,
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
                is Business -> PulseComposeIdentity.Business.key
                else -> PulseComposeIdentity.Personal.key
            }

    val targetLatitude: Double?
        get() =
            when (this) {
                is CurrentLocation -> lat
                is Home -> lat
                is Business -> lat
                Connections -> null
            }

    val targetLongitude: Double?
        get() =
            when (this) {
                is CurrentLocation -> lng
                is Home -> lng
                is Business -> lng
                Connections -> null
            }

    val targetHomeId: String?
        get() = (this as? Home)?.let { it.homeId }

    val targetBusinessId: String?
        get() = (this as? Business)?.let { it.businessId }
}
