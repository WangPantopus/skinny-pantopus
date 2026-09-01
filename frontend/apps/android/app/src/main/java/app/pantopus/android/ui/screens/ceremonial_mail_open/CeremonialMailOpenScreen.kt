@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "LargeClass",
)

package app.pantopus.android.ui.screens.ceremonial_mail_open

import android.provider.Settings
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * T6.5d (P22) — Refreshed Ceremonial Mail Open. Four frames matching
 * `ceremonial-mail-frames.jsx`:
 *
 *  - [CeremonialMailPhase.Sealed]   → Frame 1 (porch arrival).
 *  - [CeremonialMailPhase.Breaking] → Frame 2 (opening mid-state).
 *  - [CeremonialMailPhase.Open]     → Frame 3 (reading).
 *  - [CeremonialMailPhase.Replying] → Frame 4 (reply compose handoff).
 *
 * Animation budget: total Sealed → Open ≤ 2 seconds. Reduce-motion
 * (system setting) + the explicit "Skip animation" button both jump
 * straight to Open with no intermediate transitions.
 */
@Composable
fun CeremonialMailOpenScreen(
    onBack: () -> Unit = {},
    onWriteBack: (String) -> Unit = {},
    onOutcome: (CeremonialOutcomeCta) -> Unit = {},
    reduceMotionOverride: Boolean? = null,
    viewModel: CeremonialMailOpenViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val isVoicePlaying by viewModel.isVoicePlaying.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val reduceMotion =
        reduceMotionOverride ?: remember(context) {
            Settings.Global.getFloat(
                context.contentResolver,
                Settings.Global.TRANSITION_ANIMATION_SCALE,
                1f,
            ) == 0f
        }
    LaunchedEffect(Unit) { viewModel.load() }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("ceremonialMailOpen"),
    ) {
        when (val current = state) {
            is CeremonialMailOpenUiState.Loading -> LoadingFrame(onBack = onBack)
            is CeremonialMailOpenUiState.Error ->
                ErrorFrame(message = current.message, onBack = onBack, onRetry = viewModel::load)
            is CeremonialMailOpenUiState.Loaded -> {
                when (current.phase) {
                    CeremonialMailPhase.Sealed, CeremonialMailPhase.Breaking ->
                        PorchFrame(
                            letter = current.letter,
                            phase = current.phase,
                            reduceMotion = reduceMotion,
                            onTapOpen = { viewModel.startBreakingSeal(skipAnimation = reduceMotion) },
                            onSkip = viewModel::openImmediately,
                            onClose = onBack,
                        )
                    CeremonialMailPhase.Open ->
                        ReadingFrame(
                            letter = current.letter,
                            reduceMotion = reduceMotion,
                            isVoicePlaying = isVoicePlaying,
                            onToggleVoice = viewModel::toggleVoicePlayback,
                            onReply = {
                                viewModel.enterReplying()
                                onWriteBack(current.letter.sender.displayName)
                            },
                            onClose = onBack,
                            onOutcome = onOutcome,
                        )
                    CeremonialMailPhase.Replying ->
                        ReplyHandoffFrame(
                            letter = current.letter,
                            onBack = viewModel::resetToOpen,
                            onContinue = { onWriteBack(current.letter.sender.displayName) },
                        )
                }
            }
        }
    }
}

/**
 * Snapshot/test entry point that picks the right frame for a given
 * [phase] without driving the view-model or reading system reduce-motion.
 * Production code paths through [CeremonialMailOpenScreen] which owns
 * the system-reduce-motion read + animation orchestration.
 */
@Composable
internal fun LoadedBody(
    letter: CeremonialMailLetter,
    phase: CeremonialMailPhase,
    isVoicePlaying: Boolean,
    onTapSeal: () -> Unit,
    onToggleVoice: () -> Unit,
    onWriteBack: () -> Unit,
    onOutcome: (CeremonialOutcomeCta) -> Unit,
) {
    when (phase) {
        CeremonialMailPhase.Sealed, CeremonialMailPhase.Breaking ->
            PorchFrame(
                letter = letter,
                phase = phase,
                reduceMotion = true,
                onTapOpen = onTapSeal,
                onSkip = onTapSeal,
                onClose = {},
            )
        CeremonialMailPhase.Open ->
            ReadingFrame(
                letter = letter,
                reduceMotion = true,
                isVoicePlaying = isVoicePlaying,
                onToggleVoice = onToggleVoice,
                onReply = onWriteBack,
                onClose = {},
                onOutcome = onOutcome,
            )
        CeremonialMailPhase.Replying ->
            ReplyHandoffFrame(
                letter = letter,
                onBack = {},
                onContinue = onWriteBack,
            )
    }
}

