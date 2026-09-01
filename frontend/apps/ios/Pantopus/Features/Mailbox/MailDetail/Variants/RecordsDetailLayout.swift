//
//  RecordsDetailLayout.swift
//  Pantopus
//
//  A17.10 — Records ceremonial variant of the mail item detail. Sits on
//  the shared `MailItemDetailShell` (P19); the hero embeds a multi-page
//  `PaperStack` (P1.1) with the institution letterhead overlay, the body
//  is the cover-letter excerpt + "Read full document" affordance, and
//  the sender slot is the bespoke `IssuerCard` (institution avatar +
//  CRD#/FINRA mono + DKIM-verified strip). Below the body the layout
//  inserts the `VaultBreadcrumb` destination card and — only in the
//  filed state — the `RelatedRecords` strip. Actions are "File in
//  Vault" (open) → retention timer + PDF/Share/JSON tiles (filed).
//

import SwiftUI

// swiftlint:disable file_length multiple_closures_with_trailing_closure

@MainActor
struct RecordsDetailLayout: View {
    let content: MailDetailContent
    let records: RecordsDetailDTO
    let fileInFlight: Bool
    let onBack: @MainActor () -> Void
    let onFileInVault: @MainActor () -> Void
    let onOpenSenderProfile: (@MainActor (String) -> Void)?
    var onSaveToVault: @MainActor () -> Void = {}

    var body: some View {
        MailItemDetailShell(
            topBar: makeTopBar(),
            aiElf: makeAIElf(),
            attachments: nil,
            hero: { RecordsHeroCard(content: content, records: records) },
            keyFacts: { RecordsKeyFactsCard(rows: records.factsForState(filed: records.isFiled)) },
            body: {
                VStack(alignment: .leading, spacing: Spacing.s3) {
                    RecordsBody(
                        paragraphs: records.bodyParagraphs,
                        coverPageHint: records.coverPageHint,
                        pageCount: records.pageCount
                    )
                    VaultBreadcrumb(
                        trail: records.vaultTrail,
                        retentionLine: records.retentionLine,
                        isFiled: records.isFiled
                    ) {}
                    if records.isFiled, !records.related.isEmpty {
                        RelatedRecords(records: records.related, total: 8)
                    }
                }
            },
            sender: { IssuerCard(issuer: records.issuer) },
            actions: {
                RecordsActions(
                    isFiled: records.isFiled,
                    inFlight: fileInFlight,
                    onFileInVault: onFileInVault,
                    onSaveToVault: onSaveToVault
                )
            }
        )
        .accessibilityIdentifier("mailDetail_records")
    }

    private func makeTopBar() -> MailTopBarConfig {
        MailTopBarConfig(
            eyebrow: "Records",
            trust: .neutral,
            onBack: { @Sendable in Task { @MainActor in onBack() } },
            trailingAction: MailTopBarTrailingAction(
                icon: .download,
                accessibilityLabel: "Download PDF"
            ) { @Sendable in },
            overflowItems: [
                MailOverflowItem(id: "openPDF", icon: .fileText, label: "Open PDF") {},
                MailOverflowItem(id: "downloadJSON", icon: .download, label: "Download JSON") {},
                MailOverflowItem(id: "share", icon: .share, label: "Share copy") {},
                MailOverflowItem(id: "saveToVault", icon: .bookmark, label: "Save to vault") { @Sendable in
                    Task { @MainActor in onSaveToVault() }
                },
                MailOverflowItem(id: "dispute", icon: .flag, label: "Dispute") {},
                MailOverflowItem(id: "archive", icon: .archive, label: "Archive") {}
            ]
        )
    }

    private func makeAIElf() -> AIElfStripContent? {
        let elf = records.isFiled ? records.elfFiled : records.elfOpen
        let bullets = elf.bullets.map { bullet in
            AIElfBullet(icon: icon(for: bullet.glyph), label: bullet.label, text: bullet.text)
        }
        return AIElfStripContent(
            headline: elf.headline,
            summary: elf.summary,
            bullets: bullets
        )
    }

    private func icon(for glyph: RecordsElfBullet.Glyph) -> PantopusIcon {
        switch glyph {
        case .fileCheck: .checkCircle
        case .trendingUp: .trendingUp
        case .archive: .archive
        case .lock: .lock
        case .calendarClock: .calendarClock
        case .search: .search
        }
    }
}

// MARK: - Hero

