//
//  UploadSlot.swift
//  Pantopus
//
//  A12.4 — Claim ownership · Evidence. One evidence upload slot, rendered
//  in the four states from the design's slot vocabulary:
//
//    • empty      — dashed border + plus icon + label + hint
//    • uploading  — filename + size + live progress bar
//    • done       — filename + size + green check + "Address matches" line
//    • warn       — filename + amber chip + "Address differs" block
//
//  The address-match line is a per-file OCR confirmation; the heuristic
//  that produces it lives in `ClaimOwnershipSampleData` (sample data until
//  real server OCR lands). The slot itself is presentation-only — the
//  consumer drives state transitions through its view model.
//

import SwiftUI

/// Lightweight display model for the file shown in a populated slot. Decoupled
/// from `ClaimPickedFile` (which carries raw bytes) so the slot can render in
/// snapshots without fabricating data.
struct UploadSlotFile: Equatable {
    enum Kind: Equatable { case pdf, image }

    let name: String
    /// Pre-formatted size, e.g. "1.4 MB" / "820 KB".
    let sizeLabel: String
    /// Page count for multi-page docs, e.g. 8 → "8 pages". `nil` omits it.
    let pageCount: Int?
    let kind: Kind
}

/// Render-state for one claim upload slot. Mirrors the A12.4 design's slot
/// state vocabulary exactly.
enum UploadSlotState: Equatable {
    case empty
    case uploading(file: UploadSlotFile, progress: Double)
    case done(file: UploadSlotFile, detail: String)
    case warn(file: UploadSlotFile, detail: String)

    /// Bold lead rendered before the OCR detail in the `done` state.
    static let matchLead = "Address matches."
    /// Bold lead rendered before the OCR detail in the `warn` state.
    static let differLead = "Address differs from your profile."

    /// Whether the slot holds a confirmed (uploaded + checked) document.
    var isAttached: Bool {
        switch self {
        case .done, .warn: true
        case .empty, .uploading: false
        }
    }
}

/// A single evidence upload slot. Tapping the empty tile fires `onPick`; the
/// trailing control (X while uploading, trash once populated) fires `onRemove`.
struct UploadSlot: View {
    let id: String
    let label: String
    var required: Bool = false
    let hint: String
    let state: UploadSlotState
    var onPick: () -> Void = {}
    var onRemove: () -> Void = {}

