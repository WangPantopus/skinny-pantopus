@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
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
 * Paparazzi snapshot of the Civic group-detail page rendered from the
 * captured backend payload (6 districts grouped by level + 6 named
 * representatives). Locks the data-rich detail layout. Regenerate with
 * `./gradlew paparazziRecord`.
 */
class PlaceCivicDetailSnapshotTest {
    @get:Rule
    val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false))

    private val moshi: Moshi =
        Moshi.Builder()
            .add(PlaceSectionEnvelopeAdapterFactory())
            .add(PlaceEnumAdapterFactory)
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private fun fixture(): PlaceIntelligence {
        val json = checkNotNull(javaClass.classLoader?.getResource("place/intelligence-full.json")).readText()
        return checkNotNull(moshi.adapter(PlaceIntelligence::class.java).fromJson(json))
    }

    @Test
    fun place_civic_detail() {
        paparazzi.snapshot { Content() }
    }

    @Composable
    private fun Content() {
        PantopusTheme {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .background(PantopusColors.appBg)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp),
            ) {
                PlaceCivicDetailContent(fixture())
            }
        }
    }
}
