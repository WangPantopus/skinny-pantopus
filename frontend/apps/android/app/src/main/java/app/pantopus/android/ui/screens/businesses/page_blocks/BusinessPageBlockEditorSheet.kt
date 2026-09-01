@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "MagicNumber",
    "TooManyFunctions",
    "LongParameterList",
    "CyclomaticComplexMethod",
)

package app.pantopus.android.ui.screens.businesses.page_blocks

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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * C4 — the "Add block" type picker. Mirrors RN `BlockTypePicker.tsx`;
 * unknown block types never appear here because the list is driven off
 * [BusinessPageBlockKind.pickable].
 */
@Composable
fun BusinessPageBlockTypePicker(
    onSelect: (BusinessPageBlockKind) -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("businessPageBlocks.picker"),
        ) {
            ContentDetailTopBar(title = "Add block", onBack = onDismiss)
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                BusinessPageBlockKind.pickable.chunked(2).forEach { pair ->
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                        pair.forEach { kind ->
                            val entry = BusinessPageBlockRegistry.entry(kind)
                            Column(
                                modifier =
                                    Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(Radii.lg))
                                        .background(PantopusColors.appSurface)
                                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                                        .clickable { onSelect(kind) }
                                        .padding(Spacing.s3)
                                        .testTag("businessPageBlocks.pick.${kind.rawValue}"),
                                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                            ) {
                                PantopusIconImage(
                                    icon = entry.icon,
                                    contentDescription = null,
                                    size = 24.dp,
                                    tint = PantopusColors.primary600,
                                )
                                Text(
                                    text = entry.label,
                                    style = PantopusTextStyle.body,
                                    color = PantopusColors.appTextStrong,
                                )
                                Text(
                                    text = entry.summary,
                                    style = PantopusTextStyle.caption,
                                    color = PantopusColors.appTextSecondary,
                                    maxLines = 2,
                                )
                            }
                        }
                        if (pair.size == 1) Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

/**
 * C4 — field editor for one block. Edits a local copy and hands it back on
 * Done, matching RN's modal semantics (back / dismiss discards).
 */
@Composable
fun BusinessPageBlockEditorSheet(
    block: BusinessPageBlock,
    onSave: (BusinessPageBlock) -> Unit,
    onDismiss: () -> Unit,
) {
    var draft by remember(block.localId) { mutableStateOf(block) }
    var showsSettings by remember(block.localId) { mutableStateOf(false) }
    val entry = BusinessPageBlockRegistry.entry(draft.kind)

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("businessPageBlocks.editor"),
        ) {
            ContentDetailTopBar(
                title = "Edit ${entry.label}",
                onBack = onDismiss,
                action =
                    ContentDetailTopBarAction(
                        icon = PantopusIcon.Check,
                        contentDescription = "Done",
                        onClick = { onSave(draft) },
                    ),
            )
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                TypeBadge(entry)
                BlockFields(draft = draft, onDraftChange = { draft = it })
                SettingsSection(
                    draft = draft,
                    expanded = showsSettings,
                    onToggle = { showsSettings = !showsSettings },
                    onDraftChange = { draft = it },
                )
            }
        }
    }
}

@Composable
private fun TypeBadge(entry: BusinessPageBlockRegistryEntry) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .padding(Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = entry.icon, contentDescription = null, tint = PantopusColors.primary600)
        Text(text = entry.label, style = PantopusTextStyle.small, color = PantopusColors.primary600)
    }
}

