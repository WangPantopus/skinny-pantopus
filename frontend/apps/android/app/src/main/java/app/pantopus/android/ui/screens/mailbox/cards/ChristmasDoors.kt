@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.HolidayCardsRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

// The ways into a Christmas card outside the Mailbox's own row (TABCARD, founder 2026-11-13): the Mail tab's red
// envelope, Today's countdown, a person's page and a chat's menu, and the side menu. Each opens the existing send flow
// (`ChildRoutes.MAILBOX_CARDS`) and hides exactly when the Mailbox's "Send a Christmas card" row hides
// ([HolidayCardsRepository.cardsOpen]).

/**
 * Today on the device's clock. In a debug build only, the day the `PANTOPUS_DEBUG_TODAY=YYYY-MM-DD` intent extra names
 * (`adb shell am start -n <package>/app.pantopus.android.MainActivity --es PANTOPUS_DEBUG_TODAY 2026-12-26`), so the
 * Mail tab's envelope and Today's countdown can be checked on any day; a release build never reads it.
 */
object ChristmasToday {
    /** The intent extra's name (TABCARD §6, "Checking dates"). */
    const val DEBUG_EXTRA = "PANTOPUS_DEBUG_TODAY"

    @Volatile
    private var debugDay: LocalDate? = null

    /** Debug builds: the launch's `PANTOPUS_DEBUG_TODAY`, or none. Does nothing in a release build. */
    fun takeDebugDay(raw: String?) {
        if (!BuildConfig.DEBUG) return
        debugDay = raw?.let { runCatching { LocalDate.parse(it.trim()) }.getOrNull() }
    }

    fun date(): LocalDate = debugDay?.takeIf { BuildConfig.DEBUG } ?: LocalDate.now()
}

/**
 * The Mail tab wears the red envelope from November 1 through December 25, on the device's date (founder 2026-11-13:
 * "make that right now immediately, we do not need to wait until Thanksgiving"), while cards are open.
 */
fun isChristmasMailSeason(now: LocalDate): Boolean = now.monthValue == 11 || (now.monthValue == 12 && now.dayOfMonth <= 25)

/** Whole calendar days from [now] to December 25 of its year: 0 on Christmas Day, below 0 after it. */
fun daysToChristmas(now: LocalDate): Long = ChronoUnit.DAYS.between(now, LocalDate.of(now.year, 12, 25))

/** Today's countdown shows while Christmas is 1 to 45 days away. */
fun showsChristmasCountdown(days: Long): Boolean = days in 1L..CHRISTMAS_COUNTDOWN_DAYS

private const val CHRISTMAS_COUNTDOWN_DAYS = 45L

/**
 * Whether a way into a card shows: cards are open ([open]), read once if nothing has read them yet, and, for a person's
 * page or a chat, whether a card can go to that person ([sendableTo]): the send flow's own check
 * (`GET /api/mailbox/cards/arrivals?to=`: not yourself, no block either way, someone you can find by name).
 */
@HiltViewModel
class ChristmasCardDoorsViewModel
    @Inject
    constructor(
        private val cards: HolidayCardsRepository,
    ) : ViewModel() {
        /**
         * Cards are open for the signed-in account. Before this launch's first read it is the last answer this phone
         * read for the account, so the Mail tab's red envelope shows on the first frame of a launch.
         */
        val open: StateFlow<Boolean> = cards.open.stateIn(viewModelScope, SharingStarted.Eagerly, cards.openNow())

        private val _sendableTo = MutableStateFlow<String?>(null)

        /** The person [checkPerson] found a card can go to, by user id; null until the check says yes. */
        val sendableTo: StateFlow<String?> = _sendableTo.asStateFlow()

        private var checked: String? = null

        init {
            viewModelScope.launch { cards.loadIfNeeded() }
        }

        /** The app came back: the cards are read again when the last answer is a minute old. */
        fun refresh() {
            viewModelScope.launch { cards.refreshIfStale() }
        }

        /** Asks once per person whether a card can go to [userId]; a failed check is asked again next time. */
        fun checkPerson(userId: String) {
            if (userId.isBlank() || checked == userId) return
            checked = userId
            _sendableTo.value = null
            viewModelScope.launch {
                cards.loadIfNeeded()
                val yes = HolidayCardsRepository.cardsOpen(cards.latest.value) && cards.arrivalsFor(userId) is NetworkResult.Success
                if (checked != userId) return@launch
                if (yes) _sendableTo.value = userId else checked = null
            }
        }
    }

