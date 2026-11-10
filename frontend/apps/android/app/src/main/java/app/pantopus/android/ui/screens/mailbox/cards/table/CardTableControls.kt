@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards.table

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.toastDurationMillis
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import kotlinx.coroutines.delay

/** One line of the ⋯ menu. */
data class CardTableMenuItem(
    val title: String,
    val tag: String,
    val onClick: () -> Unit,
)

/** "Send Hazel a card": the quiet second button under the main one, once the card has been turned over. */
data class CardTableSendBack(
    val title: String,
    val onClick: () -> Unit,
)

/** The quiet button's words: the cream of the words at the top, a little smaller than the main button. */
internal val tableQuietStyle =
    TextStyle(
        fontSize = 14.sp,
        lineHeight = 1.35.em,
        fontWeight = FontWeight.Medium,
        color = PantopusColors.tableCreamSoft,
        textAlign = TextAlign.Center,
    )

/** The words at the top of the table: the sample's italic serif. */
internal val tableWordsStyle =
    TextStyle(
        fontFamily = FontFamily.Serif,
        fontStyle = FontStyle.Italic,
        fontSize = 18.sp,
        lineHeight = 1.3.em,
        color = PantopusColors.tableCreamSoft,
        textAlign = TextAlign.Center,
        lineBreak = LineBreak.Heading,
        shadow = Shadow(PantopusColors.tableNight.copy(alpha = 0.35f), Offset(0f, 3f), blurRadius = 16f),
    )

/** The hint under the button, in white at 70% so it reads on the dark cloth. */
internal val tableHintStyle =
    TextStyle(
        fontSize = 12.5.sp,
        lineHeight = 1.35.em,
        color = PantopusColors.tableHint,
        textAlign = TextAlign.Center,
    )

internal val tablePrimaryStyle =
    TextStyle(
        fontSize = 15.sp,
        lineHeight = 1.35.em,
        fontWeight = FontWeight.SemiBold,
        color = PantopusColors.tableCream,
        textAlign = TextAlign.Center,
    )

/**
 * Only these around the card: ✕ top left, Share and ⋯ top right, words at the top, and the button with its hint at the
 * bottom. Tapping the table hides or shows them; [touchExploring] (TalkBack) keeps them, because that's how the whole
 * moment is reached.
 */
@Composable
internal fun CardTableControls(
    state: CardTableState,
    insets: PaddingValues,
    canShare: Boolean,
    menu: List<CardTableMenuItem>,
    touchExploring: Boolean,
    showsTurnTip: Boolean,
    onClose: () -> Unit,
    onShare: () -> Unit,
    sendBack: CardTableSendBack? = null,
) {
    val top = insets.calculateTopPadding()
    val bottom = insets.calculateBottomPadding()
    val hidden = state.controlsHidden && !touchExploring
    Box(modifier = Modifier.fillMaxSize()) {
        Words(state, top)
        ActionBlock(state, hidden, bottom, sendBack)
        if (showsTurnTip) TurnTip()
        TopRow(state, top, hidden, canShare, menu.isNotEmpty(), onClose, onShare)
        if (state.menuOpen && menu.isNotEmpty()) MenuPanel(state, top, menu)
        TableToast(state, top)
    }
}

@Composable
private fun TopRow(
    state: CardTableState,
    top: Dp,
    hidden: Boolean,
    canShare: Boolean,
    hasMenu: Boolean,
    onClose: () -> Unit,
    onShare: () -> Unit,
) {
    val fade by animateFloatAsState(if (hidden) 0f else 1f, tween(350), label = "tableTop")
    val rightFade by animateFloatAsState(if (state.showsTopRight) 1f else 0f, tween(350), label = "tableTopRight")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 8.dp, end = 8.dp, top = top + 6.dp)
                .alpha(fade),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RoundButton(PantopusIcon.X, "Back to the Mailbox", "cardTableClose", enabled = !hidden, onClose)
        Row(modifier = Modifier.alpha(rightFade)) {
            val on = !hidden && state.showsTopRight
            if (canShare) RoundButton(PantopusIcon.Share, "Share this card", "cardTableShare", on, onShare)
            if (hasMenu) RoundButton(PantopusIcon.MoreHorizontal, "More", "cardTableMore", on) { state.menuOpen = !state.menuOpen }
        }
    }
}

/** A round glass button, 40 across, with room to tap around it. */
@Composable
private fun RoundButton(
    icon: PantopusIcon,
    words: String,
    tag: String,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(48.dp)
                .then(
                    if (enabled) {
                        Modifier.clickable(role = Role.Button, onClickLabel = words, onClick = onClick)
                    } else {
                        Modifier
                    },
                ).semantics {
                    if (enabled) contentDescription = words
                }.testTag(tag),
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
            PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, strokeWidth = 1.8f, tint = PantopusColors.tableCream)
        }
    }
}

