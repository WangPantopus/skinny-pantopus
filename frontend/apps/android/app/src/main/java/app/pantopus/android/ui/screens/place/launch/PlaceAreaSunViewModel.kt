package app.pantopus.android.ui.screens.place.launch

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.saved_places.TodayAreaAnswer
import app.pantopus.android.data.saved_places.TodayAreaStore
import app.pantopus.android.ui.screens.place.detail.TodaySunArcCard
import app.pantopus.android.ui.screens.place.detail.isLive
import app.pantopus.android.ui.screens.place.detail.section
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

/**
 * Place's address-first screen with a city kept on this phone (TABCARD §4b): that city's Today, read once and shared
 * with the Today tab ([TodayAreaStore]). Null until it comes, when it fails, and without a city.
 */
@HiltViewModel
class PlaceAreaSunViewModel
    @Inject
    constructor(
        private val areas: TodayAreaStore,
    ) : ViewModel() {
        private val _answer = MutableStateFlow<TodayAreaAnswer?>(null)
        val answer: StateFlow<TodayAreaAnswer?> = _answer.asStateFlow()
        private var job: Job? = null

        init {
            // A city kept or moved on Today meanwhile: its own Sun card.
            viewModelScope.launch { areas.revision.drop(1).collect { load() } }
        }

        fun load() {
            val area = areas.area()
            if (area == null) {
                job?.cancel()
                _answer.value = null
                return
            }
            if (_answer.value?.area?.samePoint(area) != true) _answer.value = areas.keptToday(area)
            job?.cancel()
            job =
                viewModelScope.launch {
                    val result = areas.today(area)
                    if (areas.area()?.samePoint(area) == true && result is NetworkResult.Success) _answer.value = result.data
                }
        }
    }

/**
 * In place of the example card on the Place tab's first-run root: "RIGHT NOW IN VANCOUVER" (the area's city, or its
 * name, in capitals) over the Sun card from the city's Today. Until that answer comes, when it fails, or without a city
 * kept, [example] stays.
 */
@Composable
fun PlaceAreaSunCard(
    modifier: Modifier = Modifier,
    viewModel: PlaceAreaSunViewModel = hiltViewModel(),
    example: @Composable () -> Unit,
) {
    val answer by viewModel.answer.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    val today = answer?.today
    val sun = today?.section(PlaceSectionId.SUNRISE_SUNSET)?.sunriseSunset
    if (today == null || sun == null) {
        example()
        return
    }
    val place = answer?.area?.city ?: today.place.city.ifBlank { null } ?: answer?.area?.label ?: today.place.label
    val weather = today.section(PlaceSectionId.WEATHER)?.takeIf { it.isLive() }?.weather?.conditionCode
    Box(modifier = modifier.testTag("place.firstRun.sunCard")) {
        TodaySunArcCard(
            sun,
            timeZone = today.homeZone ?: ZoneId.systemDefault(),
            weather = weather,
            overline = "RIGHT NOW IN ${place.uppercase()}",
        )
    }
}
