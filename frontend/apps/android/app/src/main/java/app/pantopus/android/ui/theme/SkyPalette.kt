@file:Suppress("MagicNumber")

package app.pantopus.android.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * Illustration colours for the Today tab: the living sky over the
 * resident's house (one gradient per time of day and kind of weather),
 * the ground and house silhouettes, sun, moon and window light, and the
 * EPA air-quality band hues the AQI gauge draws.
 *
 * Not in [PantopusColors]: a sky is a picture, not a UI token, and the
 * scene blends these colours (a silhouette is the horizon colour
 * darkened). Kept here, like [SpeciesPalette], so no raw colour literal
 * reaches `ui/screens/`. Mirrors iOS `Core/Design/SkyPalette.swift`.
 */
object SkyPalette {
    /** Where the sun is: the 40 minutes either side of sunrise and sunset get warm skies. */
    enum class Phase { DAWN, DAY, DUSK, NIGHT }

    /** The weather families the sky distinguishes. */
    enum class Weather { CLEAR, PARTLY, OVERCAST, FOG, WET, SNOW, STORM }

    /** Zenith, middle and horizon colours of the sky. */
    data class Sky(
        val top: Color,
        val mid: Color,
        val bottom: Color,
    )

    private fun sky(
        top: Long,
        mid: Long,
        bottom: Long,
    ) = Sky(Color(top), Color(mid), Color(bottom))

    fun sky(
        phase: Phase,
        weather: Weather,
    ): Sky =
        when (phase) {
            Phase.DAY -> daySky(weather)
            Phase.DAWN -> dawnSky(weather)
            Phase.DUSK -> duskSky(weather)
            Phase.NIGHT -> nightSky(weather)
        }

    private fun daySky(weather: Weather) =
        when (weather) {
            Weather.CLEAR -> sky(0xFF0B5FA5, 0xFF1D8FD8, 0xFF7CC8F2)
            Weather.PARTLY -> sky(0xFF22609F, 0xFF4A8DCB, 0xFFA3CDEB)
            Weather.OVERCAST -> sky(0xFF46566B, 0xFF677A8F, 0xFFA5B3C3)
            Weather.FOG -> sky(0xFF5E6C7E, 0xFF8592A2, 0xFFC3CCD6)
            Weather.WET -> sky(0xFF2B394D, 0xFF44566C, 0xFF7B8DA2)
            Weather.SNOW -> sky(0xFF4A5F79, 0xFF7A90A8, 0xFFCAD7E4)
            Weather.STORM -> sky(0xFF1C2433, 0xFF2D3849, 0xFF4A586C)
        }

    private fun dawnSky(weather: Weather) =
        when (weather) {
            Weather.CLEAR -> sky(0xFF1F2F6B, 0xFF7A4E9E, 0xFFF2A273)
            Weather.PARTLY -> sky(0xFF26356E, 0xFF7E5A9C, 0xFFE9A783)
            Weather.OVERCAST -> sky(0xFF363D52, 0xFF685F78, 0xFFB0948F)
            Weather.FOG -> sky(0xFF454B5E, 0xFF7A7488, 0xFFC2AAA2)
            Weather.WET -> sky(0xFF262E40, 0xFF4C4A5F, 0xFF8A7A80)
            Weather.SNOW -> sky(0xFF3A4560, 0xFF76708C, 0xFFD4BDB8)
            Weather.STORM -> sky(0xFF191D2B, 0xFF2F2D40, 0xFF55495A)
        }

    private fun duskSky(weather: Weather) =
        when (weather) {
            Weather.CLEAR -> sky(0xFF1B1846, 0xFF8E3A6E, 0xFFF0884A)
            Weather.PARTLY -> sky(0xFF211D4C, 0xFF86426F, 0xFFE58F5E)
            Weather.OVERCAST -> sky(0xFF2A2B40, 0xFF584A60, 0xFFA07B70)
            Weather.FOG -> sky(0xFF3A3A4E, 0xFF6A5D6E, 0xFFB5938A)
            Weather.WET -> sky(0xFF1F2233, 0xFF423A4E, 0xFF7A5F62)
            Weather.SNOW -> sky(0xFF2F3350, 0xFF6A5C7A, 0xFFC9A9A8)
            Weather.STORM -> sky(0xFF14151F, 0xFF2A2433, 0xFF4D3A44)
        }