// ─── Loading + error ─────────────────────────────────────

@Composable
private fun LoadingFrame(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().testTag("ceremonialMailOpenLoading")) {
        GeneralTopBar(onBack = onBack)
        Column(
            modifier = Modifier.padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 220.dp, cornerRadius = 18.dp)
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 180.dp, cornerRadius = 18.dp)
            Shimmer(modifier = Modifier.fillMaxWidth(), height = 56.dp, cornerRadius = 14.dp)
        }
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().testTag("ceremonialMailOpenError")) {
        GeneralTopBar(onBack = onBack)
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(Spacing.s5),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 36.dp,
                tint = PantopusColors.error,
            )
            Spacer(modifier = Modifier.height(Spacing.s2))
            Text(
                text = "Couldn't open this letter",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
            Spacer(modifier = Modifier.height(Spacing.s4))
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.primary600)
                        .clickable(onClick = onRetry)
                        .padding(horizontal = Spacing.s4)
                        .height(36.dp)
                        .testTag("ceremonialMailOpenRetry"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Try again",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun GeneralTopBar(onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(52.dp).padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onBack)
                        .testTag("ceremonialMailOpenBackButton"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ChevronLeft,
                    contentDescription = "Back",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = "Letter",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            Spacer(modifier = Modifier.weight(1f))
            Spacer(modifier = Modifier.size(36.dp))
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// ─── Frame 1 + 2: porch arrival / opening ─────────────────

@Composable
private fun PorchFrame(
    letter: CeremonialMailLetter,
    phase: CeremonialMailPhase,
    reduceMotion: Boolean,
    onTapOpen: () -> Unit,
    onSkip: () -> Unit,
    onClose: () -> Unit,
) {
    val infinite = rememberInfiniteTransition(label = "porchGlow")
    val glow by infinite.animateFloat(
        initialValue = 0.85f,
        targetValue = if (reduceMotion) 0.85f else 1f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1200),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "glow",
    )
    val lift by animateFloatAsState(
        targetValue = if (phase == CeremonialMailPhase.Breaking) -6f else 0f,
        animationSpec = tween(durationMillis = if (reduceMotion) 0 else 300),
        label = "envelopeLift",
    )
    val envelopeScale by animateFloatAsState(
        targetValue = if (phase == CeremonialMailPhase.Breaking) 1.04f else 1f,
        animationSpec = tween(durationMillis = if (reduceMotion) 0 else 300),
        label = "envelopeScale",
    )

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(letter.stationery.porchTopColor, letter.stationery.porchBottomColor),
                    ),
                )
                .testTag("ceremonialMail_frame_${phase.key}"),
    ) {
        // Vignette
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.18f)),
        )
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = Spacing.s6),
        ) {
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4)) {
                Spacer(modifier = Modifier.weight(1f))
                Box(
                    modifier =
                        Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.18f))
                            .clickable(onClick = onClose)
                            .testTag("ceremonialMail_close"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = "Close",
                        size = 18.dp,
                        tint = Color.White.copy(alpha = 0.85f),
                    )
                }
            }
            Spacer(modifier = Modifier.weight(1f))
            Text(
                text = if (phase == CeremonialMailPhase.Sealed) "FROM ${letter.sender.displayName.uppercase()}" else "OPENING…",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.6.sp,
                color = Color.White.copy(alpha = 0.85f),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.height(Spacing.s1))
            Text(
                text = "A letter has\narrived for you",
                fontSize = 28.sp,
                fontWeight = FontWeight.Medium,
                color = Color.White.copy(alpha = if (phase == CeremonialMailPhase.Sealed) 1f else 0.6f),
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
                lineHeight = 34.sp,
            )
            Spacer(modifier = Modifier.height(Spacing.s8))
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onTapOpen)
                        .testTag("ceremonialMail_envelope_tap"),
                contentAlignment = Alignment.Center,
            ) {
                EnvelopeHero(
                    letter = letter,
                    phase = phase,
                    glow = glow,
                    lift = lift,
                    scale = envelopeScale,
                )
            }
            Spacer(modifier = Modifier.height(22.dp))
            SenderStamp(letter = letter)
            Spacer(modifier = Modifier.weight(1f))
            if (phase == CeremonialMailPhase.Sealed) {
                OpenEnvelopeCta(onTap = onTapOpen)
            } else {
                ProgressDots()
            }
            SkipAnimationButton(onSkip = onSkip)
            PantopusFooter()
        }
    }
}

