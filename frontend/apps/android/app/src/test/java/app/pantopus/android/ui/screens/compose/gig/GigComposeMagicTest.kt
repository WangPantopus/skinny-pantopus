@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.compose.gig

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.ai.AiTranscriptionRepository
import app.pantopus.android.data.api.models.gigs.CareDetailsDto
import app.pantopus.android.data.api.models.gigs.GigTemplateDto
import app.pantopus.android.data.api.models.gigs.GigTemplateSeedDto
import app.pantopus.android.data.api.models.gigs.GigTemplatesResponse
import app.pantopus.android.data.api.models.gigs.MagicDraftBudgetRange
import app.pantopus.android.data.api.models.gigs.MagicDraftDto
import app.pantopus.android.data.api.models.gigs.MagicDraftResponse
import app.pantopus.android.data.api.models.gigs.MagicTaskItemDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.network.NetworkMonitor
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * A12.8 — Magic Task describe-step behaviour, mirroring iOS
 * `GigComposeMagicTests`: deterministic detection, compose-mode toggling,
 * mode-aware gates + CTAs, live module prompts, entity highlights,
 * engagement inference, templates, and the magic-draft module prefill.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigComposeMagicTest {
    private val repo: GigsRepository = mockk(relaxed = true)
    private val filesRepo: FilesRepository = mockk(relaxed = true)
    private val transcriptionRepo: AiTranscriptionRepository = mockk(relaxed = true)
    private val networkMonitor: NetworkMonitor =
        mockk<NetworkMonitor>(relaxed = true).also {
            every { it.isOnline } returns MutableStateFlow(true)
        }

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm() =
        GigComposeViewModel(
            repo,
            SavedStateHandle(),
            networkMonitor,
            filesRepo,
            transcriptionRepo,
            mockk(relaxed = true),
            mockk(relaxed = true),
        )

    @Test
    fun defaultComposeModeIsMagic() {
        assertEquals(ComposeMode.Magic, makeVm().state.value.form.composeMode)
    }

    @Test
    fun detectArchetypeKeywordMap() {
        assertEquals(GigComposeCategory.Moving, GigComposeViewModel.detectArchetype("Help me move boxes Saturday"))
        assertEquals(GigComposeCategory.Handyman, GigComposeViewModel.detectArchetype("Assemble an IKEA desk"))
        assertEquals(GigComposeCategory.Cleaning, GigComposeViewModel.detectArchetype("Deep clean my apartment"))
        assertEquals(GigComposeCategory.PetCare, GigComposeViewModel.detectArchetype("Walk my dog twice a day"))
        assertEquals(GigComposeCategory.Tutoring, GigComposeViewModel.detectArchetype("Need a math tutor"))
        assertEquals(GigComposeCategory.Tech, GigComposeViewModel.detectArchetype("My wifi router needs setup"))
        assertNull(GigComposeViewModel.detectArchetype("hi"))
        assertNull(GigComposeViewModel.detectArchetype("something totally unrelated zzz"))
    }

    @Test
    fun applyDetectionMirrorsIntoCategoryAndArchetype() {
        val vm = makeVm()
        vm.setDescribeText("Need someone to assemble an IKEA desk this Saturday")
        // Apply synchronously rather than waiting on the debounce.
        vm.applyDetection(vm.state.value.form.describeText)
        assertEquals(GigComposeCategory.Handyman, vm.state.value.form.detectedArchetype)
        assertEquals(GigComposeCategory.Handyman, vm.state.value.form.category)
        assertEquals("home_service", vm.state.value.form.taskArchetype)
    }

    @Test
    fun applyDetectionIgnoresStaleText() {
        val vm = makeVm()
        vm.setDescribeText("clean my place")
        vm.applyDetection("an older snapshot")
        assertNull(vm.state.value.form.detectedArchetype)
    }

    @Test
    fun describeTextCappedAtMax() {
        val vm = makeVm()
        vm.setDescribeText("a".repeat(GigComposeLimits.DESCRIBE_MAX + 100))
        assertEquals(GigComposeLimits.DESCRIBE_MAX, vm.state.value.form.describeText.length)
    }

    @Test
    fun magicPrimaryGatedOnDetection() {
        val vm = makeVm()
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.setDescribeText("Assemble an IKEA desk")
        vm.applyDetection(vm.state.value.form.describeText)
        assertTrue(vm.chrome.primaryCtaEnabled)
        assertEquals("Review & post →", vm.chrome.primaryCtaLabel)
    }

    @Test
    fun manualPrimaryGatedOnCategory() {
        val vm = makeVm()
        vm.setComposeMode(ComposeMode.Manual)
        assertFalse(vm.chrome.primaryCtaEnabled)
        vm.selectCategory(GigComposeCategory.Cleaning)
        assertTrue(vm.chrome.primaryCtaEnabled)
    }

    @Test
    fun manualPickerUsesEightConcreteArchetypes() {
        assertEquals(8, gigComposeManualPickerCategories.size)
        assertFalse(gigComposeManualPickerCategories.contains(GigComposeCategory.Other))
    }

    @Test
    fun magicStepExposesPickCategorySecondary() {
        assertEquals("gigCompose.cta.pickCategory", makeVm().chrome.secondaryCta?.testTag)
    }

    @Test
    fun onSecondarySwitchesToManual() {
        val vm = makeVm()
        vm.onSecondary()
        assertEquals(ComposeMode.Manual, vm.state.value.form.composeMode)
    }

    @Test
    fun manualStepHasNoSecondaryCta() {
        val vm = makeVm()
        vm.setComposeMode(ComposeMode.Manual)
        assertNull(vm.chrome.secondaryCta)
    }

    @Test
    fun engagementTilesPrefillSchedule() {
        val vm = makeVm()
        assertEquals(GigComposeEngagementMode.OneTime, vm.state.value.form.engagementMode)

        vm.selectEngagementMode(GigComposeEngagementMode.Recurring)
        assertEquals(GigComposeEngagementMode.Recurring, vm.state.value.form.engagementMode)
        assertEquals(GigComposeScheduleType.Recurring, vm.state.value.form.scheduleType)

        vm.selectEngagementMode(GigComposeEngagementMode.OpenEnded)
        assertEquals(GigComposeEngagementMode.OpenEnded, vm.state.value.form.engagementMode)
        assertEquals(GigComposeScheduleType.Flexible, vm.state.value.form.scheduleType)

        vm.selectEngagementMode(GigComposeEngagementMode.OneTime)
        assertEquals(GigComposeScheduleType.OneTime, vm.state.value.form.scheduleType)
    }

    // MARK: - A12.8 Live module prompts

    @Test
    fun modulePromptsAreEmptyWithoutDetection() {
        assertTrue(gigMagicModulePrompts(GigComposeFormState()).isEmpty())
    }

    @Test
    fun modulePromptsReflectLiveFormState() {
        val empty = gigMagicModulePrompts(GigComposeFormState(detectedArchetype = GigComposeCategory.Handyman))
        assertEquals(5, empty.size)
        assertEquals(listOf("when", "where", "effort", "photos", "budget"), empty.map { it.id })
        assertEquals(0, empty.count { it.isFilled })

        val filled = gigMagicModulePrompts(GigComposeMagicSampleData.parsedForm)
        assertEquals(4, filled.count { it.isFilled })
        assertEquals("Photos", filled.first { !it.isFilled }.label)
        assertEquals("$80–$120", filled.first { it.id == "budget" }.value)
        assertEquals("~2 hours", filled.first { it.id == "effort" }.value)
    }

    @Test
    fun modulePromptStepRouting() {
        assertEquals(GigComposeStep.FillGaps, stepForModulePrompt("when"))
        assertEquals(GigComposeStep.FillGaps, stepForModulePrompt("where"))
        assertEquals(GigComposeStep.FillGaps, stepForModulePrompt("photos"))
        assertEquals(GigComposeStep.BudgetMode, stepForModulePrompt("effort"))
        assertEquals(GigComposeStep.BudgetMode, stepForModulePrompt("budget"))
    }

    // MARK: - A12.8 Entity highlights

    @Test
    fun highlightRangesFindMoneyDayAndKeywords() {
        val text = "Assemble an IKEA desk Saturday morning for $80"
        val ranges = magicHighlightRanges(text, GigComposeCategory.Handyman)

        fun covered(word: String): Boolean {
            val start = text.indexOf(word)
            return ranges.any { it.first <= start && it.last >= start + word.length - 1 }
        }
        assertTrue("category keyword", covered("Assemble"))
        assertTrue("category keyword", covered("IKEA"))
        assertTrue("day word", covered("Saturday"))
        assertTrue("time word", covered("morning"))
        assertTrue("money", covered("\$80"))
        assertFalse("plain word stays unhighlighted", covered("for"))
    }

    @Test
    fun highlightRangesMatchHoursAndMerge() {
        val ranges = magicHighlightRanges("about 2 hours of work", null)
        assertEquals(1, ranges.size)
        assertEquals("2 hours", "about 2 hours of work".substring(ranges[0].first, ranges[0].last + 1))
        assertTrue(magicHighlightRanges("", GigComposeCategory.Handyman).isEmpty())
        // Overlapping keyword + day ranges merge into one.
        val merged = mergeRanges(listOf(0..4, 3..8, 10..12))
        assertEquals(listOf(0..8, 10..12), merged)
    }

    // MARK: - A12.8 Engagement inference

    @Test
    fun inferEngagementModeMatchesBackendRules() {
        assertEquals("quotes", GigComposeViewModel.inferEngagementMode("pro_service_quote", "flexible", false))
        assertEquals("instant_accept", GigComposeViewModel.inferEngagementMode("quick_help", "asap", false))
        assertEquals("instant_accept", GigComposeViewModel.inferEngagementMode("home_service", "flexible", true))
        assertEquals("curated_offers", GigComposeViewModel.inferEngagementMode("home_service", "flexible", false))
        assertEquals("curated_offers", GigComposeViewModel.inferEngagementMode(null, null, false))
    }

    @Test
    fun engagementOverrideWinsOverInference() {
        val vm = makeVm()
        vm.selectCategory(GigComposeCategory.Handyman)
        assertEquals("curated_offers", vm.resolvedEngagementMode())
        vm.selectEngagementOverride(GigEngagementMode.Quotes)
        assertEquals("quotes", vm.resolvedEngagementMode())
    }

    // MARK: - A12.8 Templates

    @Test
    fun templatesLoadOnceAndProject() =
        runTest {
            coEvery { repo.templatesLibrary() } returns
                NetworkResult.Success(
                    GigTemplatesResponse(
                        templates =
                            listOf(
                                GigTemplateDto(
                                    id = "mount_tv",
                                    label = "Mount TV",
                                    icon = "📺",
                                    template = GigTemplateSeedDto(title = "Mount TV on wall"),
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.loadTemplatesIfNeeded()
            vm.loadTemplatesIfNeeded()
            coVerify(exactly = 1) { repo.templatesLibrary() }
            val template = vm.state.value.templates.single()
            assertEquals("mount_tv", template.id)
            assertEquals("Mount TV on wall", template.seedText)
            vm.applyTemplate(template)
            assertEquals("Mount TV on wall", vm.state.value.form.describeText)
        }

    @Test
    fun templatesFailureIsSilent() =
        runTest {
            coEvery { repo.templatesLibrary() } returns NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.loadTemplatesIfNeeded()
            assertTrue(vm.state.value.templates.isEmpty())
            assertNull(vm.state.value.errorMessage)
        }

    // MARK: - P0.1 Real magic draft

    private val describeText = "Need someone to assemble an IKEA desk this Saturday morning"

    private fun fullDraftResponse(clarifyingQuestion: String? = null) =
        MagicDraftResponse(
            draft =
                MagicDraftDto(
                    title = "Assemble an IKEA desk",
                    description = "Assemble a desk with drawers — 3 boxes, about 2 hours of work.",
                    category = "handyman",
                    taskArchetype = "home_service",
                    payType = "fixed",
                    estimatedHours = 2.0,
                    budgetRange = MagicDraftBudgetRange(min = 80.0, max = 120.0),
                    scheduleType = "scheduled",
                    tags = listOf("#Furniture", "ikea"),
                    isUrgent = true,
                ),
            confidence = 0.92,
            clarifyingQuestion = clarifyingQuestion,
            source = "llm",
            elapsed = 412,
        )

    @Test
    fun magicDraftSuccessPrefillsForm() =
        runTest {
            coEvery { repo.magicDraft(any()) } returns NetworkResult.Success(fullDraftResponse("Which floor is the desk on?"))
            val vm = makeVm()
            vm.setDescribeText(describeText)
            vm.parseDescribe(describeText)
            val state = vm.state.value
            assertEquals(GigComposeCategory.Handyman, state.form.detectedArchetype)
            assertEquals(GigComposeCategory.Handyman, state.form.category)
            assertEquals("home_service", state.form.taskArchetype)
            assertEquals("Assemble an IKEA desk", state.form.title)
            assertEquals("Assemble a desk with drawers — 3 boxes, about 2 hours of work.", state.form.description)
            assertEquals(GigComposeBudgetType.Fixed, state.form.budgetType)
            assertEquals("80", state.form.budgetMin)
            assertEquals("120", state.form.budgetMax)
            assertEquals("2", state.form.estimatedHours)
            assertEquals(GigComposeScheduleType.OneTime, state.form.scheduleType)
            assertEquals(listOf("furniture", "ikea"), state.form.tags)
            assertTrue(state.form.isUrgent)
            assertEquals("Which floor is the desk on?", state.clarifyingQuestion)
            assertFalse(state.isParsingDraft)
            assertTrue("Magic primary gate opens on a parsed draft.", vm.chrome.primaryCtaEnabled)
        }

    @Test
    fun magicDraftPrefillsModuleObjects() =
        runTest {
            coEvery { repo.magicDraft(any()) } returns
                NetworkResult.Success(
                    MagicDraftResponse(
                        draft =
                            MagicDraftDto(
                                title = "Babysitter needed Saturday evening",
                                description = "Watch two kids while we're at a wedding nearby.",
                                category = "childcare",
                                taskArchetype = "care_task",
                                careDetails = CareDetailsDto(careType = "child", count = 2),
                                items = listOf(MagicTaskItemDto(name = "Snacks")),
                            ),
                        confidence = 0.8,
                    ),
                )
            val vm = makeVm()
            vm.setDescribeText(describeText)
            vm.parseDescribe(describeText)
            val form = vm.state.value.form
            assertEquals("care_task", form.taskArchetype)
            assertEquals("child", form.careDetails?.careType)
            assertEquals(2, form.careDetails?.count)
            assertEquals("Snacks", form.items.single().name)
        }

    @Test
    fun magicDraftSkipsManuallyEditedFields() =
        runTest {
            coEvery { repo.magicDraft(any()) } returns NetworkResult.Success(fullDraftResponse())
            val vm = makeVm()
            vm.setTitle("My own title")
            vm.setBudgetMin("55")
            vm.setDescribeText(describeText)
            vm.parseDescribe(describeText)
            val form = vm.state.value.form
            assertEquals("Touched title survives the draft.", "My own title", form.title)
            assertEquals("Touched budget survives the draft.", "55", form.budgetMin)
            assertNull("Touched budget type is not prefilled either.", form.budgetType)
            // Untouched fields still prefill.
            assertEquals(GigComposeCategory.Handyman, form.category)
            assertEquals(GigComposeScheduleType.OneTime, form.scheduleType)
        }

    @Test
    fun magicDraftFailureFallsBackToKeywordMatcher() =
        runTest {
            coEvery { repo.magicDraft(any()) } returns NetworkResult.Failure(NetworkError.Transport(java.io.IOException("offline")))
            val vm = makeVm()
            vm.setDescribeText(describeText)
            vm.parseDescribe(describeText)
            val state = vm.state.value
            assertEquals(
                "Keyword fallback still detects the archetype offline.",
                GigComposeCategory.Handyman,
                state.form.detectedArchetype,
            )
            assertNull(state.clarifyingQuestion)
            assertFalse(state.isParsingDraft)
            assertTrue("Title is not keyword-prefilled.", state.form.title.isEmpty())
        }

    @Test
    fun shortInputSkipsBackendAndUsesKeywords() =
        runTest {
            val vm = makeVm()
            vm.setDescribeText("clean apartment")
            vm.parseDescribe("clean apartment")
            assertEquals(GigComposeCategory.Cleaning, vm.state.value.form.detectedArchetype)
            coVerify(exactly = 0) { repo.magicDraft(any()) }
        }

    @Test
    fun staleParseIsIgnored() =
        runTest {
            coEvery { repo.magicDraft(any()) } returns NetworkResult.Success(fullDraftResponse())
            val vm = makeVm()
            vm.setDescribeText("walk my dog tomorrow")
            vm.parseDescribe("an older snapshot of the text")
            assertNull(vm.state.value.form.title.ifEmpty { null })
            coVerify(exactly = 0) { repo.magicDraft(any()) }
        }

    @Test
    fun draftBudgetBoundsMapping() {
        // budget_range wins when present.
        assertEquals(
            "80" to "120",
            GigComposeViewModel.draftBudgetBounds(
                MagicDraftDto(budgetRange = MagicDraftBudgetRange(80.0, 120.0), budgetFixed = 60.0),
            ),
        )
        // budget_fixed / hourly_rate land in the min field.
        assertEquals("60" to null, GigComposeViewModel.draftBudgetBounds(MagicDraftDto(budgetFixed = 60.0)))
        assertEquals("22.5" to null, GigComposeViewModel.draftBudgetBounds(MagicDraftDto(hourlyRate = 22.5)))
        assertEquals(null to null, GigComposeViewModel.draftBudgetBounds(MagicDraftDto()))
    }

    @Test
    fun draftScheduleTypeMapping() {
        assertEquals(GigComposeScheduleType.OneTime, GigComposeViewModel.scheduleTypeFromDraft("scheduled"))
        assertEquals(GigComposeScheduleType.OneTime, GigComposeViewModel.scheduleTypeFromDraft("one_time"))
        assertEquals(GigComposeScheduleType.Recurring, GigComposeViewModel.scheduleTypeFromDraft("recurring"))
        assertEquals(GigComposeScheduleType.Flexible, GigComposeViewModel.scheduleTypeFromDraft("flexible"))
        // A12.8 — the backend's asap/today buckets land on Flexible.
        assertEquals(GigComposeScheduleType.Flexible, GigComposeViewModel.scheduleTypeFromDraft("asap"))
        assertEquals(GigComposeScheduleType.Flexible, GigComposeViewModel.scheduleTypeFromDraft("today"))
        assertNull(GigComposeViewModel.scheduleTypeFromDraft("nope"))
        assertNull(GigComposeViewModel.scheduleTypeFromDraft(null))
    }

    @Test
    fun humanizeArchetypeFormatsKeys() {
        assertEquals("Home service", humanizeArchetype("home_service"))
        assertEquals("Delivery errand", humanizeArchetype("delivery_errand"))
        assertNull(humanizeArchetype(null))
        assertNull(humanizeArchetype("  "))
    }
}
