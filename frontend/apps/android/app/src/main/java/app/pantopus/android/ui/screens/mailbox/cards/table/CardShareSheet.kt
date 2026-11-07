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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
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
    val drawn = rememberSharePicture(card, format, showNote)
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
                SharePreview(format, drawn)
                SizeChoice(format) {
                    formatKey = it.key
                    say = ""
                }
                if (!card.sealed && format != ShareFormat.Link) {
                    NoteSwitch(card, mine, showNote) { showNote = it }
                }
                ActionTiles(canDraw = drawn !is SharePictureState.Failed) { action ->
                    scope.launch {
                        say = runAction(context, viewModel, card, mine, format, showNote, drawn, action)
                    }
                }
                val problem = (drawn as? SharePictureState.Failed)?.let { "We couldn't draw this picture. You can still copy the link." }
                val line = say.ifEmpty { problem.orEmpty() }
                if (line.isNotEmpty()) {
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
            }
        }
    }
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
        val modifier =
            if (format == ShareFormat.Link) {
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

/** Instagram, Facebook, Email, Copy link, Save and More; what this phone can't do isn't offered. */
@Composable
private fun ActionTiles(
    canDraw: Boolean,
    onAction: (ShareAction) -> Unit,
) {
    val context = LocalContext.current
    val hasMail = remember { mailAppsExist(context) }
    // Six to a row only where their words fit on one line.
    val perRow = if (LocalDensity.current.fontScale > 1.3f || LocalConfiguration.current.screenWidthDp < 400) 3 else 6
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
        }
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(role = Role.Button, onClick = { onAction(action) })
                .semantics { role = Role.Button }
                .heightIn(min = 64.dp)
                .testTag("cardShare-${action.key}"),
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

/** The picture for this size and choice: drawn on the phone, or for Link preview, the website's own copy. */
@Composable
private fun rememberSharePicture(
    card: CardOnTable,
    format: ShareFormat,
    showNote: Boolean,
): SharePictureState {
    val context = LocalContext.current
    val tableArt = rememberCardTableArt()
    val faceArt = rememberCardFaceArt()
    val picture = rememberCardPicture(card.design, wanted = !card.sealed)
    var state by remember { mutableStateOf<SharePictureState>(SharePictureState.Drawing) }
    LaunchedEffect(format, showNote, tableArt, faceArt, picture) {
        if (format == ShareFormat.Link) {
            state = linkPreview(context, card)?.let { SharePictureState.Ready(it) } ?: SharePictureState.Failed
            return@LaunchedEffect
        }
        val art = tableArt ?: return@LaunchedEffect
        val face = faceArt ?: return@LaunchedEffect
        // A card's picture still on its way: wait for it, unless it's failed for now.
        if (!card.sealed && picture is CardPictureState.Loading) return@LaunchedEffect
        if (!card.sealed && picture is CardPictureState.Failed) {
            state = SharePictureState.Failed
            return@LaunchedEffect
        }
        val loaded = (picture as? CardPictureState.Loaded)?.picture
        val bitmap =
            withContext(Dispatchers.Default) {
                runCatching { CardSharePictures(card, art, face, loaded).draw(format, showNote) }.getOrNull()
            }
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
): String {
    val link = viewModel.cardPageLink(card)
    val withNote = showNote && !card.sealed && format != ShareFormat.Link
    viewModel.shared(card.design, action.key, format.key, withNote)
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

/** Writes the picture where another app may read it; one file at a time, nothing kept around. */
private suspend fun shareFile(
    context: Context,
    bitmap: Bitmap,
): Uri? =
    withContext(Dispatchers.IO) {
        runCatching {
            val folder = File(context.cacheDir, "card-share").apply { mkdirs() }
            folder.listFiles()?.forEach { it.delete() }
            val file = File(folder, "pantopus-christmas-card-${System.currentTimeMillis()}.jpg")
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
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
