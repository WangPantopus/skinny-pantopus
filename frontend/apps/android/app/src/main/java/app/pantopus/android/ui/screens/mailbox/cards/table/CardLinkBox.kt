@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards.table

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.data.network.NetworkMonitor
import app.pantopus.android.ui.screens.mailbox.cards.CardButton
import app.pantopus.android.ui.screens.mailbox.cards.CardButtonKind
import app.pantopus.android.ui.screens.mailbox.components.mailMessage
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** What the link box shows: the link once it's known, and what went wrong or what just happened. */
data class CardLinkState(
    val link: String? = null,
    val reading: Boolean = false,
    val said: String? = null,
)

/** Reads a card by link's link from the server when the app doesn't have it, and says plainly when it can't. */
@HiltViewModel
class CardLinkViewModel
    @Inject
    constructor(
        private val repo: HolidayCardsRepository,
        private val network: NetworkMonitor,
    ) : ViewModel() {
        private val _state = MutableStateFlow(CardLinkState())
        val state: StateFlow<CardLinkState> = _state.asStateFlow()

        fun show(link: String?) {
            if (link != null) _state.value = _state.value.copy(link = link)
        }

        /** [then] gets the link, from what's here or from the server; a failure says what happened instead. */
        fun withLink(
            cardId: String,
            then: (String) -> Unit,
        ) {
            _state.value.link?.let {
                then(it)
                return
            }
            if (_state.value.reading) return
            _state.value = _state.value.copy(reading = true, said = null)
            viewModelScope.launch {
                when (val result = repo.cardLink(cardId)) {
                    is NetworkResult.Success -> {
                        _state.value = _state.value.copy(reading = false, link = result.data)
                        then(result.data)
                    }
                    is NetworkResult.Failure -> {
                        val why = result.error.mailMessage(online = network.isOnline.value, doing = "get your link")
                        _state.value = _state.value.copy(reading = false, said = why)
                    }
                }
            }
        }

        fun say(words: String) {
            _state.value = _state.value.copy(said = words)
        }
    }

/**
 * A card by link that's still waiting: the link itself, Copy link (or "Copy link again" on a card sent earlier), and
 * Share, which opens the phone's own sheet with a line that says who it's from.
 */
@Composable
internal fun CardLinkBox(
    cardId: String,
    knownLink: String?,
    fromFirst: String,
    copyWords: String,
    modifier: Modifier = Modifier,
    viewModel: CardLinkViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(knownLink) { viewModel.show(knownLink) }
    Column(modifier = modifier.fillMaxWidth().testTag("cardLinkBox"), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        state.link?.let { link ->
            val shape = RoundedCornerShape(10.dp)
            SelectionContainer {
                Text(
                    link,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    color = PantopusColors.cardTextBody,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(shape)
                            .background(PantopusColors.cardField)
                            .border(1.dp, PantopusColors.cardFieldEdge, shape)
                            .padding(horizontal = Spacing.s3, vertical = 10.dp)
                            .testTag("cardLinkText"),
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            CardButton(
                copyWords,
                onClick = {
                    viewModel.withLink(cardId) { link ->
                        copyLink(context, link)
                        viewModel.say("Link copied.")
                    }
                },
                icon = PantopusIcon.Link,
                busy = state.reading,
                modifier = Modifier.weight(1f).testTag("cardLinkCopy"),
            )
            CardButton(
                "Share",
                onClick = { viewModel.withLink(cardId) { link -> shareLink(context, link, fromFirst) } },
                kind = CardButtonKind.Paper,
                icon = PantopusIcon.Share,
                modifier = Modifier.weight(1f).testTag("cardLinkShare"),
            )
        }
        state.said?.let {
            Text(
                it,
                fontSize = 13.sp,
                lineHeight = 18.sp,
                color = PantopusColors.cardTextQuiet,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("cardLinkSaid"),
            )
        }
    }
}

private fun copyLink(
    context: Context,
    link: String,
) {
    context.getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText("Card link", link))
}

private fun shareLink(
    context: Context,
    link: String,
    fromFirst: String,
) {
    val send =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, "A Christmas card for you from $fromFirst: $link")
        }
    context.startActivity(Intent.createChooser(send, "Send your link"))
}