@Composable
private fun EnvelopeHero(
    letter: CeremonialMailLetter,
    phase: CeremonialMailPhase,
    glow: Float,
    lift: Float,
    scale: Float,
) {
    Box(
        modifier =
            Modifier
                .size(width = 280.dp, height = 200.dp),
        contentAlignment = Alignment.Center,
    ) {
        // Glow
        Box(
            modifier =
                Modifier
                    .size(320.dp)
                    .alpha(glow * 0.55f)
                    .background(
                        Brush.radialGradient(
                            colors =
                                listOf(
                                    Color(0xFFFFE4A0).copy(alpha = 0.55f),
                                    Color(0xFFFFB06C).copy(alpha = 0.18f),
                                    Color.Transparent,
                                ),
                        ),
                    ),
        )
        Box(
            modifier =
                Modifier
                    .size(width = 240.dp, height = 158.dp)
                    .scale(scale)
                    .background(Color.Transparent),
            contentAlignment = Alignment.Center,
        ) {
            EnvelopeShape(
                letter = letter,
                phase = phase,
                liftDp = lift.dp,
            )
        }
    }
}

@Composable
private fun EnvelopeShape(
    letter: CeremonialMailLetter,
    phase: CeremonialMailPhase,
    liftDp: androidx.compose.ui.unit.Dp,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .offset(y = liftDp)
                .clip(RoundedCornerShape(Radii.md))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(letter.stationery.paperColor, letter.stationery.paperEdgeColor),
                    ),
                )
                .border(1.dp, Color.Black.copy(alpha = 0.22f), RoundedCornerShape(Radii.md)),
    ) {
        // Letter peeking up in breaking phase
        if (phase == CeremonialMailPhase.Breaking) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .offset(y = (-30).dp)
                        .size(width = 196.dp, height = 96.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(Color(0xFFFAEFD7)),
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    repeat(4) {
                        Box(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(Color(0xFF3C2814).copy(alpha = 0.25f)),
                        )
                    }
                }
            }
        }
        // Seal medallion
        Box(
            modifier =
                Modifier
                    .align(Alignment.Center)
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(letter.seal.color)
                    .border(0.6.dp, Color.Black.copy(alpha = 0.28f), CircleShape)
                    .alpha(if (phase == CeremonialMailPhase.Sealed) 1f else 0.85f),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = letter.sender.displayName.take(1),
                fontSize = 18.sp,
                fontWeight = FontWeight.Medium,
                fontStyle = FontStyle.Italic,
                color = Color.White.copy(alpha = 0.94f),
            )
        }
    }
}

@Composable
private fun SenderStamp(letter: CeremonialMailLetter) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color.White.copy(alpha = 0.14f))
                .border(1.dp, Color.White.copy(alpha = 0.22f), RoundedCornerShape(Radii.pill))
                .padding(start = 6.dp, end = 14.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),
                        ),
                    )
                    .border(2.dp, Color.White.copy(alpha = 0.85f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = letter.sender.displayName.take(1),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = letter.sender.displayName,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFFF6ECD8),
            )
            Text(
                text = "· ${(letter.sender.trustLabel ?: "Ceremonial").uppercase()} ·",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = Color(0xFFF6ECD8).copy(alpha = 0.85f),
            )
        }
    }
}

@Composable
private fun OpenEnvelopeCta(onTap: () -> Unit) {
    Box(
        modifier =
            Modifier
                .padding(top = Spacing.s2)
                .clip(RoundedCornerShape(Radii.pill))
                .background(Color(0xFFF6ECD8).copy(alpha = 0.96f))
                .clickable(onClick = onTap)
                .padding(horizontal = 28.dp, vertical = 14.dp)
                .testTag("ceremonialMail_openEnvelope"),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "Open envelope",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF2A1F0A),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                tint = Color(0xFF2A1F0A),
            )
        }
    }
}

