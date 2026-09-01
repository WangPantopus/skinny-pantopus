@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.scheduling.bookingpage

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.MailDraft
import app.pantopus.android.ui.components.composeMail
import app.pantopus.android.ui.components.shareText
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingLoadingSkeleton
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val COPIED_RESET_MS = 1600L

@Composable
fun OneOffLinkGeneratorScreen(
    onBack: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: OneOffLinkGeneratorViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appSurface)) {
        OneOffTopBar(onClose = onBack)
        when (val s = state) {
            OneOffUiState.Loading -> SchedulingLoadingSkeleton(modifier = Modifier.fillMaxSize(), rows = 4)
            OneOffUiState.NeedsEventType ->
                EmptyState(
                    icon = PantopusIcon.CalendarPlus,
                    headline = "Create an event type first",
                    subcopy = "A one-off link points at one of your services. Add one, then mint a private link.",
                    ctaTitle = "Create event type",
                    // One-off links are personal-only (VM pins Personal) — open the personal catalog.
                    onCta = { onNavigate(SchedulingRoutes.eventTypeList(null, null)) },
                )
            is OneOffUiState.Error -> ErrorState(headline = "Couldn't load", message = s.message, onRetry = viewModel::refresh)
            is OneOffUiState.Config -> ConfigBody(s.data, viewModel)
            is OneOffUiState.Generated -> GeneratedBody(s.result, viewModel, onCreateAnother = viewModel::createAnother)
        }
    }
}

@Composable
private fun OneOffTopBar(onClose: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(onClickLabel = "Close", onClick = onClose)
                    .testTag("oneOffClose"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.X, contentDescription = "Close", size = 20.dp, tint = PantopusColors.appText)
        }
    }
}

@Composable
private fun SheetTitle() {
    Row(verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f)) {
            Text("Create a one-off link", color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text(
                "Send a private link for one person.",
                color = PantopusColors.appTextSecondary,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 3.dp),
            )
        }
        BLHeaderPill(SchedulingPillar.Personal)
    }
}

@Composable
private fun ConfigBody(
    cfg: OneOffConfig,
    viewModel: OneOffLinkGeneratorViewModel,
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            SheetTitle()

            SectionLabel("Event type")
            EventTypePicker(cfg, viewModel::selectEventType, viewModel::setDuration)

            cfg.error?.let { ErrorNote(it, onRetry = viewModel::generate) }

            SectionLabel("Availability")
            OfferTimesCard(cfg, viewModel::toggleOfferTimes, viewModel::addProposedSlot, viewModel::removeSlot)

            SectionLabel("Link expires")
            ExpiryChips(cfg.expiry, viewModel::setExpiry)

            SectionLabel("Options")
            OptionsCard(cfg, viewModel::toggleSingleUse, viewModel::toggleAskIntake)
        }
        GenerateBar(creating = cfg.creating, onGenerate = viewModel::generate)
    }
}

/** "30 min · video" — duration plus the booking mode, mirroring the design. */
private fun eventTypeSubLabel(
    duration: Int,
    locationMode: String?,
): String {
    val mode =
        when (locationMode) {
            "video" -> "video"
            "phone" -> "phone"
            "in_person" -> "in person"
            else -> null
        }
    return if (mode != null) "$duration min · $mode" else "$duration min"
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(java.util.Locale.US),
        color = PantopusColors.appTextSecondary,
        fontWeight = FontWeight.Bold,
        fontSize = 9.5.sp,
        modifier = Modifier.padding(bottom = Spacing.s1),
    )
}

@Composable
private fun EventTypePicker(
    cfg: OneOffConfig,
    onSelect: (String) -> Unit,
    onDuration: (Int) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val selected = cfg.selected
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = cfg.eventTypes.size > 1) { expanded = !expanded }
                    .padding(11.dp)
                    .testTag("oneOffEventType"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Box(
                modifier = Modifier.size(34.dp).clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.primary50),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = serviceIcon(selected?.locationMode),
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.primary600,
                )
            }
            Column(Modifier.weight(1f)) {
                Text(selected?.name.orEmpty(), color = PantopusColors.appText, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Text(
                    eventTypeSubLabel(cfg.selectedDuration, selected?.locationMode),
                    color = PantopusColors.appTextSecondary,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 1.dp),
                )
            }
            if (cfg.eventTypes.size > 1) {
                PantopusIconImage(
                    icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
        if (expanded) {
            cfg.eventTypes.filter { it.id != cfg.selectedId }.forEach { opt ->
                Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
                Text(
                    "${opt.name} · ${opt.defaultDuration} min",
                    color = PantopusColors.appText,
                    fontSize = 13.sp,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                onSelect(opt.id)
                                expanded = false
                            }
                            .padding(11.dp)
                            .testTag("oneOffOption_${opt.id}"),
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Column(modifier = Modifier.padding(11.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s2),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "Custom duration",
                    color = PantopusColors.appTextStrong,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.sp,
                )
                Text("minutes", color = PantopusColors.appTextMuted, fontSize = 10.sp)
            }
            ChipScrollRow(
                cfg.selected?.durations.orEmpty().map { it.toString() },
                cfg.selectedDuration.toString(),
            ) { onDuration(it.toInt()) }
        }
    }
}

