@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.living.LivingCabinetDto
import app.pantopus.android.data.living.LivingPosterDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.ui.screens.feed.reinvented.MomentPicture
import app.pantopus.android.ui.screens.place.detail.shareFolder
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.NumberFormat
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject

/*
 * "Pulse, reinvented" phase 4, the cabinet profile and the yearly poster (PHASE-4 piece 5; CONTRACT 9d; board B8), as the
 * iPhone's (`ReinventedCabinet.swift`) and the web's: in My Atlas, the person's own shelves of what they did (places
 * stood, the highest height they showed, field specimens, questions helped, strands sparked, canvases added to). No
 * follower count and no view count, anywhere. "Show my cabinet to people I know" is their own choice. The yearly poster
 * puts the year's numbers and one kept Moment a month (private to them) into a picture made on the phone; nothing of it
 * is shared by the server, and the phone's share sheet is the only way it leaves.
 */

/** One shelf: its icon, its number and its words; only numbers there are. */
internal data class LivingShelf(
    val icon: PantopusIcon,
    val big: String,
    val words: String,
)

internal val LivingCabinetDto.shelves: List<LivingShelf>
    get() {
        val number = NumberFormat.getIntegerInstance()

        fun count(
            value: Int,
            one: String,
            many: String,
            icon: PantopusIcon,
        ) = if (value > 0) LivingShelf(icon, number.format(value), if (value == 1) one else many) else null
        return listOfNotNull(
            count(placesStood, "place stood", "places stood", PantopusIcon.MapPin),
            highestFt?.let { LivingShelf(PantopusIcon.Mountain, "${number.format(it)} ft", "highest shown") },
            count(specimens, "field specimen", "field specimens", PantopusIcon.Leaf),
            count(questionsHelped, "question helped", "questions helped", PantopusIcon.MessageCircle),
            count(strandsSparked, "strand sparked", "strands sparked", PantopusIcon.Sparkles),
            count(canvases, "canvas added to", "canvases added to", PantopusIcon.Image),
        )
    }

data class LivingCabinetState(
    val cabinet: LivingCabinetDto? = null,
    val saving: Boolean = false,
    val poster: LivingPosterDto? = null,
    val posterFailed: Boolean = false,
)

@HiltViewModel
class LivingCabinetViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
        private val auth: AuthRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingCabinetState())
        val state: StateFlow<LivingCabinetState> = _state.asStateFlow()

        fun load() {
            val me = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id ?: return
            viewModelScope.launch {
                val answer = repository.cabinet(me) as? NetworkResult.Success ?: return@launch
                _state.update { it.copy(cabinet = answer.data) }
            }
        }

        fun show(on: Boolean) {
            if (_state.value.saving) return
            _state.update { it.copy(saving = true) }
            viewModelScope.launch {
                repository.showCabinet(on)
                load()
                _state.update { it.copy(saving = false) }
            }
        }

        fun readPoster(year: Int) {
            _state.update { it.copy(poster = null, posterFailed = false) }
            viewModelScope.launch {
                when (val answer = repository.poster(year)) {
                    is NetworkResult.Success -> _state.update { it.copy(poster = answer.data) }
                    is NetworkResult.Failure -> _state.update { it.copy(posterFailed = true) }
                }
            }
        }
    }

/** The year in Pacific time, as the server counts it. */
internal fun livingYear(): Int = LocalDate.now(ZoneId.of("America/Los_Angeles")).year

