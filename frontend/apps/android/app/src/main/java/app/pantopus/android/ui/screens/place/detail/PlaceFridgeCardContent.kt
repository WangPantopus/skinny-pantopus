package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.runtime.toMutableStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.FridgeCard
import app.pantopus.android.data.api.models.place.FridgeCardItem
import app.pantopus.android.data.api.models.place.FridgeCardStatus
import app.pantopus.android.data.api.models.place.IssueFridgeCardRequest
import app.pantopus.android.data.api.models.place.IssueFridgeCardSection
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.theme.PantopusColors

// ─── Fridge Card (Wave 1, #2) — Risk & readiness, T4 ─────────
// Compose the 911-ready household card (shutoffs pre-seeded from the
// home's existing emergency info), issue — the card link is copied —
// and manage the home's cards. Issuing FREEZES the card; revoking
// pulls its content entirely. Parity: iOS PlaceFridgeCardSection.

private val SECTION_KEYS = listOf("household", "medical", "pets", "utilities", "contacts", "notes")
private const val MAX_ITEMS = 12

private fun sectionMeta(key: String): Pair<String, FridgeCardItem> =
    when (key) {
        "household" -> "Household" to FridgeCardItem("Mia (6)", "Peanut allergy — EpiPen in the pantry")
        "medical" -> "Medical" to FridgeCardItem("Dana", "Type 1 diabetic — insulin in fridge door")
        "pets" -> "Pets" to FridgeCardItem("Biscuit", "Golden retriever, friendly")
        "utilities" -> "Shutoffs & utilities" to FridgeCardItem("Gas shutoff", "Left side of the house")
        "contacts" -> "Emergency contacts" to FridgeCardItem("Grandma Ana", "503-555-0101")
        else -> "Notes" to FridgeCardItem("Spare key", "Lockbox by the side gate")
    }

