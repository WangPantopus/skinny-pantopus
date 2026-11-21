@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "TooManyFunctions", "ReturnCount")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import app.pantopus.android.BuildConfig
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import coil.imageLoader
import coil.request.CachePolicy
import coil.request.ImageRequest
import coil.request.SuccessResult
import coil.size.Size
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.min

/** The ways out of the sheet, by the name the counts keep them under. */
private enum class ShareAction(
    val key: String,
) {
    Instagram("instagram"),
    Facebook("facebook"),
    Email("email"),
    Link("link"),
    Save("save"),
    More("more"),

    /** Share all (plan 11.3): the server counts six kinds (no change in Part 11), so it counts as More, in the Post size. */
    All("more"),
}

private const val INSTAGRAM = "com.instagram.android"
private const val FACEBOOK = "com.facebook.katana"

/**
 * "Share this card", over the table or a card's page in Sent: a preview of the picture, its size, whether the note shows,
 * and where it goes. [mine] says the card is one this person sent, so the words talk about their own note.
 */
@Composable
fun CardShareSheet(
    card: CardOnTable,
    mine: Boolean,
    onClose: () -> Unit,
    viewModel: CardShareViewModel = hiltViewModel(),
) {
    FullScreenWindow(onDismissRequest = onClose) {
        ShareSheetBody(card, mine, onClose, viewModel)
    }
}

@Composable
private fun ShareSheetBody(
    card: CardOnTable,
    mine: Boolean,
    onClose: () -> Unit,
    viewModel: CardShareViewModel,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var formatKey by rememberSaveable(card.id) { mutableStateOf(ShareFormat.Story.key) }
    var showNote by rememberSaveable(card.id) { mutableStateOf(false) }
    var say by rememberSaveable(card.id) { mutableStateOf("") }
    val format = ShareFormat.entries.first { it.key == formatKey }
    val tableArt = rememberCardTableArt()
    val faceArt = rememberCardFaceArt()
    val picture = rememberCardPicture(card.design, wanted = !card.sealed)
    val pieces = SharePieces(tableArt, faceArt, picture)
    val drawn = rememberSharePicture(card, format, showNote, pieces)
    // The picture's video (the server's launch key card_share_video): Picture | Video shows only when there is one.
    val film = rememberShareFilm(card, viewModel) { say = it }
    val showsVideo = film.video && film.url != null
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.tableSheetScrim)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onClose)
                .testTag("cardShareScrim"),
        contentAlignment = Alignment.BottomCenter,
    ) {
        // At the largest text it can fill the screen, and stays clear of the status bar and the camera's cut-out.
        BoxWithConstraints(
            modifier =
                Modifier
                    .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
                    .widthIn(max = 520.dp)
                    .fillMaxWidth(),
        ) {
            val shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = maxHeight - 12.dp)
                        .shadow(24.dp, shape)
                        .clip(shape)
                        .background(PantopusColors.tableSheet)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {}
                        .verticalScroll(rememberScrollState())
                        .navigationBarsPadding()
                        .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 14.dp)
                        .testTag("cardShareSheet"),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SheetHead(if (card.sealed) "Share the sealed card" else "Share this card", onClose)
                if (film.url != null) ModeChoice(film) { say = "" }
                if (showsVideo) {
                    VideoPart(film) { action -> scope.launch { say = runVideoAction(context, viewModel, card, film.file, action) } }
                } else {
                    SharePreview(format, drawn)
                    SizeChoice(format) {
                        formatKey = it.key
                        say = ""
                    }
                    if (!card.sealed && format != ShareFormat.Link) {
                        NoteSwitch(card, mine, showNote) { showNote = it }
                    }
                    ActionTiles(
                        canDraw = drawn !is SharePictureState.Failed,
                        canDrawAll = picture !is CardPictureState.Failed,
                    ) { action ->
                        if (action == ShareAction.All) say = "Drawing the pictures…"
                        scope.launch {
                            say =
                                runAction(context, viewModel, card, mine, format, showNote, drawn, action) {
                                    pieces.drawSet(card, showNote)
                                }
                        }
                    }
                }
                // The picture's own trouble isn't the video's: only what the last tile did shows under the video.
                SayLine(say, drawn.takeUnless { showsVideo } ?: SharePictureState.Drawing)
            }
        }
    }
}

