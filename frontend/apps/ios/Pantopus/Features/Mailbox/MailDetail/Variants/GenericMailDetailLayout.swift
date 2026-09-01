//
//  GenericMailDetailLayout.swift
//  Pantopus
//
//  A17.1 — Generic mail item detail variant. Default fall-through for
//  categories without a bespoke ceremonial layout. Sits on the shared
//  `MailItemDetailShell` (P19) and wires every slot from the mail item
//  DTO. Extracted from the inlined fallback in `MailDetailView.swift`
//  so the dispatcher routes to a real bespoke file in every case.
//

import SwiftUI

// swiftlint:disable file_length multiple_closures_with_trailing_closure

@MainActor
struct GenericMailDetailLayout: View {
    let content: MailDetailContent
    let ackInFlight: Bool
    let onBack: @MainActor () -> Void
    let onAcknowledge: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    let onSaveToVault: @MainActor () -> Void
    /// When set, the overflow menu gains a "Translate" action (A17.13).
    var onTranslate: (@MainActor @Sendable () -> Void)?
    /// A17.12 — when set, the overflow surfaces "Create task", which opens
    /// the Mail-tasks screen in its create frame for this mail.
    var onCreateTask: (@MainActor @Sendable () -> Void)?
    /// A17.1 — per-category ACTIONS row (RN `CATEGORY_ACTIONS`). Empty
    /// hides the section.
    var categoryActions: [MailCategoryAction] = []
    /// Tile currently POSTing to `/item/:id/action`.
    var categoryActionInFlight: MailCategoryAction?
    var onCategoryAction: (@MainActor (MailCategoryAction) -> Void)?

    var body: some View {
        MailItemDetailShell(
            topBar: topBar,
            aiElf: aiElf,
            attachments: attachments,
            hero: {
                GenericHeroCard(content: content)
            },
            keyFacts: {
                // On acknowledged items the activity timeline leads so the
                // post-action signal lands above the fold (mail-detail.jsx).
                VStack(spacing: Spacing.s3) {
                    if content.isAcknowledged {
                        ChainOfCustodyTimeline(
                            title: "Activity",
                            status: .custom(
                                label: "On file",
                                background: Theme.Color.successBg,
                                foreground: Theme.Color.success
                            ),
                            events: ackTimelineEvents
                        )
                        .accessibilityIdentifier("mailDetail_ackTimeline")
                    }
                    KeyFactsCard(rows: content.keyFacts())
                }
            },
            body: {
                BodyCard(paragraphs: content.bodyParagraphs)
            },
            sender: {
                SenderCard(content: content, onOpenProfile: onOpenSenderProfile)
            },
            actions: {
                ActionsRow(
                    content: content,
                    ackInFlight: ackInFlight,
                    categoryActions: categoryActions,
                    categoryActionInFlight: categoryActionInFlight,
                    onCategoryAction: onCategoryAction,
                    onAck: onAcknowledge,
                    onMove: onSaveToVault
                )
            }
        )
        .accessibilityIdentifier("mailDetail_generic")
    }

    /// Acknowledgment timeline events per mail-detail.jsx TIMELINE —
    /// synthesized from the projected content until the backend surfaces
    /// per-item activity.
    private var ackTimelineEvents: [ChainOfCustodyEvent] {
        [
            ChainOfCustodyEvent(
                id: "ack",
                icon: .badgeCheck,
                label: "Acknowledged by you",
                isComplete: true
            ),
            ChainOfCustodyEvent(
                id: "delivered",
                icon: .mailbox,
                label: "Delivered to your Mailbox",
                timestamp: content.createdAtLabel
            ),
            ChainOfCustodyEvent(
                id: "tldr",
                icon: .sparkles,
                label: "Pantopus drafted plain-language TL;DR",
                timestamp: content.createdAtLabel,
                isPantopusEvent: true
            )
        ]
    }

