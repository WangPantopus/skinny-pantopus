@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "MatchingDeclarationName",
    "TooManyFunctions",
    "LongParameterList",
)

package app.pantopus.android.ui.screens.settings.legal

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.BackToTopFab
import app.pantopus.android.ui.components.DocMetaStrip
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.LegalSection
import app.pantopus.android.ui.components.LegalTOCCard
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailShell
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBarAction
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListCallbacks
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListGroup
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListRow
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListScreen
import app.pantopus.android.ui.screens.shared.grouped_list.GroupedListUiState
import app.pantopus.android.ui.screens.shared.grouped_list.RowControl
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * P8 / T6.2c — Settings → Legal index + per-document viewer.
 *
 * The TOC is a [GroupedListScreen]; tapping a row pushes the viewer via
 * [onSelect]. Privacy + Terms render via the A19 long-form scaffold
 * ([LegalLongFormScreen]); the remaining bundled docs keep the legacy flat
 * renderer until they get their own design pass.
 */
enum class LegalDocument {
    Terms,
    Privacy,
    AcceptableUse,
    Cookies,
    OpenSource,
    ;

    val title: String
        get() =
            when (this) {
                Terms -> "Terms of service"
                Privacy -> "Privacy policy"
                AcceptableUse -> "Acceptable use"
                Cookies -> "Cookies"
                OpenSource -> "Open-source licenses"
            }

    val subtitle: String
        get() =
            when (this) {
                Terms -> "What you agree to by using Pantopus"
                Privacy -> "What we collect and why"
                AcceptableUse -> "What's not allowed on the platform"
                Cookies -> "Browser storage and tracking"
                OpenSource -> "Libraries Pantopus is built on"
            }

    val rowId: String get() = name.lowercase()
}

@HiltViewModel
class LegalIndexViewModel
    @Inject
    constructor() : ViewModel() {
        val title: String = "Legal"
        val footerCaption: String =
            "All documents are kept in plain language. Reach out via Help if anything's unclear."

        private val _state = MutableStateFlow<GroupedListUiState>(GroupedListUiState.Loading)
        val state: StateFlow<GroupedListUiState> = _state.asStateFlow()

        private val _navigation = MutableStateFlow<LegalDocument?>(null)
        val navigation: StateFlow<LegalDocument?> = _navigation.asStateFlow()

        fun load() {
            _state.value =
                GroupedListUiState.Loaded(
                    groups =
                        listOf(
                            GroupedListGroup(
                                id = "policies",
                                overline = "Policies",
                                rows =
                                    listOf(
                                        row(LegalDocument.Terms),
                                        row(LegalDocument.Privacy),
                                        row(LegalDocument.AcceptableUse),
                                        row(LegalDocument.Cookies),
                                    ),
                            ),
                            GroupedListGroup(
                                id = "credits",
                                overline = "Credits",
                                rows = listOf(row(LegalDocument.OpenSource)),
                            ),
                        ),
                )
        }

        fun onRow(rowId: String) {
            _navigation.value = LegalDocument.entries.firstOrNull { it.rowId == rowId }
        }

        fun consumeNavigation() {
            _navigation.value = null
        }

        private fun row(doc: LegalDocument): GroupedListRow =
            GroupedListRow(
                id = doc.rowId,
                label = doc.title,
                subtext = doc.subtitle,
                control = RowControl.Chevron,
            )
    }

@Composable
fun LegalIndexScreen(
    onBack: () -> Unit = {},
    onSelectDocument: (LegalDocument) -> Unit = {},
    viewModel: LegalIndexViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val navigation by viewModel.navigation.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(navigation) {
        navigation?.let {
            viewModel.consumeNavigation()
            onSelectDocument(it)
        }
    }

    GroupedListScreen(
        title = viewModel.title,
        state = state,
        footerCaption = viewModel.footerCaption,
        callbacks =
            GroupedListCallbacks(
                onBack = onBack,
                onTapRow = viewModel::onRow,
                onRetry = viewModel::load,
            ),
    )
}

/**
 * Fallback shown when a Legal route's `:doc` argument doesn't resolve to a
 * known [LegalDocument] — e.g. a stale deep link. Replaces the old
 * NotYetAvailable placeholder with a proper empty index state per the A14.3
 * Settings/Legal design: a "Select a document" prompt that routes the member
 * back to the Legal table of contents.
 */
