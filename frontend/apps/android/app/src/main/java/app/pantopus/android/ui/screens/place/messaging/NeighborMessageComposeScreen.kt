package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.NeighborMessageTemplate
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.screens.place.detail.PlaceDetailSectionLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * D1 — the verified-neighbor composer. Template-only (no free-text field
 * exists), delivered anonymously ("from a verified neighbor nearby"), scoped
 * to a verified home on your block, rate-limited, and blockable — the trust-
 * and-safety constraints ARE the UI. Parity twin of iOS
 * `NeighborMessageComposeView`.
 */
@Composable
fun NeighborMessageComposeScreen(
    onBack: () -> Unit,
    onChangeRecipient: () -> Unit,
    onDone: () -> Unit,
    viewModel: NeighborMessageComposeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val sent by viewModel.sent.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(
            title = if (sent) "Message sent" else "New message",
            address = "To a verified neighbor on your block",
            onBack = onBack,
        )
        when {
            sent -> SentConfirmation(onDone = onDone)
            state is NeighborComposeUiState.Loading -> ComposeSkeleton()
            state is NeighborComposeUiState.Error ->
                ErrorState(
                    message = (state as NeighborComposeUiState.Error).message,
                    onRetry = viewModel::load,
                )
            else -> Composer(viewModel = viewModel, onChangeRecipient = onChangeRecipient)
        }
    }
}

@Composable
@Suppress("LongMethod")
private fun Composer(
    viewModel: NeighborMessageComposeViewModel,
    onChangeRecipient: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedId by viewModel.selectedTemplateId.collectAsStateWithLifecycle()
    val sending by viewModel.sending.collectAsStateWithLifecycle()
    val sendError by viewModel.sendError.collectAsStateWithLifecycle()
    val templates = (state as? NeighborComposeUiState.Loaded)?.templates.orEmpty()
    val selected = templates.firstOrNull { it.id == selectedId }
    val canSend = viewModel.recipient != null && selected != null && !sending

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
        ) {
            PlaceDetailSectionLabel(text = "To")
            val recipient = viewModel.recipient
            if (recipient != null) {
                RecipientCard(recipient = recipient, onChange = onChangeRecipient)
            } else {
                ChooseNeighborCard(onBack = onChangeRecipient)
            }
            PrivacyNote()

            PlaceDetailSectionLabel(text = "Choose a note")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                templates.forEach { template ->
                    TemplateRow(
                        template = template,
                        selected = template.id == selectedId,
                        onSelect = viewModel::select,
                    )
                }
            }
            TemplateNote()

            PlaceDetailSectionLabel(text = "How it's delivered")
            DeliveryPreview(
                messageBody = selected?.body ?: "Choose a note above to preview how it arrives.",
            )

            PlaceDetailSectionLabel(text = "Good to know")
            SafetyCard()

            sendError?.let {
                Spacer(modifier = Modifier.height(16.dp))
                NeighborErrorBanner(message = it)
            }
            Spacer(modifier = Modifier.height(132.dp))
        }
        SendBar(
            sending = sending,
            enabled = canSend,
            onSend = viewModel::send,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

// ─── Recipient ───────────────────────────────────────────────

@Composable
private fun RecipientCard(
    recipient: ComposeRecipient,
    onChange: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().placeCard().padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlaceIconTile(icon = PantopusIcon.Home, tone = PlaceTileTone.HOME, size = 38.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = recipient.address,
                fontSize = 15.5.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.15).sp,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            Text(
                text = recipient.relativeLabel,
                fontSize = 13.sp,
                color = PantopusColors.appTextMuted,
                maxLines = 1,
            )
        }
        Text(
            text = "Change",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier = Modifier.clickable(onClick = onChange),
        )
    }
}

@Composable
private fun ChooseNeighborCard(onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        PlaceIconTile(icon = PantopusIcon.Home, tone = PlaceTileTone.MUTED, size = 38.dp)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = "Choose a neighbor on your block",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Open a home on your block to send it a verified heads-up.",
                fontSize = 13.sp,
                color = PantopusColors.appTextMuted,
            )
            Text(
                text = "Back to your block",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier = Modifier.padding(top = 4.dp).clickable(onClick = onBack),
            )
        }
    }
}

// ─── Privacy reassurance ─────────────────────────────────────

@Composable
private fun PrivacyNote() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.infoBg)
                .border(1.dp, PantopusColors.infoLight, RoundedCornerShape(12.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.EyeOff,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2f,
            tint = PantopusColors.info,
        )
        Text(
            text =
                buildString {
                    append("Your identity stays private. It's delivered as ")
                    append("“from a verified neighbor nearby” — never your name or address.")
                },
            fontSize = 13.5.sp,
            lineHeight = 19.sp,
            color = PantopusColors.appTextStrong,
        )
    }
}

// ─── Template radio row ──────────────────────────────────────

