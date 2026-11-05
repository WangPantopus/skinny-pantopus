@file:Suppress("LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.crewday.prep

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayCrewViewDto
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.crewday.components.CrewDaySection
import app.pantopus.android.ui.screens.crewday.create.NewCrewDayState
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanSpotsMeter
import app.pantopus.android.ui.screens.plans.components.PlanStatusChip
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.screens.scheduling.bookingpage.QrCanvas
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import java.time.Instant
import java.time.ZoneId

/** Where the crew's day hands off. */
data class CrewDayPrepActions(
    val onBack: () -> Unit,
    /** "Share link": the system share sheet with the invitation link and a short message. */
    val onShare: (url: String, message: String) -> Unit,
    /** "Printable flyer": the web flyer in the browser. */
    val onOpenFlyer: (url: String) -> Unit,
    /** "Propose new dates" (screen 18). */
    val onProposeDates: (crewDayId: String) -> Unit,
)

/**
 * The crew's day before it starts (screen 15, board `CrewDayPrep`): status and count, what needs the crew (price
 * checks, release asks), the homes booked (labels until 6 PM the evening before), bringing in more homes, the
 * money preview, and propose new dates or cancel.
 */
@Composable
fun CrewDayPrepScreen(
    actions: CrewDayPrepActions,
    viewModel: CrewDayPrepViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val working by viewModel.working.collectAsStateWithLifecycle()
    val notice by viewModel.notice.collectAsStateWithLifecycle()
    val toast = remember { ToastController() }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(notice) {
        notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    val loaded = state as? CrewDayPrepUiState.Loaded
    PlanPlainScaffold(
        onBack = actions.onBack,
        title = loaded?.view?.title ?: "Crew Day",
        modifier = Modifier.testTag("crewDayPrep"),
    ) {
        when (val current = state) {
            CrewDayPrepUiState.Loading -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
            is CrewDayPrepUiState.Error ->
                ErrorState(
                    headline = "Couldn't load this Crew Day",
                    message = current.message,
                    onRetry = viewModel::retry,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            is CrewDayPrepUiState.Loaded -> PrepContent(current.view, working, actions, viewModel, onCopied = { toast.info("Link copied") })
        }
    }
    ToastHost(controller = toast)
}

@Composable
private fun PrepContent(
    view: CrewDayCrewViewDto,
    working: Set<String>,
    actions: CrewDayPrepActions,
    viewModel: CrewDayPrepViewModel,
    onCopied: () -> Unit,
) {
    val day = view
    val zone = CrewDayFormat.zone(day.timezone)
    var pricing by remember { mutableStateOf<CrewDayHomeDto?>(null) }
    var declining by remember { mutableStateOf<CrewDayHomeDto?>(null) }
    var releasing by remember { mutableStateOf<CrewDayHomeDto?>(null) }
    var cancelling by remember { mutableStateOf(false) }
    var showingQr by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val open = day.status == "open"
    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        PrepHeader(view, zone)
        StatusBanner(view, working, viewModel)
        NeedsYou(view, working, onPrice = { pricing = it }, onDecline = { declining = it }, onRelease = { releasing = it })
        HomesBooked(view)
        if (open) {
            BringInMore(
                view = view,
                inviting = CrewDayPrepViewModel.DAY in working,
                onShare = { view.share?.url?.let { url -> actions.onShare(url, shareMessage(view, url)) } },
                onQr = { showingQr = true },
                onCopy = {
                    view.share?.url?.let { url ->
                        clipboard.setText(AnnotatedString(url))
                        onCopied()
                    }
                },
                onFlyer = { view.share?.flyerUrl?.let(actions.onOpenFlyer) },
                onInvitePast = viewModel::invitePast,
            )
        }
        MoneyPreview(view)
        if (day.status == "open" || day.status == "in_progress") {
            CrewDaySection("If plans change") {
                PlanOptionRow(first = true) {
                    PlanTonalButton(
                        title = "Propose new dates",
                        onClick = { actions.onProposeDates(day.id) },
                        modifier = Modifier.testTag("crewDayPrepProposeDates"),
                    )
                }
                PlanOptionRow {
                    PlanTextButton(
                        title = "Cancel this Crew Day",
                        onClick = { cancelling = true },
                        danger = true,
                        modifier = Modifier.testTag("crewDayPrepCancel"),
                    )
                }
            }
        }
    }
    pricing?.let { home ->
        SetPriceDialog(
            home = home,
            onSet = { cents ->
                pricing = null
                viewModel.setPrice(home.id, cents)
            },
            onDismiss = { pricing = null },
        )
    }
    declining?.let { home ->
        DeclineDialog(
            home = home,
            onDecline = { note ->
                declining = null
                viewModel.decline(home.id, note)
            },
            onDismiss = { declining = null },
        )
    }
    releasing?.let { home ->
        AlertDialog(
            onDismissRequest = { releasing = null },
            title = { Text("Release ${homeName(home)}?") },
            text = { Text("The household asked to cancel. Releasing it costs them nothing, and the spot opens again.") },
            confirmButton = {
                TextButton(onClick = {
                    releasing = null
                    viewModel.release(home.id)
                }) { Text("Release at no charge") }
            },
            dismissButton = { TextButton(onClick = { releasing = null }) { Text("Not now") } },
        )
    }
    if (cancelling) {
        CancelDayDialog(
            homes = view.bookedCount,
            onCancel = { reason ->
                cancelling = false
                viewModel.cancelDay(reason)
            },
            onDismiss = { cancelling = false },
        )
    }
    if (showingQr) {
        view.share?.url?.let { url -> QrDialog(url = url, title = day.title, onDismiss = { showingQr = false }) }
    }
}

/** Status, date and window, the count with its meter, and when booking closes. */
@Composable
private fun PrepHeader(
    view: CrewDayCrewViewDto,
    zone: ZoneId,
) {
    val day = view
    Column(
        modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PlanStatusChip(text = dayStatusWord(day.status, view.isFull))
        Text(
            text = day.title,
            style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = CrewDayFormat.dateAndWindow(day.serviceDate, day.windowStart, day.windowEnd),
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = "${view.bookedCount} of ${day.capacity} homes booked",
            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
            color = PantopusColors.appText,
            modifier = Modifier.testTag("crewDayPrepCount"),
        )
        PlanSpotsMeter(spots = day.capacity, taken = view.bookedCount)
        CrewDayFormat.instant(day.bookingClosesAt)?.let { closes ->
            val word = if (closes.isBefore(Instant.now())) "Booking closed" else "Booking closes"
            Text(
                text = "$word ${CrewDayFormat.shortDate(closes, zone)}, ${CrewDayFormat.clock(closes, zone)}",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** A draft, a day waiting for Pantopus, one Pantopus didn't approve, or a cancelled one says so first. */
@Composable
private fun StatusBanner(
    view: CrewDayCrewViewDto,
    working: Set<String>,
    viewModel: CrewDayPrepViewModel,
) {
    val day = view
    when (day.status) {
        "draft" -> {
            PlanBanner(
                title = "Draft",
                subtitle = "Households can't see it yet. Send it to Pantopus when it's ready.",
                icon = PantopusIcon.FileText,
                tone = PlanBannerTone.Neutral,
            )
            PrimaryButton(
                title = "Send to Pantopus for approval",
                onClick = viewModel::submit,
                isLoading = CrewDayPrepViewModel.DAY in working,
                modifier = Modifier.fillMaxWidth().testTag("crewDayPrepSubmit"),
            )
        }
        "pending_review" ->
            PlanBanner(
                title = "Waiting for Pantopus",
                subtitle = "We'll tell you within a business day. Its link works once it's approved.",
                icon = PantopusIcon.Clock,
                tone = PlanBannerTone.Info,
            )
        "declined" -> {
            PlanBanner(
                title = "Pantopus didn't approve this Crew Day",
                subtitle = day.reviewNote,
                icon = PantopusIcon.AlertCircle,
                tone = PlanBannerTone.Warning,
            )
            PrimaryButton(
                title = "Send to Pantopus again",
                onClick = viewModel::submit,
                isLoading = CrewDayPrepViewModel.DAY in working,
                modifier = Modifier.fillMaxWidth().testTag("crewDayPrepSubmit"),
            )
        }
        "cancelled" ->
            PlanBanner(
                title = "This Crew Day was cancelled",
                subtitle = "Nobody was charged.",
                icon = PantopusIcon.CircleSlash,
                tone = PlanBannerTone.Neutral,
            )
        else -> Unit
    }
}

/** Price checks ("131 Maple Lane · three stories · asked Nov 10") and households asking to cancel inside the cutoff. */
@Composable
private fun NeedsYou(
    view: CrewDayCrewViewDto,
    working: Set<String>,
    onPrice: (CrewDayHomeDto) -> Unit,
    onDecline: (CrewDayHomeDto) -> Unit,
    onRelease: (CrewDayHomeDto) -> Unit,
) {
    val checks = view.needsYou.priceChecks
    val asks = view.needsYou.releaseAsks
    if (checks.isEmpty() && asks.isEmpty()) return
    val zone = CrewDayFormat.zone(view.timezone)
    CrewDaySection("Needs you", modifier = Modifier.testTag("crewDayPrepNeedsYou")) {
        checks.forEachIndexed { index, home ->
            PlanOptionRow(first = index == 0) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(
                        text =
                            listOfNotNull(
                                homeName(home),
                                home.details?.takeIf { it.isNotBlank() }?.lowercase(),
                                askedOn(home, zone),
                            ).joinToString(" · "),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        PlanTonalButton(
                            title = "Can't take it",
                            onClick = { onDecline(home) },
                            height = 44.dp,
                            enabled = home.id !in working,
                            modifier = Modifier.weight(1f).testTag("crewDayPrepCantTake"),
                        )
                        PrimaryButton(
                            title = "Set price",
                            onClick = { onPrice(home) },
                            isLoading = home.id in working,
                            modifier = Modifier.weight(1f).testTag("crewDayPrepSetPrice"),
                        )
                    }
                }
            }
        }
        asks.forEachIndexed { index, home ->
            PlanOptionRow(first = checks.isEmpty() && index == 0) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(
                        text = "${homeName(home)} asks to cancel",
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = "It's less than 48 hours to go, so only you can release it. They aren't charged.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                    PrimaryButton(
                        title = "Release at no charge",
                        onClick = { onRelease(home) },
                        isLoading = home.id in working,
                        modifier = Modifier.fillMaxWidth().testTag("crewDayPrepRelease"),
                    )
                }
            }
        }
    }
}

/** "Home 1 · Two stories · $180"; the address shows from 6 PM the evening before (the server decides). */
@Composable
private fun HomesBooked(view: CrewDayCrewViewDto) {
    val homes = view.bookings.filter { it.status !in setOf("cancelled", "declined", "refunded") }
    if (homes.isEmpty()) return
    CrewDaySection("Homes booked", modifier = Modifier.testTag("crewDayPrepHomes")) {
        homes.forEachIndexed { index, home ->
            PlanOptionRow(first = index == 0, modifier = Modifier.semantics(mergeDescendants = true) {}) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = listOfNotNull(homeName(home), home.firstName).joinToString(" · "),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text =
                            listOfNotNull(
                                jobWords(home),
                                home.priceCents?.let(CrewDayFormat::price) ?: "Price to confirm",
                            ).joinToString(" · "),
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
        if (homes.any { it.address == null }) {
            PlanOptionRow {
                Text(
                    text = "Addresses show at 6 PM the evening before.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

@Composable
private fun BringInMore(
    view: CrewDayCrewViewDto,
    inviting: Boolean,
    onShare: () -> Unit,
    onQr: () -> Unit,
    onCopy: () -> Unit,
    onFlyer: () -> Unit,
    onInvitePast: () -> Unit,
) {
    CrewDaySection("Bring in more homes") {
        PlanOptionRow(first = true) {
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PlanTonalButton(
                        title = "Share link",
                        onClick = onShare,
                        height = 44.dp,
                        enabled = view.share?.url != null,
                        modifier = Modifier.weight(1f).testTag("crewDayPrepShare"),
                    )
                    PlanTonalButton(
                        title = "QR code",
                        onClick = onQr,
                        height = 44.dp,
                        enabled = view.share?.url != null,
                        modifier = Modifier.weight(1f).testTag("crewDayPrepQR"),
                    )
                }
                PlanTonalButton(
                    title = "Copy link",
                    onClick = onCopy,
                    height = 44.dp,
                    enabled = view.share?.url != null,
                    modifier = Modifier.testTag("crewDayPrepCopyLink"),
                )
                PlanTonalButton(
                    title = "Printable flyer",
                    onClick = onFlyer,
                    height = 44.dp,
                    enabled = view.share?.flyerUrl != null,
                    modifier = Modifier.testTag("crewDayPrepFlyer"),
                )
            }
        }
        PlanOptionRow {
            Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text =
                        when (view.pastCustomers) {
                            0 -> "No homes you served near here yet."
                            1 -> "1 home you served near here."
                            else -> "${view.pastCustomers} homes you served near here."
                        },
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                PlanTonalButton(
                    title = "Invite past customers",
                    onClick = onInvitePast,
                    height = 44.dp,
                    enabled = view.pastCustomers > 0,
                    loading = inviting,
                    modifier = Modifier.testTag("crewDayPrepInvitePast"),
                )
            }
        }
    }
}

/** "If all 6 are done: $1,020 charged · you receive $918 after the 10% founding fee." */
@Composable
private fun MoneyPreview(view: CrewDayCrewViewDto) {
    val money = view.money
    if (money.grossCents <= 0) return
    val percent = money.feeRate?.let { "${(it * 100).let { p -> if (p % 1.0 == 0.0) p.toInt().toString() else "%.1f".format(p) }}%" }
    Text(
        text =
            "If all ${view.bookedCount} are done: ${CrewDayFormat.price(money.grossCents)} charged · you receive " +
                "${CrewDayFormat.price(money.netCents)}${percent?.let { " after the $it fee" }.orEmpty()}.",
        style = PantopusTextStyle.small,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.testTag("crewDayPrepMoney"),
    )
}

@Composable
private fun SetPriceDialog(
    home: CrewDayHomeDto,
    onSet: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    var price by remember { mutableStateOf("") }
    val cents = NewCrewDayState.cents(price)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Price for ${homeName(home)}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text("The household approves it before they're booked. It includes any tax you owe.")
                PlanTextArea(
                    value = price,
                    onValue = { price = it },
                    placeholder = "$",
                    label = "Price in dollars",
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { cents?.let(onSet) }, enabled = cents != null) {
                Text(cents?.let { "Send ${CrewDayFormat.price(it)}" } ?: "Send price")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
    )
}

@Composable
private fun DeclineDialog(
    home: CrewDayHomeDto,
    onDecline: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Can't take ${homeName(home)}?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text("We tell the household, and they aren't charged anything.")
                PlanTextArea(
                    value = note,
                    onValue = { note = it.take(500) },
                    placeholder = "Why (optional)",
                    label = "Why you can't take it",
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onDecline(note.trim().ifEmpty { null }) }) { Text("Can't take it", color = PantopusColors.error) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
    )
}

@Composable
private fun CancelDayDialog(
    homes: Int,
    onCancel: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (homes == 1) "Cancel for the 1 home?" else "Cancel for all $homes homes?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text("Nobody is charged. We tell every household.")
                PlanTextArea(
                    value = reason,
                    onValue = { reason = it.take(500) },
                    placeholder = "Why (optional)",
                    label = "Why you're cancelling",
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onCancel(reason.trim().ifEmpty { null }) }) { Text("Cancel Crew Day", color = PantopusColors.error) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Keep it") } },
    )
}

/** The invitation's QR code, big enough to scan off the phone. */
@Composable
private fun QrDialog(
    url: String,
    title: String,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("crewDayQRSheet"),
        title = { Text(title) },
        text = {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Box(
                    modifier =
                        Modifier
                            .testTag("crewDayQRCode")
                            .size(240.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(PantopusColors.appSurface)
                            .padding(Spacing.s3)
                            .semantics { contentDescription = "QR code for the Crew Day's link" },
                ) {
                    QrCanvas(url = url, modifier = Modifier.size(216.dp), foreground = PantopusColors.appText)
                }
                Text("Neighbors scan it to see their price.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}

/** "asked Nov 10". */
private fun askedOn(
    home: CrewDayHomeDto,
    zone: ZoneId,
): String? = CrewDayFormat.shortDate(CrewDayFormat.instant(home.createdAt), zone)?.let { "asked ${it.substringAfter(", ")}" }

/** "Two stories · gutter guards". */
private fun jobWords(home: CrewDayHomeDto): String? =
    home.details?.takeIf { it.isNotBlank() }

/** "Home 3", or the address once the crew may see it. */
private fun homeName(home: CrewDayHomeDto): String = home.address?.line ?: home.label ?: "A home"

private fun dayStatusWord(
    status: String?,
    full: Boolean,
): String =
    when (status) {
        "draft" -> "Draft"
        "pending_review" -> "Waiting for approval"
        "declined" -> "Not approved"
        "open" -> if (full) "Full" else "Open"
        "in_progress" -> "Today"
        "done" -> "Done"
        "cancelled" -> "Cancelled"
        else -> "Open"
    }

private fun shareMessage(
    view: CrewDayCrewViewDto,
    url: String,
): String =
    view.share?.message?.takeIf { it.isNotBlank() }
        ?: "${view.title} is coming ${CrewDayFormat.shortDate(view.serviceDate).orEmpty()}. See your home's price: $url"
