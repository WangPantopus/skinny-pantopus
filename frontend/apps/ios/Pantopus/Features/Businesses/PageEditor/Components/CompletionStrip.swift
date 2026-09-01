//
//  CompletionStrip.swift
//  Pantopus
//
//  P4.2 — A13.10 Edit Business Page. Setup-mode strip that replaces
//  `EditBusinessIdentityStrip`. Renders a violet progress meter with
//  per-section completion chips below.
//

import SwiftUI

/// Setup-mode strip with violet background, a progress meter, and a
/// chip row showing which sections are filled vs pending. Renders
/// flush under the top bar.
@MainActor
public struct EditBusinessCompletionStrip: View {
    private let done: Int
    private let total: Int
    private let items: [EditBusinessPageSetupItem]

    public init(done: Int, total: Int, items: [EditBusinessPageSetupItem]) {
        self.done = done
        self.total = total
        self.items = items
    }

    private var pct: Double {
        guard total > 0 else { return 0 }
        return Double(done) / Double(total)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .fill(Theme.Color.business)
                        .frame(width: 18, height: 18)
                    Icon(.building2, size: 10, color: Theme.Color.appTextInverse)
                }
                Text("Setup · \(done) of \(total)")
                    .font(.system(size: PantopusTextStyle.caption.size, weight: .bold))
                    .foregroundStyle(Theme.Color.businessDark)
                Spacer(minLength: Spacing.s2)
                Text("\(Int((pct * 100).rounded()))%")
                    .font(.system(size: PantopusTextStyle.caption.size - 1, weight: .bold).monospacedDigit())
                    .foregroundStyle(Theme.Color.businessDark)
            }

            // Progress bar.
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(Theme.Color.appSurface)
                    RoundedRectangle(cornerRadius: 3, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [Theme.Color.business, Theme.Color.businessDark],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(0, proxy.size.width * pct))
                }
            }
            .frame(height: 6)

            // Chip row.
            EditBusinessFlowLayout(spacing: 4) {
                ForEach(items) { item in
                    ChipPill(item: item)
                }
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.top, Spacing.s3)
        .padding(.bottom, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.businessBg)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Theme.Color.business.opacity(0.18))
                .frame(height: 1)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Setup progress, \(done) of \(total) sections complete")
        .accessibilityIdentifier("editBusinessPage.completionStrip")
    }
}

private struct ChipPill: View {
    let item: EditBusinessPageSetupItem

    var body: some View {
        HStack(spacing: 3) {
            Icon(
                item.done ? .check : .circle,
                size: 9,
                strokeWidth: 3,
                color: item.done ? Theme.Color.success : Theme.Color.appTextSecondary
            )
            Text(item.label)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(item.done ? Theme.Color.success : Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 2)
        .background(item.done ? Theme.Color.successBg : Theme.Color.appSurface)
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(
                    item.done ? Theme.Color.successLight : Theme.Color.appBorder,
                    lineWidth: 1
                )
        )
        .accessibilityLabel("\(item.label), \(item.done ? "done" : "pending")")
    }
}

/// Minimal flow layout — wraps children left-to-right onto multiple
/// rows. Used by the completion strip chip cluster and the services
/// chip cluster in the body. Avoids adding a new dependency for one
/// screen of usage.
struct EditBusinessFlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout Void) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowCount = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth + size.width > maxWidth, rowCount > 0 {
                totalHeight += rowHeight + spacing
                totalWidth = max(totalWidth, rowWidth - spacing)
                rowWidth = 0
                rowHeight = 0
                rowCount = 0
            }
            rowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            rowCount += 1
        }
        totalHeight += rowHeight
        totalWidth = max(totalWidth, rowWidth - spacing)
        let finalWidth = proposal.width ?? totalWidth
        return CGSize(width: finalWidth, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal _: ProposedViewSize,
        subviews: Subviews,
        cache _: inout Void
    ) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: x, y: y),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

#Preview {
    EditBusinessCompletionStrip(
        done: 3,
        total: 7,
        items: [
            .init(id: "name", label: "Name", done: true),
            .init(id: "contact", label: "Contact", done: true),
            .init(id: "location", label: "Location", done: true),
            .init(id: "banner", label: "Banner", done: false),
            .init(id: "desc", label: "Description", done: false),
            .init(id: "hours", label: "Hours", done: false),
            .init(id: "services", label: "Services", done: false)
        ]
    )
}
