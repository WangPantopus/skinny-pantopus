@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions", "LongParameterList")

package app.pantopus.android.ui.screens.mailbox.translation

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.mailbox.translation.components.LanguageBadge
import app.pantopus.android.ui.screens.mailbox.translation.components.SideBySideView
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationConfirmBanner
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationConfirmedActions
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationMachineActions
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationReadingView
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationSenderCard
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslationViewToggle
import app.pantopus.android.ui.screens.mailbox.translation.components.TranslatorNotes
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.13 — Translation. A mail item auto-translated by Pantopus, reached
 * from a mail item's "Translate" overflow action (and the
 * `pantopus://mailbox/translation?id=` deep link). Mirror of iOS
 * `MailTranslationView`.
 *
 * Two designed frames driven by `confirmed`: machine (LanguageBadge +
 * ViewToggle(side) + SideBySide + glossary + elf + "Confirm translation")
 * and confirmed (ConfirmBanner + ViewToggle(translated) + reading view on
 * paper + elf + "Reply to Lucía").
 *
 * Sample-data driven (real MT / TTS out of scope, B2.3); "Listen" stubs to
 * a toast, "Confirm" posts to the real translate endpoint and rolls the
 * optimistic flip back on failure.
 */
@Composable
fun MailTranslationScreen(
    onBack: () -> Unit,
    onReply: () -> Unit = {},
    viewModel: MailTranslationViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val confirmInFlight by viewModel.confirmInFlight.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(toast) {
        if (toast != null) {
            kotlinx.coroutines.delay(1_800)
            viewModel.consumeToast()
        }
    }

    MailTranslationScreenContent(
        state = state,
        confirmInFlight = confirmInFlight,
        toast = toast,
        onBack = onBack,
        onSelectViewMode = viewModel::selectViewMode,
        onConfirm = viewModel::confirmTranslation,
        onListen = viewModel::listen,
        onReply = onReply,
        onToast = viewModel::showToast,
        onRetry = viewModel::refresh,
    )
}

@Composable
internal fun MailTranslationScreenContent(
    state: MailTranslationUiState,
    confirmInFlight: Boolean,
    toast: String?,
    onBack: () -> Unit,
    onSelectViewMode: (TranslationViewMode) -> Unit,
    onConfirm: () -> Unit,
    onListen: (TranslationListenColumn) -> Unit,
    onReply: () -> Unit,
    onToast: (String) -> Unit,
    onRetry: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("mailTranslation"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            TranslationNav(onBack = onBack, onShare = { onToast("Sharing translation…") })
            when (val current = state) {
                MailTranslationUiState.Loading -> LoadingBody()
                is MailTranslationUiState.Loaded ->
                    LoadedBody(
                        content = current.content,
                        confirmInFlight = confirmInFlight,
                        onSelectViewMode = onSelectViewMode,
                        onConfirm = onConfirm,
                        onListen = onListen,
                        onReply = onReply,
                        onToast = onToast,
                        onRetranslate = onRetry,
                    )
                is MailTranslationUiState.Error ->
                    EmptyState(
                        icon = PantopusIcon.Globe,
                        headline = "Couldn't translate this",
                        subcopy = current.message,
                        ctaTitle = "Try again",
                        onCta = onRetry,
                        tint = PantopusColors.categoryTranslationBg,
                        accent = PantopusColors.categoryTranslation,
                        modifier = Modifier.testTag("translation_error"),
                    )
            }
        }
        if (toast != null) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s16),
            ) {
                Text(
                    text = toast,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appText.copy(alpha = 0.9f))
                            .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun LoadedBody(
    content: MailTranslationContent,
    confirmInFlight: Boolean,
    onSelectViewMode: (TranslationViewMode) -> Unit,
    onConfirm: () -> Unit,
    onListen: (TranslationListenColumn) -> Unit,
    onReply: () -> Unit,
    onToast: (String) -> Unit,
    onRetranslate: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        TranslationHeaderRow(categoryLabel = content.categoryLabel, time = content.timeLabel)

        if (content.confirmed) {
            TranslationConfirmBanner(stamp = content.confirmedStamp)
        }

        LanguageBadge(languages = content.languages, confirmed = content.confirmed)

        TranslationViewToggle(active = content.viewMode, onSelect = onSelectViewMode)

        when (content.viewMode) {
            TranslationViewMode.Side -> SideBySideView(content = content, onListen = onListen)
            TranslationViewMode.Translated ->
                TranslationReadingView(
                    content = content,
                    showing = TranslationViewMode.Translated,
                    onSelect = onSelectViewMode,
                    onListen = onListen,
                )
            TranslationViewMode.Original ->
                TranslationReadingView(
                    content = content,
                    showing = TranslationViewMode.Original,
                    onSelect = onSelectViewMode,
                    onListen = onListen,
                )
        }

        Box(modifier = Modifier.testTag("translation_elf")) {
            AIElfStripView(content = elfContent(content.elf))
        }

        // The translate route carries no glossary; the card only appears
        // when the payload actually has notes.
        if (content.glossary.isNotEmpty()) {
            TranslatorNotes(notes = content.glossary)
        }

        TranslationSenderCard(sender = content.sender)

        if (content.confirmed) {
            TranslationConfirmedActions(
                replyName = content.sender.replyName,
                onReply = onReply,
                onRetranslate = {
                    onToast("Re-translating…")
                    onRetranslate()
                },
                onShowOriginal = { onSelectViewMode(TranslationViewMode.Original) },
                onShare = { onToast("Sharing translation…") },
                onArchive = { onToast("Archived") },
            )
        } else {
            TranslationMachineActions(
                confirmInFlight = confirmInFlight,
                onConfirm = onConfirm,
                onEdit = { onToast("Edit translation…") },
                onLanguage = { onToast("Change language…") },
                onListen = { onListen(TranslationListenColumn.Translated) },
                onArchive = { onToast("Archived") },
            )
        }
        Spacer(Modifier.height(Spacing.s4))
    }
}