@Composable
fun LegalEmptyState(onBack: () -> Unit = {}) {
    EmptyState(
        modifier = Modifier.testTag("legalIndex.empty"),
        icon = PantopusIcon.FileText,
        headline = "Select a document",
        subcopy = "Pick a policy from the Legal list to read it here.",
        ctaTitle = "Browse legal documents",
        onCta = onBack,
    )
}

// ─── Per-document viewer (doc routing) ────────────────────────────────────

@Composable
fun LegalContentScreen(
    document: LegalDocument,
    onBack: () -> Unit = {},
) {
    when (document) {
        LegalDocument.Privacy, LegalDocument.Terms ->
            LegalLongFormScreen(
                model = LegalDocs.model(document),
                title = document.title,
                screenTestTag = "legalContent.${document.rowId}",
                onBack = onBack,
            )
        else -> LegacyLegalContentScreen(document = document, onBack = onBack)
    }
}

// ─── A19 long-form scaffold ───────────────────────────────────────────────

/**
 * Stateful host for the A19 legal scaffold. Owns the TOC open/closed state and
 * the lazy-list scroll position, derives the back-to-top fab visibility from
 * it (mirroring the design's `scrollTop > 220` threshold), and wires the TOC
 * row taps + fab to animated `animateScrollToItem` jumps.
 */
@Composable
fun LegalLongFormScreen(
    model: LegalDocModel,
    title: String,
    screenTestTag: String,
    onBack: () -> Unit,
) {
    var tocOpen by rememberSaveable(screenTestTag) { mutableStateOf(true) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    val thresholdPx = with(LocalDensity.current) { 220.dp.roundToPx() }
    val showBackToTop by remember(thresholdPx) {
        derivedStateOf {
            listState.firstVisibleItemIndex > 0 ||
                listState.firstVisibleItemScrollOffset > thresholdPx
        }
    }

    LegalScaffold(
        model = model,
        title = title,
        screenTestTag = screenTestTag,
        tocOpen = tocOpen,
        showBackToTop = showBackToTop,
        listState = listState,
        onBack = onBack,
        onToggleTOC = { tocOpen = !tocOpen },
        // Item 0 is the TOC card, so section n (1-based) is at item index n.
        onJump = { index -> scope.launch { listState.animateScrollToItem(index + 1) } },
        onBackToTop = { scope.launch { listState.animateScrollToItem(0) } },
    )
}

/**
 * Stateless A19 legal scaffold — top bar + meta strip + scrollable TOC /
 * sectioned body + back-to-top fab. Scroll state is injected so the live host
 * can drive it and snapshot tests can pin a specific frame.
 */
@Composable
fun LegalScaffold(
    model: LegalDocModel,
    title: String,
    screenTestTag: String,
    tocOpen: Boolean,
    showBackToTop: Boolean,
    listState: LazyListState,
    onBack: () -> Unit,
    onToggleTOC: () -> Unit,
    onJump: (Int) -> Unit,
    onBackToTop: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appSurface)
                .testTag(screenTestTag),
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            ContentDetailTopBar(
                title = title,
                onBack = onBack,
                action =
                    ContentDetailTopBarAction(
                        icon = PantopusIcon.Share,
                        contentDescription = "Share",
                        onClick = {},
                    ),
            )
            DocMetaStrip(lastUpdated = model.lastUpdated, version = model.version)
            LazyColumn(
                state = listState,
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appSurface),
                contentPadding =
                    PaddingValues(
                        start = Spacing.s5,
                        end = Spacing.s5,
                        top = 14.dp,
                        bottom = Spacing.s6,
                    ),
            ) {
                item(key = "toc") {
                    LegalTOCCard(
                        items = model.sectionTitles,
                        isOpen = tocOpen,
                        onToggle = onToggleTOC,
                        onJump = onJump,
                    )
                }
                itemsIndexed(model.sections, key = { index, _ -> "sec-${index + 1}" }) { index, section ->
                    LegalSectionContent(number = index + 1, section = section)
                }
                item(key = "footer") {
                    LegalContactFooter(
                        email = model.contactEmail,
                        label = model.contactLabel,
                        modifier = Modifier.padding(top = Spacing.s4, bottom = Spacing.s2),
                    )
                }
            }
        }
        BackToTopFab(
            isVisible = showBackToTop,
            onTap = onBackToTop,
            modifier =
                Modifier
                    .align(Alignment.BottomEnd)
                    .padding(Spacing.s4),
        )
    }
}

