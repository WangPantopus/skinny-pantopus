//
//  MemorySampleData.swift
//  Pantopus
//
//  Deterministic A17.7 keepsake fixture for previews and snapshot tests.
//  Mirrors the design's `memory.jsx` data so renders stay faithful while
//  the backend is absent.
//

import Foundation

public enum MemorySampleData {
    /// Sender shown in the shell's sender block for the sample memory.
    public static let senderName = "Mei L."
    public static let senderMeta = "4 doors down · Just arrived"

    /// Fresh-arrival memory — not yet kept in the vault.
    public static let memory = MemoryDetailDTO(
        title: "One year ago, you found Pepper.",
        reference: "Memory MEM-0518 · marked Mon May 18",
        photoURL: nil,
        photoCaption: "Pepper, May 19 2025",
        photoLabel: "1 of 1 · sent by Mei",
        note: [
            "It's been a year, can you believe it.",
            "I still think about how you walked back from the trail with Pepper under your arm, " +
                "all muddy. He's nine now and getting slow but he still loses his mind when we pass " +
                "your driveway.",
            "Thank you again. I baked you a loaf — it's on the porch."
        ],
        noteSignature: "Mei (and Pepper)",
        facts: [
            MemoryFact(
                kind: .anniversary,
                label: "A year ago today",
                value: "Mon, May 19, 2025 · 7:42 PM"
            ),
            MemoryFact(
                kind: .pulseThread,
                label: "Originally a Pulse post",
                value: "\u{201C}Missing — small brown dog, Pepper\u{201D}",
                linkHint: "Tap to reopen the thread"
            ),
            MemoryFact(
                kind: .location,
                label: "Where it happened",
                value: "Redwood Trail · Stop 4"
            ),
            MemoryFact(
                kind: .others,
                label: "Others on the thread",
                value: "6 neighbors helped search"
            )
        ],
        elfFresh: MemoryElfContent(
            headline: "Pantopus surfaced this memory",
            summary: "A year ago today, Mei posted in the Pulse looking for Pepper and you brought " +
                "him home. She marked this anniversary in her Mailbox a week ago — it released to " +
                "you tonight.",
            bullets: [
                MemoryElfBullet(
                    glyph: .calendar,
                    label: "Anniversary release",
                    text: "Mei scheduled this on May 11"
                ),
                MemoryElfBullet(
                    glyph: .image,
                    label: "1 photograph attached",
                    text: "taken the night of, by Mei"
                ),
                MemoryElfBullet(
                    glyph: .shieldCheck,
                    label: "Private mail",
                    text: "sent only to you, not the Pulse"
                )
            ]
        ),
        elfSaved: MemoryElfContent(
            headline: "Saved to your Vault",
            summary: "This memory lives in Mailbox › Vault › Memories · 2025. Only you can see it. " +
                "Pantopus added a soft reminder for next May 18 so it can resurface again — you can " +
                "turn that off.",
            bullets: [
                MemoryElfBullet(
                    glyph: .archive,
                    label: "Mailbox › Vault › Memories",
                    text: "12 items · 2025 folder"
                ),
                MemoryElfBullet(
                    glyph: .eyeOff,
                    label: "Visible only to you",
                    text: "Mei keeps her own copy"
                ),
                MemoryElfBullet(
                    glyph: .bell,
                    label: "Anniversary reminder set",
                    text: "Mon May 18, 2027 · 7:00 PM"
                )
            ]
        ),
        vault: MemoryVaultInfo(
            trail: [
                MemoryVaultCrumb(glyph: .inbox, label: "Mailbox", isCurrent: false),
                MemoryVaultCrumb(glyph: .archive, label: "Vault", isCurrent: false),
                MemoryVaultCrumb(glyph: .heart, label: "Memories", isCurrent: false),
                MemoryVaultCrumb(glyph: .calendar, label: "2025", isCurrent: true)
            ],
            stats: [
                MemoryVaultStat(value: "12", label: "Memories"),
                MemoryVaultStat(value: "2025", label: "Folder"),
                MemoryVaultStat(value: "Only you", label: "Visibility")
            ]
        ),
        isSaved: false
    )

    /// Saved-to-vault variant of the same memory.
    public static var savedMemory: MemoryDetailDTO {
        memory.withSaved(true)
    }
}
