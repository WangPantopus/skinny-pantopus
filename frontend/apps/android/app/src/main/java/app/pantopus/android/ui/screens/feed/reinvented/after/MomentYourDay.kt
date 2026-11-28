package app.pantopus.android.ui.screens.feed.reinvented.after

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.CreateMomentBody
import app.pantopus.android.data.api.models.moments.MomentLocationBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.moments.MomentMedia
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentsPosting
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.screens.compose.placepicker.MediaLocationExtractor
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.Dash
import com.google.android.gms.maps.model.Gap
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.maps.android.compose.CameraPositionState
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.MarkerComposable
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.Polyline
import com.squareup.moshi.Moshi
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import java.util.UUID
import javax.inject.Inject

/*
 * "Your day" at 8 pm ("Pulse, reinvented" phase 3, PHASE-3 piece 10; board B12; CONTRACT 8k; iPhone's
 * `MomentYourDay.swift`): the photos the person took that day, laid along their path, for one tap to approve, change or
 * skip. On Android the app never looks through the photo library (it holds no photo permission): the card asks the
 * person to pick today's photos with the system's picker (LEAD-6, 02:07). Each picked photo's place and time are read
 * from the file, as a library pick is today; a photo with no place in it, or not from today, is set aside with words and
 * never guessed. Everything before Share stays on the phone: the path is drawn for the person alone and never sent.
 * Share posts each chosen photo, oldest first, as an ordinary Moment with today's posting and `your_day: { date, id }`;
 * the server keeps them as posts that stay. From 8 pm to midnight by the phone's clock, on Around me, while the switch
 * is on. "Not today" puts it away until tomorrow evening, per account, on the phone.
 */

/** One picked photo: its copy in the app's folder, and where and when the file says it was taken. */
data class YourDayPhoto(
    val file: File,
    val latitude: Double,
    val longitude: Double,
    val at: Instant,
    val chosen: Boolean = true,
)

data class YourDayUi(
    val photos: List<YourDayPhoto> = emptyList(),
    /** Words for the photos left out when picked (no place in them, or not from today). */
    val setAside: String? = null,
    val reading: Boolean = false,
    val editing: Boolean = false,
    /** `connections` (Friends) or `nearby` (People nearby). */
    val audience: String = "connections",
    val sharing: String? = null,
    val done: String? = null,
    val problem: String? = null,
    val away: Boolean = false,
)

