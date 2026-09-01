package app.pantopus.android.ui.screens.place.verify

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.components.PlaceChevron
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailCard
import app.pantopus.android.ui.screens.place.detail.PlaceDetailHeader
import app.pantopus.android.ui.screens.place.detail.PlaceDetailSectionLabel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

const val PLACE_VERIFY_HOME_ID_KEY = "homeId"
const val PLACE_VERIFY_METHOD_KEY = "method"
const val PLACE_VERIFY_ADDRESS_KEY = "address"

enum class PlaceVerifyMethod(val slug: String, val icon: PantopusIcon, val label: String, val sub: String) {
    MAIL("mail", PantopusIcon.Send, "Mail a code to my address", "We send a postcard with a code. Most common."),
    RECORDS("records", PantopusIcon.FileSearch, "Match property records", "Instant if your name is on the deed or lease"),
    DOCUMENT("document", PantopusIcon.Upload, "Upload a document", "A utility bill, lease, or bank statement"),
    ;

    companion object {
        fun fromSlug(slug: String?): PlaceVerifyMethod = entries.firstOrNull { it.slug == slug } ?: MAIL
    }
}

private data class VerifyBenefit(val icon: PantopusIcon, val label: String, val sub: String)

private val VERIFY_BENEFITS =
    listOf(
        VerifyBenefit(PantopusIcon.MessageCircle, "Message your verified neighbors", "Direct messages with the people on your block"),
        VerifyBenefit(PantopusIcon.BadgeCheck, "Your verified badge", "The address-proven check on your profile"),
        VerifyBenefit(PantopusIcon.Mailbox, "Your digital mailbox", "Packages, civic notices, and permits in one place"),
    )