@Composable
private fun LegalSectionContent(
    number: Int,
    section: LegalDocSection,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        LegalSection(number = number, title = section.title)
        section.blocks.forEach { block -> LegalBlockView(block = block) }
    }
}

@Composable
private fun LegalBlockView(block: LegalBlock) {
    when (block) {
        is LegalBlock.Paragraph ->
            Text(
                text = block.text,
                style = PantopusTextStyle.small,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = Spacing.s3),
            )
        is LegalBlock.Rich ->
            Text(
                text =
                    buildAnnotatedString {
                        block.runs.forEach { run ->
                            if (run.bold) {
                                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(run.text) }
                            } else {
                                append(run.text)
                            }
                        }
                    },
                style = PantopusTextStyle.small,
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = Spacing.s3),
            )
        is LegalBlock.Subheading ->
            Text(
                text = block.text,
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.appText,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Spacing.s2, bottom = Spacing.s1),
            )
        is LegalBlock.Bullets ->
            Column(
                modifier = Modifier.padding(bottom = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                block.items.forEach { item -> LegalBulletRow(text = item) }
            }
    }
}

@Composable
private fun LegalBulletRow(text: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .padding(top = 7.dp)
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.primary600),
        )
        Text(
            text = text,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun LegalContactFooter(
    email: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    val uriHandler = LocalUriHandler.current
    val shape = RoundedCornerShape(Radii.lg)
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary100, shape)
                .clickable { uriHandler.openUri("mailto:$email") }
                .padding(horizontal = Spacing.s4, vertical = 14.dp)
                .semantics { contentDescription = "$label $email" }
                .testTag("legalContactFooter"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.primary100, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Mail,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = label,
                fontSize = 12.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = email,
                fontSize = 11.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary700,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ArrowUpRight,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2.2f,
            tint = PantopusColors.primary600,
        )
    }
}

// ─── Structured content model ─────────────────────────────────────────────

/**
 * A single legal document, fully data-driven so Privacy + Terms (and iOS) stay
 * byte-identical. [sectionTitles] doubles as the [LegalTOCCard] items and the
 * [LegalSection] headings.
 */
data class LegalDocModel(
    val lastUpdated: String,
    val version: String,
    val sections: List<LegalDocSection>,
    val contactEmail: String,
    val contactLabel: String,
) {
    val sectionTitles: List<String> get() = sections.map { it.title }
}

data class LegalDocSection(
    val title: String,
    val blocks: List<LegalBlock>,
)

sealed interface LegalBlock {
    data class Paragraph(val text: String) : LegalBlock

    data class Rich(val runs: List<LegalRun>) : LegalBlock

    data class Subheading(val text: String) : LegalBlock

    data class Bullets(val items: List<String>) : LegalBlock
}

/** One inline run of paragraph text. [bold] marks a defined term (`<DT>`). */
data class LegalRun(val text: String, val bold: Boolean)

private fun t(text: String) = LegalRun(text, bold = false)

private fun b(text: String) = LegalRun(text, bold = true)

private fun para(text: String) = LegalBlock.Paragraph(text)

private fun rich(vararg runs: LegalRun) = LegalBlock.Rich(runs.toList())

private fun sub(text: String) = LegalBlock.Subheading(text)

private fun bullets(vararg items: String) = LegalBlock.Bullets(items.toList())

// ─── Verbatim copy (mirrors docs/designs/A19/legal-frames.jsx) ────────────

internal object LegalDocs {
    fun model(document: LegalDocument): LegalDocModel =
        when (document) {
            LegalDocument.Terms -> terms
            else -> privacy
        }

