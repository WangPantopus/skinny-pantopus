@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.place

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshot of the assembled C1a (claimed, T3) Place dashboard,
 * rendered from the captured real backend payload. Locks the full-screen
 * visual contract (header, verify banner, hero with the active heat
 * warning, the eight section groups, the "Locked until you verify"
 * group). Regenerate with `./gradlew paparazziRecord`.
 */
class PlaceDashboardSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false),
        )

    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private fun fixture(): PlaceIntelligence {
        val json =
            checkNotNull(javaClass.classLoader?.getResource("place/intelligence-full.json")).readText()
        return checkNotNull(moshi.adapter(PlaceIntelligence::class.java).fromJson(json))
    }

    @Test
    fun place_dashboard_claimed() {
        paparazzi.snapshot { Dashboard() }
    }

    @Composable
    private fun Dashboard() {
        PantopusTheme {
            PlaceDashboardContent(
                intel = fixture(),
                onOpenAvatar = {},
                onVerify = {},
                onOpenDetail = {},
                modifier = Modifier.fillMaxWidth().background(PantopusColors.appBg),
            )
        }
    }
}
