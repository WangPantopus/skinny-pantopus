package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.geo.GeoResolveRequest
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.data.api.models.geo.NormalizedAddress
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.roundToLong

/**
 * Address suggestions under a street field. Typing asks `GET /api/geo/autocomplete` (debounced); picking one
 * resolves it with `POST /api/geo/resolve` so the form can fill its street, city, state and ZIP. The field itself
 * stays the screen's own, so every form keeps its look; [AddressSuggestionList] adds the list under it. A failed
 * lookup just shows no list: the field still takes a typed address.
 * Parity: iOS `AddressSuggestions` (Features/Shared/AddressSuggestions).
 *
 * Screens get one from [rememberAddressSuggestions], so no view-model has to change.
 */
class AddressSuggestions(
    private val geoApi: GeoApi,
    private val scope: CoroutineScope,
    private val streetOnly: Boolean = true,
) {
    private val _suggestions = MutableStateFlow<List<GeoSuggestion>>(emptyList())
    val suggestions: StateFlow<List<GeoSuggestion>> = _suggestions.asStateFlow()
    private val _resolving = MutableStateFlow(false)
    val resolving: StateFlow<Boolean> = _resolving.asStateFlow()

    /** Favor suggestions near this point (latitude to longitude), e.g. the person's own home. */
    var near: Pair<Double, Double>? = null

    private var searchJob: Job? = null

    /** The address a pick wrote into the field: an answer, not a new question. */
    private var pickedText: String? = null

    /** Call on every change of the street field's text. */
    fun onTextChanged(text: String) {
        searchJob?.cancel()
        val query = text.trim()
        if (query.length < MIN_QUERY || text == pickedText) {
            _suggestions.value = emptyList()
            return
        }
        pickedText = null
        searchJob =
            scope.launch {
                delay(DEBOUNCE_MS)
                val point = near
                val result =
                    safeApiCall {
                        geoApi.autocomplete(
                            query,
                            lat = point?.first?.roughly(),
                            lng = point?.second?.roughly(),
                            kind = if (streetOnly) "address" else null,
                        )
                    }
                if (!isActive) return@launch
                _suggestions.value = (result as? NetworkResult.Success)?.data?.suggestions.orEmpty()
            }
    }

    /** Resolves a picked suggestion into its parts; null when it can't be resolved, and the typed text stays. */
    suspend fun choose(suggestion: GeoSuggestion): NormalizedAddress? {
        if (_resolving.value || _suggestions.value.none { it.suggestionId == suggestion.suggestionId }) return null
        searchJob?.cancel()
        _resolving.value = true
        try {
            val result = safeApiCall { geoApi.resolve(GeoResolveRequest(suggestion.suggestionId)) }
            val normalized = (result as? NetworkResult.Success)?.data?.normalized ?: return null
            _suggestions.value = emptyList()
            pickedText = normalized.address
            return normalized
        } finally {
            _resolving.value = false
        }
    }

    /** Resolves [suggestion] on the screen's scope and hands the address to [onPicked]. */
    fun pick(
        suggestion: GeoSuggestion,
        onPicked: (NormalizedAddress) -> Unit,
    ) {
        scope.launch { choose(suggestion)?.let(onPicked) }
    }

    fun dismiss() {
        searchJob?.cancel()
        _suggestions.value = emptyList()
    }

    private companion object {
        const val MIN_QUERY = 4
        const val DEBOUNCE_MS = 250L

        /** About a kilometer: a bias needs no more, and the exact point stays on the phone. */
        fun Double.roughly(): Double = (this * 100).roundToLong() / 100.0
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
internal interface AddressSuggestionsEntryPoint {
    fun geoApi(): GeoApi

    fun homesRepository(): HomesRepository
}

/**
 * Suggestions for one street field, living as long as the screen. With [nearHomeId], suggestions near that home come
 * first (the stored My Homes has its point). Null in previews and snapshot tests, which have no app graph: the field
 * then works as a plain text field.
 */
@Composable
fun rememberAddressSuggestions(
    nearHomeId: String? = null,
    streetOnly: Boolean = true,
): AddressSuggestions? {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val graph =
        remember(context) {
            runCatching {
                EntryPointAccessors.fromApplication(context.applicationContext, AddressSuggestionsEntryPoint::class.java)
            }.getOrNull()
        }
    val suggestions = remember(graph, scope, streetOnly) { graph?.let { AddressSuggestions(it.geoApi(), scope, streetOnly) } }
    LaunchedEffect(suggestions, nearHomeId) {
        if (suggestions != null && nearHomeId != null) {
            val homes = runCatching { graph?.homesRepository()?.myHomesStored()?.data?.homes }.getOrNull()
            suggestions.near = homes?.firstOrNull { it.id == nearHomeId }?.location?.let { it.latitude to it.longitude }
        }
    }
    return suggestions
}

/**
 * The suggestions under a street field; a tapped one is resolved and handed to [onPicked]. Results under a text box
 * take a first tap to put the keyboard away (KeyboardRules).
 */
@Composable
fun AddressSuggestionList(
    suggestions: AddressSuggestions?,
    testTagPrefix: String,
    modifier: Modifier = Modifier,
    onPicked: (NormalizedAddress) -> Unit,
) {
    if (suggestions == null) return
    val items by suggestions.suggestions.collectAsStateWithLifecycle()
    val resolving by suggestions.resolving.collectAsStateWithLifecycle()
    if (items.isEmpty()) return
    val shape = RoundedCornerShape(Radii.md)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .firstTapClosesKeyboard(),
    ) {
        items.forEachIndexed { index, suggestion ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle)
            val description = listOfNotNull(suggestion.primaryText, suggestion.secondaryText).joinToString(", ")
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clickable(enabled = !resolving) { suggestions.pick(suggestion, onPicked) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .semantics(mergeDescendants = true) { contentDescription = description }
                        .testTag("$testTagPrefix.$index"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(32.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.MapPin,
                        contentDescription = null,
                        size = 15.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        suggestion.primaryText,
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextStrong,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    suggestion.secondaryText?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            it,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
        }
    }
}
