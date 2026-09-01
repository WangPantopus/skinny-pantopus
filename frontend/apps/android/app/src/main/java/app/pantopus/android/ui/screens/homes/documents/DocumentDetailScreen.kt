@file:Suppress(
    "PackageNaming",
    "LongMethod",
    "MagicNumber",
    "LongParameterList",
    "MatchingDeclarationName",
)

package app.pantopus.android.ui.screens.homes.documents

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homes.HomeDocumentDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * P2.10 — Document detail. Reads the document via the existing list
 * endpoint (no GET-by-id on the backend today), renders a header card,
 * a preview pane (PDF / image / unsupported), a metadata grid, and a
 * sticky footer with the four design actions.
 */
@Composable
fun DocumentDetailScreen(
    onBack: () -> Unit,
    onReplace: () -> Unit,
    viewModel: DocumentDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showDeleteConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_500)
            viewModel.dismissToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("documentDetail"),
    ) {
        Column(Modifier.fillMaxSize()) {
            when (val current = state) {
                DocumentDetailUiState.Loading -> LoadingShell(onBack = onBack)
                is DocumentDetailUiState.Loaded ->
                    LoadedShell(
                        dto = current.document,
                        isMutating = current.isMutating,
                        onBack = onBack,
                        onOpenExternally = { openExternally(context, current.document) },
                        onShare = { shareDocument(context, current.document) },
                        onReplace = onReplace,
                        onDelete = { showDeleteConfirm = true },
                    )
                is DocumentDetailUiState.Error ->
                    ErrorShell(
                        message = current.message,
                        onBack = onBack,
                        onRetry = { viewModel.load() },
                    )
            }
        }
        toast?.let { value ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s12)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(if (value.isError) PantopusColors.error else PantopusColors.success)
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s2),
            ) {
                Text(
                    text = value.text,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Delete this document?") },
            text = { Text("The file will be removed from this home's vault.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.delete()
                }) {
                    Text("Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

// MARK: - Shells

@Composable
private fun LoadingShell(onBack: () -> Unit) {
    ContentDetailShell(
        title = "Document",
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Shimmer(width = 320.dp, height = 60.dp, cornerRadius = Radii.lg)
                Shimmer(width = 320.dp, height = 260.dp, cornerRadius = Radii.lg)
            }
        },
        body = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                repeat(3) {
                    Shimmer(width = 320.dp, height = 56.dp, cornerRadius = Radii.md)
                }
            }
        },
    )
}

@Composable
private fun ErrorShell(
    message: String,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    ContentDetailShell(
        title = "Document",
        onBack = onBack,
        header = { Spacer(Modifier.height(Spacing.s0)) },
        body = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(Spacing.s5),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.AlertCircle,
                    contentDescription = null,
                    size = 32.dp,
                    tint = PantopusColors.appTextMuted,
                )
                Text(
                    text = "Couldn't load this document",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
                Text(
                    text = message,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
                TextButton(onClick = onRetry) { Text("Try again") }
            }
        },
    )
}

