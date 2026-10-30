@file:Suppress("PackageNaming", "MagicNumber", "TooManyFunctions", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.mailbox.v2.DrawerMail
import app.pantopus.android.ui.components.CompactButton
import app.pantopus.android.ui.components.CompactButtonSize
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.mailbox.cards.HolidayCardArt
import app.pantopus.android.ui.screens.mailbox.components.MailKind
import app.pantopus.android.ui.screens.mailbox.components.MailPieceMapper
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Which part of the Vault the list shows: everything filed, one folder, or what's archived. */
sealed interface MailVaultShelf {
    data object All : MailVaultShelf

    data class Folder(
        val id: String,
        val label: String,
    ) : MailVaultShelf

    data object Archived : MailVaultShelf
}

/** "Search everything you have filed", searched on the server when the keyboard's search key is pressed. */
@Composable
fun MailVaultSearchField(
    query: String,
    searching: Boolean,
    onChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onClear: () -> Unit,
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val submit = {
        keyboard?.hide()
        onSubmit()
    }
    Row(
        modifier =
            Modifier
                .keepsKeyboard()
                .padding(start = Spacing.s4, end = Spacing.s4, top = 14.dp)
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .padding(start = Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Search, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextSecondary)
        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (query.isEmpty()) {
                Text("Search everything you have filed", fontSize = 15.sp, color = PantopusColors.appTextMuted)
            }
            BasicTextField(
                value = query,
                onValueChange = onChange,
                singleLine = true,
                textStyle = TextStyle(fontSize = 15.sp, color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { submit() }),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        // A hardware keyboard's Enter searches too, and goes no further (it would reach the screen's buttons).
                        .onPreviewKeyEvent { event ->
                            val enter = event.key == Key.Enter || event.key == Key.NumPadEnter
                            if (enter && event.type == KeyEventType.KeyUp) submit()
                            enter
                        }.semantics { contentDescription = "Search everything you have filed" }
                        .testTag("mailVaultSearch"),
            )
        }
        when {
            searching -> CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(end = Spacing.s3).size(18.dp))
            query.isNotEmpty() ->
                Box(
                    modifier =
                        Modifier
                            .size(48.dp)
                            .clickable(onClick = onClear)
                            .semantics {
                                contentDescription = "Clear search"
                                role = Role.Button
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextSecondary,
                    )
                }
        }
    }
}

/** Two manila folders side by side (the last row may hold one). */
@Composable
fun MailVaultFolderRow(
    folders: List<MailVaultFolder>,
    onOpen: (MailVaultFolder) -> Unit,
) {
    Row(
        modifier = Modifier.padding(horizontal = Spacing.s4, vertical = 7.dp).fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        folders.forEach { folder -> MailVaultFolderTile(folder, onOpen = { onOpen(folder) }, modifier = Modifier.weight(1f)) }
        if (folders.size == 1) Spacer(Modifier.weight(1f))
    }
}

/** A Vault folder drawn as a manila folder with its tab: its name, and how many filed pieces are in it. */
@Composable
private fun MailVaultFolderTile(
    folder: MailVaultFolder,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onOpen)
                .clearAndSetSemantics {
                    contentDescription = "${folder.label}, ${folder.count} filed"
                    role = Role.Button
                }.testTag("mailVaultFolder.${folder.id}"),
    ) {
        Box(
            modifier =
                Modifier
                    .width(64.dp)
                    .heightIn(min = 12.dp)
                    .background(PantopusColors.mailManilaTab, RoundedCornerShape(topStart = 7.dp, topEnd = 7.dp)),
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 64.dp)
                    .background(
                        PantopusColors.mailManila,
                        RoundedCornerShape(topEnd = 10.dp, bottomStart = 10.dp, bottomEnd = 10.dp),
                    ).padding(start = Spacing.s3, end = Spacing.s3, top = 10.dp, bottom = Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                folder.label,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.mailInkHand,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Text("${folder.count}", fontSize = 13.sp, lineHeight = 20.sp, color = PantopusColors.mailManilaInk)
        }
    }
}