    var body: some View {
        Group {
            switch state {
            case .empty:
                emptyTile
            case let .uploading(file, progress):
                uploadingTile(file: file, progress: progress)
            case let .done(file, detail):
                uploadedTile(file: file, detail: detail, isWarn: false)
            case let .warn(file, detail):
                uploadedTile(file: file, detail: detail, isWarn: true)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(a11yLabel)
        .accessibilityIdentifier("uploadSlot_\(id)")
    }

    // MARK: - Empty

    private var emptyTile: some View {
        Button(action: onPick) {
            HStack(spacing: Spacing.s3) {
                iconDisc(.upload)
                VStack(alignment: .leading, spacing: Spacing.s1) {
                    requiredLabelText
                    Text(hint)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                Icon(.plus, size: 18, color: Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(
                        Theme.Color.appBorderStrong,
                        style: StrokeStyle(lineWidth: 1.5, lineCap: .round, dash: [6, 4])
                    )
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Uploading

    private func uploadingTile(file: UploadSlotFile, progress: Double) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                iconDisc(.image)
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    uploadProgressText(file: file, progress: progress)
                }
                Spacer(minLength: Spacing.s0)
                removeButton(icon: .x, background: Theme.Color.appSurfaceSunken)
            }
            progressBar(progress: progress)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary200, lineWidth: 1)
        }
    }

    // MARK: - Done / Warn

    private func uploadedTile(file: UploadSlotFile, detail: String, isWarn: Bool) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                thumbnail(file: file)
                VStack(alignment: .leading, spacing: 2) {
                    Text(file.name)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(sizeAndPages(file))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s0)
                removeButton(icon: .trash2, background: .clear)
            }
            ocrRow(detail: detail, isWarn: isWarn)
        }
        .padding(Spacing.s3)
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(isWarn ? Theme.Color.warningLight : Theme.Color.successLight, lineWidth: 1)
        }
    }

    private func ocrRow(detail: String, isWarn: Bool) -> some View {
        HStack(alignment: .top, spacing: Spacing.s2) {
            ZStack {
                Circle().fill(isWarn ? Theme.Color.warning : Theme.Color.success)
                Icon(
                    isWarn ? .alertTriangle : .check,
                    size: 11,
                    strokeWidth: 3,
                    color: Theme.Color.appTextInverse
                )
            }
            .frame(width: 18, height: 18)
            ocrDetailText(detail: detail, isWarn: isWarn)
                .foregroundStyle(isWarn ? Theme.Color.warning : Theme.Color.success)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(Spacing.s2)
        .background(isWarn ? Theme.Color.warningBg : Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
    }

    // MARK: - Shared bits

    private var requiredLabelText: Text {
        let base = Text(label)
            .font(.system(size: 13.5, weight: .semibold))
            .foregroundStyle(Theme.Color.appText)
        guard required else { return base }
        return base
            + Text("  *")
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(Theme.Color.error)
    }

    private func uploadProgressText(file: UploadSlotFile, progress: Double) -> Text {
        Text("Uploading · \(file.sizeLabel) · ")
            .font(.system(size: 11))
            .foregroundStyle(Theme.Color.appTextSecondary)
            + Text("\(Int((progress * 100).rounded()))%")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Theme.Color.primary600)
    }

    private func ocrDetailText(detail: String, isWarn: Bool) -> Text {
        Text(isWarn ? UploadSlotState.differLead : UploadSlotState.matchLead)
            .font(.system(size: 11.5, weight: .semibold))
            + Text(" \(detail)")
            .font(.system(size: 11.5))
    }

    private func iconDisc(_ icon: PantopusIcon) -> some View {
        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(Theme.Color.primary50)
            .frame(width: 40, height: 40)
            .overlay { Icon(icon, size: 18, strokeWidth: 2.2, color: Theme.Color.primary600) }
    }

    @ViewBuilder
    private func thumbnail(file: UploadSlotFile) -> some View {
        switch file.kind {
        case .pdf:
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.errorBg)
                .frame(width: 40, height: 48)
                .overlay {
                    Text("PDF")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(Theme.Color.error)
                }
        case .image:
            RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                .fill(Theme.Color.primary50)
                .frame(width: 40, height: 48)
                .overlay { Icon(.image, size: 20, strokeWidth: 1.8, color: Theme.Color.primary600) }
        }
    }

    private func removeButton(icon: PantopusIcon, background: Color) -> some View {
        Button(action: onRemove) {
            Icon(icon, size: 14, color: Theme.Color.appTextSecondary)
                .frame(width: 28, height: 28)
                .background(background)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Remove \(label)")
        .accessibilityIdentifier("uploadSlot_remove_\(id)")
    }

    private func progressBar(progress: Double) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.Color.appSurfaceSunken)
                Capsule()
                    .fill(Theme.Color.primary600)
                    .frame(width: max(0, min(1, progress)) * geo.size.width)
            }
        }
        .frame(height: 4)
    }

    private func sizeAndPages(_ file: UploadSlotFile) -> String {
        guard let pages = file.pageCount else { return file.sizeLabel }
        return "\(file.sizeLabel) · \(pages) pages"
    }

    private var a11yLabel: String {
        switch state {
        case .empty:
            "\(label). Tap to upload. \(hint)"
        case let .uploading(file, progress):
            "\(label). Uploading \(file.name), \(Int((progress * 100).rounded())) percent."
        case let .done(file, detail):
            "\(label). \(file.name) uploaded. \(UploadSlotState.matchLead) \(detail)"
        case let .warn(file, detail):
            "\(label). \(file.name) uploaded. \(UploadSlotState.differLead) \(detail)"
        }
    }
}

#Preview {
    VStack(spacing: Spacing.s3) {
        UploadSlot(
            id: "ownership",
            label: "Proof of ownership",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .empty
        )
        UploadSlot(
            id: "ownership",
            label: "Proof of ownership",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .done(
                file: UploadSlotFile(name: "deed_of_trust_412elm.pdf", sizeLabel: "1.4 MB", pageCount: 8, kind: .pdf),
                detail: "\"412 Elm St\" detected on page 1."
            )
        )
        UploadSlot(
            id: "identity",
            label: "Recent utility or tax bill",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .warn(
                file: UploadSlotFile(name: "mortgage_statement.pdf", sizeLabel: "2.1 MB", pageCount: 4, kind: .pdf),
                detail: "Doc reads \"412 Elm Street\"; your account has \"412 Elm St, Apt 3B\"."
            )
        )
        UploadSlot(
            id: "identity",
            label: "Recent utility or tax bill",
            required: true,
            hint: "JPG or PNG up to 10 MB",
            state: .uploading(
                file: UploadSlotFile(name: "pge_october_bill.jpg", sizeLabel: "1.1 MB", pageCount: nil, kind: .image),
                progress: 0.62
            )
        )
    }
    .padding()
    .background(Theme.Color.appBg)
}
