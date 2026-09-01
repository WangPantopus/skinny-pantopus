//
//  BookletDetailLayout.swift
//  Pantopus
//
//  T6.5c (P21) — Booklet (A17.2) variant of the mail item detail. Sits
//  on the shared `MailItemDetailShell` (P19); the only slot it deviates
//  on from the generic A17.1 view is the body — `BookletPager` replaces
//  the plain text card with the swipeable image-page reader + the
//  thumbnail-grid secondary state.
//
//  P21 acceptance is wiring the pager + indicator + grid mode against
//  the projected `BookletDetailDTO`. Per-page OCR + download endpoints
//  light up in a follow-up once the V2 endpoints are wired through the
//  generic VM.
//

import SwiftUI

// swiftlint:disable multiple_closures_with_trailing_closure

/// Standalone variant layout. Exposed to `MailDetailView`'s dispatcher.
@MainActor
struct BookletDetailLayout: View {
    let content: MailDetailContent
    let booklet: BookletDetailDTO
    let ackInFlight: Bool
    let onBack: @MainActor () -> Void
    let onAcknowledge: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    /// T6.5e (P19.5) — Opens the host's Save-to-vault picker. Defaults
    /// to a no-op so existing call sites compile unchanged.
    var onSaveToVault: @MainActor () -> Void = {}
    /// A17.2 — fetches the rendered booklet PDF
    /// (`POST …/p2/booklet/:mailId/download`). RN reports the file size
    /// in the confirmation (`src/app/mailbox/booklet.tsx:43`).
    var onDownloadPDF: @MainActor () -> Void = {}
    /// `true` while the PDF fetch is in flight — the tile disables so a
    /// double-tap can't fire two downloads.
    var downloadInFlight: Bool = false

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: makeAttachments(),
            hero: { HeroCard(content: content) },
            keyFacts: { keyFacts() },
            body: {
                BookletPager(
                    pages: booklet.pages,
                    pageCount: booklet.pageCount,
                    ocrTexts: booklet.ocrTexts
                )
            },
            sender: { SenderCard(content: content, onOpenProfile: onOpenSenderProfile) },
            actions: {
                ActionsRow(
                    onSaveToVault: onSaveToVault,
                    onDownloadPDF: onDownloadPDF,
                    downloadInFlight: downloadInFlight
                )
            }
        )
        .accessibilityIdentifier("mailDetail_booklet")
    }

    // MARK: - Top bar

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: content.category.label,
            trust: content.detailTrust,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: nil,
            overflowItems: [
                MailOverflowItem(id: "share", icon: .share, label: "Share") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "download", icon: .download, label: "Save PDF") { @Sendable in
                    Task { @MainActor in onDownloadPDF() }
                },
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {},
                MailOverflowItem(id: "delete", icon: .trash2, label: "Delete", isDestructive: true) {}
            ]
        )
    }

    // MARK: - AI elf (booklet-specific copy)

    private func makeAIElf() -> AIElfStripContent? {
        // T6.5c — V1 mail detail doesn't expose ai_summary today; when
        // the V2 surface lights it up the strip will appear. Variants
        // can override the headline; the booklet design prefers
        // "Pantopus read the whole booklet" + a "<N> min summary" badge.
        guard let summary = content.aiSummary, !summary.isEmpty else { return nil }
        return AIElfStripContent(
            headline: "Pantopus read the whole booklet",
            summary: summary,
            trailingBadge: booklet.pageCount > 0 ? "\(estimateReadMinutes()) min" : nil
        )
    }

    private func estimateReadMinutes() -> Int {
        // 1 minute per ~3 pages. Clamp at 1.
        max(1, Int(ceil(Double(booklet.pageCount) / 3.0)))
    }

    // MARK: - Attachments

    private func makeAttachments() -> AttachmentsRowContent? {
        guard !content.attachments.isEmpty else { return nil }
        let items = content.attachments.enumerated().map { index, name in
            AttachmentItem(id: "att-\(index)", kind: .pdf, name: name)
        }
        return AttachmentsRowContent(title: "Source files", items: items)
    }

    // MARK: - Key facts (booklet-specific)

    @ViewBuilder
    private func keyFacts() -> some View {
        let rows: [MailDetailKeyFact] = makeBookletKeyFacts()
        if !rows.isEmpty {
            KeyFactsCard(rows: rows)
        }
    }

    private func makeBookletKeyFacts() -> [MailDetailKeyFact] {
        var rows: [MailDetailKeyFact] = []
        if booklet.pageCount > 0 {
            rows.append(
                MailDetailKeyFact(
                    icon: .fileType,
                    label: "Pages",
                    value: "\(booklet.pageCount)"
                )
            )
        }
        if let received = content.createdAtLabel {
            rows.append(MailDetailKeyFact(icon: .calendar, label: "Received", value: received))
        }
        if let senderMeta = content.senderMeta {
            rows.append(MailDetailKeyFact(icon: .briefcase, label: "From", value: senderMeta))
        }
        return rows
    }

    // MARK: - Actions

    private struct ActionsRow: View {
        let onSaveToVault: @MainActor () -> Void
        let onDownloadPDF: @MainActor () -> Void
        let downloadInFlight: Bool

        var body: some View {
            VStack(spacing: Spacing.s2) {
                Button(action: { onSaveToVault() }) {
                    HStack(spacing: Spacing.s2) {
                        Icon(.archive, size: 16, color: Theme.Color.appTextInverse)
                        Text("Save to Vault")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(Theme.Color.appTextInverse)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Theme.Color.primary600)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("mailDetail_booklet_saveToVault")
                HStack(spacing: Spacing.s2) {
                    secondary(icon: .share, label: "Share") {}
                    secondary(
                        icon: .download,
                        label: "PDF",
                        identifier: "mailDetail_booklet_downloadPdf",
                        isDisabled: downloadInFlight,
                        action: onDownloadPDF
                    )
                    secondary(icon: .archive, label: "Archive") {}
                }
            }
        }

        private func secondary(
            icon: PantopusIcon,
            label: String,
            identifier: String? = nil,
            isDisabled: Bool = false,
            action: @escaping @MainActor () -> Void
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
                .opacity(isDisabled ? 0.6 : 1)
            }
            .buttonStyle(.plain)
            .disabled(isDisabled)
            .accessibilityLabel(label)
            .accessibilityIdentifier(identifier ?? "mailDetail_booklet_\(label.lowercased())")
        }
    }
}

// MARK: - Reused subviews

private struct HeroCard: View {
    let content: MailDetailContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s1) {
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
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
            if let excerpt = content.excerpt, !excerpt.isEmpty {
                Text(excerpt)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .lineSpacing(2)
                    .fixedSize(horizontal: false, vertical: true)
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
                }
                Spacer(minLength: Spacing.s0)
                if onOpenProfile != nil, content.senderUserId != nil {
                    Icon(.chevronRight, size: 14, color: Theme.Color.appTextMuted)
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
    }
}
