//
//  MemoryBody.swift
//  Pantopus
//
//  Concrete body for the Memory mailbox category (A17.7). A keepsake
//  delivery: a serif title + reference, the polaroid photograph, the
//  handwritten note, the "Pantopus surfaced this" elf, and a contextual
//  summary that swaps from the facts grid (fresh) to the vault-location
//  card once kept. The shell owns the accent strip, sender block, trust
//  pill, and the sticky Save-to-Vault / Share shelf.
//
// swiftlint:disable multiple_closures_with_trailing_closure

import SwiftUI

@MainActor
public struct MemoryBody: View {
    private let memory: MemoryDetailDTO
    private let isSaved: Bool
    private let onOpenThread: (@MainActor () -> Void)?
    private let onOpenVault: (@MainActor () -> Void)?

    public init(
        memory: MemoryDetailDTO,
        isSaved: Bool,
        onOpenThread: (@MainActor () -> Void)? = nil,
        onOpenVault: (@MainActor () -> Void)? = nil
    ) {
        self.memory = memory
        self.isSaved = isSaved
        self.onOpenThread = onOpenThread
        self.onOpenVault = onOpenVault
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            titleBlock
                .padding(.horizontal, Spacing.s4)

            if isSaved {
                MemorySavedBanner()
                    .padding(.horizontal, Spacing.s4)
            }

            PolaroidFrame(
                imageURL: memory.photoURL,
                caption: memory.photoCaption,
                label: memory.photoLabel
            )
            .padding(.horizontal, Spacing.s4)

            StationeryCard(
                eyebrow: "The note",
                paragraphs: memory.note,
                signature: memory.noteSignature
            )
            .padding(.horizontal, Spacing.s4)

            MemoryElfCard(content: isSaved ? memory.elfSaved : memory.elfFresh)
                .padding(.horizontal, Spacing.s4)

            if isSaved {
                MemoryVaultCard(vault: memory.vault, onOpenVault: onOpenVault)
                    .padding(.horizontal, Spacing.s4)
            } else {
                MemoryFactsCard(facts: memory.facts, onOpenThread: onOpenThread)
                    .padding(.horizontal, Spacing.s4)
            }
        }
        .accessibilityIdentifier("memoryBody")
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.s1) {
            Text(memory.title)
                .font(.system(size: 22, weight: .semibold, design: .serif))
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text(memory.reference)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Saved banner

private struct MemorySavedBanner: View {
    var body: some View {
        HStack(spacing: Spacing.s2) {
            ZStack {
                Circle().fill(Theme.Color.success)
                Icon(.heart, size: 11, color: Theme.Color.appTextInverse)
            }
            .frame(width: 20, height: 20)

            Text("Kept in your Vault").fontWeight(.bold).foregroundStyle(Theme.Color.success)
                + Text(" · only you can see it").foregroundStyle(Theme.Color.appTextSecondary)
        }
        .font(Theme.Font.caption)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.successLight, lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Kept in your Vault, only you can see it")
    }
}

// MARK: - Elf card

private struct MemoryElfCard: View {
    let content: MemoryElfContent

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.primary600)
                    Icon(.sparkles, size: 13, color: Theme.Color.appTextInverse)
                }
                .frame(width: 24, height: 24)
                Text(content.headline)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primary800)
            }

            Text(content.summary)
                .font(.system(size: 13))
                .foregroundStyle(Theme.Color.primary900)
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: Spacing.s2) {
                ForEach(content.bullets) { bullet in
                    bulletRow(bullet)
                }
            }
            .padding(.top, Spacing.s1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s3)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        )
    }

    private func bulletRow(_ bullet: MemoryElfBullet) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.xs).fill(Theme.Color.appSurface)
                RoundedRectangle(cornerRadius: Radii.xs).stroke(Theme.Color.primary200, lineWidth: 1)
                Icon(icon(for: bullet.glyph), size: 10, color: Theme.Color.primary700)
            }
            .frame(width: 18, height: 18)

            (Text(bullet.label).fontWeight(.bold).foregroundStyle(Theme.Color.appText)
                + Text(" — \(bullet.text)").foregroundStyle(Theme.Color.appTextSecondary))
                .pantopusTextStyle(.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(bullet.label). \(bullet.text)")
    }

    private func icon(for glyph: MemoryElfBullet.Glyph) -> PantopusIcon {
        switch glyph {
        case .calendar: .calendar
        case .image: .image
        case .shieldCheck: .shieldCheck
        case .archive: .archive
        case .eyeOff: .eyeOff
        case .bell: .bell
        }
    }
}

// MARK: - Facts grid (fresh state)