@Composable
private fun OfferTimesCard(
    cfg: OneOffConfig,
    onToggle: () -> Unit,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 11.dp),
    ) {
        BLToggleRow(
            label = "Offer specific times",
            sub = if (cfg.offerSpecificTimes) "They pick from the times you propose." else "We'll show your full availability.",
            on = cfg.offerSpecificTimes,
            onToggle = onToggle,
            last = !cfg.offerSpecificTimes,
        )
        if (cfg.offerSpecificTimes) {
            cfg.offeredSlots.forEachIndexed { index, slot ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Box(
                        modifier = Modifier.size(30.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Calendar,
                            contentDescription = null,
                            size = 14.dp,
                            tint = PantopusColors.primary600,
                        )
                    }
                    Column(Modifier.weight(1f)) {
                        Text(
                            "${slot.weekday} · ${slot.date}",
                            color = PantopusColors.appText,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.5.sp,
                        )
                        Text(
                            slot.timeRange,
                            color = PantopusColors.appTextSecondary,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 1.dp),
                        )
                    }
                    Box(
                        modifier = Modifier.size(24.dp).clip(CircleShape).clickable { onRemove(index) }.testTag("removeSlot_$index"),
                        contentAlignment = Alignment.Center,
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.X,
                            contentDescription = "Remove time",
                            size = 15.dp,
                            tint = PantopusColors.appTextMuted,
                        )
                    }
                }
            }
            Row(
                modifier = Modifier.clickable(onClick = onAdd).padding(vertical = 9.dp).testTag("oneOffAddTime"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 13.dp, tint = PantopusColors.primary600)
                Text("Add a time", color = PantopusColors.primary600, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ExpiryChips(
    selected: ExpiryOption,
    onSelect: (ExpiryOption) -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        ExpiryOption.entries.forEach { option ->
            val on = option == selected
            Text(
                option.label,
                color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                fontSize = 12.sp,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(1.dp, if (on) PantopusColors.primary600 else PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3, vertical = 7.dp)
                        .testTag("expiry_${option.name}"),
            )
        }
    }
}

@Composable
private fun ChipScrollRow(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        options.forEach { option ->
            val on = option == selected
            Text(
                option,
                color = if (on) PantopusColors.appTextInverse else PantopusColors.appTextStrong,
                fontWeight = if (on) FontWeight.Bold else FontWeight.SemiBold,
                fontSize = 12.sp,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (on) PantopusColors.primary600 else PantopusColors.appSurface)
                        .border(1.dp, if (on) PantopusColors.primary600 else PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                        .clickable { onSelect(option) }
                        .padding(horizontal = Spacing.s3, vertical = 7.dp)
                        .testTag("duration_$option"),
            )
        }
    }
}

@Composable
private fun OptionsCard(
    cfg: OneOffConfig,
    onSingleUse: () -> Unit,
    onAskIntake: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(horizontal = 11.dp),
    ) {
        BLToggleRow(
            label = "Single use",
            sub = "Link stops working after one booking.",
            icon = PantopusIcon.Tag,
            on = cfg.singleUse,
            onToggle = onSingleUse,
        )
        BLToggleRow(
            label = "Ask intake questions",
            sub = "Collect details before they book.",
            icon = PantopusIcon.ClipboardList,
            on = cfg.askIntake,
            onToggle = onAskIntake,
            last = true,
        )
    }
}