/** "Your cabinet" in My Atlas, while nothing is searched. */
@Composable
internal fun LivingCabinet(viewModel: LivingCabinetViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var poster by remember { mutableStateOf(false) }
    LaunchedEffect(viewModel) { viewModel.load() }
    val cabinet = state.cabinet ?: return
    val year = livingYear()
    Column(modifier = Modifier.fillMaxWidth().testTag("reinventedCabinet"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                "Your cabinet",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            since(cabinet.since)?.let { Text(it, fontSize = 12.sp, color = PantopusColors.appTextSecondary) }
            Box(Modifier.weight(1f))
            TextButton(
                onClick = {
                    poster = true
                    viewModel.readPoster(year)
                },
                modifier = Modifier.testTag("reinventedCabinet.poster"),
            ) { Text("Make my $year poster", fontSize = 13.sp, fontWeight = FontWeight.Bold) }
        }
        val shelves = cabinet.shelves
        if (shelves.isEmpty()) {
            Text(
                "Nothing on the shelves yet. Moments, answers and Retakes fill them.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        } else {
            shelves.chunked(2).forEach { pair ->
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    pair.forEach { Shelf(it, Modifier.weight(1f)) }
                    if (pair.size == 1) Box(Modifier.weight(1f))
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Show my cabinet to people I know", fontSize = 14.sp, color = PantopusColors.appText, modifier = Modifier.weight(1f))
            Switch(
                checked = cabinet.shownTo == "people_you_know",
                onCheckedChange = viewModel::show,
                enabled = !state.saving,
                modifier = Modifier.testTag("reinventedCabinet.shown"),
            )
        }
    }
    if (poster) LivingPosterSheet(year, state) { poster = false }
}

private fun since(day: String?): String? {
    val date = day?.let { runCatching { LocalDate.parse(it.take(10)) }.getOrNull() } ?: return null
    return "since " + DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.getDefault()).format(date)
}

@Composable
private fun Shelf(
    shelf: LivingShelf,
    modifier: Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier
                .background(PantopusColors.appSurface, shape)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(10.dp)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = shelf.icon, contentDescription = null, size = 18.dp, tint = PantopusColors.primary600)
        Column {
            Text(shelf.big, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(shelf.words, fontSize = 12.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        }
    }
}

/** The poster's night-blue: the iPhone's and the web's gradient, from tokens. */
private val posterTop: Color get() = PantopusColors.momentFloatShadow
private val posterBottom: Color get() = PantopusColors.momentCardSkyBottom

/** The yearly poster: shown here, made into a picture on the phone, and handed to the share sheet if the person asks. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LivingPosterSheet(
    year: Int,
    state: LivingCabinetState,
    onClose: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("reinventedPoster"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Your $year", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            val poster = state.poster
            when {
                poster != null -> {
                    PosterArt(poster)
                    TextButton(
                        onClick = { scope.launch { sharePoster(context, poster) } },
                        modifier = Modifier.testTag("reinventedPoster.share"),
                    ) { Text("Save or share the picture", fontSize = 15.sp, fontWeight = FontWeight.Bold) }
                    Text(
                        "Made on this phone. Nothing is shared unless you share it.",
                        fontSize = 13.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                state.posterFailed -> Text("Your poster couldn't load. Try again later.", color = PantopusColors.appText)
                else -> CircularProgressIndicator(Modifier.padding(Spacing.s6))
            }
            TextButton(onClick = onClose, modifier = Modifier.testTag("reinventedPoster.close")) { Text("Close") }
        }
    }
}

/** The poster on the screen: the year, the numbers, and twelve months with their pictures. */
@Composable
private fun PosterArt(poster: LivingPosterDto) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Brush.verticalGradient(listOf(posterTop, posterBottom)))
                .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(poster.year.toString(), fontSize = 44.sp, fontWeight = FontWeight.Black, color = Color.White)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            poster.numbers.shelves.forEach {
                Text("${it.big} ${it.words}", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.92f))
            }
        }
        MONTH_ROWS.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                row.forEach { month ->
                    val moment = poster.months.firstOrNull { it.month == month }?.moment
                    Box(
                        modifier =
                            Modifier
                                .weight(1f)
                                .aspectRatio(0.75f)
                                .background(Color.White.copy(alpha = if (moment == null) 0.08f else 0.22f)),
                        contentAlignment = Alignment.BottomStart,
                    ) {
                        if (moment != null) MomentPicture(moment, Modifier.fillMaxSize())
                        Text(
                            monthName(month),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier =
                                Modifier
                                    .padding(4.dp)
                                    .background(Color.Black.copy(alpha = 0.55f), RoundedCornerShape(percent = 50))
                                    .padding(horizontal = 4.dp, vertical = 1.dp),
                        )
                    }
                }
            }
        }
        Text("Pantopus", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.White.copy(alpha = 0.7f))
    }
}

/** The twelve months in rows of four. */
private val MONTH_ROWS: List<List<Int>> = (1..12).chunked(4)

private fun monthName(month: Int): String = java.time.Month.of(month).getDisplayName(TextStyle.SHORT, Locale.getDefault())

/**
 * The shared picture, drawn on the phone: the year, its numbers and twelve months, each its colour and its name (a
 * month's picture is not drawn into it, as on the iPhone and the web). Then the share sheet.
 */
private suspend fun sharePoster(
    context: Context,
    poster: LivingPosterDto,
) {
    val file =
        withContext(Dispatchers.Default) {
            val bitmap = posterBitmap(poster)
            withContext(Dispatchers.IO) {
                File(shareFolder(context), "pantopus-${poster.year}.png").also { out ->
                    out.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                }
            }
        }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri(null, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    runCatching { context.startActivity(Intent.createChooser(send, null)) }
}

private fun posterBitmap(poster: LivingPosterDto): Bitmap {
    val width = 1080f
    val pad = 60f
    val gap = 12f
    val cell = (width - 2 * pad - 3 * gap) / 4
    val cellHeight = cell / 0.75f
    val shelves = poster.numbers.shelves
    val height = pad + 132f + 24f + shelves.size * 46f + 24f + 3 * cellHeight + 2 * gap + 24f + 40f + pad
    val bitmap = Bitmap.createBitmap(width.toInt(), height.toInt(), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    paint.shader = LinearGradient(0f, 0f, 0f, height, posterTop.toArgb(), posterBottom.toArgb(), Shader.TileMode.CLAMP)
    canvas.drawRect(0f, 0f, width, height, paint)
    paint.shader = null
    val white = Color.White
    paint.color = white.toArgb()
    paint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    paint.textSize = 132f
    var y = pad + 112f
    canvas.drawText(poster.year.toString(), pad, y, paint)
    y += 24f
    paint.textSize = 40f
    paint.color = white.copy(alpha = 0.92f).toArgb()
    shelves.forEach {
        y += 46f
        canvas.drawText("${it.big} ${it.words}", pad, y, paint)
    }
    y += 24f
    for (month in 1..12) {
        val left = pad + ((month - 1) % 4) * (cell + gap)
        val top = y + ((month - 1) / 4) * (cellHeight + gap)
        val has = poster.months.any { it.month == month }
        paint.color = white.copy(alpha = if (has) 0.22f else 0.08f).toArgb()
        canvas.drawRect(RectF(left, top, left + cell, top + cellHeight), paint)
        paint.color = white.toArgb()
        paint.textSize = 30f
        canvas.drawText(monthName(month), left + 12f, top + cellHeight - 14f, paint)
    }
    y += 3 * cellHeight + 2 * gap + 24f + 32f
    paint.color = white.copy(alpha = 0.7f).toArgb()
    paint.textSize = 32f
    canvas.drawText("Pantopus", pad, y, paint)
    return bitmap
}