/** What the last tile did, or that this picture couldn't be drawn; read out when it changes. */
@Composable
private fun SayLine(
    say: String,
    drawn: SharePictureState,
) {
    val problem = (drawn as? SharePictureState.Failed)?.let { "We couldn't draw this picture. You can still copy the link." }
    val line = say.ifEmpty { problem.orEmpty() }
    if (line.isEmpty()) return
    Text(
        line,
        fontSize = 13.sp,
        lineHeight = 1.4.em,
        color = PantopusColors.tableCreamSoft,
        modifier =
            Modifier
                .semantics { liveRegion = LiveRegionMode.Polite }
                .testTag("cardShareSay"),
    )
}

@Composable
private fun SheetHead(
    title: String,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            fontFamily = FontFamily.Serif,
            fontSize = 21.sp,
            lineHeight = 1.2.em,
            color = PantopusColors.tableCream,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clickable(role = Role.Button, onClickLabel = "Close", onClick = onClose)
                    .semantics { contentDescription = "Close" }
                    .testTag("cardShareClose"),
            contentAlignment = Alignment.Center,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.tableGlass)
                        .border(0.5.dp, PantopusColors.tableGlassLine, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 1.8f,
                    tint = PantopusColors.tableCream,
                )
            }
        }
    }
}

/** The picture itself, as large as there's room for; the last one stays up while the next is drawn. */
@Composable
private fun SharePreview(
    format: ShareFormat,
    drawn: SharePictureState,
) {
    val tall = LocalConfiguration.current.screenHeightDp * 0.46f
    val height = min(tall, 430f).dp
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(8.dp)
        val picture = (drawn as? SharePictureState.Ready)?.bitmap
        val shapeOf = format.width.toFloat() / format.height
        // Wider than tall (Open card, Link preview): the sheet's width.
        val modifier =
            if (format.width > format.height) {
                Modifier.fillMaxWidth().aspectRatio(shapeOf)
            } else {
                Modifier.height(height).aspectRatio(shapeOf)
            }
        Box(
            modifier =
                modifier
                    .shadow(13.dp, shape)
                    .clip(shape)
                    .background(PantopusColors.tableNight)
                    .semantics { contentDescription = "The picture that will be shared" }
                    .testTag("cardSharePreview"),
        ) {
            if (picture != null) {
                Image(
                    bitmap = picture.asImageBitmap(),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
    }
}

@Composable
private fun SizeChoice(
    format: ShareFormat,
    onChoose: (ShareFormat) -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.tableCream8)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        ShareFormat.entries.forEach { option ->
            val chosen = option == format
            val inner = RoundedCornerShape(9.dp)
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .clip(inner)
                        .background(if (chosen) PantopusColors.tableCream14 else PantopusColors.tableCream8.copy(alpha = 0f))
                        .clickable(role = Role.Button) { onChoose(option) }
                        .semantics { selected = chosen }
                        .testTag("cardShareSize-${option.key}"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.label,
                    fontSize = 13.5.sp,
                    lineHeight = 1.3.em,
                    fontWeight = if (chosen) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (chosen) PantopusColors.tableCream else PantopusColors.tableCreamSoft,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun NoteSwitch(
    card: CardOnTable,
    mine: Boolean,
    showNote: Boolean,
    onChange: (Boolean) -> Unit,
) {
    val first = card.fromFirst
    val words =
        when {
            mine && showNote -> "This picture shows your words and first name."
            mine -> "Your words and name stay private. Your address never shows."
            showNote -> "This picture shows $first's words and first name. Only share them if $first wouldn't mind."
            else -> "$first's words and name stay private. Your address never shows."
        }
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp).testTag("cardShareNoteRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Show the note",
                fontSize = 14.5.sp,
                lineHeight = 1.35.em,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.tableCream,
            )
            Text(
                words,
                fontSize = 12.5.sp,
                lineHeight = 1.3.em,
                color = PantopusColors.tableCreamFaint,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Switch(
            checked = showNote,
            onCheckedChange = onChange,
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.cardWax,
                    checkedThumbColor = PantopusColors.tableCream,
                    checkedBorderColor = PantopusColors.cardWax,
                    uncheckedTrackColor = PantopusColors.tableCream18,
                    uncheckedThumbColor = PantopusColors.tableCream,
                    uncheckedBorderColor = PantopusColors.tableCream18,
                ),
            modifier = Modifier.semantics { contentDescription = "Show the note" }.testTag("cardShareNote"),
        )
    }
}

/**
 * Instagram, Facebook, Email, Copy link, Save, More and Share all; what this phone can't do isn't offered. Share all draws
 * its own pictures, so it stays when only this size's picture couldn't be drawn (a Link preview the website didn't send).
 */
@Composable
private fun ActionTiles(
    canDraw: Boolean,
    canDrawAll: Boolean,
    onAction: (ShareAction) -> Unit,
) {
    val context = LocalContext.current
    val hasMail = remember { mailAppsExist(context) }
    val tiles =
        buildList {
            if (canDraw) {
                add(ShareAction.Instagram)
                add(ShareAction.Facebook)
                if (hasMail) add(ShareAction.Email)
            }
            add(ShareAction.Link)
            if (canDraw) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(ShareAction.Save)
                add(ShareAction.More)
            }
            if (canDrawAll) add(ShareAction.All)
        }
    // Six to a row only where their words fit on one line; seven go four and three.
    val perRow =
        when {
            LocalDensity.current.fontScale > 1.3f -> 3
            tiles.size > 6 -> 4
            LocalConfiguration.current.screenWidthDp < 400 -> 3
            else -> 6
        }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        tiles.chunked(perRow).forEach { row ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { action -> ActionTile(action, onAction, Modifier.weight(1f)) }
                repeat(perRow - row.size) { Box(Modifier.weight(1f)) }
            }
        }
    }
}