@HiltViewModel
class MomentYourDayViewModel
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val repository: TogetherRepository,
        private val posting: MomentsPosting,
        private val moshi: Moshi,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(YourDayUi())
        val ui: StateFlow<YourDayUi> = _ui.asStateFlow()

        /** The day's id: the same for every photo shared from this card today. */
        private val dayId = UUID.randomUUID().toString()

        private val prefs get() = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        /** Whether [account] put today's card away ("Not today"). */
        fun readAway(account: String) {
            _ui.update { it.copy(away = prefs.getString("$AWAY_KEY$account", null) == LocalDate.now().toString()) }
        }

        fun notToday(account: String) {
            prefs.edit().putString("$AWAY_KEY$account", LocalDate.now().toString()).apply()
            _ui.value = YourDayUi(away = true)
        }

        /** Reads each picked photo's place and time from the file (on the phone only). */
        fun picked(uris: List<Uri>) {
            if (uris.isEmpty()) return
            _ui.update { it.copy(reading = true, problem = null, done = null) }
            viewModelScope.launch {
                val today = LocalDate.now()
                val zone = ZoneId.systemDefault()
                var noPlace = 0
                var notToday = 0
                val photos = mutableListOf<YourDayPhoto>()
                for (uri in uris.take(MOST)) {
                    val copy = MomentMedia.copyIn(context, uri, "jpg") ?: continue
                    val found = runCatching { MediaLocationExtractor.fromImageBytes(copy.readBytes()) }.getOrNull()
                    val at = found?.capturedAt
                    when {
                        found == null -> noPlace++
                        at == null || at.atZone(zone).toLocalDate() != today -> notToday++
                        else -> photos += YourDayPhoto(copy, found.latitude, found.longitude, at)
                    }
                }
                _ui.update {
                    it.copy(
                        photos = (it.photos + photos).distinctBy { p -> p.at to (p.latitude to p.longitude) }.sortedBy { p -> p.at },
                        setAside = asideWords(noPlace, notToday),
                        reading = false,
                    )
                }
            }
        }

        fun toggle(index: Int) =
            _ui.update { ui -> ui.copy(photos = ui.photos.mapIndexed { i, p -> if (i == index) p.copy(chosen = !p.chosen) else p }) }

        fun edit(on: Boolean) = _ui.update { it.copy(editing = on) }

        fun audience(audience: String) = _ui.update { it.copy(audience = audience) }

        /** Posts each chosen photo, oldest first; a refused one stays on the card, left out, with the server's words. */
        fun share() {
            val start = _ui.value
            val chosen = start.photos.filter { it.chosen }
            if (chosen.isEmpty() || start.sharing != null) return
            viewModelScope.launch {
                val refused = mutableListOf<YourDayPhoto>()
                var why: String? = null
                chosen.forEachIndexed { at, photo ->
                    _ui.update { it.copy(sharing = "Sharing ${at + 1} of ${chosen.size}…", problem = null) }
                    val failed = post(photo, start.audience)
                    if (failed != null) {
                        refused += photo
                        why = why ?: failed
                    }
                }
                val shared = chosen.size - refused.size
                val to = if (start.audience == "nearby") "people nearby" else "Friends"
                _ui.update { ui ->
                    if (refused.isEmpty()) {
                        YourDayUi(done = "Shared ${photoCount(shared)} with $to. They stay in your Atlas.")
                    } else {
                        val rest = if (shared > 0) " The other ${if (shared == 1) "one was" else "$shared were"} shared." else ""
                        ui.copy(
                            photos = refused.map { it.copy(chosen = false) },
                            sharing = null,
                            problem = "${photoCount(refused.size)} couldn’t be shared: $why$rest",
                        )
                    }
                }
            }
        }

        /** One ordinary Moment, made as today's composer makes a library pick, then today's upload; null when it posted. */
        private suspend fun post(
            photo: YourDayPhoto,
            audience: String,
        ): String? {
            val ready = runCatching { MomentMedia.preparePhoto(context, photo.file) }.getOrNull() ?: return "Couldn’t read that photo."
            val body =
                CreateMomentBody(
                    kind = "photo",
                    hours = HOURS,
                    audience = audience,
                    showArea = false,
                    location =
                        MomentLocationBody(
                            source = "capture",
                            latitude = photo.latitude,
                            longitude = photo.longitude,
                            takenAt = photo.at.toString(),
                        ),
                    clientRequestId = UUID.randomUUID().toString(),
                )

            @Suppress("UNCHECKED_CAST")
            val base = moshi.adapter(CreateMomentBody::class.java).toJsonValue(body) as? Map<String, Any?> ?: return FAILED
            // The path never goes: only the day and its id (CONTRACT 8k).
            val day = mapOf("date" to photo.at.atZone(ZoneId.systemDefault()).toLocalDate().toString(), "id" to dayId)
            return when (val made = repository.createMoment(base.filterValues { it != null } + ("your_day" to day))) {
                is NetworkResult.Success -> {
                    posting.start(made.data, MomentMediaFile.Photo(ready), photo.latitude, photo.longitude)
                    null
                }
                is NetworkResult.Failure -> made.error.displayMessage(FAILED)
            }
        }

        private fun asideWords(
            noPlace: Int,
            notToday: Int,
        ): String? {
            val parts =
                listOfNotNull(
                    "${photoCount(noPlace)} with no place in ${if (noPlace == 1) "it" else "them"}".takeIf { noPlace > 0 },
                    "${photoCount(notToday)} not from today".takeIf { notToday > 0 },
                )
            return if (parts.isEmpty()) null else "Left out: ${parts.joinToString(" and ")}. Nothing is guessed."
        }

        private companion object {
            const val PREFS = "pulse_your_day"
            const val AWAY_KEY = "away."
            const val MOST = 12
            const val HOURS = 24
            const val FAILED = "Couldn’t share it. Try again."
        }
    }