@Composable
private fun BlockFields(
    draft: BusinessPageBlock,
    onDraftChange: (BusinessPageBlock) -> Unit,
) {
    val setString: (String, String) -> Unit = { key, value ->
        onDraftChange(draft.copy(data = draft.data + (key to value)))
    }
    val setNumber: (String, String, Int) -> Unit = { key, value, fallback ->
        onDraftChange(draft.copy(data = draft.data + (key to (value.toIntOrNull() ?: fallback).toDouble())))
    }

    when (val form = BusinessPageBlockForm.of(draft.kind)) {
        BusinessPageBlockForm.Hero -> {
            StringField("Headline", draft, "headline", "Your headline") { setString("headline", it) }
            StringField("Subhead", draft, "subhead", "Supporting text") { setString("subhead", it) }
            ButtonListEditor("Call-to-Action Buttons", draft, "cta", onDraftChange)
        }
        BusinessPageBlockForm.Text -> {
            StringField("Heading", draft, "heading", "Section heading") { setString("heading", it) }
            StringField("Body", draft, "body", "Body text…") { setString("body", it) }
        }
        BusinessPageBlockForm.Gallery -> {
            StringField("Heading", draft, "heading", "Gallery") { setString("heading", it) }
            NumberField("Image Count", draft, "image_count", 6) { setNumber("image_count", it, 6) }
            Hint("Image uploads available in the media manager")
        }
        BusinessPageBlockForm.Catalog -> {
            StringField("Heading", draft, "heading", "Our Services") { setString("heading", it) }
            ChipRow("Filter", BusinessPageBlockOptions.catalogFilterKinds, draft.filterKind) {
                setString("filter_kind", it)
            }
            NumberField("Max Items", draft, "max_items", 8) { setNumber("max_items", it, 8) }
        }
        BusinessPageBlockForm.Cta -> {
            StringField("Heading", draft, "heading", "Ready to get started?") { setString("heading", it) }
            StringField("Subhead", draft, "subhead", "Supporting text") { setString("subhead", it) }
            ButtonListEditor("Buttons", draft, "buttons", onDraftChange)
        }
        BusinessPageBlockForm.Faq -> {
            StringField("Heading", draft, "heading", "FAQ") { setString("heading", it) }
            FaqEditor(draft, onDraftChange)
        }
        BusinessPageBlockForm.Stats -> StatsEditor(draft, onDraftChange)
        BusinessPageBlockForm.Embed -> {
            StringField("URL", draft, "url", "https://youtube.com/…") { setString("url", it) }
            Hint("YouTube, Vimeo, Google Maps, and other embeddable URLs")
        }
        BusinessPageBlockForm.PostsFeed -> {
            StringField("Heading", draft, "heading", "Latest Updates") { setString("heading", it) }
            NumberField("Max Items", draft, "max_items", 5) { setNumber("max_items", it, 5) }
        }
        is BusinessPageBlockForm.HeadingOnly -> {
            StringField("Heading", draft, "heading", "Section heading") { setString("heading", it) }
            Hint(form.hint)
        }
        is BusinessPageBlockForm.Note -> Hint(form.text)
        is BusinessPageBlockForm.Unsupported ->
            Hint("Unknown block type: ${form.type}. Update the app to edit this block.")
    }
}

@Composable
private fun StringField(
    label: String,
    draft: BusinessPageBlock,
    key: String,
    placeholder: String,
    onChange: (String) -> Unit,
) {
    PantopusTextField(
        label = label,
        value = draft.data[key] as? String ?: "",
        onValueChange = onChange,
        placeholder = placeholder,
        fieldTestTag = "businessPageBlocks.field.$key",
    )
}

@Composable
private fun NumberField(
    label: String,
    draft: BusinessPageBlock,
    key: String,
    fallback: Int,
    onChange: (String) -> Unit,
) {
    val current =
        when (val value = draft.data[key]) {
            is Number -> value.toInt().toString()
            is String -> value
            else -> fallback.toString()
        }
    PantopusTextField(
        label = label,
        value = current,
        onValueChange = onChange,
        placeholder = fallback.toString(),
        keyboardType = KeyboardType.Number,
        fieldTestTag = "businessPageBlocks.field.$key",
    )
}

@Composable
private fun Hint(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextMuted,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ChipRow(
    title: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(text = title, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            options.forEach { (key, label) ->
                val isActive = selected == key
                Text(
                    text = label,
                    style = PantopusTextStyle.caption,
                    color = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextSecondary,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurface)
                            .clickable { onSelect(key) }
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                )
            }
        }
    }
}

@Composable
private fun ButtonListEditor(
    title: String,
    draft: BusinessPageBlock,
    key: String,
    onDraftChange: (BusinessPageBlock) -> Unit,
) {
    val buttons = draft.buttonList(key)

    fun write(next: List<BusinessPageBlockButton>) = onDraftChange(draft.copy(data = draft.data + (key to next.map { it.toMap() })))

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(text = title, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        buttons.forEachIndexed { index, button ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Box(modifier = Modifier.weight(1f)) {
                        PantopusTextField(
                            label = "Label",
                            value = button.label,
                            onValueChange = { value ->
                                write(buttons.toMutableList().also { it[index] = button.copy(label = value) })
                            },
                            placeholder = "Button label",
                        )
                    }
                    RemoveButton("businessPageBlocks.removeButton.$index") {
                        write(buttons.toMutableList().also { it.removeAt(index) })
                    }
                }
                ChipRow("Action", BusinessPageBlockOptions.ctaActions, button.action) { action ->
                    write(buttons.toMutableList().also { it[index] = button.copy(action = action) })
                }
            }
        }
        AddRow("Add button", "businessPageBlocks.addButton.$key") {
            write(buttons + BusinessPageBlockButton(label = "", action = "message"))
        }
    }
}

