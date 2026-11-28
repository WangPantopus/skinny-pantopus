@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import android.content.Context
import android.location.Address
import android.location.Geocoder
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.ReinventedListItemDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.LivingConstellationsDto
import app.pantopus.android.data.living.LivingFollowedPlaceDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.ui.components.sheetKeyboardRules
import app.pantopus.android.ui.screens.feed.reinvented.MomentPicture
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.util.Locale
import javax.inject.Inject
import kotlin.coroutines.resume

/*
 * "Pulse, reinvented" phase 4, places you follow and curiosity constellations (PHASE-4 piece 4; CONTRACT 9c), as the
 * iPhone's (`ReinventedPlacesYouFollow.swift`, `ReinventedConstellations.swift`) and the web's.
 *
 * - Places you follow, at the top of Explore: up to five far places (a hometown, Kyoto) whose Explore items come into
 *   Explore. They are the person's own choice and private: nobody is ever told or shown what someone follows. A place is
 *   found with the phone's own place search (the geocoder) and sent as its name and point; the server rounds the point.
 *   Explore's first page then brings "From <place>, a place you follow" items, shown here as a row of cards.
 * - Constellations, "Near you" in My Atlas while nothing is searched: within five miles of the phone, the Retakes people
 *   keep adding to, the skies several caught, the field specimens named, and the questions people answered. The phone's
 *   place goes only in the POST body and is never kept; with no place, nothing is asked and nothing shows.
 */

data class LivingPlacesState(
    val places: List<LivingFollowedPlaceDto> = emptyList(),
    val error: String? = null,
    val saving: Boolean = false,
)

@HiltViewModel
class LivingPlacesViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingPlacesState())
        val state: StateFlow<LivingPlacesState> = _state.asStateFlow()

        fun load() {
            viewModelScope.launch {
                val answer = repository.places() as? NetworkResult.Success ?: return@launch
                _state.update { it.copy(places = answer.data) }
            }
        }

        /** Follows a place; [then] runs when it went through (Explore reads again). */
        fun follow(
            label: String,
            latitude: Double,
            longitude: Double,
            then: () -> Unit,
        ) {
            if (_state.value.saving) return
            _state.update { it.copy(saving = true, error = null) }
            viewModelScope.launch {
                when (val answer = repository.follow(label, latitude, longitude)) {
                    is NetworkResult.Success -> {
                        val places = (repository.places() as? NetworkResult.Success)?.data ?: _state.value.places
                        _state.update { it.copy(places = places, saving = false) }
                        then()
                    }
                    is NetworkResult.Failure -> {
                        val words =
                            when (answer.error.code) {
                                HTTP_CONFLICT -> "You follow five places. Stop following one to add another."
                                HTTP_BAD_REQUEST -> "That place couldn't be followed. Pick it from the list."
                                else -> "That didn't save. Try again."
                            }
                        _state.update { it.copy(saving = false, error = words) }
                    }
                }
            }
        }

        fun unfollow(
            place: LivingFollowedPlaceDto,
            then: () -> Unit,
        ) {
            viewModelScope.launch {
                when (repository.unfollow(place.id)) {
                    is NetworkResult.Success -> {
                        _state.update { now -> now.copy(places = now.places.filterNot { it.id == place.id }, error = null) }
                        then()
                    }
                    is NetworkResult.Failure -> _state.update { it.copy(error = "That didn't save. Try again.") }
                }
            }
        }

        companion object {
            const val MOST = 5
            private const val HTTP_BAD_REQUEST = 400
            private const val HTTP_CONFLICT = 409
        }
    }

private const val FOLLOW_NOTE =
    "Follow a hometown or a far place, and what people there share with everyone comes into Explore. Nobody sees what you follow."

/**
 * At the top of Explore: the places followed, "Follow a place", and what came from them ([followed], Explore's first
 * page). Explore reads again after a follow or an unfollow ([onRefresh]), so its items come and go.
 */
