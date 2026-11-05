@file:Suppress("LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.crewday.booking

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.crewday.CrewDayBookingDto
import app.pantopus.android.data.api.models.crewday.CrewDayPublicDto
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.scheduling.bookingpage.QrCanvas
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** The note for the crew: the gate, pets, parking. Up to 500 characters. */
@Composable
fun CrewDayNoteDialog(
    initial: String,
    onSave: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var note by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("crewDayNoteDialog").closesKeyboardOnTapOrScroll(),
        title = { Text("Note for the crew") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanTextArea(
                    value = note,
                    onValue = { note = it.take(MAX_NOTE) },
                    placeholder = "Gate, pets, parking…",
                    label = "Note for the crew",
                )
                Text(
                    text = "The crew sees this on the day. It's deleted a week after the job.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
        },
        confirmButton = { TextButton(onClick = { onSave(note) }, modifier = Modifier.testTag("crewDayNoteSave")) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
    )
}

private const val MAX_NOTE = 500

/**
 * Change or cancel (screen 8, board `Cancel`). Before the cutoff: change the home's details (you approve any new
 * price first), edit the note, cancel for free. After it: the note, and ask the crew to cancel.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CrewDayChangeSheet(
    booking: CrewDayBookingDto,
    prices: CrewDayPublicDto?,
    working: Set<String>,
    onEditNote: () -> Unit,
    onChangeDetails: (optionId: String, addOnIds: List<String>) -> Unit,
    onCancel: () -> Unit,
    onAskRelease: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var changing by remember { mutableStateOf(false) }
    var confirming by remember { mutableStateOf(false) }
    val zone = CrewDayFormat.zone(booking.crewDay?.timezone)
    val cutoff = CrewDayFormat.instant(booking.cancelCutoffAt)
    val title = booking.crewDay?.title.orEmpty()
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, modifier = Modifier.testTag("crewDayCancel")) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Change or cancel",
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            if (changing && prices != null) {
                ChangeDetails(booking, prices, CrewDayBookingViewModel.CHANGE in working, onChangeDetails) { changing = false }
                return@Column
            }
            PlanFormCard {
                if (booking.canChange) {
                    SheetRow(
                        title = "Change my home details",
                        body = "Stories and add-ons. You approve any new price first.",
                        first = true,
                        tag = "crewDayCancelChange",
                        onClick = { changing = true },
                    )
                }
                SheetRow(
                    title = "Edit the note for the crew",
                    body = null,
                    first = !booking.canChange,
                    tag = "crewDayCancelNote",
                    onClick = onEditNote,
                )
            }
            when {
                booking.canCancel ->
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        PlanTextButton(
                            title = "Cancel my booking",
                            onClick = { confirming = true },
                            danger = true,
                            modifier = Modifier.testTag("crewDayCancelBooking"),
                        )
                        cutoff?.let {
                            Text(
                                text =
                                    "Free until ${CrewDayFormat.shortDate(it, zone)} at ${CrewDayFormat.clock(it, zone)}. " +
                                        "Nothing has been charged.",
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextSecondary,
                            )
                        }
                    }
                booking.canAskRelease ->
                    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        PlanTonalButton(
                            title = "Ask the crew to cancel",
                            onClick = onAskRelease,
                            loading = CrewDayBookingViewModel.RELEASE in working,
                            modifier = Modifier.testTag("crewDayCancelAskCrew"),
                        )
                        Text(
                            text = "It's less than 48 hours to go. ${booking.crewName} can release your home at no charge.",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                booking.releaseAskedAt != null ->
                    Text(
                        text = "You asked ${booking.crewName} to release your home. They'll answer in Messages.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.testTag("crewDayCancelAsked"),
                    )
            }
            Box(modifier = Modifier.size(Spacing.s4))
        }
    }
    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Cancel your ${title.substringBefore(" on ").ifBlank { "Crew Day" }} booking?") },
            text = { Text("Nothing has been charged, and nothing will be.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        onCancel()
                    },
                    modifier = Modifier.testTag("crewDayCancelConfirm"),
                ) { Text("Cancel booking", color = PantopusColors.error) }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text("Keep it") } },
        )
    }
}

@Composable
private fun SheetRow(
    title: String,
    body: String?,
    first: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    PlanOptionRow(first = first, onClick = onClick, modifier = Modifier.testTag(tag)) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
            body?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

private const val LOOK_FIRST_WORDS = "The crew confirms the new price before you're booked."

/** The day's options and add-ons, with the new total; a look-first option sends it back to the crew for a price. */
@Composable
private fun ChangeDetails(
    booking: CrewDayBookingDto,
    prices: CrewDayPublicDto,
    saving: Boolean,
    onSave: (String, List<String>) -> Unit,
    onBack: () -> Unit,
) {
    val currentOption = booking.option?.id ?: booking.lineItems.firstOrNull { it.kind == "option" }?.id
    var optionId by remember { mutableStateOf(currentOption) }
    var addOns by remember { mutableStateOf(booking.addOns.map { it.id }.toSet()) }
    val option = prices.priceOptions.firstOrNull { it.id == optionId }
    val total =
        option?.takeIf { !it.needsLook }?.priceCents?.let { base ->
            base + prices.addOns.filter { it.id in addOns }.sumOf { it.priceCents }
        }
    PlanFormCard {
        prices.priceOptions.forEachIndexed { index, choice ->
            val selected = choice.id == optionId
            PlanOptionRow(
                first = index == 0,
                onClick = { optionId = choice.id },
                modifier = Modifier.semantics { this.selected = selected }.testTag("crewDayCancelOption_${choice.id}"),
            ) {
                RadioButton(selected = selected, onClick = null)
                Text(text = choice.label, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
                Text(
                    text = if (choice.needsLook) "After a look" else CrewDayFormat.price(choice.priceCents),
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
            }
        }
    }
    if (prices.addOns.isNotEmpty()) {
        PlanFormCard {
            prices.addOns.forEachIndexed { index, addOn ->
                PlanOptionRow(first = index == 0) {
                    PantopusCheckbox(
                        isChecked = addOn.id in addOns,
                        onCheckedChange = { on -> addOns = if (on) addOns + addOn.id else addOns - addOn.id },
                        label = "${addOn.label} · +${CrewDayFormat.price(addOn.priceCents)}",
                    )
                }
            }
        }
    }
    Text(
        text = total?.let { "New total: ${CrewDayFormat.price(it)} · including tax" } ?: LOOK_FIRST_WORDS,
        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
        color = PantopusColors.appText,
    )
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PlanTonalButton(title = "Back", onClick = onBack, height = 44.dp, modifier = Modifier.weight(1f))
        PrimaryButton(
            title = "Save",
            onClick = { optionId?.let { onSave(it, addOns.toList()) } },
            isEnabled = optionId != null,
            isLoading = saving,
            modifier = Modifier.weight(1f).testTag("crewDayCancelSaveDetails"),
        )
    }
}

/**
 * The share kit (screen 12, board `Share`): the count only, the drafted message (editable), the link's preview
 * (street and date, never the address), Copy link, Share…, the QR code and the printable flyer.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CrewDayShareSheet(
    booking: CrewDayBookingDto,
    onShare: (String) -> Unit,
    onOpenFlyer: () -> Unit,
    onDismiss: () -> Unit,
) {
    val share = booking.share ?: return
    val url = share.url ?: return
    val clipboard = LocalClipboardManager.current
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var message by remember { mutableStateOf(share.message?.takeIf { it.isNotBlank() } ?: url) }
    var showingQr by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheet, modifier = Modifier.testTag("crewDayShare")) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .navigationBarsPadding()
                    .closesKeyboardOnTapOrScroll(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Share with neighbors",
                style = PantopusTextStyle.h3.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text =
                    "${if (share.bookedCount == 1) "1 home" else "${share.bookedCount} homes"} booked · " +
                        "room for ${share.spotsLeft} more",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("crewDayShareCount"),
            )
            PlanTextArea(
                value = message,
                onValue = { message = it },
                placeholder = "Your message",
                label = "Message to neighbors",
                minHeight = 110.dp,
            )
            // The link's preview: the street and the date, never the address.
            Column(
                modifier = Modifier.fillMaxWidth().planCard().padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = booking.crewDay?.title.orEmpty(),
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appText,
                )
                Text(
                    text = listOfNotNull(CrewDayFormat.shortDate(booking.serviceDate), booking.crewDay?.city).joinToString(" · "),
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                Text(text = "Never your address.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlanTonalButton(
                    title = if (copied) "Copied" else "Copy link",
                    onClick = {
                        clipboard.setText(AnnotatedString(url))
                        copied = true
                    },
                    height = 44.dp,
                    modifier = Modifier.weight(1f).testTag("crewDayShareCopy"),
                )
                PrimaryButton(
                    title = "Share…",
                    onClick = { onShare(message) },
                    modifier = Modifier.weight(1f).testTag("crewDayShareShare"),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PlanTonalButton(
                    title = "Show QR code",
                    onClick = { showingQr = true },
                    height = 44.dp,
                    modifier = Modifier.weight(1f).testTag("crewDayShareQR"),
                )
                PlanTonalButton(
                    title = "Printable flyer",
                    onClick = onOpenFlyer,
                    height = 44.dp,
                    enabled = share.flyerUrl != null,
                    modifier = Modifier.weight(1f).testTag("crewDayShareFlyer"),
                )
            }
            Box(modifier = Modifier.size(Spacing.s4))
        }
    }
    if (showingQr) {
        AlertDialog(
            onDismissRequest = { showingQr = false },
            modifier = Modifier.testTag("crewDayQRSheet"),
            title = { Text(booking.crewDay?.title.orEmpty()) },
            text = {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Box(
                        modifier =
                            Modifier
                                .testTag("crewDayQRCode")
                                .size(240.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(PantopusColors.appSurface)
                                .padding(Spacing.s3),
                    ) {
                        QrCanvas(url = url, modifier = Modifier.size(216.dp), foreground = PantopusColors.appText)
                    }
                    Text("Neighbors scan it to see their price.", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                }
            },
            confirmButton = { TextButton(onClick = { showingQr = false }) { Text("Done") } },
        )
    }
}