@Composable
private fun ActionTile(
    action: ShareAction,
    onAction: (ShareAction) -> Unit,
    modifier: Modifier = Modifier,
) {
    val label =
        when (action) {
            ShareAction.Instagram -> "Instagram"
            ShareAction.Facebook -> "Facebook"
            ShareAction.Email -> "Email"
            ShareAction.Link -> "Copy link"
            ShareAction.Save -> "Save"
            ShareAction.More -> "More"
            ShareAction.All -> "Share all"
        }
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(role = Role.Button, onClick = { onAction(action) })
                .semantics { role = Role.Button }
                .heightIn(min = 64.dp)
                .testTag(if (action == ShareAction.All) "cardShare-all" else "cardShare-${action.key}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.tableCream10),
            contentAlignment = Alignment.Center,
        ) {
            when (action) {
                ShareAction.Instagram -> InstagramMark()
                ShareAction.Facebook -> FacebookMark()
                ShareAction.Email -> ShareIcon(PantopusIcon.Mail)
                ShareAction.Link -> ShareIcon(PantopusIcon.Link)
                ShareAction.Save -> ShareIcon(PantopusIcon.Download)
                ShareAction.More -> ShareIcon(PantopusIcon.Share)
                ShareAction.All -> AllMark()
            }
        }
        Text(
            label,
            fontSize = 11.5.sp,
            lineHeight = 1.25.em,
            color = PantopusColors.tableCreamSoft,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ShareIcon(icon: PantopusIcon) {
    PantopusIconImage(icon = icon, contentDescription = null, size = 22.dp, strokeWidth = 1.7f, tint = PantopusColors.tableCream)
}

/** The camera outline of the sample's Instagram tile: a rounded square, a circle and a dot. */
@Composable
private fun InstagramMark() {
    Canvas(Modifier.size(22.dp)) {
        val unit = size.width / 24f
        val stroke = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.7f * unit)
        drawRoundRect(
            color = PantopusColors.tableCream,
            topLeft = androidx.compose.ui.geometry.Offset(4f * unit, 4f * unit),
            size = androidx.compose.ui.geometry.Size(16f * unit, 16f * unit),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(4.5f * unit),
            style = stroke,
        )
        drawCircle(PantopusColors.tableCream, radius = 3.6f * unit, style = stroke)
        drawCircle(PantopusColors.tableCream, radius = 1.1f * unit, center = androidx.compose.ui.geometry.Offset(16.8f * unit, 7.2f * unit))
    }
}

/** Share all's tile, as web draws it: a picture with another behind it. */
@Composable
private fun AllMark() {
    Canvas(Modifier.size(22.dp)) {
        val u = size.width / 24f
        val stroke =
            androidx.compose.ui.graphics.drawscope.Stroke(
                width = 1.7f * u,
                join = androidx.compose.ui.graphics.StrokeJoin.Round,
                cap = androidx.compose.ui.graphics.StrokeCap.Round,
            )
        drawRoundRect(
            color = PantopusColors.tableCream,
            topLeft = androidx.compose.ui.geometry.Offset(7.5f * u, 3.5f * u),
            size = androidx.compose.ui.geometry.Size(12f * u, 13f * u),
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(1.5f * u),
            style = stroke,
        )
        val behind =
            androidx.compose.ui.graphics.Path().apply {
                moveTo(4.5f * u, 7.5f * u)
                lineTo(4.5f * u, 18.5f * u)
                quadraticTo(4.5f * u, 20.5f * u, 6.5f * u, 20.5f * u)
                lineTo(15.5f * u, 20.5f * u)
            }
        drawPath(behind, PantopusColors.tableCream, style = stroke)
    }
}

/** The "f" of the sample's Facebook tile. */
@Composable
private fun FacebookMark() {
    Canvas(Modifier.size(22.dp)) {
        val u = size.width / 24f
        val path =
            androidx.compose.ui.graphics.Path().apply {
                moveTo(14.5f * u, 20f * u)
                lineTo(14.5f * u, 13f * u)
                lineTo(16.9f * u, 13f * u)
                lineTo(17.4f * u, 10f * u)
                lineTo(14.5f * u, 10f * u)
                lineTo(14.5f * u, 8.4f * u)
                cubicTo(14.5f * u, 7.5f * u, 14.8f * u, 7f * u, 16f * u, 7f * u)
                lineTo(17.5f * u, 7f * u)
                lineTo(17.5f * u, 4.3f * u)
                cubicTo(16.9f * u, 4.2f * u, 16.2f * u, 4f * u, 15.2f * u, 4f * u)
                cubicTo(12.9f * u, 4f * u, 11.4f * u, 5.4f * u, 11.4f * u, 7.9f * u)
                lineTo(11.4f * u, 10f * u)
                lineTo(9f * u, 10f * u)
                lineTo(9f * u, 13f * u)
                lineTo(11.4f * u, 13f * u)
                lineTo(11.4f * u, 20f * u)
            }
        drawPath(
            path,
            PantopusColors.tableCream,
            style =
                androidx.compose.ui.graphics.drawscope.Stroke(
                    width = 1.7f * u,
                    join = androidx.compose.ui.graphics.StrokeJoin.Round,
                    cap = androidx.compose.ui.graphics.StrokeCap.Round,
                ),
        )
    }
}

/** Where a shared picture stands. */
private sealed interface SharePictureState {
    data object Drawing : SharePictureState

    data class Ready(
        val bitmap: Bitmap,
    ) : SharePictureState

    data object Failed : SharePictureState
}

/** What every picture is drawn from: the table's art, the card's paper and type, and the card's own picture. */
private data class SharePieces(
    val tableArt: CardTableArt?,
    val faceArt: CardFaceArt?,
    val picture: CardPictureState,
) {
    /** The drawer, once everything it needs is here; a sealed card's picture is never asked for. */
    fun drawer(card: CardOnTable): CardSharePictures? {
        val art = tableArt ?: return null
        val face = faceArt ?: return null
        if (!card.sealed && picture !is CardPictureState.Loaded) return null
        return CardSharePictures(card, art, face, (picture as? CardPictureState.Loaded)?.picture)
    }

    /** Share all's pictures (plan 11.3), or null while something is still on its way or couldn't be drawn. */
    suspend fun drawSet(
        card: CardOnTable,
        showNote: Boolean,
    ): List<Bitmap>? {
        val drawer = drawer(card) ?: return null
        return withContext(Dispatchers.Default) { runCatching { drawer.drawSet(showNote && !card.sealed) }.getOrNull() }
    }
}

/** The picture for this size and choice: drawn on the phone, or for Link preview, the website's own copy. */
@Composable
private fun rememberSharePicture(
    card: CardOnTable,
    format: ShareFormat,
    showNote: Boolean,
    pieces: SharePieces,
): SharePictureState {
    val context = LocalContext.current
    var state by remember { mutableStateOf<SharePictureState>(SharePictureState.Drawing) }
    LaunchedEffect(format, showNote, pieces) {
        if (format == ShareFormat.Link) {
            state = linkPreview(context, card)?.let { SharePictureState.Ready(it) } ?: SharePictureState.Failed
            return@LaunchedEffect
        }
        // A card's picture that failed for now: say so. Still on its way: wait for it.
        if (!card.sealed && pieces.picture is CardPictureState.Failed) {
            state = SharePictureState.Failed
            return@LaunchedEffect
        }
        val drawer = pieces.drawer(card) ?: return@LaunchedEffect
        val bitmap = withContext(Dispatchers.Default) { runCatching { drawer.draw(format, showNote) }.getOrNull() }
        state = bitmap?.let { SharePictureState.Ready(it) } ?: SharePictureState.Failed
    }
    return state
}

/** The Link preview the website keeps for this picture, or its sealed-envelope picture. */
private suspend fun linkPreview(
    context: Context,
    card: CardOnTable,
): Bitmap? {
    val name = if (card.sealed) "sealed-link" else "${card.design}-link"
    val request =
        ImageRequest
            .Builder(context)
            .data(BuildConfig.PANTOPUS_WEB_BASE_URL.trimEnd('/') + "/holiday-cards/share/$name.jpg")
            .size(Size.ORIGINAL)
            .allowHardware(false)
            .diskCachePolicy(CachePolicy.ENABLED)
            .build()
    val result = context.imageLoader.execute(request) as? SuccessResult
    return (result?.drawable as? BitmapDrawable)?.bitmap
}

private fun mailAppsExist(context: Context): Boolean =
    Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")).resolveActivity(context.packageManager) != null

/** The link a share carries: a travelling card's journey page (travelling card plan Part 7), else the card's page. */
private suspend fun shareLink(
    card: CardOnTable,
    viewModel: CardShareViewModel,
): String {
    val journey = card.travel?.journey?.takeIf { card.travels && !card.sealed } ?: return viewModel.cardPageLink(card)
    return CardTravel.journeyUrl(journey)
}

/** Does what the tile says, and answers with what to tell the person. */
private suspend fun runAction(
    context: Context,
    viewModel: CardShareViewModel,
    card: CardOnTable,
    mine: Boolean,
    format: ShareFormat,
    showNote: Boolean,
    drawn: SharePictureState,
    action: ShareAction,
    drawAll: suspend () -> List<Bitmap>?,
): String {
    val link = shareLink(card, viewModel)
    if (action == ShareAction.All) {
        viewModel.shared(card.design, action.key, ShareFormat.Post.counted, showNote && !card.sealed)
        return shareAll(context, drawAll)
    }
    val withNote = showNote && !card.sealed && format != ShareFormat.Link
    viewModel.shared(card.design, action.key, format.counted, withNote)
    if (action == ShareAction.Link) {
        val clipboard = context.getSystemService(ClipboardManager::class.java)
        clipboard?.setPrimaryClip(ClipData.newPlainText("Card link", link))
        return "Link copied."
    }
    if (action == ShareAction.Facebook && format == ShareFormat.Link) return openFacebookSharer(context, link)
    val bitmap = (drawn as? SharePictureState.Ready)?.bitmap ?: return "The picture is still being drawn. Try again in a moment."
    if (action == ShareAction.Save) return saveToGallery(context, bitmap)
    val uri = shareFile(context, bitmap) ?: return "Couldn't get the picture ready. Check that your phone has free space, then try again."
    return try {
        when (action) {
            ShareAction.Instagram -> sendTo(context, uri, INSTAGRAM, "Share this card")
            ShareAction.Facebook -> sendTo(context, uri, FACEBOOK, "Share this card")
            ShareAction.Email -> composeEmail(context, uri, mine, link)
            else -> sendTo(context, uri, null, "Share this card")
        }
        ""
    } catch (_: ActivityNotFoundException) {
        "No app on this phone can take this picture. You can copy the link instead."
    }
}

/**
 * Share all (plan 11.3): the shut envelope, the card and (only with the note on) the note page, handed to the phone's
 * share screen together, so an app that takes several can post them as a carousel. A sealed card is its sealed picture.
 */
private suspend fun shareAll(
    context: Context,
    drawAll: suspend () -> List<Bitmap>?,
): String {
    val set = drawAll()
    if (set.isNullOrEmpty()) return "We couldn't draw these pictures. You can still copy the link."
    val uris = shareFiles(context, set)
    set.forEach { it.recycle() }
    if (uris.isNullOrEmpty()) return "Couldn't get the pictures ready. Check that your phone has free space, then try again."
    val send = if (uris.size == 1) picturesIntent(uris.first()) else severalPicturesIntent(uris)
    return try {
        context.startActivity(Intent.createChooser(send, "Share this card"))
        ""
    } catch (_: ActivityNotFoundException) {
        "No app on this phone can take these pictures. You can copy the link instead."
    }
}

/** Several pictures in one share, in order, each readable by the app that takes them. */
private fun severalPicturesIntent(uris: List<Uri>): Intent {
    val clip = ClipData.newRawUri("Christmas card", uris.first())
    uris.drop(1).forEach { clip.addItem(ClipData.Item(it)) }
    return Intent(Intent.ACTION_SEND_MULTIPLE).apply {
        type = "image/jpeg"
        putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        clipData = clip
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
}

private fun picturesIntent(uri: Uri): Intent =
    Intent(Intent.ACTION_SEND).apply {
        type = "image/jpeg"
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = ClipData.newRawUri("Christmas card", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }

/** The picture straight to [app] when it's on this phone; otherwise the phone's own chooser. */
private fun sendTo(
    context: Context,
    uri: Uri,
    app: String?,
    title: String,
) {
    val send = picturesIntent(uri)
    if (app != null) {
        val direct = Intent(send).setPackage(app)
        if (direct.resolveActivity(context.packageManager) != null) {
            context.startActivity(direct)
            return
        }
    }
    context.startActivity(Intent.createChooser(send, title))
}

private fun composeEmail(
    context: Context,
    uri: Uri,
    mine: Boolean,
    link: String,
) {
    val send =
        picturesIntent(uri).apply {
            putExtra(Intent.EXTRA_SUBJECT, if (mine) "A Christmas card I sent" else "Look what came in the mail")
            val opening = if (mine) "I sent this Christmas card on Pantopus." else "I got this Christmas card on Pantopus."
            putExtra(Intent.EXTRA_TEXT, "$opening You can send one too: $link")
        }
    // Each mail app by name: a chooser with a mailto selector finds no apps at all on recent Android.
    val apps =
        context.packageManager
            .queryIntentActivities(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:")), 0)
            .map { it.activityInfo.packageName }
            .distinct()
            .map { Intent(send).setPackage(it) }
    val first = apps.firstOrNull() ?: throw ActivityNotFoundException()
    if (apps.size == 1) {
        context.startActivity(first)
    } else {
        val others = apps.drop(1).toTypedArray()
        context.startActivity(Intent.createChooser(first, "Email this card").putExtra(Intent.EXTRA_INITIAL_INTENTS, others))
    }
}

private fun openFacebookSharer(
    context: Context,
    link: String,
): String {
    val sharer = "https://www.facebook.com/sharer/sharer.php?u=" + Uri.encode(link)
    return try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(sharer)))
        ""
    } catch (_: ActivityNotFoundException) {
        "No app on this phone can open Facebook. You can copy the link instead."
    }
}

/** Writes the picture where another app may read it; one share at a time, nothing kept around. */
private suspend fun shareFile(
    context: Context,
    bitmap: Bitmap,
): Uri? = shareFiles(context, listOf(bitmap))?.singleOrNull()

/** Writes the pictures of one share, numbered in order when there are several; the last share's files go first. */
private suspend fun shareFiles(
    context: Context,
    bitmaps: List<Bitmap>,
): List<Uri>? =
    withContext(Dispatchers.IO) {
        runCatching {
            val folder = File(context.cacheDir, "card-share").apply { mkdirs() }
            folder.listFiles()?.forEach { it.delete() }
            val stamp = System.currentTimeMillis()
            bitmaps.mapIndexed { index, bitmap ->
                val number = if (bitmaps.size > 1) "-${index + 1}" else ""
                val file = File(folder, "pantopus-christmas-card-$stamp$number.jpg")
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            }
        }.getOrNull()
    }

/** Saves to the gallery. A half-written picture is never left behind, even if the sheet closes meanwhile. */
private suspend fun saveToGallery(
    context: Context,
    bitmap: Bitmap,
): String =
    withContext(NonCancellable + Dispatchers.IO) {
        val saved =
            runCatching {
                val values =
                    ContentValues().apply {
                        put(MediaStore.Images.Media.DISPLAY_NAME, "pantopus-christmas-card-${System.currentTimeMillis()}.jpg")
                        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/Pantopus")
                        put(MediaStore.Images.Media.IS_PENDING, 1)
                    }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: error("no row")
                resolver.openOutputStream(uri)?.use { bitmap.compress(Bitmap.CompressFormat.JPEG, 95, it) } ?: error("no stream")
                resolver.update(uri, ContentValues().apply { put(MediaStore.Images.Media.IS_PENDING, 0) }, null, null)
            }.isSuccess
        if (saved) "Saved to your gallery." else "Couldn't save the picture. Check that your phone has free space, then try again."
    }

/** Picture or Video at the top of the sheet, only when the picture has a video; [onSwitch] clears the last message. */
@Composable
private fun ModeChoice(
    film: ShareFilm,
    onSwitch: () -> Unit,
) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.tableCream8)
                .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        listOf(false to "Picture", true to "Video").forEach { (isVideo, label) ->
            val chosen = isVideo == film.video
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(9.dp))
                        .background(if (chosen) PantopusColors.tableCream14 else PantopusColors.tableCream8.copy(alpha = 0f))
                        .clickable(role = Role.Button) {
                            film.video = isVideo
                            onSwitch()
                        }
                        .semantics { selected = chosen }
                        .testTag(if (isVideo) "cardShareMode.video" else "cardShareMode.picture"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    fontSize = 13.5.sp,
                    fontWeight = if (chosen) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (chosen) PantopusColors.tableCream else PantopusColors.tableCreamSoft,
                )
            }
        }
    }
}

