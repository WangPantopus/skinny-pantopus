//
//  MemoryDetailLayout.swift
//  Pantopus
//
//  A17.7 — Memory ceremonial variant of the mail item detail. Sits on
//  the shared `MailItemDetailShell` (P19); the body slot is the
//  bespoke `MemoryBody` (polaroid + handwritten note + Pantopus elf +
//  facts grid → vault card swap once saved). The actions shelf is the
//  prominent "Save to my Vault" CTA, collapsing into a tappable
//  "Saved" pill once the keepsake is filed.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

@MainActor
struct MemoryDetailLayout: View {
    let content: MailDetailContent
    let memory: MemoryDetailDTO
    let saveInFlight: Bool
    let onBack: @MainActor () -> Void
    let onSaveMemory: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { MemoryHeroCard(content: content, memory: memory) },
            keyFacts: { MemoryKeyFactsCard(rows: makeKeyFacts()) },
            body: {
                MemoryBody(
                    memory: memory,
                    isSaved: memory.isSaved
                )
            },
            sender: { MemorySenderCard(content: content, onOpenProfile: onOpenSenderProfile) },
            actions: {
                MemoryDetailActions(
                    isSaved: memory.isSaved,
                    inFlight: saveInFlight,
                    onSave: onSaveMemory,
                    onShare: onSaveToVault
                )
            }
        )
        .accessibilityIdentifier("mailDetail_memory")
    }

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Memory",
            trust: .verified,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: memory.isSaved ? .heart : .bookmark,
                accessibilityLabel: memory.isSaved ? "Saved to vault" : "Save to vault",
                isActive: memory.isSaved
            ) { @Sendable in Task { @MainActor in onSaveToVault() } },
            overflowItems: [
                MailOverflowItem(id: "share", icon: .share, label: "Share with sender") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "muteAnniversary", icon: .bell, label: "Mute anniversary") {},
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {}
            ]
        )
    }

    private func makeAIElf() -> AIElfStripContent? {
        let elf = memory.isSaved ? memory.elfSaved : memory.elfFresh
        let bullets = elf.bullets.map { source in
            AIElfBullet(
                icon: glyph(for: source.glyph),
                label: source.label,
                text: source.text
            )
        }
        return AIElfStripContent(
            headline: elf.headline,
            summary: elf.summary,
            bullets: bullets
        )
    }

    private func glyph(for glyph: MemoryElfBullet.Glyph) -> PantopusIcon {
        switch glyph {
        case .calendar: .calendar
        case .image: .image
        case .shieldCheck: .shieldCheck
        case .archive: .archive
        case .eyeOff: .eyeOff
        case .bell: .bell
        }
    }

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .image, name: name)
        }
        return AttachmentsRowContent(title: "Attached photos", items: items)
    }

    private func makeKeyFacts() -> [MailDetailKeyFact] {
        var rows: [MailDetailKeyFact] = []
        if !memory.reference.isEmpty {
            rows.append(MailDetailKeyFact(icon: .hash, label: "Reference", value: memory.reference))
        }
        for fact in memory.facts.prefix(3) {
            rows.append(
                MailDetailKeyFact(
                    icon: icon(for: fact.kind),
                    label: fact.label,
                    value: fact.value
                )
            )
        }
        if memory.isSaved, let folder = memory.vault.trail.last(where: { $0.isCurrent }) {
            rows.append(MailDetailKeyFact(icon: .archive, label: "Filed in", value: folder.label))
        }
        return rows
    }

    private func icon(for kind: MemoryFact.Kind) -> PantopusIcon {
        switch kind {
        case .anniversary: .calendar
        case .pulseThread: .messageSquare
        case .location: .mapPin
        case .others: .users
        }
    }
}

// MARK: - Hero