@Composable
private fun FaqEditor(
    draft: BusinessPageBlock,
    onDraftChange: (BusinessPageBlock) -> Unit,
) {
    val items = draft.faqItems

    fun write(next: List<BusinessPageBlockFaqItem>) = onDraftChange(draft.copy(data = draft.data + ("items" to next.map { it.toMap() })))

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Questions & answers",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        items.forEachIndexed { index, item ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Box(modifier = Modifier.weight(1f)) {
                        PantopusTextField(
                            label = "Question",
                            value = item.question,
                            onValueChange = { value ->
                                write(items.toMutableList().also { it[index] = item.copy(question = value) })
                            },
                            placeholder = "Question",
                        )
                    }
                    RemoveButton("businessPageBlocks.removeFaq.$index") {
                        write(items.toMutableList().also { it.removeAt(index) })
                    }
                }
                PantopusTextField(
                    label = "Answer",
                    value = item.answer,
                    onValueChange = { value ->
                        write(items.toMutableList().also { it[index] = item.copy(answer = value) })
                    },
                    placeholder = "Answer",
                )
            }
        }
        AddRow("Add question", "businessPageBlocks.addFaq") {
            write(items + BusinessPageBlockFaqItem(question = "", answer = ""))
        }
    }
}

@Composable
private fun StatsEditor(
    draft: BusinessPageBlock,
    onDraftChange: (BusinessPageBlock) -> Unit,
) {
    val stats = draft.stats

    fun write(next: List<BusinessPageBlockStat>) = onDraftChange(draft.copy(data = draft.data + ("stats" to next.map { it.toMap() })))

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(text = "Stats", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        stats.forEachIndexed { index, stat ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    PantopusTextField(
                        label = "Value",
                        value = stat.value,
                        onValueChange = { value ->
                            write(stats.toMutableList().also { it[index] = stat.copy(value = value) })
                        },
                        placeholder = "100+",
                    )
                }
                Box(modifier = Modifier.weight(1f)) {
                    PantopusTextField(
                        label = "Label",
                        value = stat.label,
                        onValueChange = { value ->
                            write(stats.toMutableList().also { it[index] = stat.copy(label = value) })
                        },
                        placeholder = "Customers",
                    )
                }
                RemoveButton("businessPageBlocks.removeStat.$index") {
                    write(stats.toMutableList().also { it.removeAt(index) })
                }
            }
        }
        AddRow("Add stat", "businessPageBlocks.addStat") {
            write(stats + BusinessPageBlockStat(label = "", value = ""))
        }
    }
}

@Composable
private fun SettingsSection(
    draft: BusinessPageBlock,
    expanded: Boolean,
    onToggle: () -> Unit,
    onDraftChange: (BusinessPageBlock) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(vertical = Spacing.s3)
                    .testTag("businessPageBlocks.editor.settingsToggle"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = "Block settings", style = PantopusTextStyle.body, color = PantopusColors.appTextStrong)
            Box(modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = if (expanded) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                tint = PantopusColors.appTextSecondary,
            )
        }
        if (expanded) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Visible to visitors",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                Box(modifier = Modifier.weight(1f))
                Switch(
                    checked = draft.isVisible,
                    onCheckedChange = { onDraftChange(draft.copy(isVisible = it)) },
                    colors = SwitchDefaults.colors(checkedTrackColor = PantopusColors.primary600),
                    modifier = Modifier.testTag("businessPageBlocks.editor.visible"),
                )
            }
            ChipRow(
                title = "Padding",
                options = BusinessPageBlockOptions.padding,
                selected = draft.settings["padding"] as? String ?: "default",
            ) { value ->
                onDraftChange(draft.copy(settings = draft.settings + ("padding" to value)))
            }
            ChipRow(
                title = "Background",
                options = BusinessPageBlockOptions.background,
                selected = draft.settings["background"] as? String ?: "default",
            ) { value ->
                onDraftChange(draft.copy(settings = draft.settings + ("background" to value)))
            }
        }
    }
}

@Composable
private fun RemoveButton(
    tag: String,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier.clickable(onClick = onClick).padding(Spacing.s2).testTag(tag),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.XCircle,
            contentDescription = "Remove",
            tint = PantopusColors.error,
        )
    }
}

@Composable
private fun AddRow(
    title: String,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier.clickable(onClick = onClick).padding(vertical = Spacing.s2).testTag(tag),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PlusCircle,
            contentDescription = null,
            tint = PantopusColors.primary600,
        )
        Text(text = title, style = PantopusTextStyle.small, color = PantopusColors.primary600)
    }
}