/** The picture's video: where it is in public storage, and the file on this phone once fetched. */
private class ShareFilm {
    /** Video is chosen over Picture. */
    var video by mutableStateOf(false)
    var url by mutableStateOf<String?>(null)
    var file by mutableStateOf<File?>(null)
    var failed by mutableStateOf(false)
    val settled: Boolean get() = file != null || failed
}

private const val FILM_DESCRIPTION = "The video that will be shared: the card arriving and opening, with no note or name in it"

/** Asks whether the picture has a video, and fetches the file once Video is chosen; [onFailed] says why not. */
@Composable
private fun rememberShareFilm(
    card: CardOnTable,
    viewModel: CardShareViewModel,
    onFailed: (String) -> Unit,
): ShareFilm {
    val context = LocalContext.current
    val film = remember(card.id) { ShareFilm() }
    LaunchedEffect(card.id) { film.url = viewModel.shareVideoUrl(card) }
    LaunchedEffect(film.video, film.url) {
        val source = film.url
        if (!film.video || source == null || film.settled) return@LaunchedEffect
        film.file = downloadFilm(context, source, card.design)
        if (film.file == null) {
            film.failed = true
            onFailed("We couldn't load the video. Check your connection, or copy the link instead.")
        }
    }
    return film
}

/** The video's part of the sheet: the film playing, what's in it, and where it can go. */
@Composable
private fun VideoPart(
    film: ShareFilm,
    onAction: (ShareAction) -> Unit,
) {
    FilmPreview(film.file?.let { Uri.fromFile(it) } ?: Uri.parse(film.url))
    Text(
        "The card arriving and opening, with the paper sounds. Nobody's note or name is in it.",
        fontSize = 12.5.sp,
        lineHeight = 1.35.em,
        color = PantopusColors.tableCreamFaint,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth(),
    )
    VideoTiles(ready = film.settled, onAction = onAction)
}

