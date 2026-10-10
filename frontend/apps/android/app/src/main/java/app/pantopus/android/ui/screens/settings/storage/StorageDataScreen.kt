@file:Suppress("MagicNumber", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.settings.storage

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.storage.StorageLimit
import app.pantopus.android.data.storage.StorageUsage
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tags, the twins of iOS `StorageDataView`'s accessibility identifiers. */
object StorageDataTags {
    const val SCREEN = "storageData"
    const val TOTAL = "storageDataTotal"
    const val CLEAR = "storageDataClearCache"
    const val LIMIT = "storageDataLimit"
    const val CONFIRM = "storageDataConfirm"
    const val LIMIT_PICKER = "storageDataLimitPicker"
}

private val photosColor = PantopusColors.primary600
private val pagesColor = PantopusColors.home
private val draftsColor = PantopusColors.business

/**
 * Settings → This phone → Storage & data, also opened by the system's "Manage space" button (ManageSpaceActivity).
 * Wording is the Instant Screens contract's (section 7), the same on every platform.
 */
@Composable
fun StorageDataScreen(
    onBack: () -> Unit,
    viewModel: StorageDataViewModel = hiltViewModel(),
) {
    val sizes by viewModel.sizes.collectAsStateWithLifecycle()
    val limitMegabytes by viewModel.limitMegabytes.collectAsStateWithLifecycle()
    val clearing by viewModel.clearing.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    var confirmsClear by remember { mutableStateOf(false) }
    var picksLimit by remember { mutableStateOf(false) }
    val toastController = remember { ToastController() }

    // Entry and every return (the cache grows while other screens are open).
    LifecycleResumeEffect(Unit) {
        viewModel.load()
        onPauseOrDispose { }
    }
    LaunchedEffect(toast) {
        toast?.let {
            toastController.show(it)
            viewModel.consumeToast()
        }
    }

    val clearable = StorageUsage.format(sizes?.clearable ?: 0L)
    Box(modifier = Modifier.fillMaxSize().testTag(StorageDataTags.SCREEN)) {
        ContentDetailShell(
            title = "Storage & data",
            onBack = onBack,
            header = { StorageHeader(sizes = sizes, limitMegabytes = limitMegabytes) },
            body = {
                StorageBody(
                    sizes = sizes,
                    clearable = clearable,
                    limitMegabytes = limitMegabytes,
                    clearing = clearing,
                    onClear = { confirmsClear = true },
                    onPickLimit = { picksLimit = true },
                )
            },
        )
        ToastHost(controller = toastController)
    }

    if (confirmsClear) {
        AlertDialog(
            onDismissRequest = { confirmsClear = false },
            title = { Text("Clear $clearable?") },
            text = { Text("Your homes, messages, posts and unsent drafts stay. Photos and pages download again when you open them.") },
            modifier = Modifier.testTag(StorageDataTags.CONFIRM),
            confirmButton = {
                TextButton(onClick = {
                    confirmsClear = false
                    viewModel.clearCache()
                }) {
                    Text("Clear cache", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmsClear = false }) { Text("Cancel") }
            },
        )
    }
    if (picksLimit) {
        LimitPicker(
            selected = limitMegabytes,
            onPick = { megabytes ->
                picksLimit = false
                viewModel.setLimit(megabytes)
            },
            onDismiss = { picksLimit = false },
        )
    }
}

/** The total, "Pantopus on this phone" and the meter. */
@Composable
private fun StorageHeader(
    sizes: StorageUsage.Sizes?,
    limitMegabytes: Int,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = sizes?.let { StorageUsage.format(it.total) } ?: "—",
            style = PantopusTextStyle.h1,
            color = PantopusColors.appText,
            modifier = Modifier.testTag(StorageDataTags.TOTAL),
        )
        Text(text = "Pantopus on this phone", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        StorageMeter(
            sizes = sizes,
            limitBytes = limitMegabytes * StorageLimit.BYTES_PER_MEGABYTE,
            modifier = Modifier.padding(top = Spacing.s2),
        )
    }
}

