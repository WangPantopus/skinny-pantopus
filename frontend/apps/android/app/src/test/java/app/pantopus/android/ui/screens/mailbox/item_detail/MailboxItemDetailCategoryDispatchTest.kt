@file:Suppress("MagicNumber", "LongMethod", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.mailbox.v2.MailboxCategoryPayload
import app.pantopus.android.data.api.models.mailbox.v2.MailboxItemActionResponse
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2Item
import app.pantopus.android.data.api.models.mailbox.v2.MailboxV2ItemResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.coEvery
import io.mockk.coVerify
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MailboxItemDetailCategoryDispatchTest {
    private val repo: MailboxRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): MailboxItemDetailViewModel {
        val networkMonitor =
            mockk<app.pantopus.android.data.network.NetworkMonitor>(relaxed = true)
                .also { io.mockk.every { it.isOnline } returns MutableStateFlow(true) }
        return MailboxItemDetailViewModel(
            repo = repo,
            networkMonitor = networkMonitor,
            savedStateHandle = SavedStateHandle(mapOf(MAILBOX_ITEM_DETAIL_MAIL_ID_KEY to "m1")),
        )
    }

    private fun item(
        type: String,
        objectPayload: Map<String, Any?>?,
    ): MailboxV2ItemResponse =
        MailboxV2ItemResponse(
            mail =
                MailboxV2Item(
                    id = "m1",
                    type = type,
                    createdAt = "2026-04-30T10:00:00Z",
                    displayTitle = "Detail",
                    previewText = null,
                    sender = null,
                    senderDisplay = "Sender",
                    senderTrust = "verified_business",
                    senderUserId = null,
                    `package` = null,
                    packageInfo = null,
                    packageTimeline = emptyList(),
                    objectPayload = objectPayload,
                ),
        )

    @Test fun coupon_dispatch_projects_coupon_payload() =
        runTest {
            val payload =
                mapOf(
                    "headline" to "30% OFF",
                    "code" to "PANTO30",
                    "expires_at" to "2026-05-31",
                    "merchant" to "Whole Foods",
                )
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("coupon", payload))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Coupon, loaded.content.category)
            assertTrue(loaded.content.payload is MailboxCategoryPayload.Coupon)
            assertFalse(loaded.content.sender.showStamp)
            assertTrue(loaded.content.keyFacts.any { it.label == "Code" })
        }

    @Test fun booklet_dispatch_projects_booklet_payload() =
        runTest {
            val payload =
                mapOf(
                    "pages" to listOf("https://x/p1.png", "https://x/p2.png"),
                    "summary" to "Spring",
                    "page_count" to 24,
                )
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("booklet", payload))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Booklet, loaded.content.category)
            val booklet = loaded.content.payload as MailboxCategoryPayload.Booklet
            assertEquals(2, booklet.detail.pages.size)
            assertEquals(24, booklet.detail.pageCount)
        }

    @Test fun certified_dispatch_sets_certified_chain_and_stamp() =
        runTest {
            val payload =
                mapOf(
                    "reference_number" to "CRT-2026-0091",
                    "document_type" to "Court summons",
                    "acknowledge_by" to "2026-05-25",
                    "chain" to
                        listOf(
                            mapOf("id" to "sent", "label" to "Sent", "occurred_at" to "2026-05-08"),
                            mapOf("id" to "delivered", "label" to "Delivered", "occurred_at" to "2026-05-10"),
                        ),
                    "notice_body" to "You are summoned.",
                    "is_acknowledged" to false,
                )
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("certified", payload))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Certified, loaded.content.category)
            assertEquals(MailTrust.CertifiedChain, loaded.content.trust)
            assertTrue(loaded.content.sender.showStamp)
            assertNotNull(loaded.content.aiElf)
            assertEquals(2, loaded.content.timeline.size)
            assertTrue(loaded.content.payload is MailboxCategoryPayload.Certified)
        }

    @Test fun community_dispatch_projects_poll_payload() =
        runTest {
            val payload =
                mapOf(
                    "community_item_id" to "community-poll",
                    "kind" to "poll",
                    "group" to
                        mapOf(
                            "name" to "Elm Park HOA",
                            "tagline" to "40 households",
                            "verified" to true,
                            "role" to "Resident",
                            "since" to "Mar 2024",
                            "member_count" to 87,
                        ),
                    "poll" to
                        mapOf(
                            "question" to "Which weekend should we reserve?",
                            "options" to
                                listOf(
                                    mapOf("id" to "june-7", "label" to "Saturday, June 7", "votes" to 19, "selected" to true),
                                    mapOf("id" to "june-14", "label" to "Saturday, June 14", "votes" to 11),
                                ),
                            "total_votes" to 30,
                            "closes_at" to "Fri 5 PM",
                            "status" to "Residents only",
                        ),
                    "attendees" to listOf(mapOf("id" to "jt", "name" to "Jamal T.", "initials" to "JT", "verified" to true)),
                    "attendee_count" to 30,
                    "attendees_from_block" to 6,
                    "pulse_thread" to mapOf("thread_id" to "pulse-1", "title" to "Poll thread", "reply_count" to 4),
                )
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("community", payload))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Community, loaded.content.category)
            assertEquals(MailTrust.Verified, loaded.content.trust)
            assertTrue(loaded.content.keyFacts.isEmpty())
            val community = loaded.content.payload as MailboxCategoryPayload.Community
            assertEquals(app.pantopus.android.data.api.models.mailbox.v2.CommunityMailSubtype.Poll, community.detail.subtype)
            assertEquals(2, community.detail.poll?.options?.size)
            assertEquals(30, community.detail.poll?.totalVotes)
        }

    private fun memoryPayload(): Map<String, Any?> =
        mapOf(
            "title" to "One year ago, you found Pepper.",
            "reference" to "Memory MEM-0518",
            "photo" to mapOf("caption" to "Pepper, May 19 2025", "label" to "1 of 1 · sent by Mei"),
            "note" to listOf("It's been a year.", "He's nine now.", "I baked you a loaf."),
            "note_signature" to "Mei (and Pepper)",
            "facts" to
                listOf(
                    mapOf("kind" to "anniversary", "label" to "A year ago today", "value" to "Mon, May 19"),
                    mapOf(
                        "kind" to "pulseThread",
                        "label" to "Originally a Pulse post",
                        "value" to "Missing — Pepper",
                        "link_hint" to "Tap to reopen the thread",
                    ),
                    mapOf("kind" to "location", "label" to "Where it happened", "value" to "Redwood Trail"),
                    mapOf("kind" to "others", "label" to "Others on the thread", "value" to "6 neighbors"),
                ),
            "elf_fresh" to
                mapOf(
                    "headline" to "Pantopus surfaced this memory",
                    "summary" to "It released to you tonight.",
                    "bullets" to
                        listOf(
                            mapOf("glyph" to "calendar", "label" to "Anniversary release", "text" to "May 11"),
                        ),
                ),
            "elf_saved" to
                mapOf(
                    "headline" to "Saved to your Vault",
                    "summary" to "Only you can see it.",
                    "bullets" to
                        listOf(
                            mapOf("glyph" to "archive", "label" to "Mailbox vault", "text" to "12 items"),
                        ),
                ),
            "vault" to
                mapOf(
                    "trail" to
                        listOf(
                            mapOf("glyph" to "inbox", "label" to "Mailbox"),
                            mapOf("glyph" to "calendar", "label" to "2025", "current" to true),
                        ),
                    "stats" to
                        listOf(
                            mapOf("value" to "12", "label" to "Memories"),
                            mapOf("value" to "Only you", "label" to "Visibility"),
                        ),
                ),
            "is_saved" to false,
        )

    @Test fun memory_dispatch_projects_memory_payload() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("memory", memoryPayload()))
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            assertEquals(MailItemCategory.Memory, loaded.content.category)
            assertEquals(MailTrust.Verified, loaded.content.trust)
            val memory = loaded.content.payload as MailboxCategoryPayload.Memory
            assertEquals("One year ago, you found Pepper.", memory.detail.title)
            assertEquals(4, memory.detail.facts.size)
            assertEquals(3, memory.detail.note.size)
            assertFalse(memory.detail.isSaved)
            // The body owns the polaroid / note / facts / vault — the
            // shell's standard elf + key-facts slots stay empty.
            assertNull(loaded.content.aiElf)
            assertTrue(loaded.content.keyFacts.isEmpty())
            assertFalse(loaded.content.sender.showStamp)
        }

    @Test fun memory_save_to_vault_flips_saved_state() =
        runTest {
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("memory", memoryPayload()))
            val vm = makeVm()
            vm.load()

            // "Save to Vault" is a client-side flip — no network request.
            vm.performPrimaryAction()
            val loaded = vm.state.value as MailboxItemDetailUiState.Loaded
            val memory = loaded.content.payload as MailboxCategoryPayload.Memory
            assertTrue(memory.detail.isSaved)
        }

    @Test fun certified_primary_action_gated_on_ack_checkbox() =
        runTest {
            val payload =
                mapOf(
                    "reference_number" to "CRT-1",
                    "chain" to listOf<Any?>(),
                    "is_acknowledged" to false,
                )
            coEvery { repo.item("m1") } returns NetworkResult.Success(item("certified", payload))
            coEvery { repo.itemAction("m1", "acknowledge") } returns
                NetworkResult.Success(MailboxItemActionResponse(message = "ok", action = "acknowledge"))
            val vm = makeVm()
            vm.load()

            // Without checking the gate, the primary action must no-op.
            assertFalse(vm.certifiedAckChecked.value)
            vm.performPrimaryAction()
            coVerify(exactly = 0) { repo.itemAction("m1", "acknowledge") }

            // After checking, the action fires.
            vm.setCertifiedAckChecked(true)
            vm.performPrimaryAction()
            coVerify(exactly = 1) { repo.itemAction("m1", "acknowledge") }
            assertTrue(vm.ctaFlags.value.primaryCompleted)
        }
}