/**
 * The season's Mail icon (board Main, row 3): a red envelope with a small gold seal where the flap meets. It keeps its
 * own colours whether the tab is selected or not.
 */
@Composable
fun ChristmasEnvelopeIcon(
    size: Dp,
    modifier: Modifier = Modifier,
) {
    val body = PantopusColors.cardEnvelope
    val flap = PantopusColors.cardEnvelopeInk
    val seal = PantopusColors.tableGold
    Canvas(modifier = modifier.size(size)) {
        val u = this.size.minDimension / 24f
        val left = 2f * u
        val top = 5f * u
        val width = 20f * u
        val height = 14.5f * u
        drawRoundRect(color = body, topLeft = Offset(left, top), size = Size(width, height), cornerRadius = CornerRadius(2.2f * u))
        val tip = Offset(12f * u, 12.6f * u)
        val v =
            Path().apply {
                moveTo(left + 0.9f * u, top + 0.9f * u)
                lineTo(tip.x, tip.y)
                lineTo(left + width - 0.9f * u, top + 0.9f * u)
            }
        drawPath(v, color = flap, style = Stroke(width = 1.5f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawCircle(color = seal, radius = 2.7f * u, center = tip)
    }
}

/**
 * Today's countdown (board Today; TABCARD §2a): CHRISTMAS, the days left on a red tile, "Who is far away this year?",
 * and Send a Christmas card, on the paper and red of the Mailbox's card row.
 */
@Composable
fun ChristmasCountdownCard(
    days: Long,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.xl)
    val unit = if (days == 1L) "day" else "days"
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .padding(Spacing.s4)
                .testTag("today.christmasCountdown"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            "CHRISTMAS",
            fontSize = 11.sp,
            lineHeight = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.4.sp,
            color = PantopusColors.cardSectionInk,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3), verticalAlignment = Alignment.CenterVertically) {
            Column(
                modifier =
                    Modifier
                        .defaultMinSize(minWidth = 64.dp, minHeight = 64.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.cardWax)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .clearAndSetSemantics { contentDescription = "$days $unit" },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Text("$days", fontSize = 28.sp, lineHeight = 32.sp, fontWeight = FontWeight.Bold, color = PantopusColors.cardWaxText)
                Text(unit, fontSize = 12.sp, lineHeight = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.cardWaxText)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    "Who is far away this year?",
                    fontSize = 18.sp,
                    lineHeight = 23.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.cardWax,
                )
                Text(
                    "A card from you will mean more than you think.",
                    fontSize = 14.sp,
                    lineHeight = 19.sp,
                    color = PantopusColors.cardTextBody,
                )
            }
        }
        CardButton("Send a Christmas card", onClick = onSend, modifier = Modifier.testTag("today.christmasCountdown.send"))
    }
}

/**
 * The personal side menu's cream row above Manage (board SideMenu; TABCARD §2d): the red envelope, "Send a Christmas
 * card" and "Until December 31". Its id follows the menu's rows (`navDrawer.item.<slug>`).
 */
@Composable
fun ChristmasMenuRow(
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier
                .padding(horizontal = Spacing.s3)
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.cardNotePaper)
                .border(1.dp, PantopusColors.cardNoteEdge, shape)
                .clickable(onClick = onOpen)
                .defaultMinSize(minHeight = 52.dp)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .clearAndSetSemantics {
                    contentDescription = "Send a Christmas card. Until December 31"
                    role = Role.Button
                }.testTag("navDrawer.item.send-a-christmas-card"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        ChristmasEnvelopeIcon(size = 22.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                "Send a Christmas card",
                fontSize = 15.sp,
                lineHeight = 19.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.cardWax,
            )
            Text(
                "Until December 31",
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = PantopusColors.cardTextBody,
                textAlign = TextAlign.Start,
            )
        }
    }
}