/** A plain row that opens a shelf: Archived, or back to All folders. */
@Composable
fun MailVaultLinkRow(
    title: String,
    icon: PantopusIcon,
    tag: String,
    trailing: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(12.dp))
                .then(
                    if (trailing) {
                        Modifier.background(PantopusColors.appSurface).border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                    } else {
                        Modifier
                    },
                ).clickable(onClick = onClick)
                .padding(horizontal = if (trailing) 14.dp else Spacing.s1)
                .semantics(mergeDescendants = true) { role = Role.Button }
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            tint = if (trailing) PantopusColors.appTextSecondary else PantopusColors.primary600,
        )
        Text(
            title,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (trailing) PantopusColors.appText else PantopusColors.primary600,
            modifier = Modifier.weight(1f),
        )
        if (trailing) {
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

/**
 * A filed (or archived) piece in the Vault: a scrap of its paper, what it is, and who sent it, which folder it's in and
 * when it came ("Riverbend Power · Utilities · Oct 26"). Read as one sentence; a tap opens it.
 */
@Composable
fun MailFiledRow(
    row: DrawerMail,
    folder: String?,
    zone: ZoneId,
    onOpen: () -> Unit,
) {
    val kind = MailKind.fromWire(row.kind)
    val card = row.card
    val title = row.displayTitle?.takeIf { it.isNotBlank() } ?: row.subject?.takeIf { it.isNotBlank() } ?: kind.word
    val from = row.senderDisplay.ifBlank { row.senderBusinessName ?: "Unknown sender" }
    val where = folder ?: if (row.archived && row.lifecycle != "filed") "Archived" else null
    val came = MailPieceMapper.deliveredAt(row)?.let { filedDay(it, zone) }
    val meta = listOfNotNull(from, where, came).joinToString(" · ")
    val spoken =
        buildString {
            append(if (card != null) "Christmas card from $from" else "${kind.word} from $from, $title")
            when {
                folder != null -> append(", filed in $folder")
                where != null -> append(", archived")
            }
            came?.let { append(", came $it") }
            append('.')
        }
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s1)
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .clickable(onClick = onOpen)
                .padding(horizontal = 14.dp, vertical = Spacing.s2)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                }.testTag("mailFiled.${row.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 34.dp, height = 24.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(if (card != null) PantopusColors.cardEnvelope else paperOf(kind))
                    .border(1.dp, PantopusColors.mailPostcardRule, RoundedCornerShape(3.dp)),
        ) {
            // A Christmas card shows its picture once it's been opened; its red envelope before that or while sealed.
            if (card != null && !card.sealed && row.viewed) {
                AsyncImage(
                    model = HolidayCardArt.picture(card.design, thumb = true),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    alignment = BiasAlignment(0f, -0.44f),
                    modifier = Modifier.matchParentSize(),
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                title,
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                meta,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = PantopusColors.appTextSecondary,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Something to say in the Vault in place of a list: nothing filed yet, no matches. */
@Composable
fun MailVaultNote(
    text: String,
    tag: String,
) {
    Text(
        text,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2).fillMaxWidth().testTag(tag),
    )
}

/** What went wrong in the Vault, where it went wrong, with Try again. */
@Composable
fun MailVaultProblem(
    message: String,
    tag: String,
    onRetry: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(message, fontSize = 14.sp, lineHeight = 20.sp, color = PantopusColors.appTextStrong, modifier = Modifier.weight(1f))
        CompactButton(
            title = "Try again",
            variant = CompactButtonVariant.Primary,
            size = CompactButtonSize.Footer,
            onClick = onRetry,
            modifier = Modifier.heightIn(min = 48.dp),
        )
    }
}

/** "Show more" under the search results. */
@Composable
fun MailVaultMore(
    loading: Boolean,
    onMore: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxWidth().padding(Spacing.s4), contentAlignment = Alignment.Center) {
        if (loading) {
            CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
        } else {
            CompactButton(
                title = "Show more",
                variant = CompactButtonVariant.Ghost,
                size = CompactButtonSize.Footer,
                onClick = onMore,
                modifier = Modifier.heightIn(min = 48.dp).testTag("mailVaultMore"),
            )
        }
    }
}

private val shortDay = DateTimeFormatter.ofPattern("MMM d", Locale.US)
private val longDay = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)

/** "Oct 26", or "Oct 26, 2025" from another year. */
private fun filedDay(
    at: Instant,
    zone: ZoneId,
): String {
    val day = at.atZone(zone).toLocalDate()
    return day.format(if (day.year == Instant.now().atZone(zone).year) shortDay else longDay)
}

/** The scrap of paper a filed piece shows: the envelope's or card's own stock. */
private fun paperOf(kind: MailKind) =
    when (kind) {
        MailKind.Bill, MailKind.Notice -> PantopusColors.appSurface
        MailKind.Postcard -> PantopusColors.mailPostcardPaper
        MailKind.Booklet -> PantopusColors.mailStampFirArt
        MailKind.Parcel -> PantopusColors.mailKraft
        MailKind.Letter, MailKind.Bundle -> PantopusColors.mailLetterPaper
    }