/// Slate accent strip + class chip + sender overline + statement title
/// + mono reference + PaperStack preview + (filed) success stamp.
private struct RecordsHeroCard: View {
    let content: MailDetailContent
    let records: RecordsDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s1) {
                classChip
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
            Text(records.title)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(records.reference)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextSecondary)
                .lineLimit(2)
                .padding(.top, 2)

            paperStackPreview

            if records.isFiled {
                filedStamp
            }
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(Theme.Color.categoryRecords)
                .frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
    }

    private var classChip: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.fileText, size: 10, color: Theme.Color.categoryRecordsDeep)
            Text(records.docClassLabel.uppercased())
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.categoryRecordsDeep)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.categoryRecordsBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xs)
                .stroke(Theme.Color.categoryRecordsBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
    }

    private var paperStackPreview: some View {
        // PaperStack is a fixed 320×384 primitive. `scaleEffect` only
        // transforms drawing (not layout), so we down-scale it and wrap
        // in a frame sized to the scaled footprint (320·0.55 × 384·0.55)
        // — the centered drawing then fills that frame exactly; `clipped`
        // trims the tilt overflow so it never collides with neighbors.
        PaperStack {
            Letterhead(records: records)
        }
        .scaleEffect(0.55, anchor: .center)
        .frame(width: 176, height: 211)
        .clipped()
        .overlay(alignment: .topTrailing) { pageCountChip }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s2)
    }

    private var pageCountChip: some View {
        HStack(spacing: 4) {
            Icon(.fileText, size: 10, color: Theme.Color.appTextInverse)
            Text("\(records.pageCount) PAGES · PDF")
                .font(.system(size: 10, weight: .heavy))
                .tracking(0.4)
                .foregroundStyle(Theme.Color.appTextInverse)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, 3)
        .background(Theme.Color.categoryRecordsDeep)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .padding(.top, Spacing.s2)
        .padding(.trailing, Spacing.s2)
    }

    private var filedStamp: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(.check, size: 13, color: Theme.Color.appTextInverse)
            }
            .frame(width: 20, height: 20)
            (Text("Filed in Vault").font(.system(size: 12, weight: .bold))
                .foregroundColor(Theme.Color.success)
                + Text(" · \(records.filedAtLabel ?? "")")
                .font(.system(size: 12))
                .foregroundColor(Theme.Color.success))
                .fixedSize(horizontal: false, vertical: true)
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
        .accessibilityIdentifier("mailDetail_records_filedStamp")
    }
}

