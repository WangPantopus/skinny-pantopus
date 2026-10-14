@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.feed.FeedPreferencesDto
import app.pantopus.android.ui.components.RefreshFailedLine
import app.pantopus.android.ui.components.RefreshOnStoreChange
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.adaptiveColor

/**
 * Pulse Preferences — the bottom sheet behind the Pulse header's
 * preferences control. Mirrors RN
 * `src/components/feed/FeedPreferencesSheet.tsx`: two Place-feed toggles
 * (deals, safety alerts) plus a single political-content toggle that writes
 * both the Place and Connections columns.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedPreferencesSheet(
    onClose: () -> Unit,
    onPrefsChanged: () -> Unit = {},
    /** A Pulse topic was unmuted here (its id): the feed shows its posts again. */
    onTopicUnmuted: (String) -> Unit = {},
    viewModel: FeedPreferencesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val mutedTopics by viewModel.mutedTopics.collectAsStateWithLifecycle()
    LaunchedEffect(viewModel) { viewModel.unmutedTopics.collect { onTopicUnmuted(it) } }
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val refreshNotice by viewModel.refreshNotice.collectAsStateWithLifecycle()
    val toast by viewModel.toastMessage.collectAsStateWithLifecycle()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    LaunchedEffect(Unit) { viewModel.load() }
    RefreshOnStoreChange(viewModel::load)

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = sheetState,
        containerColor = adaptiveColor(PantopusColors.appBg, PantopusColors.appBgDark),
        modifier = Modifier.testTag("pulsePreferencesSheet"),
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Pulse Preferences",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = adaptiveColor(PantopusColors.appText, PantopusColors.appTextDark),
                    modifier = Modifier.semantics { heading() },
                )
                Spacer(modifier = Modifier.weight(1f))
                Box(
                    modifier =
                        Modifier
                            .size(32.dp)
                            .clickable(onClick = onClose)
                            .semantics { contentDescription = "Close preferences" }
                            .testTag("pulsePreferencesClose"),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.X,
                        contentDescription = null,
                        size = 18.dp,
                        tint = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark),
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(adaptiveColor(PantopusColors.appBorderSubtle, PantopusColors.appBorderDark)),
            )
            refreshNotice?.let { RefreshFailedLine(it) }
            when (val s = state) {
                is FeedPreferencesUiState.Loading -> PreferencesLoading()
                is FeedPreferencesUiState.Error ->
                    PreferencesError(message = s.message, onRetry = { viewModel.refresh() })
                is FeedPreferencesUiState.Loaded ->
                    PreferencesLoaded(
                        prefs = s.preferences,
                        isSaving = isSaving,
                        onShowDeals = {
                            viewModel.setShowDeals(it)
                            onPrefsChanged()
                        },
                        onShowAlerts = {
                            viewModel.setShowAlerts(it)
                            onPrefsChanged()
                        },
                        onShowPolitics = {
                            viewModel.setShowPolitics(it)
                            onPrefsChanged()
                        },
                        mutedTopics = mutedTopics,
                        onUnmuteTopic = viewModel::unmuteTopic,
                    )
            }
            toast?.let { message ->
                Text(
                    text = message,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    color = adaptiveColor(PantopusColors.error, PantopusColors.errorLight),
                    modifier = Modifier.padding(top = Spacing.s2).testTag("pulsePreferencesToast"),
                )
            }
            Spacer(modifier = Modifier.height(Spacing.s10))
        }
    }
}

@Composable
private fun PreferencesLoading() {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s4).testTag("pulsePreferencesLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        // Shimmer pins its own width, so the skeleton rows use the card
        // width from the A03 frame rather than fillMaxWidth().
        repeat(3) {
            Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.sm)
        }
    }
}

@Composable
private fun PreferencesError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s5).testTag("pulsePreferencesError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 32.dp,
            tint = adaptiveColor(PantopusColors.error, PantopusColors.errorLight),
        )
        Text(
            text = "Couldn't load preferences",
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            color = adaptiveColor(PantopusColors.appText, PantopusColors.appTextDark),
        )
        Text(text = message, fontSize = 13.sp, color = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark))
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.primary600)
                    .clickable(onClick = onRetry)
                    .padding(horizontal = 22.dp)
                    .height(40.dp)
                    .testTag("pulsePreferencesRetry"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Try again",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }
}