@Composable
fun PlaceFridgeCardSection(viewModel: PlaceDetailViewModel) {
    val state by viewModel.fridgeCards.collectAsStateWithLifecycle()
    val linkToCopy by viewModel.cardLinkToCopy.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    LaunchedEffect(linkToCopy) {
        linkToCopy?.let {
            clipboard.setText(AnnotatedString(it))
            viewModel.consumeCardLink()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FridgeCardComposer(viewModel)
        PlaceActionToastLine(viewModel)
        when (val current = state) {
            is FridgeCardsUiState.Loading -> Unit
            is FridgeCardsUiState.Error ->
                PlaceDetailCard { Text(current.message, fontSize = 13.5.sp, color = PantopusColors.appTextMuted) }
            is FridgeCardsUiState.Loaded ->
                current.cards.forEach { FridgeCardRow(it, viewModel) }
        }
    }
}

@Composable
private fun FridgeCardComposer(viewModel: PlaceDetailViewModel) {
    var label by remember { mutableStateOf("") }
    val drafts = remember { mutableStateMapOf<String, SnapshotStateList<FridgeCardItem>>() }
    val seed by viewModel.utilitySeed.collectAsStateWithLifecycle()
    val isIssuing by viewModel.isIssuingCard.collectAsStateWithLifecycle()

    // Passive derivation: seed shutoffs once, only into an empty section.
    LaunchedEffect(seed) {
        if (seed.isNotEmpty() && drafts["utilities"].isNullOrEmpty()) {
            drafts["utilities"] = seed.toMutableStateList()
        }
    }

    val hasContent = drafts.values.any { list -> list.any { it.label.isNotBlank() || it.note.isNotBlank() } }

    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "The 911-ready household card",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                "Everything a sitter needs to say on a 911 call — starting with your exact address, " +
                    "which the card always shows. Read by people you hand it to; never sent to dispatch.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextSecondary,
            )
            OutlinedTextField(
                value = label,
                onValueChange = { label = it },
                placeholder = { Text("Card name — e.g. Sitter card") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            SECTION_KEYS.forEach { key ->
                FridgeSectionEditor(key, drafts.getOrPut(key) { emptyList<FridgeCardItem>().toMutableStateList() })
            }
            PrimaryButton(
                title = if (isIssuing) "Issuing…" else "Issue card & copy link",
                isLoading = isIssuing,
                isEnabled = hasContent,
                onClick = {
                    val sections =
                        SECTION_KEYS.mapNotNull { key ->
                            val items = drafts[key].orEmpty().filter { it.label.isNotBlank() || it.note.isNotBlank() }
                            if (items.isEmpty()) null else IssueFridgeCardSection(key, items)
                        }
                    viewModel.issueFridgeCard(IssueFridgeCardRequest(label.ifBlank { null }, sections))
                },
            )
            Text(
                "Issuing freezes the card exactly as entered. To change it later, issue a fresh card and revoke the old one.",
                fontSize = 11.5.sp,
                lineHeight = 15.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun FridgeSectionEditor(
    key: String,
    items: SnapshotStateList<FridgeCardItem>,
) {
    val (title, placeholder) = sectionMeta(key)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                title.uppercase(java.util.Locale.US),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.weight(1f),
            )
            Text(
                "Add",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier.clickable(enabled = items.size < MAX_ITEMS) {
                        items.add(FridgeCardItem("", ""))
                    },
            )
        }
        items.forEachIndexed { index, item ->
            FridgeItemRow(
                item = item,
                placeholder = placeholder,
                // Bounds-guarded like the iOS twin: the lambdas capture the
                // composition-time index, and an IME commit racing a ✕ tap
                // in the same frame can fire against a shrunken list —
                // items[staleIndex] would crash, removeAt would delete the
                // wrong row.
                onChange = { if (index < items.size) items[index] = it },
                onRemove = { if (index < items.size) items.removeAt(index) },
            )
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
    }
}

@Composable
private fun FridgeItemRow(
    item: FridgeCardItem,
    placeholder: FridgeCardItem,
    onChange: (FridgeCardItem) -> Unit,
    onRemove: () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = item.label,
            onValueChange = { onChange(item.copy(label = it)) },
            placeholder = { Text(placeholder.label, fontSize = 12.sp) },
            singleLine = true,
            modifier = Modifier.width(120.dp),
        )
        OutlinedTextField(
            value = item.note,
            onValueChange = { onChange(item.copy(note = it)) },
            placeholder = { Text(placeholder.note, fontSize = 12.sp) },
            singleLine = true,
            modifier = Modifier.weight(1f),
        )
        Text(
            "✕",
            fontSize = 14.sp,
            color = PantopusColors.appTextMuted,
            modifier = Modifier.clickable(onClick = onRemove),
        )
    }
}

@Composable
private fun FridgeCardRow(
    card: FridgeCard,
    viewModel: PlaceDetailViewModel,
) {
    val clipboard = LocalClipboardManager.current
    val opens =
        when {
            card.viewCount == 0 -> "Not opened yet"
            card.viewCount == 1 -> "Opened 1 time"
            else -> "Opened ${card.viewCount} times"
        }
    PlaceDetailCard(padding = 14.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    card.label ?: "Fridge card",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PlaceChip(
                    if (card.status == FridgeCardStatus.ACTIVE) {
                        PlaceChipModel(PlaceChipTone.SUCCESS, "Active")
                    } else {
                        PlaceChipModel(PlaceChipTone.WARNING, "Revoked")
                    },
                )
            }
            Text(
                "${PlacePresentation.fmtMonthYear(card.issuedAt) ?: ""} · $opens",
                fontSize = 11.5.sp,
                color = PantopusColors.appTextMuted,
            )
            if (card.status == FridgeCardStatus.ACTIVE) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Copy link",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                        modifier = Modifier.clickable { clipboard.setText(AnnotatedString(card.cardUrl)) },
                    )
                    Text(
                        "Revoke",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.error,
                        modifier = Modifier.clickable { viewModel.revokeFridgeCard(card.id) },
                    )
                }
            }
        }
    }
}