@Composable
private fun LoadedShell(
    dto: HomeDocumentDto,
    isMutating: Boolean,
    onBack: () -> Unit,
    onOpenExternally: () -> Unit,
    onShare: () -> Unit,
    onReplace: () -> Unit,
    onDelete: () -> Unit,
) {
    val fileType = remember(dto) { DocumentFileType.fromMime(dto.mimeType, dto.title) }
    val category = remember(dto) { DocumentCategory.fromDocType(dto.docType) }
    val projection =
        remember(dto) {
            DocumentsViewModel.project(dto, java.time.Instant.now())
        }
    val tags = remember(dto) { parseTags(dto.details ?: emptyMap()) }
    val linkedEntity = remember(dto) { parseLinkedEntity(dto.details ?: emptyMap()) }

    Box(modifier = Modifier.fillMaxSize()) {
        ContentDetailShell(
            title = "Document",
            onBack = onBack,
            header = {
                HeaderCard(
                    dto = dto,
                    fileType = fileType,
                    category = category,
                    modifier = Modifier.padding(horizontal = Spacing.s4),
                )
            },
            body = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                    PreviewPane(
                        dto = dto,
                        fileType = fileType,
                        onOpenExternally = onOpenExternally,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                    MetadataGrid(
                        dto = dto,
                        projection = projection,
                        modifier = Modifier.padding(horizontal = Spacing.s4),
                    )
                    if (tags.isNotEmpty()) {
                        TagsRow(tags = tags, modifier = Modifier.padding(horizontal = Spacing.s4))
                    }
                    linkedEntity?.let {
                        LinkedToCard(link = it, modifier = Modifier.padding(horizontal = Spacing.s4))
                    }
                    Spacer(Modifier.height(80.dp))
                }
            },
        )
        StickyActionFooter(
            isMutating = isMutating,
            onOpenExternally = onOpenExternally,
            onShare = onShare,
            onReplace = onReplace,
            onDelete = onDelete,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

// MARK: - Header

@Composable
private fun HeaderCard(
    dto: HomeDocumentDto,
    fileType: DocumentFileType,
    category: DocumentCategory,
    modifier: Modifier = Modifier,
) {
    val sizeLabel = remember(dto) { formatBytes(dto.sizeBytes) }
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s4),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        FileTypeTile(fileType = fileType, width = 48.dp, height = 56.dp)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = dto.title,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .semantics { heading() }
                        .testTag("documentDetailTitle"),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                CategoryBadge(category = category)
                if (!sizeLabel.isNullOrEmpty()) {
                    Text(
                        text = sizeLabel,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun CategoryBadge(category: DocumentCategory) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(category.background)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .semantics { contentDescription = "Category ${category.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = category.icon,
            contentDescription = null,
            size = Radii.lg,
            tint = category.foreground,
        )
        Text(
            text = category.label,
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = category.foreground,
        )
    }
}

// MARK: - Preview pane

@Composable
private fun PreviewPane(
    dto: HomeDocumentDto,
    fileType: DocumentFileType,
    onOpenExternally: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val previewUrl = remember(dto) { resolvePreviewUrl(dto) }
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(260.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .testTag("documentDetailPreview"),
        contentAlignment = Alignment.Center,
    ) {
        when {
            previewUrl != null && (fileType == DocumentFileType.Pdf || fileType == DocumentFileType.Scan) ->
                PdfPreview(url = previewUrl)
            previewUrl != null && fileType == DocumentFileType.Image ->
                ImagePreview(url = previewUrl)
            else -> UnsupportedPreview(fileType = fileType, onOpenExternally = onOpenExternally)
        }
    }
}

@Composable
private fun PdfPreview(url: String) {
    val context = LocalContext.current
    val bitmap by produceState<Bitmap?>(initialValue = null, key1 = url) {
        value = withContext(Dispatchers.IO) { renderFirstPage(context, url) }
    }
    if (bitmap == null) {
        CircularProgressIndicator(
            color = PantopusColors.primary600,
            modifier = Modifier.size(28.dp),
        )
    } else {
        Image(
            bitmap = bitmap!!.asImageBitmap(),
            contentDescription = "PDF preview",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
        )
    }
}

@Composable
private fun ImagePreview(url: String) {
    SubcomposeAsyncImage(
        model = url,
        contentDescription = "Image preview",
        modifier = Modifier.fillMaxSize(),
        contentScale = ContentScale.Fit,
        loading = {
            CircularProgressIndicator(
                color = PantopusColors.primary600,
                modifier = Modifier.size(28.dp),
            )
        },
        error = {
            UnsupportedPreview(fileType = DocumentFileType.Image, onOpenExternally = {})
        },
    )
}

@Composable
private fun UnsupportedPreview(
    fileType: DocumentFileType,
    onOpenExternally: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        modifier = Modifier.padding(Spacing.s5),
    ) {
        FileTypeTile(fileType = fileType, width = 56.dp, height = 68.dp)
        Text(
            text = "Preview not supported",
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
        Text(
            text = "Open the file in another app to view its contents.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                    .clickable(onClick = onOpenExternally)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag("documentDetailPreviewOpenExternally"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ExternalLink,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Open externally",
                style = PantopusTextStyle.caption,
                color = PantopusColors.primary600,
            )
        }
    }
}

// MARK: - Metadata grid

@Composable
private fun MetadataGrid(
    dto: HomeDocumentDto,
    projection: DocumentRowProjection,
    modifier: Modifier = Modifier,
) {
    val uploadedBy =
        dto.details?.get("uploaded_by")?.takeIf { it.isNotEmpty() } ?: dto.createdBy ?: "—"
    val uploadedLabel = projection.uploadedLabel ?: "—"
    val visibility =
        when (dto.visibility) {
            "managers" -> "Owners only"
            "members" -> "All members"
            "private" -> "Private"
            "public" -> "Public"
            else -> dto.visibility?.replaceFirstChar { it.uppercase() } ?: "—"
        }
    val sizeLabel = remember(dto) { formatBytes(dto.sizeBytes) }
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg)),
    ) {
        MetaRow(label = "Uploaded by", value = uploadedBy)
        Divider()
        MetaRow(label = "Uploaded", value = uploadedLabel)
        projection.expiresLabel?.let {
            Divider()
            MetaRow(
                label = "Expires",
                value = it,
                valueIsWarning = projection.expiresUrgent,
            )
        }
        Divider()
        MetaRow(label = "Visibility", value = visibility)
        sizeLabel?.let {
            Divider()
            MetaRow(label = "Size", value = it)
        }
    }
}