@Composable
private fun PreferencesLoaded(
    prefs: FeedPreferencesDto,
    isSaving: Boolean,
    onShowDeals: (Boolean) -> Unit,
    onShowAlerts: (Boolean) -> Unit,
    onShowPolitics: (Boolean) -> Unit,
    mutedTopics: MutedTopicsUiState = MutedTopicsUiState.Loaded(emptyList()),
    onUnmuteTopic: (MutedTopicUi) -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("pulsePreferencesLoaded")) {
        SectionLabel("PLACE FEED")
        PreferenceRow(
            title = "Show deals",
            body = "Deals and promotions from local businesses",
            checked = !prefs.hideDealsPlace,
            enabled = !isSaving,
            testTag = "pulsePreferencesShowDeals",
            onCheckedChange = onShowDeals,
        )
        PreferenceRow(
            title = "Show safety alerts",
            body = "Hazards, outages and safety warnings",
            checked = !prefs.hideAlertsPlace,
            enabled = !isSaving,
            testTag = "pulsePreferencesShowAlerts",
            onCheckedChange = onShowAlerts,
        )
        SectionLabel("CONTENT")
        PreferenceRow(
            title = "Show political content",
            body =
                "Political posts are hidden by default to keep your feed focused " +
                    "on neighborhood life",
            checked = prefs.showPoliticsPlace,
            enabled = !isSaving,
            testTag = "pulsePreferencesShowPolitics",
            onCheckedChange = onShowPolitics,
        )
        MutedTopicsSection(state = mutedTopics, onUnmute = onUnmuteTopic)
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Info,
                contentDescription = null,
                size = 13.dp,
                tint = adaptiveColor(PantopusColors.appTextMuted, PantopusColors.appTextSecondaryDark),
            )
            Text(
                text = "These preferences sync across all your devices.",
                fontSize = 12.sp,
                color = adaptiveColor(PantopusColors.appTextMuted, PantopusColors.appTextSecondaryDark),
            )
        }
    }
}

/**
 * The Pulse topics the person muted (Pulse build S4), each with "Unmute"; ids `pulsePreferencesMutedTopics`,
 * `pulsePreferencesMutedTopic_<topic id>` and `pulsePreferencesUnmuteTopic_<topic id>`, as on iOS.
 */
@Composable
private fun MutedTopicsSection(
    state: MutedTopicsUiState,
    onUnmute: (MutedTopicUi) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("pulsePreferencesMutedTopics")) {
        SectionLabel("MUTED TOPICS")
        when (state) {
            MutedTopicsUiState.Loading -> Shimmer(width = 320.dp, height = 44.dp, cornerRadius = Radii.sm)
            MutedTopicsUiState.Error ->
                Text(
                    text = "Couldn't load your muted topics.",
                    fontSize = 13.sp,
                    color = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark),
                )
            is MutedTopicsUiState.Loaded ->
                if (state.items.isEmpty()) {
                    Text(
                        text = "No muted topics.",
                        fontSize = 13.sp,
                        color = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark),
                        modifier = Modifier.padding(bottom = Spacing.s2),
                    )
                } else {
                    state.items.forEach { item -> MutedTopicRow(item = item, onUnmute = { onUnmute(item) }) }
                }
        }
    }
}

@Composable
private fun MutedTopicRow(
    item: MutedTopicUi,
    onUnmute: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("pulsePreferencesMutedTopic_${item.topic.key}")) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = item.topic.label,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = adaptiveColor(PantopusColors.appText, PantopusColors.appTextDark),
                )
                Text(
                    text = if (item.areaId == null) "Everywhere" else "In one area",
                    fontSize = 12.sp,
                    color = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark),
                )
            }
            Box(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .border(
                            1.dp,
                            adaptiveColor(PantopusColors.appBorderStrong, PantopusColors.appBorderStrongDark),
                            RoundedCornerShape(Radii.pill),
                        )
                        .testTag("pulsePreferencesUnmuteTopic_${item.topic.key}")
                        .clickable(role = Role.Button, onClick = onUnmute)
                        .clearAndSetSemantics { contentDescription = "Unmute ${item.topic.label}" }
                        .heightIn(min = 44.dp)
                        .padding(horizontal = Spacing.s4),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Unmute",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = adaptiveColor(PantopusColors.primary600, PantopusColors.primary300),
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(adaptiveColor(PantopusColors.appBorderSubtle, PantopusColors.appBorderDark)),
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = adaptiveColor(PantopusColors.appTextMuted, PantopusColors.appTextSecondaryDark),
        modifier = Modifier.padding(top = Spacing.s5, bottom = Spacing.s2),
    )
}

@Composable
private fun PreferenceRow(
    title: String,
    body: String,
    checked: Boolean,
    enabled: Boolean,
    testTag: String,
    onCheckedChange: (Boolean) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = title,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = adaptiveColor(PantopusColors.appText, PantopusColors.appTextDark),
                )
                Text(
                    text = body,
                    fontSize = 12.sp,
                    color = adaptiveColor(PantopusColors.appTextSecondary, PantopusColors.appTextSecondaryDark),
                )
            }
            Switch(
                checked = checked,
                onCheckedChange = onCheckedChange,
                enabled = enabled,
                colors =
                    SwitchDefaults.colors(
                        checkedThumbColor = PantopusColors.appTextInverse,
                        checkedTrackColor = PantopusColors.primary600,
                    ),
                modifier =
                    Modifier
                        .semantics { contentDescription = title }
                        .testTag(testTag),
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(adaptiveColor(PantopusColors.appBorderSubtle, PantopusColors.appBorderDark)),
        )
    }
}
