package app.pantopus.android.data.api.models.hub

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * T2 — the `PUT /api/hub/preferences` body contract
 * (`backend/routes/hub.js:697-714`). Joi validates the exact key set
 * with `.min(1)`, allows `null` on both `quiet_hours_*` columns, and
 * rejects any time that isn't `HH:mm` — so this test locks the two
 * things a generated Moshi adapter would get wrong: unset keys must be
 * omitted, and a cleared quiet-hours window must serialize as explicit
 * JSON `null` rather than vanishing.
 */
class NotificationPreferencesPatchTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(NotificationPreferencesPatchJsonAdapter())
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private fun encode(patch: NotificationPreferencesPatch): String = moshi.adapter(NotificationPreferencesPatch::class.java).toJson(patch)

    @Test
    fun writes_only_the_changed_key() {
        assertEquals(
            """{"weather_alerts_enabled":false}""",
            encode(NotificationPreferencesPatch(weatherAlertsEnabled = false)),
        )
    }

    @Test
    fun writes_times_as_raw_hh_mm() {
        assertEquals(
            """{"daily_briefing_time_local":"09:30"}""",
            encode(NotificationPreferencesPatch(dailyBriefingTimeLocal = "09:30")),
        )
    }

    @Test
    fun writes_the_quiet_hours_window_when_set() {
        assertEquals(
            """{"quiet_hours_start_local":"22:00","quiet_hours_end_local":"07:00"}""",
            encode(NotificationPreferencesPatch(quietHours = QuietHoursPatch("22:00", "07:00"))),
        )
    }

    @Test
    fun writes_explicit_nulls_when_quiet_hours_are_cleared() {
        assertEquals(
            """{"quiet_hours_start_local":null,"quiet_hours_end_local":null}""",
            encode(NotificationPreferencesPatch(quietHours = QuietHoursPatch(null, null))),
        )
    }

    @Test
    fun writes_the_location_mode_enum() {
        assertEquals(
            """{"location_mode":"viewing_location"}""",
            encode(NotificationPreferencesPatch(locationMode = "viewing_location")),
        )
    }

    @Test
    fun merge_keeps_untouched_keys_and_lets_the_newer_value_win() {
        val merged =
            NotificationPreferencesPatch(aqiAlertsEnabled = false)
                .mergedWith(NotificationPreferencesPatch(gigUpdatesEnabled = false))
                .mergedWith(NotificationPreferencesPatch(aqiAlertsEnabled = true))
        assertEquals(true, merged.aqiAlertsEnabled)
        assertEquals(false, merged.gigUpdatesEnabled)
        assertEquals(
            """{"aqi_alerts_enabled":true,"gig_updates_enabled":false}""",
            encode(merged),
        )
    }

    @Test
    fun empty_patch_is_recognised_so_no_body_less_put_goes_out() {
        assertTrue(NotificationPreferencesPatch().isEmpty)
        assertFalse(NotificationPreferencesPatch(mailSummaryEnabled = true).isEmpty)
        assertFalse(
            "Clearing quiet hours is a real change even though both fields are null",
            NotificationPreferencesPatch(quietHours = QuietHoursPatch(null, null)).isEmpty,
        )
    }
}