/// Tiny letterhead overlay rendered on the front sheet of the
/// `PaperStack` primitive. Issuer mark + name + "STATEMENT Q1 2026"
/// metadata row.
private struct Letterhead: View {
    let records: RecordsDetailDTO

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            HStack(alignment: .center, spacing: Spacing.s1) {
                Text(records.issuer.initials)
                    .font(.system(size: 8, weight: .heavy))
                    .tracking(0.4)
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(width: 18, height: 18)
                    .background(Theme.Color.categoryRecordsDeep)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
                VStack(alignment: .leading, spacing: 0) {
                    Text(records.issuer.name.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.2)
                        .foregroundStyle(Theme.Color.categoryRecordsDeep)
                        .lineLimit(1)
                    Text("Retirement Services")
                        .font(.system(size: 6, weight: .semibold))
                        .tracking(0.6)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 0) {
                    Text("STATEMENT")
                        .font(.system(size: 7))
                        .tracking(0.4)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                    Text("Q1 2026")
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundStyle(Theme.Color.categoryRecordsDeep)
                }
            }
            Rectangle()
                .fill(Theme.Color.categoryRecordsDeep)
                .frame(height: 1.5)
                .padding(.bottom, 2)
            Spacer(minLength: 0)
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
            HStack {
                Text("ACCT ····4421")
                    .font(.system(size: 7, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer()
                Text("$84,237.16")
                    .font(.system(size: 7, weight: .bold, design: .monospaced))
                    .foregroundStyle(Theme.Color.categoryRecordsDeep)
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityHidden(true)
    }
}

// MARK: - Key facts

/// KeyFacts grid for records — same anatomy as memory's facts card but
/// with the slate accent for emphasis rows + value tints (positive
/// emerald for `+$3,419.08` net change, status row green when filed).
private struct RecordsKeyFactsCard: View {
    let rows: [RecordsFact]

    var body: some View {
        if rows.isEmpty {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: Spacing.s0) {
                Text("KEY FACTS")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s3)
                    .padding(.vertical, Spacing.s2)
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                    factRow(row)
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

    private func factRow(_ row: RecordsFact) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm)
                    .fill(Theme.Color.appSurface)
                RoundedRectangle(cornerRadius: Radii.sm)
                    .stroke(Theme.Color.categoryRecordsBorder, lineWidth: 1)
                Icon(icon(for: row.kind), size: 13, color: Theme.Color.categoryRecordsDeep)
            }
            .frame(width: 26, height: 26)

            VStack(alignment: .leading, spacing: 2) {
                Text(row.label.uppercased())
                    .font(.system(size: 10.5, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(row.value)
                    .font(.system(
                        size: row.emphasis ? 17 : 14,
                        weight: row.emphasis ? .heavy : .bold,
                        design: row.mono ? .monospaced : .default
                    ))
                    .foregroundStyle(valueColor(for: row))
                if let note = row.note {
                    Text(note)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: Spacing.s0)
            if row.tone == .positive, row.emphasis, row.kind == .change {
                trendBadge
            }
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(row.emphasis ? Theme.Color.categoryRecordsBg : Theme.Color.appSurface)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(row.label), \(row.value)\(row.note.map { ", \($0)" } ?? "")")
    }

    private var trendBadge: some View {
        Icon(.trendingUp, size: 11, color: Theme.Color.success)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(Theme.Color.successBg)
            .clipShape(RoundedRectangle(cornerRadius: Radii.xs))
            .accessibilityHidden(true)
    }

    private func valueColor(for row: RecordsFact) -> Color {
        switch row.tone {
        case .positive: Theme.Color.success
        case .neutral: Theme.Color.appText
        }
    }

    private func icon(for kind: RecordsFact.Kind) -> PantopusIcon {
        switch kind {
        case .account: .hash
        case .period: .calendarDays
        case .balance: .dollarSign
        case .change: .trendingUp
        case .statementDate: .calendarClock
        case .status: .checkCircle
        }
    }
}

// MARK: - Body

/// Cover letter excerpt + page-count hint + "Read full document" CTA.
/// Lives inline because it's only used by the records variant.
private struct RecordsBody: View {
    let paragraphs: [String]
    let coverPageHint: String
    let pageCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .center, spacing: Spacing.s1) {
                Text("COVER LETTER")
                    .font(.system(size: 11, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Text(coverPageHint)
                    .font(.system(size: 10.5, design: .monospaced))
                    .foregroundStyle(Theme.Color.appTextMuted)
            }
            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(Array(paragraphs.enumerated()), id: \.offset) { _, paragraph in
                    Text(paragraph)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.Color.appText)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            readFullButton
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("mailDetail_records_body")
    }

    private var readFullButton: some View {
        Button(action: {}) {
            HStack(spacing: Spacing.s1) {
                Icon(.fileText, size: 13, color: Theme.Color.appText)
                Text("Read full document · \(pageCount) pages")
                    .font(.system(size: 12.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s2)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("mailDetail_records_readFull")
    }
}

// MARK: - Actions

/// Records shelf — open shows "File in vault" primary + Download PDF /
/// Choose folder secondary tiles; filed shows retention banner + Open
/// PDF / Share / JSON triplet.
private struct RecordsActions: View {
    let isFiled: Bool
    let inFlight: Bool
    let onFileInVault: @MainActor () -> Void
    let onSaveToVault: @MainActor () -> Void

    var body: some View {
        if isFiled {
            filedActions
        } else {
            openActions
        }
    }

    private var openActions: some View {
        VStack(spacing: Spacing.s2) {
            fileInVaultButton
            HStack(spacing: Spacing.s2) {
                secondary(id: "downloadPDF", icon: .download, label: "Download PDF")
                secondary(id: "chooseFolder", icon: .archive, label: "Choose folder", action: onSaveToVault)
            }
        }
    }

    private var filedActions: some View {
        VStack(spacing: Spacing.s2) {
            retentionBanner
            HStack(spacing: Spacing.s2) {
                secondary(id: "openPDF", icon: .fileText, label: "Open PDF")
                secondary(id: "share", icon: .share, label: "Share")
                secondary(id: "downloadJSON", icon: .download, label: "JSON")
            }
        }
    }

    private var fileInVaultButton: some View {
        Button(action: { onFileInVault() }) {
            HStack(spacing: Spacing.s2) {
                Icon(.archive, size: 16, color: Theme.Color.appTextInverse)
                Text("File in Vault")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.categoryRecordsDeep)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .opacity(inFlight ? 0.6 : 1)
        }
        .buttonStyle(.plain)
        .disabled(inFlight)
        .accessibilityIdentifier("mailDetail_records_fileInVault")
    }

    private var retentionBanner: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.calendarClock, size: 14, color: Theme.Color.appTextStrong)
            Text("Stored for 7 years · auto-delete prompt Apr 2033")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurfaceSunken)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityIdentifier("mailDetail_records_retentionBanner")
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
        .accessibilityIdentifier("mailDetail_records_action_\(id)")
    }
}