/** The share video playing in the sheet: muted, looping, no controls. */
@Composable
private fun FilmPreview(source: Uri) {
    val context = LocalContext.current
    val tall = LocalConfiguration.current.screenHeightDp * 0.46f
    val player =
        remember(source) {
            ExoPlayer.Builder(context).build().apply {
                setMediaItem(MediaItem.fromUri(source))
                repeatMode = Player.REPEAT_MODE_ONE
                volume = 0f
                playWhenReady = true
                prepare()
            }
        }
    DisposableEffect(player) { onDispose { player.release() } }
    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        val shape = RoundedCornerShape(8.dp)
        AndroidView(
            factory = { PlayerView(it).apply { useController = false } },
            update = { it.player = player },
            modifier =
                Modifier
                    .height(min(tall, 430f).dp)
                    .aspectRatio(9f / 16f)
                    .shadow(13.dp, shape)
                    .clip(shape)
                    .background(PantopusColors.tableNight)
                    .semantics { contentDescription = FILM_DESCRIPTION }
                    .testTag("cardShareVideoPreview"),
        )
    }
}

/** The video's ways out: Instagram, Facebook, Save, More and Copy link. */
@Composable
private fun VideoTiles(
    ready: Boolean,
    onAction: (ShareAction) -> Unit,
) {
    val tiles =
        buildList {
            add(ShareAction.Instagram)
            add(ShareAction.Facebook)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) add(ShareAction.Save)
            add(ShareAction.More)
            add(ShareAction.Link)
        }
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        tiles.forEach { action ->
            val usable = ready || action == ShareAction.Link
            ActionTile(action, { if (usable) onAction(it) }, Modifier.weight(1f).alpha(if (usable) 1f else 0.45f))
        }
    }
}

