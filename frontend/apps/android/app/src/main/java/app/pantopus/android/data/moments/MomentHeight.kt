package app.pantopus.android.data.moments

import java.text.NumberFormat
import kotlin.math.floor

/**
 * The server's rules for a Moment's height (`shownAltitude` in backend/services/moments/momentStore.js), mirrored, so
 * the Post sheet offers "Show height" only for a reading the server will keep and shows the number everyone will read.
 */
object MomentHeight {
    private const val MIN_METERS = -500.0
    private const val MAX_METERS = 15_000.0
    private const val MAX_ERROR_METERS = 60.0
    private const val MAX_ERROR_FLYING_METERS = 150.0
    private const val FLYING_MPS = 60.0
    private const val FEET_PER_METER = 3.28084
    private const val STEP_FEET = 10

    /**
     * The feet everyone reads for a reading, rounded to 10 as the server rounds; null for one the server leaves out:
     * below -500 m or above 15,000 m, or rougher than 60 m (150 m in flight, at 60 m/s or more).
     */
    fun feet(
        meters: Double,
        accuracyM: Double?,
        speedMps: Double?,
    ): Int? {
        // A reading that isn't a number is in no range.
        if (meters !in MIN_METERS..MAX_METERS) return null
        val flying = speedMps != null && speedMps.isFinite() && speedMps >= FLYING_MPS
        val roughest = if (flying) MAX_ERROR_FLYING_METERS else MAX_ERROR_METERS
        if (accuracyM != null && accuracyM !in 0.0..roughest) return null
        // Half a step rounds up, as JavaScript's Math.round does.
        return floor(meters * FEET_PER_METER / STEP_FEET + HALF).toInt() * STEP_FEET
    }

    /** The row's second line: "4,390 ft above sea level". */
    fun line(feet: Int): String {
        val number = NumberFormat.getIntegerInstance()
        return if (feet < 0) "${number.format(-feet)} ft below sea level" else "${number.format(feet)} ft above sea level"
    }

    private const val HALF = 0.5
}
