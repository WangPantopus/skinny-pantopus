package app.pantopus.android.ui.components

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color

/**
 * The color of the band the activity paints behind the camera cutout and the status bar (`MainActivity`). Null is the
 * app's own surface. A screen that stands on black (the Moments viewer and camera) sets its color while it shows, so
 * the band isn't a white strip over it.
 */
object CutoutBand {
    var color: Color? by mutableStateOf(null)
}