/** Fetches the video into the shared cache folder, once; null when it couldn't. */
private suspend fun downloadFilm(
    context: Context,
    source: String,
    design: String,
): File? =
    withContext(Dispatchers.IO) {
        runCatching {
            val folder = File(context.cacheDir, "card-share-video").apply { mkdirs() }
            val file = File(folder, "pantopus-christmas-card-$design.mp4")
            if (file.length() > 0) return@runCatching file
            val part = File(folder, "$design.part")
            val connection = URL(source).openConnection() as HttpURLConnection
            try {
                connection.connectTimeout = 15_000
                connection.readTimeout = 30_000
                check(connection.responseCode == HttpURLConnection.HTTP_OK) { "status ${connection.responseCode}" }
                connection.inputStream.use { input -> part.outputStream().use { input.copyTo(it) } }
            } finally {
                connection.disconnect()
            }
            check(part.renameTo(file)) { "rename" }
            file
        }.getOrNull()
    }

/** Does what the video's tile says, and answers with what to tell the person. */
private suspend fun runVideoAction(
    context: Context,
    viewModel: CardShareViewModel,
    card: CardOnTable,
    file: File?,
    action: ShareAction,
): String {
    viewModel.shared(card.design, action.key, "video", false)
    if (action == ShareAction.Link) {
        val clipboard = context.getSystemService(ClipboardManager::class.java)
        clipboard?.setPrimaryClip(ClipData.newPlainText("Card link", viewModel.cardPageLink(card)))
        return "Link copied."
    }
    file ?: return "We couldn't load the video. You can copy the link instead."
    if (action == ShareAction.Save) return saveVideoToGallery(context, file)
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = "video/mp4"
            putExtra(Intent.EXTRA_STREAM, uri)
            clipData = ClipData.newRawUri("Christmas card", uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (action == ShareAction.More) putExtra(Intent.EXTRA_TEXT, viewModel.cardPageLink(card))
        }
    return try {
        val app =
            when (action) {
                ShareAction.Instagram -> INSTAGRAM
                ShareAction.Facebook -> FACEBOOK
                else -> null
            }
        val direct = app?.let { Intent(send).setPackage(it) }?.takeIf { it.resolveActivity(context.packageManager) != null }
        context.startActivity(direct ?: Intent.createChooser(send, "Share this card"))
        ""
    } catch (_: ActivityNotFoundException) {
        "No app on this phone can take this video. You can copy the link instead."
    }
}

/** Saves the video to the gallery (Movies/Pantopus). A half-written file is never left behind. */
private suspend fun saveVideoToGallery(
    context: Context,
    file: File,
): String =
    withContext(NonCancellable + Dispatchers.IO) {
        val saved =
            runCatching {
                val values =
                    ContentValues().apply {
                        put(MediaStore.Video.Media.DISPLAY_NAME, "pantopus-christmas-card-${System.currentTimeMillis()}.mp4")
                        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
                        put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/Pantopus")
                        put(MediaStore.Video.Media.IS_PENDING, 1)
                    }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values) ?: error("no row")
                resolver.openOutputStream(uri)?.use { output -> file.inputStream().use { it.copyTo(output) } } ?: error("no stream")
                resolver.update(uri, ContentValues().apply { put(MediaStore.Video.Media.IS_PENDING, 0) }, null, null)
            }.isSuccess
        if (saved) "Saved to your gallery." else "Couldn't save the video. Check that your phone has free space, then try again."
    }