private struct MemoryHeroCard: View {
    let content: MailDetailContent
    let memory: MemoryDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                CategoryBadge(category: content.category)
                Spacer()
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Text(content.senderDisplayName.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(content.title)
                .font(.system(size: 19, weight: .bold, design: .serif))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if memory.isSaved {
                savedChip
            } else if let excerpt = content.excerpt, !excerpt.isEmpty {
                Text(excerpt)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(content.category.accent).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var savedChip: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.heart, size: 13, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Theme.Color.success)
                .clipShape(Circle())
            Text("Kept in your Vault")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_memory_savedChip")
    }
}

private struct CategoryBadge: View {
    let category: MailItemCategory

    var body: some View {
        HStack(spacing: Spacing.s1) {
            Icon(category.icon, size: 11, color: category.accent)
            Text(category.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.4)
                .foregroundStyle(category.accent)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(category.rowBackground)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

// MARK: - Key facts

private struct MemoryKeyFactsCard: View {
    let rows: [MailDetailKeyFact]

    var body: some View {
        if rows.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("KEEPSAKE FACTS")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    HStack(alignment: .top, spacing: Spacing.s3) {
                        Icon(row.icon, size: 13, color: Theme.Color.appTextStrong)
                            .frame(width: 24, height: 24)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                        VStack(alignment: .leading, spacing: 1) {
                            Text(row.label.uppercased())
                                .font(.system(size: 11, weight: .semibold))
                                .tracking(0.4)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                            Text(row.value)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Theme.Color.appText)
                        }
                        Spacer(minLength: Spacing.s0)
                    }
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                    if index < rows.count - 1 {
                        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                    }
                }
            }
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
    }
}

// MARK: - Sender

private struct MemorySenderCard: View {
    let content: MailDetailContent
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        HStack(spacing: Spacing.s3) {
            Text(content.senderInitials)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .frame(width: 44, height: 44)
                .background(content.category.accent)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            VStack(alignment: .leading, spacing: 2) {
                Text(content.senderDisplayName)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                if let meta = content.senderMeta {
                    Text(meta)
                        .pantopusTextStyle(.caption)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                HStack(spacing: Spacing.s1) {
                    Icon(.heart, size: 11, color: Theme.Color.success)
                    Text("Sent privately to you")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(Theme.Color.success)
                }
                .padding(.top, 2)
            }
            Spacer(minLength: Spacing.s0)
            if onOpenProfile != nil, content.senderUserId != nil {
                Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
            }
        }
        .padding(Spacing.s3)
        .contentShape(Rectangle())
        .onTapGesture {
            if let onOpenProfile, let userId = content.senderUserId {
                onOpenProfile(userId)
            }
        }
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

// MARK: - Actions

private struct MemoryDetailActions: View {
    let isSaved: Bool
    let inFlight: Bool
    let onSave: @MainActor () -> Void
    let onShare: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if isSaved {
                savedPill
            } else {
                saveButton
            }
            HStack(spacing: Spacing.s2) {
                secondary(id: "reply", icon: .messageSquare, label: "Reply")
                secondary(id: "share", icon: .share, label: "Share", action: onShare)
                secondary(id: "print", icon: .download, label: "Print")
            }
        }
    }

    private var saveButton: some View {
        Button(action: { onSave() }) {
            HStack(spacing: Spacing.s2) {
                Icon(.heart, size: 16, color: Theme.Color.appTextInverse)
                Text("Save to my Vault")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(inFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(inFlight)
        .accessibilityIdentifier("mailDetail_memory_save")
    }

    private var savedPill: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.checkCircle, size: 16, color: Theme.Color.success)
            Text("Kept in your Vault · only you")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(Theme.Color.success)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Theme.Color.successLight, lineWidth: 1.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityIdentifier("mailDetail_memory_savedShelf")
    }

    private func secondary(
        id: String,
        icon: PantopusIcon,
        label: String,
        action: @escaping @MainActor () -> Void = {}
    ) -> some View {
        Button(action: { action() }) {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 17, color: Theme.Color.appTextStrong)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("mailDetail_memory_action_\(id)")
    }
}