@Composable
private fun ProgressDots() {
    Row(
        modifier = Modifier.padding(vertical = 14.dp).fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
        Spacer(modifier = Modifier.width(6.dp))
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White))
        Spacer(modifier = Modifier.width(6.dp))
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.55f)))
        Spacer(modifier = Modifier.width(6.dp))
        Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.25f)))
        Spacer(modifier = Modifier.width(10.dp))
        Text(
            text = "BREAKING THE SEAL",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.2.sp,
            color = Color.White.copy(alpha = 0.85f),
        )
    }
}

@Composable
private fun SkipAnimationButton(onSkip: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 6.dp)
                .clickable(onClick = onSkip)
                .testTag("ceremonialMail_skipAnimation")
                .semantics { contentDescription = "Skip animation and open the letter" },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Skip animation",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.65f),
            textDecoration = TextDecoration.Underline,
        )
    }
}

@Composable
private fun PantopusFooter() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 14.dp, bottom = Spacing.s3),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(Color.White.copy(alpha = 0.22f)))
        Spacer(modifier = Modifier.height(Spacing.s2))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mailbox,
                contentDescription = null,
                size = 13.dp,
                tint = Color.White.copy(alpha = 0.75f),
            )
            Text(
                text = "PANTOPUS · VERIFIED BY ADDRESS",
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.6.sp,
                color = Color.White.copy(alpha = 0.75f),
            )
        }
    }
}

// ─── Frame 3: reading ────────────────────────────────────

@Composable
private fun ReadingFrame(
    letter: CeremonialMailLetter,
    reduceMotion: Boolean,
    isVoicePlaying: Boolean,
    onToggleVoice: () -> Unit,
    onReply: () -> Unit,
    onClose: () -> Unit,
    onOutcome: (CeremonialOutcomeCta) -> Unit,
) {
    val opacity by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = if (reduceMotion) 0 else 300, delayMillis = 50),
        label = "paperOpacity",
    )
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(letter.stationery.paperColor)
                .testTag("ceremonialMail_frame_open"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ReadingTopBar(letter = letter, onClose = onClose, onArchive = {
                onOutcome(
                    CeremonialOutcomeCta(
                        id = "archive",
                        label = "Archive",
                        icon = PantopusIcon.Archive,
                        style = CeremonialOutcomeCta.Style.Ghost,
                    ),
                )
            })
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 22.dp, vertical = Spacing.s4)
                        .alpha(opacity)
                        .testTag("ceremonialMailOpenContent"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                SenderRow(letter = letter)
                Ornament(letter = letter)
                Text(
                    text = "Dearest reader,",
                    fontSize = 19.sp,
                    fontStyle = FontStyle.Italic,
                    color = letter.ink.color,
                )
                letter.bodyParagraphs.forEach { paragraph ->
                    Text(
                        text = paragraph,
                        fontSize = 15.sp,
                        color = letter.ink.color,
                        lineHeight = 23.sp,
                        modifier = Modifier.testTag("ceremonialMailPaperBody"),
                    )
                }
                Signature(letter = letter)
                if (letter.voicePostscriptUri != null) {
                    VoicePostscriptCard(
                        letter = letter,
                        isPlaying = isVoicePlaying,
                        onToggle = onToggleVoice,
                    )
                }
                EndOrnament(letter = letter)
                Spacer(modifier = Modifier.height(80.dp))
            }
        }
        StickyBottomBar(
            letter = letter,
            onReply = onReply,
            onSave = {
                onOutcome(
                    CeremonialOutcomeCta(
                        id = "save",
                        label = "Save to records",
                        icon = PantopusIcon.Check,
                        style = CeremonialOutcomeCta.Style.Ghost,
                    ),
                )
            },
            onArchive = {
                onOutcome(
                    CeremonialOutcomeCta(
                        id = "archive",
                        label = "Archive",
                        icon = PantopusIcon.Archive,
                        style = CeremonialOutcomeCta.Style.Ghost,
                    ),
                )
            },
            modifier = Modifier.align(Alignment.BottomStart),
        )
    }
}