    private fun nightSky(weather: Weather) =
        when (weather) {
            Weather.CLEAR -> sky(0xFF060A1C, 0xFF101838, 0xFF25305C)
            Weather.PARTLY -> sky(0xFF080D20, 0xFF141C3B, 0xFF2A3459)
            Weather.OVERCAST -> sky(0xFF0E121B, 0xFF1A202D, 0xFF2B3444)
            Weather.FOG -> sky(0xFF12161E, 0xFF202631, 0xFF353D4A)
            Weather.WET -> sky(0xFF0A101C, 0xFF152031, 0xFF253349)
            Weather.SNOW -> sky(0xFF111829, 0xFF202D47, 0xFF3C4C68)
            Weather.STORM -> sky(0xFF06080E, 0xFF111522, 0xFF1F2536)
        }

    /**
     * Linear sRGB blend toward [other]; 0 keeps [this], 1 gives [other]. Done by
     * component (not Compose's perceptual `lerp`) so the pictures match iOS.
     */
    fun Color.mixed(
        other: Color,
        amount: Float,
    ): Color {
        val t = amount.coerceIn(0f, 1f)
        return Color(
            red = red + (other.red - red) * t,
            green = green + (other.green - green) * t,
            blue = blue + (other.blue - blue) * t,
            alpha = alpha,
        )
    }

    /** Near-black blue the ground silhouettes are darkened toward. */
    val ink = Color(0xFF04070F)
    val white = Color(0xFFFFFFFF)
    val black = Color(0xFF000000)

    /** The legibility scrim behind the temperature (slate 950). */
    val scrim = Color(0xFF020617)

    /** Sun disc high in the sky, and low near sunrise and sunset. */
    val sunHigh = Color(0xFFFFE08A)
    val sunLow = Color(0xFFFFC27A)
    val moon = Color(0xFFEEF1FA)
    val moonShadow = Color(0xFFCBD5F5)
    val moonGlow = Color(0xFFE2E8FF)

    /** Lamp light in the house windows after dark. */
    val windowGlow = Color(0xFFFFD27A)

    /** Partly-cloudy puffs, tinted by the light they're in. */
    val cloudDawn = Color(0xFFF6E3EA)
    val cloudDusk = Color(0xFFF8DCCB)
    val cloudNight = Color(0xFF3A4668)

    val rainDay = Color(0xFFE1EBFA)
    val rainNight = Color(0xFFAABEE6)
    val fogDay = Color(0xFFEBF0F5)
    val fogNight = Color(0xFFC8D2E1)
    val lightning = Color(0xFFEBF0FF)
    val bolt = Color(0xFFFFFADC)
    val smoke = Color(0xFFE6EBF5)
    val leafDay = Color(0xFFEAB308)
    val leafNight = Color(0xFFA08C5A)

    /** Frost creeping in from the card's corners on a freezing morning. */
    val frost = Color(0xFFE8F4FF)

    /** The round tree through the year, blended into the silhouette. */
    val treeSpring = Color(0xFF7BC67E)
    val treeSummer = Color(0xFF3F8F4A)
    val treeAutumn = Color(0xFFE07A2E)
    val treeAutumnDeep = Color(0xFFB8432A)
    val blossom = Color(0xFFF9A8D4)
    val pine = Color(0xFF2F6B3F)

    /** Bins at the curb: garbage, recycling, yard waste. */
    val binGarbage = Color(0xFF4B5563)
    val binRecycling = Color(0xFF2563EB)
    val binYard = Color(0xFF15803D)

    /** Snow-covered hills and house, day and night. */
    val snowHillBackDay = Color(0xFFDCE5EF)
    val snowHillFrontDay = Color(0xFFF3F6FA)
    val snowHouseDay = Color(0xFF5E7088)
    val snowHillBackNight = Color(0xFF5B6B86)
    val snowHillFrontNight = Color(0xFF46546E)
    val snowHouseNight = Color(0xFF2C3850)

    /** EPA AQI category hues, Good → Hazardous (the web's `AQI_BANDS`). */
    val airQualityBands =
        listOf(
            Color(0xFF16A34A),
            Color(0xFFEAB308),
            Color(0xFFF97316),
            Color(0xFFDC2626),
            Color(0xFF7C3AED),
            Color(0xFF7F1D1D),
        )
}
