@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.support_trains

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/** Test tag on the Support Trains screen root container. */
const val SUPPORT_TRAINS_TAG = "supportTrains"

/**
 * T6.6c (P26.5) Support Trains. Thin wrapper around [ListOfRowsScreen] —
 * three tabs (My trains / Nearby / Invitations), per-row category-tint
 * tile + status chip, "Start a train" extended-nav FAB. The VM owns the
 * data and the routing callbacks.
 */
@Composable
fun SupportTrainsScreen(
    onBack: () -> Unit,
    onOpenTrain: (String) -> Unit,
    onStartTrain: () -> Unit,
    onSearch: () -> Unit = {},
    locationProvider: (suspend () -> Pair<Double, Double>?)? = null,
    viewModel: SupportTrainsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val topBarAction by viewModel.topBarAction.collectAsStateWithLifecycle()
    val fab by viewModel.fab.collectAsStateWithLifecycle()

    // Nearby's "Use my location" asks for the permission first, as the place pickers do.
    val context = LocalContext.current
    val permissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            if (results.values.any { it }) viewModel.useMyLocation() else viewModel.locationPermissionDenied()
        }

    LaunchedEffect(Unit) {
        viewModel.onOpenTrain = onOpenTrain
        viewModel.onStartTrain = onStartTrain
        viewModel.onSearch = onSearch
        locationProvider?.let { viewModel.locationProvider = it }
        viewModel.onRequestLocation = {
            if (hasLocationPermission(context)) {
                viewModel.useMyLocation()
            } else {
                permissionLauncher.launch(LOCATION_PERMISSIONS)
            }
        }
        viewModel.onOpenLocationSettings = {
            context.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null)),
            )
        }
        viewModel.load()
    }

    Box(modifier = Modifier.fillMaxSize().testTag(SUPPORT_TRAINS_TAG)) {
        ListOfRowsScreen(
            title = "Support trains",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = {},
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = { viewModel.selectTab(it) },
            topBarAction = topBarAction,
            fab = fab,
            onBack = onBack,
        )
    }
}

private val LOCATION_PERMISSIONS =
    arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

private fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
