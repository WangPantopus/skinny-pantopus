package app.pantopus.android.data.moments

import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.moments.MomentRingDto
import java.text.NumberFormat
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * The server's rules for a Moment's height (`shownAltitude` in backend/services/moments/momentStore.js), mirrored, so
 * the Post sheet offers "Show elevation" only for a reading the server will keep and shows the number everyone will read.
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

/**
 * A Moment's height as the server returns it (`altitude_ft` and `flying`, contract v3.8), on a ring (its newest
 * Moment's) and on a Moment: what the map's tag and the viewer show.
 */
data class MomentShownHeight(
    /** Feet above sea level, a multiple of 10; negative below it. */
    val feet: Int,
    /** Posted in flight (60 m/s or more). */
    val flying: Boolean,
) {
    /** The color that goes with the number (never color alone). */
    val band: MomentHeightBand get() = if (flying) MomentHeightBand.FLYING else MomentHeightBand.of(feet)

    /** The tag: "4,390 ft". */
    val text: String get() = "${NumberFormat.getIntegerInstance().format(feet)} ft"

    /** What TalkBack adds to a ring: "4,390 feet above sea level", or "posted in flight at 34,000 feet". */
    val spoken: String
        get() {
            val number = NumberFormat.getIntegerInstance()
            return when {
                flying -> "posted in flight at ${number.format(feet)} feet"
                feet < 0 -> "${number.format(-feet)} feet below sea level"
                else -> "${number.format(feet)} feet above sea level"
            }
        }

    companion object {
        /** Whole feet from the server's number; null for none, or one that can't be a height. */
        fun of(
            altitudeFt: Double?,
            flying: Boolean,
        ): MomentShownHeight? {
            if (altitudeFt == null || !altitudeFt.isFinite() || abs(altitudeFt) >= MAX_FEET) return null
            return MomentShownHeight(altitudeFt.roundToInt(), flying)
        }

        private const val MAX_FEET = 100_000.0
    }
}

/** The height bands of the map's key (board H2): four on the ground, and flying. */
enum class MomentHeightBand(
    /** Under its bar in the key: where the band starts. */
    val keyLabel: String,
    /** What TalkBack reads for it in the key. */
    val spoken: String,
) {
    LOW("0 ft", "green, under 500 feet"),
    HILLS("500", "lime, 500 to 2,000 feet"),
    MOUNTAIN("2,000", "amber, 2,000 to 6,000 feet"),
    PEAK("6,000", "rose, 6,000 feet and over"),
    FLYING("Flying", "blue with a plane, posted in flight"),
    ;

    companion object {
        private const val HILLS_FROM = 500
        private const val MOUNTAIN_FROM = 2_000
        private const val PEAK_FROM = 6_000

        /** Under 500 ft; 500 to under 2,000; 2,000 to under 6,000; 6,000 and over. */
        fun of(feet: Int): MomentHeightBand =
            when {
                feet < HILLS_FROM -> LOW
                feet < MOUNTAIN_FROM -> HILLS
                feet < PEAK_FROM -> MOUNTAIN
                else -> PEAK
            }
    }
}

/** Its newest Moment's height; null when it shows none. */
val MomentRingDto.shownHeight: MomentShownHeight? get() = MomentShownHeight.of(altitudeFt, flying)

val MomentDto.shownHeight: MomentShownHeight? get() = MomentShownHeight.of(altitudeFt, flying)