@Composable
private fun MetaRow(
    label: String,
    value: String,
    valueIsWarning: Boolean = false,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .semantics { contentDescription = "$label $value" },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.width(110.dp),
        )
        Text(
            text = value,
            style = PantopusTextStyle.body,
            color = if (valueIsWarning) PantopusColors.warning else PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun Divider() {
    HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
}

// MARK: - Tags + linked

@Composable
private fun TagsRow(
    tags: List<String>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag("documentDetailTags"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "TAGS",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        LazyRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            items(tags, key = { it }) { tag ->
                Text(
                    text = tag,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appText,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                            .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun LinkedToCard(
    link: DocumentLinkedEntity,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.testTag("documentDetailLinkedTo"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "LINKED TO",
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = link.kind.icon,
                contentDescription = null,
                size = Radii.xl,
                tint = PantopusColors.home,
            )
            Column {
                Text(
                    text = link.title,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
                Text(
                    text = link.kind.label,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// MARK: - Sticky footer

@Composable
private fun StickyActionFooter(
    isMutating: Boolean,
    onOpenExternally: () -> Unit,
    onShare: () -> Unit,
    onReplace: () -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FooterButton(
                icon = PantopusIcon.ExternalLink,
                label = "Open",
                contentDesc = "Open externally",
                testTag = "documentDetailOpenExternally",
                tint = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                enabled = !isMutating,
                onClick = onOpenExternally,
            )
            FooterButton(
                icon = PantopusIcon.Share,
                label = "Share",
                contentDesc = "Share document",
                testTag = "documentDetailShare",
                tint = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                enabled = !isMutating,
                onClick = onShare,
            )
            FooterButton(
                icon = PantopusIcon.RefreshCw,
                label = "Replace",
                contentDesc = "Replace file",
                testTag = "documentDetailReplace",
                tint = PantopusColors.appText,
                modifier = Modifier.weight(1f),
                enabled = !isMutating,
                onClick = onReplace,
            )
            FooterButton(
                icon = PantopusIcon.Trash2,
                label = "Delete",
                contentDesc = "Delete document",
                testTag = "documentDetailDelete",
                tint = PantopusColors.error,
                modifier = Modifier.weight(1f),
                enabled = !isMutating,
                onClick = onDelete,
            )
        }
    }
}

@Composable
private fun FooterButton(
    icon: PantopusIcon,
    label: String,
    contentDesc: String,
    testTag: String,
    tint: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            modifier
                .clickable(enabled = enabled, onClick = onClick)
                .testTag(testTag)
                .semantics { contentDescription = contentDesc }
                .padding(vertical = Spacing.s2),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 18.dp,
            tint = tint,
        )
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = tint,
        )
    }
}

// MARK: - Helpers (preview + share)

private fun resolvePreviewUrl(dto: HomeDocumentDto): String? {
    dto.details?.get("preview_url")?.takeIf { it.isNotEmpty() }?.let { return it }
    val path = dto.storagePath ?: return null
    return if (path.startsWith("http")) path else null
}

private fun openExternally(
    context: android.content.Context,
    dto: HomeDocumentDto,
) {
    val url = resolvePreviewUrl(dto) ?: return
    val intent =
        Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    runCatching { context.startActivity(intent) }
}

private fun shareDocument(
    context: android.content.Context,
    dto: HomeDocumentDto,
) {
    val url = resolvePreviewUrl(dto) ?: dto.title
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, dto.title)
            putExtra(Intent.EXTRA_TEXT, url)
        }
    runCatching {
        context.startActivity(Intent.createChooser(intent, "Share document"))
    }
}

/**
 * Render the first page of a remote PDF into a [Bitmap]. Returns null
 * on failure; the call site falls back to the unsupported-preview UI.
 */
private suspend fun renderFirstPage(
    context: android.content.Context,
    url: String,
): Bitmap? {
    return runCatching {
        val tempFile = File.createTempFile("doc-preview-", ".pdf", context.cacheDir)
        URL(url).openStream().use { input ->
            tempFile.outputStream().use { output -> input.copyTo(output) }
        }
        val fd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY)
        PdfRenderer(fd).use { renderer ->
            if (renderer.pageCount == 0) return@use null
            renderer.openPage(0).use { page ->
                val bitmap = Bitmap.createBitmap(page.width * 2, page.height * 2, Bitmap.Config.ARGB_8888)
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                bitmap
            }
        }
    }.getOrNull()
}

/** Parse the comma-separated `tags` payload from a document's `details` map. */
internal fun parseTags(details: Map<String, String>): List<String> {
    val raw = details["tags"].orEmpty()
    if (raw.isEmpty()) return emptyList()
    return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
}

/** Parse the linked-entity tuple from a document's `details` map. */
internal fun parseLinkedEntity(details: Map<String, String>): DocumentLinkedEntity? {
    val kindRaw = details["linked_entity_kind"].orEmpty()
    val title = details["linked_entity_title"].orEmpty()
    if (kindRaw.isEmpty() || title.isEmpty()) return null
    val kind =
        DocumentLinkedEntity.Kind.entries.firstOrNull { it.id == kindRaw } ?: return null
    return DocumentLinkedEntity(kind = kind, title = title)
}

/** Parsed linked-entity payload — kind + title. */
data class DocumentLinkedEntity(
    val kind: Kind,
    val title: String,
) {
    enum class Kind(val id: String, val label: String, val icon: PantopusIcon) {
        Bill("bill", "Bill", PantopusIcon.ReceiptText),
        Maintenance("maintenance", "Maintenance", PantopusIcon.Hammer),
        Pet("pet", "Pet", PantopusIcon.PawPrint),
    }
}