    private var topBar: MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: content.category.label,
            trust: content.detailTrust,
            onBack: { @Sendable in
                Task { @MainActor in onBack() }
            },
            trailingAction: MailTopBarTrailingAction(
                icon: .bookmark,
                accessibilityLabel: "Save to vault"
            ) { @Sendable in
                Task { @MainActor in onSaveToVault() }
            },
            overflowItems: overflowItems
        )
    }

    private var overflowItems: [MailOverflowItem] {
        var items: [MailOverflowItem] = []
        if let onTranslate {
            items.append(
                MailOverflowItem(id: "translate", icon: .globe, label: "Translate") { @Sendable in
                    Task { @MainActor in onTranslate() }
                }
            )
        }
        if let onCreateTask {
            items.append(
                MailOverflowItem(id: "createTask", icon: .listChecks, label: "Create task") { @Sendable in
                    Task { @MainActor in onCreateTask() }
                }
            )
        }
        items.append(contentsOf: [
            MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {},
            MailOverflowItem(id: "move", icon: .folderPlus, label: "Move") { @Sendable in
                Task { @MainActor in onSaveToVault() }
            },
            MailOverflowItem(id: "share", icon: .share, label: "Share") {},
            MailOverflowItem(id: "unread", icon: .mailOpen, label: "Mark unread") {}
        ])
        return items
    }

    private var aiElf: AIElfStripContent? {
        guard let summary = content.aiSummary, !summary.isEmpty else { return nil }
        return AIElfStripContent(
            headline: content.isAcknowledged ? "What happens next" : "Pantopus read this for you",
            summary: summary,
            bullets: content.aiBullets
        )
    }

    private var attachments: AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(
                id: "att-\(index)",
                kind: Self.guessKind(for: name),
                name: name
            )
        }
        return AttachmentsRowContent(items: items)
    }

    /// Cheap heuristic from filename extension. Backend will eventually
    /// expose `kind` per-attachment and this helper retires.
    private static func guessKind(for name: String) -> AttachmentKind {
        let lower = name.lowercased()
        if lower.hasSuffix(".pdf") { return .pdf }
        if lower.hasSuffix(".jpg") || lower.hasSuffix(".jpeg") ||
            lower.hasSuffix(".png") || lower.hasSuffix(".heic") || lower.hasSuffix(".webp") {
            return .image
        }
        if lower.hasSuffix(".mp4") || lower.hasSuffix(".mov") { return .video }
        if lower.hasSuffix(".mp3") || lower.hasSuffix(".m4a") { return .audio }
        if lower.hasPrefix("http://") || lower.hasPrefix("https://") { return .link }
        return .other
    }
}

// MARK: - Hero (mail-detail.jsx HeroCard)

/// A17.1 hero — accent strip + trust/category chips + uppercase sender +
/// title + mono reference + optional acknowledged banner. Sender identity
/// lives in the separate `SenderCard` slot below the body.
private struct GenericHeroCard: View {
    let content: MailDetailContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s1) {
                MailSenderTrustChip(trust: content.trust)
                CategoryBadge(category: content.category)
                Spacer(minLength: Spacing.s0)
                if let received = content.createdAtLabel {
                    Text(received)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Text(content.senderDisplayName.uppercased())
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            Text(content.title)
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .lineSpacing(1)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("mailDetail_subjectRow")
            if !content.referenceLabel.isEmpty {
                Text(content.referenceLabel)
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, 2)
            }
            if content.isAcknowledged {
                acknowledgedBanner
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(content.category.accent)
                .frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_genericHero")
    }

    private var acknowledgedBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 13, color: Theme.Color.appTextInverse)
                .frame(width: 20, height: 20)
                .background(Theme.Color.success)
                .clipShape(Circle())
            (
                Text("Acknowledged").bold()
                    + Text(acknowledgedSuffix)
                    .foregroundColor(Theme.Color.success.opacity(0.85))
            )
            .pantopusTextStyle(.caption)
            .foregroundColor(Theme.Color.success)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, 9)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_ackBanner")
    }

    private var acknowledgedSuffix: String {
        if let when = content.createdAtLabel, !when.isEmpty {
            return " · \(when) by you"
        }
        return " · by you"
    }
}

private struct MailSenderTrustChip: View {
    let trust: MailTrust