@Composable
private fun ReadingTopBar(
    letter: CeremonialMailLetter,
    onClose: () -> Unit,
    onArchive: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(letter.stationery.paperColor.copy(alpha = 0.55f))
                .padding(horizontal = Spacing.s3)
                .height(44.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconChip(
            icon = PantopusIcon.X,
            ink = letter.ink.color,
            id = "ceremonialMailReading_close",
            label = "Close",
            onClick = onClose,
        )
        Spacer(Modifier.weight(1f))
        Text(
            text = letter.sender.displayName,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            color = letter.ink.color,
        )
        Spacer(Modifier.weight(1f))
        IconChip(
            icon = PantopusIcon.Share,
            ink = letter.ink.color,
            id = "ceremonialMailReading_share",
            label = "Share",
            onClick = {},
        )
        Spacer(modifier = Modifier.width(6.dp))
        IconChip(
            icon = PantopusIcon.Archive,
            ink = letter.ink.color,
            id = "ceremonialMailReading_archive",
            label = "Archive",
            onClick = onArchive,
        )
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(letter.ink.color.copy(alpha = 0.1f)))
}

@Composable
private fun IconChip(
    icon: PantopusIcon,
    ink: Color,
    id: String,
    label: String,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.55f))
                .border(1.dp, ink.copy(alpha = 0.14f), CircleShape)
                .clickable(onClick = onClick)
                .testTag(id)
                .semantics { contentDescription = label },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = ink)
    }
}

@Composable
private fun SenderRow(letter: CeremonialMailLetter) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.size(44.dp), contentAlignment = Alignment.Center) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),
                            ),
                        )
                        .border(2.dp, Color.White.copy(alpha = 0.55f), CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = letter.sender.displayName.take(1),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White,
                )
            }
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success)
                        .border(2.dp, letter.stationery.paperColor, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.md,
                    tint = Color.White,
                )
            }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                text = letter.sender.displayName,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = letter.ink.color,
            )
            Text(
                text = "· ${(letter.sender.trustLabel ?: "Ceremonial").uppercase()} ·",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = letter.ink.color.copy(alpha = 0.7f),
            )
        }
        PostmarkStamp(letter = letter)
    }
}

@Composable
private fun PostmarkStamp(letter: CeremonialMailLetter) {
    Box(
        modifier =
            Modifier
                .size(56.dp)
                .clip(CircleShape)
                .border(1.2.dp, letter.seal.color, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "PANTOPUS",
                fontSize = 6.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.5.sp,
                color = letter.seal.color,
            )
            Text(
                text = "·",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = letter.seal.color,
            )
            Text(
                text = "POST",
                fontSize = 6.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = letter.seal.color,
            )
        }
    }
}

@Composable
private fun Ornament(letter: CeremonialMailLetter) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(modifier = Modifier.weight(1f).height(1.dp).background(letter.seal.color.copy(alpha = 0.4f)))
        Box(modifier = Modifier.size(4.dp).clip(CircleShape).background(letter.seal.color))
        Box(modifier = Modifier.weight(1f).height(1.dp).background(letter.seal.color.copy(alpha = 0.4f)))
    }
}

@Composable
private fun Signature(letter: CeremonialMailLetter) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = Spacing.s2)) {
        Text(
            text = "With warmth,",
            fontSize = 15.sp,
            fontStyle = FontStyle.Italic,
            color = letter.ink.color,
        )
        Text(
            text = letter.sender.displayName.split(" ").firstOrNull() ?: letter.sender.displayName,
            fontSize = 28.sp,
            fontStyle = FontStyle.Italic,
            fontWeight = FontWeight.Medium,
            color = letter.seal.color,
        )
    }
}