@Composable
internal fun LivingFollowedPlaces(
    followed: List<ReinventedListItemDto>,
    onRefresh: () -> Unit,
    onOpenMoment: (MomentDto) -> Unit,
    viewModel: LivingPlacesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var finding by remember { mutableStateOf(false) }
    LaunchedEffect(viewModel) { viewModel.load() }
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s2).testTag("reinventedPlaces"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            "Places you follow",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            state.places.forEach { place -> PlaceChip(place) { viewModel.unfollow(place, onRefresh) } }
            if (state.places.size < LivingPlacesViewModel.MOST) FollowButton(enabled = !state.saving) { finding = true }
        }
        if (state.places.isEmpty()) Text(FOLLOW_NOTE, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        state.error?.let { Text(it, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.error) }
        if (followed.isNotEmpty()) {
            Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                followed.forEach { entry -> FollowedCard(entry, onOpenMoment) }
            }
        }
    }
    if (finding) {
        LivingPlaceFinder(
            onPick = { place ->
                finding = false
                viewModel.follow(place.label, place.latitude, place.longitude, onRefresh)
            },
            onDismiss = { finding = false },
        )
    }
}

/** A place the phone's own place search found: its name, where it is, and its point. */
internal data class LivingFoundPlace(
    val label: String,
    val line: String,
    val latitude: Double,
    val longitude: Double,
)

/**
 * The phone's own place search (Android's geocoder: on the phone, no key, no new service), as the iPhone's MapKit search:
 * type a town, pick it, follow it. Far places too ("Kyoto"), which today's venue picker doesn't search.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LivingPlaceFinder(
    onPick: (LivingFoundPlace) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    var text by remember { mutableStateOf("") }
    var found by remember { mutableStateOf<List<LivingFoundPlace>>(emptyList()) }
    LaunchedEffect(text) {
        val words = text.trim()
        if (words.length < 2) {
            found = emptyList()
            return@LaunchedEffect
        }
        delay(FIND_WAIT_MS)
        found = findPlaces(context, words)
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.sheetKeyboardRules().testTag("reinventedPlaces.finder"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s5).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Follow a place", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            val shape = RoundedCornerShape(Radii.lg)
            BasicTextField(
                value = text,
                onValueChange = { text = it.take(MAX_FIND) },
                singleLine = true,
                textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
                cursorBrush = SolidColor(PantopusColors.appText),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth().testTag("reinventedPlaces.finder.field"),
                decorationBox = { inner ->
                    Box(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .background(PantopusColors.appSurface, shape)
                                .border(1.dp, PantopusColors.appBorder, shape)
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s3),
                    ) {
                        if (text.isEmpty()) Text("A town or a place", fontSize = 15.sp, color = PantopusColors.appTextSecondary)
                        inner()
                    }
                },
            )
            found.forEach { place ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable(role = Role.Button) { onPick(place) }
                            .padding(vertical = Spacing.s2)
                            .semantics(mergeDescendants = true) {},
                ) {
                    Text(place.label, fontSize = 15.sp, color = PantopusColors.appText)
                    if (place.line.isNotEmpty()) Text(place.line, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
                }
            }
        }
    }
}

private const val FIND_WAIT_MS = 400L
private const val MAX_FIND = 60
private const val MOST_FOUND = 6

/** Up to six places for [words] from the phone's own geocoder; none where the phone has no geocoder. */
private suspend fun findPlaces(
    context: Context,
    words: String,
): List<LivingFoundPlace> =
    withContext(Dispatchers.IO) {
        if (!Geocoder.isPresent()) return@withContext emptyList()
        val geocoder = Geocoder(context, Locale.getDefault())
        val addresses: List<Address> =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                suspendCancellableCoroutine { done ->
                    geocoder.getFromLocationName(
                        words,
                        MOST_FOUND,
                        object : Geocoder.GeocodeListener {
                            override fun onGeocode(found: MutableList<Address>) = done.resume(found)

                            override fun onError(errorMessage: String?) = done.resume(emptyList())
                        },
                    )
                }
            } else {
                @Suppress("DEPRECATION")
                runCatching { geocoder.getFromLocationName(words, MOST_FOUND) }.getOrNull().orEmpty()
            }
        addresses.filter { it.hasLatitude() && it.hasLongitude() }.map { address ->
            val label = address.locality ?: address.featureName ?: words
            LivingFoundPlace(
                label = label.take(MAX_FIND),
                line = listOfNotNull(address.adminArea, address.countryName).filter { it != label }.joinToString(", "),
                latitude = address.latitude,
                longitude = address.longitude,
            )
        }.distinctBy { it.label + it.line }
    }