private struct MemoryFactsCard: View {
    let facts: [MemoryFact]
    let onOpenThread: (@MainActor () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            Text("The story behind it")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.horizontal, Spacing.s3)
                .padding(.vertical, Spacing.s2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)

            ForEach(Array(facts.enumerated()), id: \.element.id) { index, fact in
                factEntry(fact)
                if index < facts.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
                }
            }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder private func factEntry(_ fact: MemoryFact) -> some View {
        if fact.linkHint != nil, let onOpenThread {
            Button(action: { onOpenThread() }) {
                factRow(fact, showHint: true)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("memoryBody.openThread")
            .accessibilityHint("Opens the original Pulse thread")
        } else {
            factRow(fact, showHint: false)
        }
    }

    private func factRow(_ fact: MemoryFact, showHint: Bool) -> some View {
        HStack(alignment: .top, spacing: Spacing.s3) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm).fill(Theme.Color.warningBg)
                Icon(icon(for: fact.kind), size: 13, color: Theme.Color.warning)
            }
            .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 1) {
                Text(fact.label)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Text(fact.value)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if showHint, let hint = fact.linkHint {
                    Text(hint)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Theme.Color.primary600)
                }
            }
            Spacer(minLength: Spacing.s0)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .contentShape(Rectangle())
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

// MARK: - Vault location card (saved state)

private struct MemoryVaultCard: View {
    let vault: MemoryVaultInfo
    let onOpenVault: (@MainActor () -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Filed in your Vault")
                .pantopusTextStyle(.overline)
                .foregroundStyle(Theme.Color.appTextSecondary)

            breadcrumb
            stats
            if let onOpenVault {
                openButton(onOpenVault)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.s4)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
    }

    private var breadcrumb: some View {
        ScrollView(.horizontal) {
            HStack(spacing: Spacing.s1) {
                ForEach(Array(vault.trail.enumerated()), id: \.element.id) { index, crumb in
                    crumbChip(crumb)
                    if index < vault.trail.count - 1 {
                        Icon(.chevronRight, size: 11, color: Theme.Color.appTextMuted)
                    }
                }
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s2)
        }
        .scrollIndicators(.hidden)
        .background(Theme.Color.appSurfaceSunken)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Path: " + vault.trail.map(\.label).joined(separator: ", "))
    }

    private func crumbChip(_ crumb: MemoryVaultCrumb) -> some View {
        HStack(spacing: Spacing.s1) {
            Icon(icon(for: crumb.glyph), size: 11, color: crumb.isCurrent ? Theme.Color.appText : Theme.Color.appTextStrong)
            Text(crumb.label)
                .font(.system(size: 12, weight: crumb.isCurrent ? .bold : .semibold))
                .foregroundStyle(crumb.isCurrent ? Theme.Color.appText : Theme.Color.appTextStrong)
        }
        .padding(.horizontal, Spacing.s2)
        .padding(.vertical, Spacing.s1)
        .background(crumb.isCurrent ? Theme.Color.appSurface : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: Radii.pill))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.pill)
                .stroke(crumb.isCurrent ? Theme.Color.appBorder : Color.clear, lineWidth: 1)
        )
    }

    private var stats: some View {
        HStack(spacing: Spacing.s0) {
            ForEach(Array(vault.stats.enumerated()), id: \.element.id) { index, stat in
                if index > 0 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(width: 1, height: 28)
                }
                VStack(spacing: 2) {
                    Text(stat.value)
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Text(stat.label)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, Spacing.s2)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
        )
    }

    private func openButton(_ action: @escaping @MainActor () -> Void) -> some View {
        Button(action: { action() }) {
            HStack(spacing: Spacing.s1) {
                Text("Open Vault › Memories")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Icon(.arrowRight, size: 13, color: Theme.Color.appText)
            }
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(Theme.Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("memoryBody.openVault")
        .accessibilityLabel("Open Vault, Memories")
    }

    private func icon(for glyph: MemoryVaultCrumb.Glyph) -> PantopusIcon {
        switch glyph {
        case .inbox: .inbox
        case .archive: .archive
        case .heart: .heart
        case .calendar: .calendar
        }
    }
}

#Preview("Fresh") {
    let onOpenThread: @MainActor () -> Void = {}
    return ScrollView {
        MemoryBody(memory: MemorySampleData.memory, isSaved: false, onOpenThread: onOpenThread)
            .padding(.vertical)
    }
    .background(Theme.Color.appBg)
}

#Preview("Saved") {
    let onOpenVault: @MainActor () -> Void = {}
    return ScrollView {
        MemoryBody(memory: MemorySampleData.savedMemory, isSaved: true, onOpenVault: onOpenVault)
            .padding(.vertical)
    }
    .background(Theme.Color.appBg)
}