    // Privacy (10 sections)
    val privacy =
        LegalDocModel(
            lastUpdated = "October 1, 2025",
            version = "3.2",
            sections =
                listOf(
                    LegalDocSection(
                        title = "Overview",
                        blocks =
                            listOf(
                                rich(
                                    t("Pantopus is a neighborhood platform that lets you keep separate "),
                                    b("Personal"),
                                    t(", "),
                                    b("Home"),
                                    t(", and "),
                                    b("Business"),
                                    t(
                                        " identities. This policy explains what data we collect for each " +
                                            "pillar, why we collect it, and the controls you have over it.",
                                    ),
                                ),
                                para(
                                    "We wrote this in plain language. Defined terms appear in the Glossary " +
                                        "at the end of the document.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Information we collect",
                        blocks =
                            listOf(
                                para(
                                    "We collect three categories of information: information you give us " +
                                        "directly, information generated by your use of Pantopus, and " +
                                        "information from third parties (such as identity verification " +
                                        "partners).",
                                ),
                                sub("Information you provide"),
                                para(
                                    "This includes account details, profile fields, content you post, and " +
                                        "documents you upload to verify a claim:",
                                ),
                                bullets(
                                    "Your name, email address, and phone number",
                                    "Profile photos and avatars for each identity pillar",
                                    "Address and deed documents when claiming a Home identity",
                                    "Business filings, EIN, and storefront photos for a Business identity",
                                    "Messages you send through member chat and Ceremonial Mail",
                                ),
                                sub("Information generated by your use"),
                                para(
                                    "We log device type, app version, approximate location (derived from " +
                                        "IP), and which features you interact with. This helps us debug issues " +
                                        "and tell you how busy your neighborhood is, without ever attaching " +
                                        "precise GPS to your account.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "How we use it",
                        blocks =
                            listOf(
                                rich(
                                    t(
                                        "We use the information above to operate Pantopus — for example, to " +
                                            "deliver chat messages, route a package notification to the right ",
                                    ),
                                    b("Home"),
                                    t(
                                        ", or surface a relevant local gig. We also use it for safety, fraud " +
                                            "prevention, and to improve the product.",
                                    ),
                                ),
                                bullets(
                                    "To operate and maintain core features (chat, mail, claims)",
                                    "To verify identity claims and prevent impersonation",
                                    "To send transactional notifications you can control in Settings",
                                    "To improve and debug the product through aggregated analytics",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Identity pillars & privacy",
                        blocks =
                            listOf(
                                rich(
                                    t("The three pillars are walled off from each other by default. Your "),
                                    b("Business"),
                                    t(" identity does not show your home address; your "),
                                    b("Home"),
                                    t(
                                        " identity does not reveal your personal phone number to neighbors " +
                                            "unless you explicitly opt in.",
                                    ),
                                ),
                                rich(
                                    t("When someone sends you a "),
                                    b("Token"),
                                    t(
                                        " (an invite to a Home, Business, or guest pass), the recipient sees " +
                                            "only the fields you've published on that pillar — never the other " +
                                            "two.",
                                    ),
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Sharing & disclosure",
                        blocks =
                            listOf(
                                para(
                                    "We do not sell your personal information. We share data only with " +
                                        "service providers under contract (hosting, payments, identity " +
                                        "verification), with parties you direct us to share with, and when " +
                                        "required by law.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Your rights & controls",
                        blocks =
                            listOf(
                                para("You can, at any time:"),
                                bullets(
                                    "Download a copy of your data from Settings → Privacy → Export",
                                    "Delete a single identity pillar or your entire account",
                                    "Revoke any Token you previously accepted",
                                    "Object to a specific use of your data by contacting privacy@pantopus.com",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Data retention",
                        blocks =
                            listOf(
                                para(
                                    "We retain your data for as long as your account is active. When you " +
                                        "delete an identity pillar, associated content is removed within 30 " +
                                        "days. Some records (financial, safety) may be retained longer where " +
                                        "legally required.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Children & teens",
                        blocks =
                            listOf(
                                para(
                                    "Pantopus is intended for users 13 and older. We do not knowingly " +
                                        "collect personal information from children under 13. If you believe a " +
                                        "child has provided us with personal information, please contact us so " +
                                        "we can remove it.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "International transfers",
                        blocks =
                            listOf(
                                para(
                                    "We are based in the United States. If you use Pantopus from outside " +
                                        "the U.S., your information will be transferred to, stored, and " +
                                        "processed in the U.S. under appropriate safeguards.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Changes to this policy",
                        blocks =
                            listOf(
                                para(
                                    "We may update this policy from time to time. When we do, we'll change " +
                                        "the \"Last updated\" date at the top and — for material changes — send " +
                                        "an in-app notice at least 14 days before the changes take effect.",
                                ),
                            ),
                    ),
                ),
            contactEmail = "privacy@pantopus.com",
            contactLabel = "Questions about this policy?",
        )

    // Terms (12 sections)
    val terms =
        LegalDocModel(
            lastUpdated = "February 14, 2026",
            version = "5.0",
            sections =
                listOf(
                    LegalDocSection(
                        title = "Acceptance of these terms",
                        blocks =
                            listOf(
                                para(
                                    "These Terms of Service (\"Terms\") are a binding agreement between you " +
                                        "and Pantopus, Inc. By creating an account, claiming an identity, or " +
                                        "otherwise using Pantopus, you agree to these Terms and to our Privacy " +
                                        "Policy.",
                                ),
                                para(
                                    "If you are using Pantopus on behalf of a business, you represent that " +
                                        "you have authority to bind that business to these Terms.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Eligibility & accounts",
                        blocks =
                            listOf(
                                para(
                                    "You must be at least 13 years old to use Pantopus. You are responsible " +
                                        "for the activity on your account and for keeping your credentials " +
                                        "secure.",
                                ),
                                bullets(
                                    "Provide accurate information when you register",
                                    "Keep your password and device secure",
                                    "Notify us promptly of any unauthorized use",
                                    "One person may hold only one Personal identity",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Identity pillars",
                        blocks =
                            listOf(
                                rich(
                                    t("Pantopus lets you operate up to three identity pillars — "),
                                    b("Personal"),
                                    t(", "),
                                    b("Home"),
                                    t(", and "),
                                    b("Business"),
                                    t(
                                        ". Claiming a Home or Business pillar may require verification " +
                                            "documents. You agree not to claim an identity you are not entitled " +
                                            "to represent.",
                                    ),
                                ),
                                para(
                                    "We may revoke a pillar if a claim is found to be false, disputed by a " +
                                        "rightful owner, or used to impersonate another party.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Acceptable use",
                        blocks =
                            listOf(
                                para("You agree not to use Pantopus to:"),
                                bullets(
                                    "Harass, threaten, or impersonate other members",
                                    "Post unlawful, fraudulent, or misleading content",
                                    "Scrape, reverse-engineer, or overload the service",
                                    "Circumvent the walls between identity pillars",
                                    "Resell access or Tokens without our written consent",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Content & licenses",
                        blocks =
                            listOf(
                                para(
                                    "You retain ownership of the content you post. By posting, you grant " +
                                        "Pantopus a non-exclusive, worldwide license to host, display, and " +
                                        "distribute that content as needed to operate the service.",
                                ),
                                sub("Feedback"),
                                para(
                                    "If you send us ideas or suggestions, you grant us a perpetual, " +
                                        "royalty-free license to use them without obligation to you.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Tokens, invites & access",
                        blocks =
                            listOf(
                                rich(
                                    t("A "),
                                    b("Token"),
                                    t(
                                        " grants limited, revocable access to a Home, Business, or guest " +
                                            "context. Tokens are personal to the recipient and may not be " +
                                            "transferred. Either party may revoke a Token at any time from " +
                                            "Settings.",
                                    ),
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Payments & gigs",
                        blocks =
                            listOf(
                                para(
                                    "Some features — local gigs, marketplace listings, and premium pillars " +
                                        "— involve payments processed by our third-party providers. You agree " +
                                        "to their terms in addition to ours. Fees are disclosed before you " +
                                        "confirm a transaction.",
                                ),
                                bullets(
                                    "Gig payments are released on completion or per the listing terms",
                                    "Refunds follow the policy shown at checkout",
                                    "You are responsible for any taxes on income you earn",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Termination",
                        blocks =
                            listOf(
                                para(
                                    "You may delete a pillar or your entire account at any time. We may " +
                                        "suspend or terminate access if you violate these Terms, create risk " +
                                        "for other members, or as required by law. Sections that by their " +
                                        "nature should survive termination will survive.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Disclaimers",
                        blocks =
                            listOf(
                                para(
                                    "Pantopus is provided \"as is\" and \"as available.\" We do not warrant " +
                                        "that the service will be uninterrupted, error-free, or that any member " +
                                        "is who they claim to be beyond the verification we describe.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Limitation of liability",
                        blocks =
                            listOf(
                                para(
                                    "To the maximum extent permitted by law, Pantopus will not be liable " +
                                        "for indirect, incidental, or consequential damages, or for any amount " +
                                        "exceeding the greater of the fees you paid us in the past 12 months or " +
                                        "one hundred U.S. dollars.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Governing law & disputes",
                        blocks =
                            listOf(
                                para(
                                    "These Terms are governed by the laws of the State of Delaware, without " +
                                        "regard to its conflict-of-laws rules. Disputes will be resolved in the " +
                                        "state or federal courts located in Delaware, unless applicable law " +
                                        "requires otherwise.",
                                ),
                            ),
                    ),
                    LegalDocSection(
                        title = "Changes to these terms",
                        blocks =
                            listOf(
                                para(
                                    "We may update these Terms from time to time. For material changes " +
                                        "we'll update the \"Last updated\" date and give in-app notice at least " +
                                        "14 days before they take effect. Continued use after that date means " +
                                        "you accept the revised Terms.",
                                ),
                            ),
                    ),
                ),
            contactEmail = "legal@pantopus.com",
            contactLabel = "Questions about these terms?",
        )
}

// ─── Legacy flat renderer (Acceptable use / Cookies / Open-source) ────────

@Composable
private fun LegacyLegalContentScreen(
    document: LegalDocument,
    onBack: () -> Unit = {},
) {
    ContentDetailShell(
        title = document.title,
        onBack = onBack,
        header = {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = document.title,
                    style = PantopusTextStyle.h2,
                    color = PantopusColors.appText,
                )
                Text(
                    text = "Last updated: ${LegalContent.LAST_UPDATED}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
        },
        body = {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4, vertical = Spacing.s4)
                        .testTag("legalContent.${document.rowId}"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                LegalContent.blocks(document).forEach { block ->
                    when (block) {
                        is LegalContent.Block.Heading ->
                            Text(
                                text = block.text,
                                style = PantopusTextStyle.h3,
                                color = PantopusColors.appText,
                            )
                        is LegalContent.Block.Paragraph ->
                            Text(
                                text = block.text,
                                style = PantopusTextStyle.body,
                                color = PantopusColors.appTextSecondary,
                            )
                        is LegalContent.Block.Bullet ->
                            Row(verticalAlignment = Alignment.Top) {
                                Text(
                                    text = "•  ",
                                    style = PantopusTextStyle.body,
                                    color = PantopusColors.appTextSecondary,
                                )
                                Text(
                                    text = block.text,
                                    style = PantopusTextStyle.body,
                                    color = PantopusColors.appTextSecondary,
                                )
                            }
                    }
                }
            }
        },
    )
}

internal object LegalContent {
    const val LAST_UPDATED = "2026-05-01"

    sealed interface Block {
        data class Heading(val text: String) : Block

        data class Paragraph(val text: String) : Block

        data class Bullet(val text: String) : Block
    }

    fun blocks(doc: LegalDocument): List<Block> =
        when (doc) {
            LegalDocument.AcceptableUse -> acceptableUse
            LegalDocument.Cookies -> cookies
            LegalDocument.OpenSource -> openSource
            else -> emptyList()
        }

    private val acceptableUse =
        listOf(
            Block.Paragraph("Pantopus is a neighborhood platform. Help keep it kind, useful, and honest."),
            Block.Heading("Not allowed"),
            Block.Bullet("Harassment, threats, or hate speech."),
            Block.Bullet("Spam, including unsolicited promotion of unrelated businesses."),
            Block.Bullet("Impersonating a neighbor or a business."),
            Block.Bullet("Posting illegal content or coordinating illegal activity."),
            Block.Heading("Enforcement"),
            Block.Paragraph(
                "Violations may lead to content removal, account suspension, or permanent removal. " +
                    "Repeated abuse can also be reported to the relevant authorities.",
            ),
        )

    private val cookies =
        listOf(
            Block.Paragraph(
                "On the mobile app we use device storage for: session tokens, push-notification routing, " +
                    "and a small cache of recently loaded content. We don't use third-party advertising cookies.",
            ),
            Block.Heading("Web"),
            Block.Paragraph(
                "On the web, we use cookies to keep you signed in and to remember your light/dark mode preference. " +
                    "Analytics is opt-in via Settings → Privacy.",
            ),
        )

    private val openSource =
        listOf(
            Block.Paragraph(
                "Pantopus is built on shoulders of giants. We owe thanks to the maintainers of every library below. " +
                    "Full license texts ship with each app build.",
            ),
            Block.Heading("iOS"),
            Block.Bullet("SwiftUI — Apple"),
            Block.Bullet("Lucide icons — Lucide contributors"),
            Block.Heading("Android"),
            Block.Bullet("Jetpack Compose — Google"),
            Block.Bullet("Hilt — Google"),
            Block.Bullet("Moshi — Square"),
            Block.Heading("Backend"),
            Block.Bullet("Express — OpenJS Foundation"),
            Block.Bullet("Supabase — Supabase Inc."),
            Block.Bullet("Stripe SDK — Stripe Inc."),
        )
}