@Composable
private fun PlaceChip(
    place: LivingFollowedPlaceDto,
    onUnfollow: () -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Row(
        modifier =
            Modifier
                .height(32.dp)
                .background(PantopusColors.appSurface, shape)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(start = 10.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 13.dp, tint = PantopusColors.primary600)
        Text(place.label, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText, maxLines = 1)
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(28.dp)
                    .clickable(role = Role.Button, onClick = onUnfollow)
                    .semantics { contentDescription = "Stop following ${place.label}" }
                    .testTag("reinventedPlaces.unfollow.${place.id}"),
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun FollowButton(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .height(32.dp)
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.primary600)
                .clickable(role = Role.Button, enabled = enabled, onClick = onClick)
                .padding(horizontal = 12.dp)
                .testTag("reinventedPlaces.follow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 13.dp, tint = Color.White)
        Text("Follow a place", fontSize = 13.5.sp, fontWeight = FontWeight.Bold, color = Color.White)
    }
}

/** One Explore item from a followed place: a Moment's picture or a post's words, and "From Kyoto, a place you follow". */
@Composable
private fun FollowedCard(
    entry: ReinventedListItemDto,
    onOpenMoment: (MomentDto) -> Unit,
) {
    val shape = RoundedCornerShape(10.dp)
    val moment = entry.moment
    val post = entry.post
    Column(
        modifier =
            Modifier
                .width(128.dp)
                .clickable(role = Role.Button) {
                    when {
                        moment != null -> onOpenMoment(moment)
                        post != null -> DeepLinkRouter.handle("/posts/${post.id}")
                    }
                }.testTag("reinventedPlaces.item.${entry.id}"),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (moment != null) {
            MomentPicture(moment, Modifier.width(128.dp).height(150.dp).clip(shape))
        } else {
            Text(
                post?.title?.takeIf { it.isNotBlank() } ?: post?.content.orEmpty(),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 5,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.width(128.dp).height(150.dp).background(PantopusColors.appSurface, shape).padding(10.dp),
            )
        }
        entry.why?.let { Text(it, fontSize = 12.sp, color = PantopusColors.appTextSecondary, maxLines = 2) }
    }
}

// Constellations

@HiltViewModel
class LivingConstellationsViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
        private val location: LocationProvider,
    ) : ViewModel() {
        private val _found = MutableStateFlow<LivingConstellationsDto?>(null)
        val found: StateFlow<LivingConstellationsDto?> = _found.asStateFlow()
        private var read = false

        /** Once per screen: with no place on the phone, nothing is asked. */
        fun load() {
            if (read) return
            read = true
            viewModelScope.launch {
                val here = location.cachedCoordinate() ?: location.requestCurrent() ?: return@launch
                val answer = repository.constellations(here.latitude, here.longitude) as? NetworkResult.Success ?: return@launch
                _found.value = answer.data
            }
        }
    }

/** "Near you" in My Atlas: nothing while it loads, with no place, or with nothing near. */
@Composable
internal fun LivingConstellations(viewModel: LivingConstellationsViewModel = hiltViewModel()) {
    val found by viewModel.found.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.load() }
    val near = found?.takeUnless { it.isEmpty } ?: return
    Column(modifier = Modifier.testTag("reinventedAtlas.constellations"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            "Near you",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            near.retakes.forEach { retake ->
                Star(PantopusIcon.Camera, retake.title ?: "A Retake", count(retake.frames, "frame")) {
                    DeepLinkRouter.handle("/moments/${retake.id}")
                }
            }
            near.skies.forEach { sky ->
                val title = sky.title ?: sky.kind?.replaceFirstChar { it.uppercase() } ?: "A sky"
                Star(PantopusIcon.Sun, title, count(sky.pieces, "piece"), open = null)
            }
            near.specimens.forEach { specimen ->
                Star(PantopusIcon.Leaf, specimen.names.take(2).joinToString(", "), "Named nearby") {
                    DeepLinkRouter.handle(if (specimen.type == "post") "/posts/${specimen.id}" else "/moments/${specimen.id}")
                }
            }
            near.answers.forEach { answer ->
                Star(PantopusIcon.MessageCircle, answer.question ?: "A question", count(answer.answers, "answer")) {
                    DeepLinkRouter.handle("/posts/${answer.id}")
                }
            }
        }
    }
}

private fun count(
    value: Int?,
    word: String,
): String = value?.let { "$it $word" + if (it == 1) "" else "s" }.orEmpty()

@Composable
private fun Star(
    icon: PantopusIcon,
    title: String,
    line: String,
    open: (() -> Unit)?,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .width(150.dp)
                .height(96.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .clickable(role = Role.Button, enabled = open != null) { open?.invoke() }
                .padding(10.dp)
                .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
        Text(
            title,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        if (line.isNotEmpty()) Text(line, fontSize = 12.sp, color = PantopusColors.appTextSecondary)
    }
}
