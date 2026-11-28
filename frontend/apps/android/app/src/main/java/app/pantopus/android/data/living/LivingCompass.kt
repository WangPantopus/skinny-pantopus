@file:Suppress("MagicNumber")

package app.pantopus.android.data.living

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import java.time.Instant
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * CONTRACT 9h: which way the phone faced at the shutter. Sent with a Moment the camera took now (the Live mark) while
 * `pulse_reinvented` is on, only when the compass is good to 30 degrees or better. The server keeps it, rounded to 5
 * degrees, only where 9h says, and never answers it as a number.
 */
@JsonClass(generateAdapter = true)
data class MomentHeadingBody(
    val deg: Double,
    @Json(name = "accuracy_deg") val accuracyDeg: Double,
)

/**
 * "Pulse, reinvented" phase 4, the compass at the shutter for live beams (PHASE-4 piece 2; CONTRACT 9h), as the iPhone's
 * `MomentsStudioCompass.swift`. It reads the phone's rotation sensor only while the camera is up and the switch is on
 * ([watch]), and keeps the last ten minutes of readings (one every quarter second) on the phone only, so a Moment's post
 * takes the reading nearest that Moment's own capture time ([near]), within two seconds. A phone with no rotation sensor
 * reads nothing and sends nothing. The readings are dropped when the switch reads off; nothing is kept anywhere else.
 */
object LivingCompass : SensorEventListener {
    private const val GOOD_ENOUGH_DEG = 30.0
    private const val NEAR_MS = 2_000L
    private const val EVERY_MS = 250L
    private const val KEEP_MS = 10 * 60_000L
    private const val NO_ESTIMATE = 180.0

    private data class Reading(
        val deg: Double,
        val accuracyDeg: Double,
        val atMs: Long,
    )

    private var manager: SensorManager? = null
    private val readings = ArrayDeque<Reading>()
    private var declination = 0f
    private val rotation = FloatArray(9)
    private val orientation = FloatArray(3)

    /**
     * Starts reading while [on] (the switch, with the camera up); with the switch off it stops and forgets every reading.
     * [latitude] and [longitude], when the phone has a place, turn magnetic north into true north.
     */
    @Synchronized
    fun watch(
        context: Context,
        on: Boolean,
        latitude: Double? = null,
        longitude: Double? = null,
    ) {
        stop()
        if (!on) {
            readings.clear()
            return
        }
        val sensors = context.getSystemService(SensorManager::class.java) ?: return
        val sensor = sensors.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) ?: return
        declination =
            if (latitude != null && longitude != null) {
                GeomagneticField(latitude.toFloat(), longitude.toFloat(), 0f, System.currentTimeMillis()).declination
            } else {
                0f
            }
        manager = sensors
        sensors.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI)
    }

    /** The camera went: no more readings (those taken stay, for the Moment being posted). */
    @Synchronized
    fun stop() {
        manager?.unregisterListener(this)
        manager = null
    }

    /** The reading nearest [captured] (a Moment's own capture time), within two seconds and good to 30 degrees; else null. */
    @Synchronized
    fun near(captured: Instant): MomentHeadingBody? {
        val at = captured.toEpochMilli()
        val reading = readings.minByOrNull { abs(it.atMs - at) } ?: return null
        if (abs(reading.atMs - at) > NEAR_MS || reading.accuracyDeg > GOOD_ENOUGH_DEG) return null
        return MomentHeadingBody(deg = reading.deg, accuracyDeg = reading.accuracyDeg)
    }

    @Synchronized
    override fun onSensorChanged(event: SensorEvent) {
        val now = System.currentTimeMillis()
        if ((readings.lastOrNull()?.atMs ?: 0L) > now - EVERY_MS) return
        SensorManager.getRotationMatrixFromVector(rotation, event.values)
        SensorManager.getOrientation(rotation, orientation)
        val magnetic = Math.toDegrees(orientation[0].toDouble())
        // Rounded to a tenth first, then brought under 360: 359.96 is 0.0, never 360.0 (which the server drops).
        val deg = (((magnetic + declination) * 10).roundToInt() / 10.0 % 360 + 360) % 360
        // The rotation vector's own heading estimate (radians), when the phone gives one.
        val estimate = event.values.getOrNull(4)?.takeIf { it > 0f }?.let { Math.toDegrees(it.toDouble()) }
        val accuracy = (estimate ?: byStatus(event.accuracy)).coerceIn(0.0, NO_ESTIMATE)
        readings.addLast(Reading(deg, accuracy, now))
        while ((readings.firstOrNull()?.atMs ?: now) < now - KEEP_MS) readings.removeFirst()
    }

    override fun onAccuracyChanged(
        sensor: Sensor?,
        accuracy: Int,
    ) = Unit

    private fun byStatus(status: Int): Double =
        when (status) {
            SensorManager.SENSOR_STATUS_ACCURACY_HIGH -> 10.0
            SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM -> 25.0
            SensorManager.SENSOR_STATUS_ACCURACY_LOW -> 45.0
            else -> NO_ESTIMATE
        }
}
