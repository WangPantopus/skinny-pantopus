package app.pantopus.android.ui.screens.place.detail

import java.time.ZoneId

/** The address's clock and the home and street drawn beneath its sky. */
data class SkyPlace(
    val home: SkyHome = SkyHome.HOUSE,
    val streetLights: Int = 0,
    val timeZone: ZoneId = ZoneId.systemDefault(),
)