@Composable
private fun VoicePostscriptCard(
    letter: CeremonialMailLetter,
    isPlaying: Boolean,
    onToggle: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(top = 14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(letter.ink.color.copy(alpha = 0.2f)))
        Text(
            text = "· VOICE POSTSCRIPT ·",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.6.sp,
            color = letter.seal.color,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(letter.stationery.paperColor.copy(alpha = 0.7f))
                    .border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onToggle)
                    .padding(horizontal = 14.dp, vertical = 6.dp)
                    .testTag("ceremonialMailVoicePostscript")
                    .semantics {
                        contentDescription = if (isPlaying) "Pause voice postscript" else "Play voice postscript"
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier = Modifier.size(30.dp).clip(CircleShape).background(letter.ink.color),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = if (isPlaying) PantopusIcon.Pause else PantopusIcon.Play,
                    contentDescription = null,
                    size = 11.dp,
                    tint = letter.stationery.paperColor,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                val heights = listOf(7, 13, 9, 18, 14, 21, 11, 16, 8, 13)
                heights.forEachIndexed { idx, h ->
                    Box(
                        modifier =
                            Modifier
                                .width(2.4.dp)
                                .height(h.dp)
                                .clip(RoundedCornerShape(1.5.dp))
                                .background(if (idx < 5) letter.seal.color else letter.ink.color.copy(alpha = 0.4f)),
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            Text(
                text = if (isPlaying) "0:14 / 0:32" else "0:32",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = letter.ink.color.copy(alpha = 0.7f),
            )
        }
    }
}

@Composable
private fun EndOrnament(letter: CeremonialMailLetter) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        Box(modifier = Modifier.width(24.dp).height(1.dp).background(letter.seal.color.copy(alpha = 0.55f)))
        Spacer(modifier = Modifier.width(Spacing.s2))
        Box(
            modifier =
                Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .border(0.9.dp, letter.seal.color.copy(alpha = 0.55f), CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            Box(modifier = Modifier.size(4.dp).clip(CircleShape).background(letter.seal.color.copy(alpha = 0.55f)))
        }
        Spacer(modifier = Modifier.width(Spacing.s2))
        Box(modifier = Modifier.width(24.dp).height(1.dp).background(letter.seal.color.copy(alpha = 0.55f)))
    }
}

@Composable
private fun StickyBottomBar(
    letter: CeremonialMailLetter,
    onReply: () -> Unit,
    onSave: () -> Unit,
    onArchive: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, letter.stationery.paperColor),
                    ),
                )
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .padding(bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(
            modifier =
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onReply)
                    .padding(vertical = Spacing.s3)
                    .testTag("ceremonialMailOutcome_write_back"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Send, contentDescription = null, size = 14.dp, tint = Color.White)
            Spacer(Modifier.width(7.dp))
            Text(text = "Reply", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(Color.White.copy(alpha = 0.65f))
                    .border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onSave)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag("ceremonialMailOutcome_save"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            PantopusIconImage(icon = PantopusIcon.Bookmark, contentDescription = null, size = 14.dp, tint = letter.ink.color)
            Text(text = "Save", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = letter.ink.color)
        }
        Box(
            modifier =
                Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.65f))
                    .border(1.dp, letter.ink.color.copy(alpha = 0.13f), CircleShape)
                    .clickable(onClick = onArchive)
                    .testTag("ceremonialMailOutcome_archive")
                    .semantics { contentDescription = "Archive letter" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Archive, contentDescription = null, size = 15.dp, tint = letter.ink.color)
        }
    }
}

// ─── Frame 4: reply compose handoff ──────────────────────

@Composable
private fun ReplyHandoffFrame(
    letter: CeremonialMailLetter,
    onBack: () -> Unit,
    onContinue: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(letter.stationery.paperColor)
                .testTag("ceremonialMailWriteBackBanner"),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ReplyTopBar(letter = letter, onBack = onBack, onContinue = onContinue)
            Column(
                modifier =
                    Modifier
                        .weight(1f)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                LetterPreviewCard(letter = letter)
                ComposeSurface(letter = letter)
            }
        }
        Text(
            text = "NEXT · CEREMONIAL COMPOSE →",
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.2.sp,
            color = letter.ink.color.copy(alpha = 0.5f),
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 18.dp),
        )
    }
}

@Composable
private fun ReplyTopBar(
    letter: CeremonialMailLetter,
    onBack: () -> Unit,
    onContinue: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(letter.stationery.paperColor.copy(alpha = 0.55f))
                .padding(horizontal = Spacing.s3)
                .height(44.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconChip(
            icon = PantopusIcon.ChevronLeft,
            ink = letter.ink.color,
            id = "ceremonialMailReply_back",
            label = "Back to letter",
            onClick = onBack,
        )
        Spacer(Modifier.weight(1f))
        Text(
            text = "WRITE BACK",
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp,
            color = letter.ink.color.copy(alpha = 0.75f),
        )
        Spacer(Modifier.weight(1f))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onContinue)
                    .padding(horizontal = Spacing.s3)
                    .height(30.dp)
                    .testTag("ceremonialMailReply_continue"),
            contentAlignment = Alignment.Center,
        ) {
            Text(text = "Continue →", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(letter.ink.color.copy(alpha = 0.1f)))
}