@Composable
private fun Words(
    state: CardTableState,
    top: Dp,
) {
    val shows by remember(state) { derivedStateOf { state.pull.x <= 0.02f && state.step != TableStep.Pulling } }
    val fade by animateFloatAsState(if (shows && state.words.isNotEmpty()) 1f else 0f, tween(400), label = "tableWords")
    val words = state.words
    if (words.isEmpty() && fade == 0f) return
    Text(
        words,
        style = tableWordsStyle,
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 24.dp, top = top + 54.dp)
                .alpha(fade)
                .semantics { liveRegion = LiveRegionMode.Polite }
                .testTag("cardTableWords"),
    )
}

@Composable
private fun ActionBlock(
    state: CardTableState,
    hidden: Boolean,
    bottom: Dp,
    sendBack: CardTableSendBack?,
) {
    val away = hidden || state.step == TableStep.Pulling
    val fade by animateFloatAsState(if (away) 0f else 1f, tween(350), label = "tableAct")
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
        Column(
            modifier =
                Modifier
                    .padding(start = 16.dp, end = 16.dp, bottom = bottom + 8.dp)
                    .alpha(fade),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            if (state.primaryLabel.isNotEmpty()) {
                val shape = RoundedCornerShape(22.dp)
                Box(
                    modifier =
                        Modifier
                            .minimumInteractiveComponentSize()
                            .clip(shape)
                            .background(PantopusColors.tableGlass)
                            .border(0.5.dp, PantopusColors.tableGlassLine, shape)
                            .then(
                                if (away) {
                                    Modifier
                                } else {
                                    Modifier.clickable(role = Role.Button, onClick = state::primary)
                                },
                            ).heightIn(min = 44.dp)
                            .padding(horizontal = 24.dp)
                            .testTag("cardTablePrimary"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(state.primaryLabel, style = tablePrimaryStyle)
                }
            }
            // Once the card has been turned over: the next kind act, one tap away (not on a sealed card).
            if (sendBack != null && state.sendBackShows) {
                Box(
                    modifier =
                        Modifier
                            .minimumInteractiveComponentSize()
                            .clip(RoundedCornerShape(22.dp))
                            .then(
                                if (away) {
                                    Modifier
                                } else {
                                    Modifier.clickable(role = Role.Button, onClick = sendBack.onClick)
                                },
                            ).heightIn(min = 44.dp)
                            .padding(horizontal = 16.dp)
                            .testTag("cardTableSendBack"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(sendBack.title, style = tableQuietStyle)
                }
            }
            Text(state.hint, style = tableHintStyle, modifier = Modifier.heightIn(min = 16.dp).testTag("cardTableHint"))
        }
    }
}

@Composable
private fun MenuPanel(
    state: CardTableState,
    top: Dp,
    menu: List<CardTableMenuItem>,
) {
    val shape = RoundedCornerShape(14.dp)
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopEnd) {
        Column(
            modifier =
                Modifier
                    .padding(end = 12.dp, top = top + 58.dp)
                    .width(IntrinsicSize.Max)
                    .widthIn(min = 220.dp)
                    .shadow(12.dp, shape)
                    .clip(shape)
                    .background(PantopusColors.tableMenu)
                    .border(0.5.dp, PantopusColors.tableGlassLine, shape)
                    .padding(6.dp)
                    .testTag("cardTableMenu"),
        ) {
            menu.forEach { item ->
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .clip(RoundedCornerShape(9.dp))
                            .clickable(role = Role.Button) {
                                state.menuOpen = false
                                item.onClick()
                            }.padding(horizontal = 12.dp)
                            .semantics { role = Role.Button }
                            .testTag(item.tag),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Text(item.title, fontSize = 14.5.sp, lineHeight = 1.35.em, color = PantopusColors.tableCream)
                }
            }
        }
    }
}

/** "Not yet", and what the screen's actions report; it fades after a moment and a screen reader reads it. */
@Composable
private fun TableToast(
    state: CardTableState,
    top: Dp,
) {
    val words = state.toast
    val fade by animateFloatAsState(if (words != null) 1f else 0f, tween(280), label = "tableToast")
    LaunchedEffect(words) {
        if (words != null) {
            delay(toastDurationMillis(words, minimumMillis = 2_600))
            state.toast = null
        }
    }
    if (words == null) return
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Text(
            words,
            fontSize = 13.5.sp,
            lineHeight = 1.35.em,
            color = PantopusColors.tableCream,
            textAlign = TextAlign.Center,
            modifier =
                Modifier
                    .padding(start = 28.dp, end = 28.dp, top = top + 62.dp)
                    .alpha(fade)
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.tableToast)
                    .padding(horizontal = 15.dp, vertical = 9.dp)
                    .semantics { liveRegion = LiveRegionMode.Polite }
                    .testTag("cardTableToast"),
        )
    }
}

/** A phone on its side has no room for the card. */
@Composable
private fun TurnTip() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.tableTipCover)
                .padding(20.dp)
                .testTag("cardTableTurnTip"),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            "Hold your phone upright for the card.",
            style = tableWordsStyle.copy(lineHeight = 1.4.em, color = PantopusColors.tableCream),
        )
    }
}