private fun photoCount(n: Int): String = "$n ${if (n == 1) "photo" else "photos"}"

/** From 8 pm to midnight by the phone's own clock. */
internal fun yourDayEvening(now: LocalTime = LocalTime.now()): Boolean = now.hour >= EVENING_HOUR

/** At the top of Around me in the evening: "Your Friday · Only you see this", the picked photos along their path. */
@Composable
fun MomentYourDayCard(
    account: String?,
    viewModel: MomentYourDayViewModel = hiltViewModel(),
) {
    if (account == null || !yourDayEvening()) return
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(account) { viewModel.readAway(account) }
    if (ui.away) return
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { viewModel.picked(it) }
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(Spacing.s3)
                .testTag("reinventedPulse.yourDay"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val weekday = LocalDate.now().dayOfWeek.getDisplayName(TextStyle.FULL, Locale.US)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                "Your $weekday",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text("Only you see this", fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
        }
        ui.done?.let {
            DayNote(it, "reinventedPulse.yourDay.done")
            return@Column
        }
        val photos = ui.photos
        DayNote(
            if (photos.isEmpty()) {
                "Pick today’s photos to lay them along your path. Nothing is shared until you say so."
            } else {
                "${photoCount(photos.size)} you took today, along your path. Nothing is shared until you say so."
            },
            "reinventedPulse.yourDay.line",
        )
        if (photos.isNotEmpty()) {
            DayMap(photos)
            DayPhotos(photos, editing = ui.editing, onToggle = viewModel::toggle)
        }
        ui.setAside?.let { DayNote(it, "reinventedPulse.yourDay.aside") }
        ui.problem?.let {
            Text(it, fontSize = 13.5.sp, color = PantopusColors.error, modifier = Modifier.testTag("reinventedPulse.yourDay.problem"))
        }
        if (ui.editing) AudienceRow(ui.audience, viewModel::audience)
        DayActions(ui, onPick = { pick.launch(arrayOf("image/*")) }, viewModel = viewModel, account = account)
    }
}

@Composable
private fun DayActions(
    ui: YourDayUi,
    onPick: () -> Unit,
    viewModel: MomentYourDayViewModel,
    account: String,
) {
    val busy = ui.sharing != null || ui.reading
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            ui.sharing != null -> DayNote(ui.sharing, "reinventedPulse.yourDay.sharing")
            ui.photos.isEmpty() -> {
                val title = if (ui.reading) "Reading…" else "Pick today’s photos"
                DayButton(title, primary = true, enabled = !busy, tag = "pick", onClick = onPick)
            }
            else -> {
                val to = if (ui.audience == "nearby") "People nearby" else "Friends"
                val any = ui.photos.any { it.chosen }
                DayButton("Share with $to", primary = true, enabled = any && !busy, tag = "share", onClick = viewModel::share)
                DayButton(if (ui.editing) "Done" else "Edit", primary = false, enabled = !busy, tag = "edit") {
                    viewModel.edit(!ui.editing)
                }
                DayButton("Add photos", primary = false, enabled = !busy, tag = "add", onClick = onPick)
            }
        }
        DayButton("Not today", primary = false, enabled = !busy, tag = "notToday") { viewModel.notToday(account) }
    }
}