    var body: some View {
        HStack(spacing: 3) {
            Icon(trust.icon, size: 11, color: trust.foreground)
            Text(trust.label)
                .font(.system(size: 10, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(trust.foreground)
                .lineLimit(1)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(trust.background)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .accessibilityLabel("\(trust.label) sender")
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

// MARK: - Sender (mail-detail.jsx SenderCard)

/// Separate sender identity card below the body — avatar + name +
/// dept + kind/proof chips. Kept out of the hero so acknowledged
/// frames can lead with timeline + key facts above the fold.
private struct SenderCard: View {
    let content: MailDetailContent
    let onOpenProfile: (@MainActor (String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("SENDER")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            HStack(alignment: .center, spacing: Spacing.s3) {
                avatar
                VStack(alignment: .leading, spacing: 2) {
                    Text(content.senderDisplayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    if let meta = content.senderMeta, !meta.isEmpty {
                        Text(meta)
                            .pantopusTextStyle(.caption)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .lineLimit(2)
                    }
                    HStack(spacing: Spacing.s1) {
                        kindChip
                        proofChip
                    }
                    .padding(.top, 4)
                }
                Spacer(minLength: Spacing.s0)
                if onOpenProfile != nil, content.senderUserId != nil {
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                if let onOpenProfile, let userId = content.senderUserId {
                    onOpenProfile(userId)
                }
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("mailDetail_senderCard")
    }

    private var avatar: some View {
        Text(content.senderInitials)
            .font(.system(size: 14, weight: .bold))
            .foregroundStyle(Theme.Color.appTextInverse)
            .frame(width: 44, height: 44)
            .background(content.category.accent)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .overlay(alignment: .bottomTrailing) {
                Circle()
                    .fill(Theme.Color.success)
                    .frame(width: 16, height: 16)
                    .overlay {
                        Icon(.check, size: 9, color: Theme.Color.appTextInverse)
                    }
                    .overlay(Circle().stroke(Theme.Color.appSurface, lineWidth: 2))
                    .offset(x: 3, y: 3)
            }
    }

    private var kindChip: some View {
        HStack(spacing: 3) {
            Icon(.landmark, size: 9, color: Theme.Color.primary800)
            Text(content.senderTypeLabel)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Theme.Color.primary800)
                .lineLimit(1)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(Theme.Color.infoBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }

    private var proofChip: some View {
        Text(content.trust.label)
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(Theme.Color.success)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Theme.Color.successBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
    }
}

private struct KeyFactsCard: View {
    let rows: [MailDetailKeyFact]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("KEY FACTS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, Spacing.s3)
                .padding(.top, Spacing.s2)
                .padding(.bottom, Spacing.s2)
                .accessibilityAddTraits(.isHeader)
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

private struct BodyCard: View {
    let paragraphs: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NOTICE TEXT")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.5)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                Text(paragraph)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }
}

private struct ActionsRow: View {
    let content: MailDetailContent
    let ackInFlight: Bool
    let categoryActions: [MailCategoryAction]
    let categoryActionInFlight: MailCategoryAction?
    let onCategoryAction: (@MainActor (MailCategoryAction) -> Void)?
    let onAck: @MainActor () -> Void
    let onMove: @MainActor () -> Void

    var body: some View {
        VStack(spacing: Spacing.s2) {
            if content.ackRequired || content.isAcknowledged {
                acknowledgeButton
            }
            if !categoryActions.isEmpty, onCategoryAction != nil {
                categoryActionsSection
            }
            secondaryRow
        }
    }

    /// A17.1 — the per-category row RN renders under an "ACTIONS"
    /// overline: first tile filled with the category accent, the rest
    /// outlined, wrapping (`detail.tsx:188-208`).
    private var categoryActionsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("ACTIONS")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .accessibilityAddTraits(.isHeader)
            MailActionsFlowLayout(spacing: Spacing.s2) {
                ForEach(Array(categoryActions.enumerated()), id: \.element.id) { index, action in
                    categoryActionTile(action, isPrimary: index == 0)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_categoryActions")
    }

    private func categoryActionTile(_ action: MailCategoryAction, isPrimary: Bool) -> some View {
        let isBusy = categoryActionInFlight == action
        let foreground: Color = isPrimary ? Theme.Color.appTextInverse : Theme.Color.appText
        return Button(action: { onCategoryAction?(action) }) {
            HStack(spacing: Spacing.s2) {
                Icon(action.icon, size: 14, color: foreground)
                Text(action.label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .background(isPrimary ? content.category.accent : Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .opacity(isBusy ? 0.5 : 1)
        }
        .buttonStyle(.plain)
        .disabled(categoryActionInFlight != nil)
        .accessibilityLabel(action.label)
        .accessibilityIdentifier("mailDetail_categoryAction_\(action.rawValue)")
    }

    private var acknowledgeButton: some View {
        Button(action: { onAck() }) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    content.isAcknowledged ? .checkCircle : .check,
                    size: 16,
                    color: content.isAcknowledged ? Theme.Color.success : Theme.Color.appTextInverse
                )
                Text(content.isAcknowledged ? "Acknowledged · Tap to undo" : "Acknowledge receipt")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(
                        content.isAcknowledged ? Theme.Color.success : Theme.Color.appTextInverse
                    )
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(
                content.isAcknowledged ? Theme.Color.appSurface : Theme.Color.primary600
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14)
                    .stroke(
                        content.isAcknowledged ? Theme.Color.successLight : Color.clear,
                        lineWidth: 1.5
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(ackInFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(ackInFlight)
        .accessibilityIdentifier("mailDetail_acknowledge")
    }

    private var secondaryRow: some View {
        HStack(spacing: Spacing.s2) {
            secondaryTile(id: "archive", icon: .archive, label: "Archive")
            secondaryTile(id: "move", icon: .folderPlus, label: "Move", action: onMove)
            secondaryTile(id: "share", icon: .share, label: "Share")
            secondaryTile(id: "markUnread", icon: .mailOpen, label: "Mark unread")
        }
    }

    private func secondaryTile(
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
        .accessibilityLabel(label)
        .accessibilityIdentifier("mailDetail_action_\(id)")
    }
}

// MARK: - Flow layout for the wrapping ACTIONS row

/// Minimal flow layout — wraps children left-to-right and starts a new
/// line when the next tile would overflow the available width. Mirrors
/// RN's `actionsRow` (`flexWrap: 'wrap'`, `gap: 8`).
private struct MailActionsFlowLayout: Layout {
    let spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxRowWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                maxRowWidth = max(maxRowWidth, x - spacing)
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        maxRowWidth = max(maxRowWidth, x - spacing)
        return CGSize(width: maxRowWidth, height: y + rowHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache _: inout ()
    ) {
        let maxWidth = proposal.width ?? bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
