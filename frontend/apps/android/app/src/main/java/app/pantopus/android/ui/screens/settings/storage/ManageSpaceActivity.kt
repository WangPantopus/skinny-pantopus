package app.pantopus.android.ui.screens.settings.storage

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.Modifier
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * The system's "Manage space" button (Settings → Apps → Pantopus → Storage) opens Storage & data here, through
 * `android:manageSpaceActivity` (Instant Screens contract §7). It shows no account data, so it opens signed out or
 * locked as well; Back returns to the system's screen.
 */
@AndroidEntryPoint
class ManageSpaceActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PantopusTheme {
                // The status bar sits over the top bar's surface, as in the app's own screens.
                Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurface).safeDrawingPadding()) {
                    StorageDataScreen(onBack = ::finish)
                }
            }
        }
    }
}