// ─── B1 — the verify sheet ───────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaceVerifySheet(
    address: String,
    onStart: (PlaceVerifyMethod) -> Unit,
    onDismiss: () -> Unit,
) {
    var selected by remember { mutableStateOf(PlaceVerifyMethod.MAIL) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = PantopusColors.appSurface) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 4.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(bottom = 18.dp),
            ) {
                Box(
                    modifier =
                        Modifier.size(
                            38.dp,
                        ).clip(
                            RoundedCornerShape(11.dp),
                        ).background(PantopusColors.homeBg).border(1.dp, PantopusColors.successLight, RoundedCornerShape(11.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 20.dp, strokeWidth = 2f, tint = PantopusColors.home)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Verify your address",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = (-0.36).sp,
                        color = PantopusColors.appText,
                    )
                    Text(address, fontSize = 13.sp, color = PantopusColors.appTextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Box(
                    modifier =
                        Modifier.size(
                            30.dp,
                        ).clip(CircleShape).background(PantopusColors.appSurfaceSunken).clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(PantopusIcon.X, "Close", size = 16.dp, strokeWidth = 2.5f, tint = PantopusColors.appTextSecondary)
                }
            }

            Overline("What this unlocks")
            Column(modifier = Modifier.fillMaxWidth().placeCard()) {
                VERIFY_BENEFITS.forEachIndexed { i, b ->
                    VerifyRow(b.icon, b.label, b.sub, PlaceTileTone.HOME, trailing = null)
                    if (i < VERIFY_BENEFITS.lastIndex) Divider()
                }
            }
            Spacer(modifier = Modifier.height(18.dp))

            Overline("Choose how")
            Column(modifier = Modifier.fillMaxWidth().placeCard()) {
                PlaceVerifyMethod.entries.forEachIndexed { i, m ->
                    Box(modifier = Modifier.clickable { selected = m }) {
                        VerifyRow(m.icon, m.label, m.sub, PlaceTileTone.SKY, trailing = { Radio(selected == m) })
                    }
                    if (i < PlaceVerifyMethod.entries.lastIndex) Divider()
                }
            }
            Spacer(modifier = Modifier.height(16.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.padding(horizontal = 2.dp, vertical = 0.dp)) {
                PantopusIconImage(
                    PantopusIcon.Clock,
                    null,
                    size = 15.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                    modifier = Modifier.padding(top = 1.dp),
                )
                Text(
                    "This can take a few days. Everything you have now stays available while you wait.",
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            PrimaryButton(title = "Start verification", onClick = { onStart(selected) }, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
private fun VerifyRow(
    icon: PantopusIcon,
    label: String,
    sub: String,
    tone: PlaceTileTone,
    trailing: (@Composable () -> Unit)?,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlaceIconTile(icon = icon, tone = tone, size = 34.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(sub, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
        }
        trailing?.invoke()
    }
}

@Composable
private fun Radio(selected: Boolean) {
    Box(
        modifier =
            Modifier.size(
                22.dp,
            ).clip(CircleShape).border(2.dp, if (selected) PantopusColors.primary600 else PantopusColors.appBorder, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (selected) Box(modifier = Modifier.size(12.dp).clip(CircleShape).background(PantopusColors.primary600))
    }
}

@Composable
private fun Divider() {
    Box(modifier = Modifier.fillMaxWidth().padding(start = 60.dp).height(1.dp).background(PantopusColors.appBorderSubtle))
}

@Composable
private fun Overline(text: String) {
    Text(
        text.uppercase(),
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.6.sp,
        color = PantopusColors.appTextMuted,
        modifier = Modifier.padding(horizontal = 2.dp, vertical = 0.dp).padding(bottom = 9.dp),
    )
}

// ─── B2/B3/B4 — the status screen ────────────────────────────

private enum class VerifyStage { PENDING, SUCCESS, FAILED }

@Composable
fun PlaceVerifyStatusScreen(
    address: String,
    method: PlaceVerifyMethod,
    onBack: () -> Unit,
    onDone: () -> Unit,
) {
    var stage by remember { mutableStateOf(VerifyStage.PENDING) }

    Column(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) {
        PlaceDetailHeader(title = "Verification", address = address, onBack = onBack)
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            when (stage) {
                VerifyStage.PENDING ->
                    Pending(
                        method,
                        onDone,
                        onSuccess = { stage = VerifyStage.SUCCESS },
                        onFailed = { stage = VerifyStage.FAILED },
                    )
                VerifyStage.SUCCESS -> Success(address, onDone)
                VerifyStage.FAILED -> Failed(method, onRetry = { stage = VerifyStage.PENDING })
            }
        }
    }
}

@Composable
private fun Pending(
    method: PlaceVerifyMethod,
    onDone: () -> Unit,
    onSuccess: () -> Unit,
    onFailed: () -> Unit,
) {
    StatusMark(if (method == PlaceVerifyMethod.MAIL) PantopusIcon.Clock else PantopusIcon.RefreshCw, home = true)
    Text(
        if (method == PlaceVerifyMethod.MAIL) "Your code is on the way" else "Checking property records…",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = PantopusColors.appText,
    )
    Text(
        when (method) {
            PlaceVerifyMethod.MAIL -> "We've mailed a postcard to your address. Enter the code when it arrives — usually within a few days."
            PlaceVerifyMethod.RECORDS -> "We're matching your name against the deed and lease records on file. This is usually instant."
            PlaceVerifyMethod.DOCUMENT -> "We're reviewing the document you uploaded. We'll let you know shortly."
        },
        fontSize = 14.sp,
        lineHeight = 20.sp,
        textAlign = TextAlign.Center,
        color = PantopusColors.appTextSecondary,
    )
    Reassurance()
    PrimaryButton(title = "Go to your dashboard", onClick = onDone, modifier = Modifier.fillMaxWidth())
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Simulate verified",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.clickable(onClick = onSuccess),
        )
        Text(
            "Simulate failed",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.clickable(onClick = onFailed),
        )
    }
}

@Composable
private fun Success(
    address: String,
    onDone: () -> Unit,
) {
    Box(modifier = Modifier.size(96.dp), contentAlignment = Alignment.Center) {
        Box(modifier = Modifier.size(96.dp).clip(CircleShape).background(PantopusColors.homeBg))
        Box(modifier = Modifier.size(64.dp).clip(CircleShape).background(PantopusColors.home), contentAlignment = Alignment.Center) {
            PantopusIconImage(PantopusIcon.Check, null, size = 34.dp, strokeWidth = 3f, tint = PantopusColors.appSurface)
        }
    }
    Text(
        "Your address is verified.",
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = PantopusColors.appText,
    )
    Text(
        "You're now an address-proven neighbor at $address.",
        fontSize = 14.sp,
        textAlign = TextAlign.Center,
        color = PantopusColors.appTextSecondary,
    )
    Column(modifier = Modifier.fillMaxWidth()) {
        PlaceDetailSectionLabel("Now available")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            VERIFY_BENEFITS.forEachIndexed { i, b ->
                val alpha by animateFloatAsState(targetValue = 1f, label = "reveal-$i")
                PlaceDetailCard(padding = 14.dp, modifier = Modifier.alpha(alpha)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                        PlaceIconTile(b.icon, PlaceTileTone.HOME, 32.dp)
                        Column(modifier = Modifier.weight(1f)) {
                            Text(b.label, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                            Text(b.sub, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
                        }
                        PantopusIconImage(PantopusIcon.Check, null, size = 16.dp, strokeWidth = 2.5f, tint = PantopusColors.home)
                    }
                }
            }
        }
    }
    PrimaryButton(title = "Go to your place", onClick = onDone, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun Failed(
    method: PlaceVerifyMethod,
    onRetry: () -> Unit,
) {
    StatusMark(PantopusIcon.TriangleAlert, home = false)
    Text(
        "We couldn't verify that yet.",
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        color = PantopusColors.appText,
    )
    PlaceChip(PlaceChipModel(PlaceChipTone.WARNING, if (method == PlaceVerifyMethod.MAIL) "Code expired" else "No record match"))
    Text(
        "This happens to plenty of people. Try one of the other ways below — nothing on your dashboard changed.",
        fontSize = 14.sp,
        lineHeight = 20.sp,
        textAlign = TextAlign.Center,
        color = PantopusColors.appTextSecondary,
    )
    Column(modifier = Modifier.fillMaxWidth()) {
        PlaceDetailSectionLabel("Other ways to verify")
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            PlaceVerifyMethod.entries.filter { it != method }.forEach { m ->
                Box(modifier = Modifier.clickable(onClick = onRetry)) {
                    PlaceDetailCard(padding = 14.dp) {
                        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
                            PlaceIconTile(m.icon, PlaceTileTone.SKY, 32.dp)
                            Column(modifier = Modifier.weight(1f)) {
                                Text(m.label, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                                Text(m.sub, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
                            }
                            PlaceChevron()
                        }
                    }
                }
            }
        }
    }
    Reassurance()
}

@Composable
private fun StatusMark(
    icon: PantopusIcon,
    home: Boolean,
) {
    Box(modifier = Modifier.size(84.dp), contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier.size(
                    84.dp,
                ).clip(CircleShape).background(if (home) PantopusColors.homeBg else PantopusColors.appSurfaceSunken),
        )
        PantopusIconImage(icon, null, size = 36.dp, strokeWidth = 2f, tint = if (home) PantopusColors.home else PantopusColors.warning)
    }
}

@Composable
private fun Reassurance() {
    PlaceDetailCard(padding = 14.dp, modifier = Modifier.fillMaxWidth()) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(PantopusIcon.ShieldCheck, null, size = 18.dp, strokeWidth = 2f, tint = PantopusColors.home)
            Text(
                "Nothing on your dashboard changed. You can keep using everything you have.",
                fontSize = 13.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}