@Composable
private fun LetterPreviewCard(letter: CeremonialMailLetter) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(letter.stationery.paperColor)
                .border(1.dp, letter.ink.color.copy(alpha = 0.12f), RoundedCornerShape(14.dp))
                .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFFC29230), Color(0xFF7A4F1B)),
                            ),
                        ),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = letter.sender.displayName.take(1),
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White,
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    text = letter.sender.displayName,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = letter.ink.color,
                )
                Text(
                    text = "THEIR LETTER",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.4.sp,
                    color = letter.ink.color.copy(alpha = 0.65f),
                )
            }
        }
        Text(
            text = letter.bodyParagraphs.firstOrNull().orEmpty(),
            fontSize = 13.sp,
            color = letter.ink.color.copy(alpha = 0.82f),
            maxLines = 3,
            lineHeight = 18.sp,
        )
    }
}

@Composable
private fun ComposeSurface(letter: CeremonialMailLetter) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(letter.stationery.paperColor)
                .border(1.dp, letter.ink.color.copy(alpha = 0.12f), RoundedCornerShape(18.dp))
                .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "PAPER",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
                color = letter.ink.color.copy(alpha = 0.65f),
                modifier = Modifier.weight(1f),
            )
            Text(
                text = "INK",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.4.sp,
                color = letter.ink.color.copy(alpha = 0.65f),
            )
        }
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            PaperSwatchRow(letter = letter, modifier = Modifier.weight(1f))
            InkSwatchRow(letter = letter)
        }
        Text(
            text = "Dear ${letter.sender.displayName.split(" ").firstOrNull() ?: letter.sender.displayName},",
            fontSize = 18.sp,
            fontStyle = FontStyle.Italic,
            fontWeight = FontWeight.Medium,
            color = letter.ink.color,
        )
        Text(
            text = "Begin your reply…",
            fontSize = 15.sp,
            color = letter.ink.color.copy(alpha = 0.5f),
            modifier = Modifier.fillMaxWidth().height(96.dp),
        )
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(letter.ink.color.copy(alpha = 0.1f)))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            ComposeIcon(letter = letter, icon = PantopusIcon.Send)
            ComposeIcon(letter = letter, icon = PantopusIcon.Image)
            ComposeIcon(letter = letter, icon = PantopusIcon.Bookmark)
            Spacer(Modifier.weight(1f))
            Text(
                text = "0 / 600",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = letter.ink.color.copy(alpha = 0.65f),
            )
        }
    }
}

@Composable
private fun PaperSwatchRow(
    letter: CeremonialMailLetter,
    modifier: Modifier = Modifier,
) {
    val swatches =
        listOf(
            letter.stationery,
            CeremonialMailStationeryTone.Winter,
            CeremonialMailStationeryTone.Spring,
            CeremonialMailStationeryTone.Summer,
            CeremonialMailStationeryTone.Evergreen,
        )
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        swatches.forEachIndexed { idx, tone ->
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(tone.paperColor)
                        .border(
                            width = if (idx == 0) 2.dp else 1.dp,
                            color = if (idx == 0) letter.ink.color else letter.ink.color.copy(alpha = 0.2f),
                            shape = CircleShape,
                        ),
            )
        }
    }
}

@Composable
private fun InkSwatchRow(letter: CeremonialMailLetter) {
    val swatches = listOf(letter.ink, CeremonialMailInkTone.Iron, CeremonialMailInkTone.Ivory)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        swatches.forEachIndexed { idx, tone ->
            Box(
                modifier =
                    Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(tone.color)
                        .border(
                            width = if (idx == 0) 2.dp else 1.dp,
                            color = if (idx == 0) letter.ink.color else letter.ink.color.copy(alpha = 0.2f),
                            shape = CircleShape,
                        ),
            )
        }
    }
}

@Composable
private fun ComposeIcon(
    letter: CeremonialMailLetter,
    icon: PantopusIcon,
) {
    Box(
        modifier =
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(9.dp))
                .background(Color.White.copy(alpha = 0.45f))
                .border(1.dp, letter.ink.color.copy(alpha = 0.13f), RoundedCornerShape(9.dp)),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = letter.ink.color)
    }
}