@Composable
private fun ErrorNote(
    message: String,
    onRetry: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.errorBg)
                .border(1.dp, PantopusColors.errorLight, RoundedCornerShape(Radii.xl))
                .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 16.dp, tint = PantopusColors.error)
        Column(Modifier.weight(1f)) {
            Text(message, color = PantopusColors.error, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
            Text(
                "Your settings are saved — nothing was lost.",
                color = PantopusColors.error,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
            Row(
                modifier = Modifier.clickable(onClick = onRetry).padding(top = 7.dp).testTag("oneOffTryAgain"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.RefreshCw, contentDescription = null, size = 13.dp, tint = PantopusColors.error)
                Text("Try again", color = PantopusColors.error, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun GenerateBar(
    creating: Boolean,
    onGenerate: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s2, bottom = Spacing.s5),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = Spacing.s2)
                    .height(46.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(if (creating) PantopusColors.appSurfaceSunken else PantopusColors.primary600)
                    .then(if (creating) Modifier else Modifier.clickable(onClick = onGenerate))
                    .testTag("oneOffGenerate"),
            contentAlignment = Alignment.Center,
        ) {
            if (creating) {
                androidx.compose.material3.CircularProgressIndicator(
                    color = PantopusColors.appTextSecondary,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    PantopusIconImage(
                        icon = PantopusIcon.Link,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                    Text("Generate link", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun GeneratedBody(
    result: OneOffResult,
    viewModel: OneOffLinkGeneratorViewModel,
    onCreateAnother: () -> Unit,
) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var copied by remember { mutableStateOf(false) }
    LaunchedEffect(copied) {
        if (copied) {
            kotlinx.coroutines.delay(COPIED_RESET_MS)
            copied = false
        }
    }
    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(11.dp)) {
                Box(
                    modifier = Modifier.size(40.dp).clip(CircleShape).background(PantopusColors.success),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Check,
                        contentDescription = null,
                        size = 20.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text("Link ready", color = PantopusColors.appText, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(
                        "A private link for one person.",
                        color = PantopusColors.appTextSecondary,
                        fontSize = 11.5.sp,
                        modifier = Modifier.padding(top = 1.dp),
                    )
                }
            }
            ResultUrlCard(result.url, copied) {
                clipboard.setText(AnnotatedString(result.url))
                copied = true
            }
            MetaChip(result.expiryLabel, result.singleUse)
            SectionLabel("Send via")
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                ShareTargetButton(PantopusIcon.Share, "Share", Modifier.weight(1f), maxTile = 54.dp) { context.shareText(result.url) }
                ShareTargetButton(PantopusIcon.MessageCircle, "Messages", Modifier.weight(1f), maxTile = 54.dp) {
                    context.shareText(result.url)
                }
                ShareTargetButton(PantopusIcon.Mail, "Email", Modifier.weight(1f), maxTile = 54.dp) {
                    context.composeMail(MailDraft(subject = "Book a time with me", body = "Here's a private link: ${result.url}"))
                }
            }
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Row(
                    modifier = Modifier.clickable(onClick = onCreateAnother).padding(Spacing.s2).testTag("oneOffCreateAnother"),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
                    Text("Create another", color = PantopusColors.primary600, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                }
            }
        }
        if (copied) {
            CopiedToast(message = "Link copied", modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = Spacing.s10))
        }
    }
}

@Composable
private fun ResultUrlCard(
    url: String,
    copied: Boolean,
    onCopy: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(start = Spacing.s3, top = Spacing.s2, bottom = Spacing.s2, end = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MonoUrlText(url = url, modifier = Modifier.weight(1f))
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (copied) PantopusColors.success else PantopusColors.primary600)
                    .clickable(onClick = onCopy)
                    .padding(horizontal = 14.dp, vertical = 9.dp)
                    .testTag("oneOffCopy"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = if (copied) PantopusIcon.Check else PantopusIcon.Copy,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
            Text(if (copied) "Copied" else "Copy", color = PantopusColors.appTextInverse, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun MetaChip(
    expiryLabel: String,
    singleUse: Boolean,
) {
    // Spec: two inline segments (calendar-clock + expiry · ticket + usage) with a dot separator.
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = 11.dp, vertical = Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        MetaSegment(icon = PantopusIcon.CalendarClock, text = expiryLabel)
        Box(modifier = Modifier.size(3.dp).clip(CircleShape).background(PantopusColors.appTextMuted))
        MetaSegment(icon = PantopusIcon.Ticket, text = if (singleUse) "Single use" else "Multi-use")
    }
}

@Composable
private fun MetaSegment(
    icon: PantopusIcon,
    text: String,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 12.dp, tint = PantopusColors.appTextStrong)
        Text(text, color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
    }
}