@Composable
private fun TemplateRow(
    template: NeighborMessageTemplate,
    selected: Boolean,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(if (selected) PantopusColors.successBg else PantopusColors.appSurface)
                .border(
                    width = if (selected) 1.5.dp else 1.dp,
                    color = if (selected) PantopusColors.successLight else PantopusColors.appBorder,
                    shape = RoundedCornerShape(16.dp),
                )
                .clickable { onSelect(template.id) }
                .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .then(
                        if (selected) {
                            Modifier.background(PantopusColors.home)
                        } else {
                            Modifier
                                .background(PantopusColors.appSurface)
                                .border(2.dp, PantopusColors.appBorderStrong, CircleShape)
                        },
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (selected) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 13.dp,
                    strokeWidth = 3.25f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                PantopusIconImage(
                    icon = neighborTemplateIcon(template.icon),
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = if (selected) PantopusColors.home else PantopusColors.appTextMuted,
                )
                Text(
                    text = template.category.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.55.sp,
                    color = if (selected) PantopusColors.home else PantopusColors.appTextMuted,
                )
            }
            Text(
                text = template.body,
                fontSize = 13.5.sp,
                lineHeight = 18.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun TemplateNote() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 2.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "Messages are pre-written to keep them neutral. Free typing isn't available — it's how we keep this channel safe.",
            fontSize = 12.5.sp,
            lineHeight = 17.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

// ─── Delivery preview ────────────────────────────────────────

@Composable
private fun DeliveryPreview(messageBody: String) {
    Column(modifier = Modifier.fillMaxWidth().placeCard().padding(15.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ShieldCheck,
                    contentDescription = null,
                    size = 20.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.home,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "A verified neighbor nearby",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.15).sp,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "On your block · just now",
                    fontSize = 12.5.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
            PlaceChip(model = PlaceChipModel(tone = PlaceChipTone.SUCCESS, text = "Verified", icon = PantopusIcon.ShieldCheck))
        }
        Text(
            text = messageBody,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(12.dp),
        )
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DeliveryPill(icon = PantopusIcon.Reply, text = "Reply with a note", danger = false)
            DeliveryPill(icon = PantopusIcon.Ban, text = "Block", danger = true)
        }
        Text(
            text = "They can reply with a template or block you anytime.",
            fontSize = 12.sp,
            color = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun DeliveryPill(
    icon: PantopusIcon,
    text: String,
    danger: Boolean,
) {
    val fg = if (danger) PantopusColors.error else PantopusColors.appTextSecondary
    val bg = if (danger) PantopusColors.errorBg else PantopusColors.appSurfaceSunken
    val bd = if (danger) PantopusColors.errorLight else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(999.dp))
                .background(bg)
                .border(1.dp, bd, RoundedCornerShape(999.dp))
                .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 14.dp, strokeWidth = 2f, tint = fg)
        Text(text = text, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = fg)
    }
}

// ─── Safety card ─────────────────────────────────────────────

private data class SafetyRow(val icon: PantopusIcon, val title: String, val sub: String)

@Composable
private fun SafetyCard() {
    val rows =
        listOf(
            SafetyRow(
                PantopusIcon.Hand,
                "Keep it neighborly",
                "For genuine heads-ups — not complaints, sales, or anything targeted.",
            ),
            SafetyRow(
                PantopusIcon.Clock,
                "A few messages a week",
                "There's a gentle limit, so the channel stays low-volume and calm.",
            ),
            SafetyRow(
                PantopusIcon.Ban,
                "Always blockable",
                "Anyone can block messages from verified neighbors at any time.",
            ),
        )
    Column(modifier = Modifier.fillMaxWidth().placeCard().padding(horizontal = 14.dp)) {
        rows.forEachIndexed { index, row ->
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PantopusIconImage(
                    icon = row.icon,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = row.title,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = row.sub,
                        fontSize = 12.5.sp,
                        lineHeight = 17.sp,
                        color = PantopusColors.appTextMuted,
                    )
                }
            }
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

// ─── Pinned send bar ─────────────────────────────────────────

@Composable
private fun SendBar(
    sending: Boolean,
    enabled: Boolean,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(horizontal = 16.dp)
                .padding(top = 12.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (enabled) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                    .clickable(enabled = enabled, onClick = onSend),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.25f,
                tint = PantopusColors.appTextInverse,
            )
            Spacer(modifier = Modifier.size(8.dp))
            Text(
                text = if (sending) "Sending…" else "Send",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = (-0.16).sp,
                color = PantopusColors.appTextInverse,
            )
        }
        Row(
            modifier = Modifier.padding(top = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.EyeOff,
                contentDescription = null,
                size = 13.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
            Text(
                text = "Delivered anonymously · a few messages a week",
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

// ─── Sent confirmation ───────────────────────────────────────

@Composable
private fun SentConfirmation(onDone: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(top = 24.dp),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().placeCard().padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PlaceIconTile(icon = PantopusIcon.Check, tone = PlaceTileTone.HOME, size = 48.dp)
            Text(
                text = "Delivered anonymously",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = (-0.18).sp,
                color = PantopusColors.appText,
                modifier = Modifier.padding(top = 12.dp),
            )
            Text(
                text = "Your verified neighbor received it as “from a verified neighbor nearby” — never your name or address.",
                fontSize = 13.5.sp,
                lineHeight = 19.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.padding(top = 6.dp, start = 8.dp, end = 8.dp),
            )
            Row(
                modifier =
                    Modifier
                        .padding(top = 20.dp)
                        .height(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onDone)
                        .padding(horizontal = 20.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Done",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

// ─── Skeleton ────────────────────────────────────────────────

@Composable
@Suppress("MagicNumber")
private fun ComposeSkeleton() {
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(top = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        FullWidthShimmer(height = 64.dp, cornerRadius = 16.dp)
        FullWidthShimmer(height = 48.dp, cornerRadius = 12.dp)
        Spacer(modifier = Modifier.height(4.dp))
        repeat(4) { FullWidthShimmer(height = 64.dp, cornerRadius = 16.dp) }
    }
}

@Composable
private fun FullWidthShimmer(
    height: androidx.compose.ui.unit.Dp,
    cornerRadius: androidx.compose.ui.unit.Dp = 12.dp,
) {
    androidx.compose.foundation.layout.BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
        Shimmer(width = maxWidth, height = height, cornerRadius = cornerRadius)
    }
}