/** Map the content-layer elf payload onto the shared [AIElfStripView]. */
private fun elfContent(elf: TranslationElf): AIElfStripContent =
    AIElfStripContent(
        headline = elf.headline,
        summary = elf.summary,
        bullets =
            elf.bullets.map { bullet ->
                AIElfBullet(id = "elf-${bullet.id}", icon = bullet.icon, label = bullet.label, text = bullet.text)
            },
    )

// ─── Top nav ──────────────────────────────────────────────────

@Composable
private fun TranslationNav(
    onBack: () -> Unit,
    onShare: () -> Unit,
) {
    Column(modifier = Modifier.testTag("translation_nav")) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .height(44.dp)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onBack)
                        .padding(horizontal = Spacing.s1, vertical = 6.dp)
                        .testTag("translation_back")
                        .semantics { contentDescription = "Back to Mailbox" },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = null,
                    size = 22.dp,
                    tint = PantopusColors.primary600,
                )
                Text(text = "Mailbox", fontSize = 15.sp, color = PantopusColors.primary600)
            }
            Spacer(Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .testTag("translation_nav_eyebrow")
                        .semantics { heading() },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.categoryTranslation),
                )
                Text(
                    text = "TRANSLATION",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    color = PantopusColors.appTextStrong,
                )
            }
            Spacer(Modifier.weight(1f))
            NavTrailingCluster(onShare = onShare)
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun NavTrailingCluster(onShare: () -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        NavIconButton(icon = PantopusIcon.Share, label = "Share", onClick = onShare)
        Box {
            NavIconButton(
                icon = PantopusIcon.MoreHorizontal,
                label = "More actions",
                onClick = { expanded = true },
            )
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                DropdownMenuItem(
                    text = { Text("Re-translate") },
                    onClick = {
                        expanded = false
                        onShare()
                    },
                )
                DropdownMenuItem(
                    text = { Text("Report a problem") },
                    onClick = {
                        expanded = false
                        onShare()
                    },
                )
            }
        }
    }
}

@Composable
private fun NavIconButton(
    icon: PantopusIcon,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceSunken)
                .clickable(onClick = onClick)
                .semantics { contentDescription = label }
                .testTag("translation_nav_${label.substringBefore(' ').lowercase()}"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.appTextStrong,
        )
    }
}

// ─── Header chip row ──────────────────────────────────────────

@Composable
private fun TranslationHeaderRow(
    categoryLabel: String,
    time: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("translation_headerRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        // Trust chip
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.successBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp)
                    .semantics { contentDescription = "Verified sender" },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ShieldCheck,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.success,
            )
            Text(text = "Verified", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
        }
        // Category chip
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.categoryTranslationBg)
                    .padding(horizontal = Spacing.s2, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.categoryTranslation),
            )
            Text(
                text = categoryLabel,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.4.sp,
                color = PantopusColors.categoryTranslationInk,
            )
        }
        Box(modifier = Modifier.weight(1f))
        Text(text = time, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextSecondary)
    }
}

// ─── Loading body ─────────────────────────────────────────────

@Composable
private fun LoadingBody() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("translation_loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 20.dp, cornerRadius = Radii.sm)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 64.dp, cornerRadius = Radii.xl)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 44.dp, cornerRadius = Radii.lg)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 200.dp, cornerRadius = Radii.xl)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 120.dp, cornerRadius = Radii.xl)
        Shimmer(modifier = Modifier.fillMaxWidth(), height = 96.dp, cornerRadius = Radii.xl)
    }
}