/** Photos, saved pages and drafts as three segments, against the limit. Decorative: the rows say the same in words. */
@Composable
private fun StorageMeter(
    sizes: StorageUsage.Sizes?,
    limitBytes: Long,
    modifier: Modifier = Modifier,
) {
    val scale = maxOf(limitBytes, sizes?.total ?: 0L, 1L).toFloat()
    BoxWithConstraints(
        modifier =
            modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .clearAndSetSemantics { },
    ) {
        val full = maxWidth
        Row(modifier = Modifier.fillMaxHeight(), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            listOf(
                (sizes?.photos ?: 0L) to photosColor,
                (sizes?.savedPages ?: 0L) to pagesColor,
                (sizes?.drafts ?: 0L) to draftsColor,
            ).forEach { (bytes, color) ->
                if (bytes > 0L) {
                    Box(modifier = Modifier.fillMaxHeight().width(maxOf(2.dp, full * (bytes / scale))).background(color))
                }
            }
        }
    }
}

@Composable
private fun StorageBody(
    sizes: StorageUsage.Sizes?,
    clearable: String,
    limitMegabytes: Int,
    clearing: Boolean,
    onClear: () -> Unit,
    onPickLimit: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(Radii.lg)).background(PantopusColors.appSurface)) {
            SizeRow("Photos and images", "From posts, messages and homes you opened", sizes?.photos, photosColor)
            HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(start = Spacing.s4))
            SizeRow("Saved pages", "So your tabs open instantly and offline", sizes?.savedPages, pagesColor)
            HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(start = Spacing.s4))
            SizeRow("Drafts and uploads in progress", "Kept until you send or finish them", sizes?.drafts, draftsColor)
        }
        GhostButton(
            title = "Clear cache ($clearable)",
            onClick = onClear,
            isLoading = clearing,
            isEnabled = (sizes?.clearable ?: 0L) > 0L,
            modifier = Modifier.testTag(StorageDataTags.CLEAR),
        )
        Footnote(
            "Nothing in your account is deleted. Your homes, messages, posts and unsent drafts stay. " +
                "Pages load from the internet the next time you open them.",
        )
        Text(
            text = "Automatic cleanup".uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(top = Spacing.s2).semantics { heading() },
        )
        LimitRow(limitMegabytes = limitMegabytes, onClick = onPickLimit)
        Footnote("At the limit, the oldest photos go first. Anything you haven't opened in 30 days goes too.")
    }
}

@Composable
private fun SizeRow(
    label: String,
    subtext: String,
    bytes: Long?,
    swatch: Color,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(swatch).clearAndSetSemantics { })
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText)
            Text(text = subtext, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        Text(
            text = bytes?.let(StorageUsage::format) ?: "—",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun LimitRow(
    limitMegabytes: Int,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) { }
                .testTag(StorageDataTags.LIMIT),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(text = "Keep up to", style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
        Text(text = "$limitMegabytes MB", style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/** The "Keep up to" choices: 50, 100 or 250 MB. */
@Composable
private fun LimitPicker(
    selected: Int,
    onPick: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Keep up to") },
        text = {
            Column(modifier = Modifier.selectableGroup()) {
                StorageLimit.CHOICES.forEach { megabytes ->
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .selectable(selected = megabytes == selected, role = Role.RadioButton) { onPick(megabytes) }
                                .testTag("${StorageDataTags.LIMIT_PICKER}_$megabytes"),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        RadioButton(selected = megabytes == selected, onClick = null)
                        Text(text = "$megabytes MB", style = PantopusTextStyle.body, color = PantopusColors.appText)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
        modifier = Modifier.testTag(StorageDataTags.LIMIT_PICKER),
    )
}

@Composable
private fun Footnote(text: String) {
    Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
}