/** The day's places on a small map, numbered in time order, with a dotted line between them: drawn on the phone only. */
@Composable
private fun DayMap(photos: List<YourDayPhoto>) {
    val points = photos.map { LatLng(it.latitude, it.longitude) }
    val camera = remember(points) { CameraPositionState(CameraPosition.fromLatLngZoom(points.first(), DEFAULT_ZOOM)) }
    Box(Modifier.fillMaxWidth().height(MAP_HEIGHT.dp).clip(RoundedCornerShape(Radii.md)).testTag("reinventedPulse.yourDay.map")) {
        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = camera,
            uiSettings = DAY_MAP_SETTINGS,
            onMapLoaded = {
                if (points.size > 1) {
                    val bounds = LatLngBounds.builder().apply { points.forEach(::include) }.build()
                    camera.move(com.google.android.gms.maps.CameraUpdateFactory.newLatLngBounds(bounds, MAP_PADDING))
                }
            },
        ) {
            val shown = photos.mapIndexedNotNull { i, p -> if (p.chosen) i to LatLng(p.latitude, p.longitude) else null }
            if (shown.size > 1) {
                Polyline(points = shown.map { it.second }, color = PantopusColors.primary600, width = LINE_WIDTH, pattern = DOTTED)
            }
            photos.forEachIndexed { i, p ->
                MarkerComposable(
                    keys = arrayOf<Any>(i, p.chosen),
                    state = remember(p) { MarkerState(position = LatLng(p.latitude, p.longitude)) },
                    anchor = PIN_CENTER,
                ) {
                    Box(
                        Modifier.size(PIN.dp).clip(CircleShape).background(if (p.chosen) PantopusColors.primary600 else Color.Gray),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("${i + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/** The photos with their times; in Edit a tap leaves one out or takes it back. */
@Composable
private fun DayPhotos(
    photos: List<YourDayPhoto>,
    editing: Boolean,
    onToggle: (Int) -> Unit,
) {
    val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).testTag("reinventedPulse.yourDay.photos"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        photos.forEachIndexed { i, p ->
            val label = "${i + 1} · ${p.at.atZone(ZoneId.systemDefault()).format(clock)}"
            Column(
                modifier =
                    Modifier
                        .width(THUMB.dp)
                        .clickable(enabled = editing, role = Role.Checkbox) { onToggle(i) }
                        .testTag("reinventedPulse.yourDay.photo.$i")
                        .semantics(mergeDescendants = true) {
                            contentDescription = if (p.chosen) label else "$label, left out"
                            selected = p.chosen
                        },
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                AsyncImage(
                    model = p.file,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(THUMB.dp).clip(RoundedCornerShape(Radii.md)).alpha(if (p.chosen) 1f else LEFT_OUT_ALPHA),
                )
                Text(
                    if (p.chosen) label else "Left out",
                    fontSize = 12.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

/** Friends | People nearby. */
@Composable
private fun AudienceRow(
    audience: String,
    onPick: (String) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        listOf("connections" to "Friends", "nearby" to "People nearby").forEach { (key, title) ->
            DayButton(title, primary = audience == key, enabled = true, tag = "audience.$key") { onPick(key) }
        }
    }
}

@Composable
private fun DayButton(
    title: String,
    primary: Boolean,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(percent = 50)
    Box(
        modifier =
            Modifier
                .heightIn(min = 40.dp)
                .alpha(if (enabled) 1f else DISABLED_ALPHA)
                .clip(shape)
                .background(if (primary) PantopusColors.primary600 else Color.Transparent)
                .border(1.dp, if (primary) PantopusColors.primary600 else PantopusColors.appBorder, shape)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = 16.dp)
                .testTag("reinventedPulse.yourDay.$tag"),
        contentAlignment = Alignment.Center,
    ) {
        Text(title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (primary) Color.White else PantopusColors.appText)
    }
}

@Composable
private fun DayNote(
    words: String,
    tag: String,
) {
    Text(words, fontSize = 13.5.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.testTag(tag))
}

/** The day's map only shows: it takes no gesture, so the list scrolls over it. */
private val DAY_MAP_SETTINGS =
    MapUiSettings(
        zoomControlsEnabled = false,
        scrollGesturesEnabled = false,
        zoomGesturesEnabled = false,
        rotationGesturesEnabled = false,
        tiltGesturesEnabled = false,
        mapToolbarEnabled = false,
    )
private val DOTTED = listOf(Dash(18f), Gap(12f))

/** A numbered pin sits centred on its place. */
private val PIN_CENTER = Offset(0.5f, 0.5f)
private const val LINE_WIDTH = 6f
private const val EVENING_HOUR = 20
private const val DEFAULT_ZOOM = 14f
private const val MAP_HEIGHT = 150
private const val MAP_PADDING = 48
private const val PIN = 24
private const val THUMB = 84
private const val LEFT_OUT_ALPHA = 0.35f
private const val DISABLED_ALPHA = 0.5f
