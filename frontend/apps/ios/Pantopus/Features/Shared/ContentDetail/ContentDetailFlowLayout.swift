//
//  ContentDetailFlowLayout.swift
//  Pantopus
//
//  Shared wrapping `Layout` for the Content Detail archetype's chip / tag
//  rows. `TransactionalDetailShell` and `StatsTabsBody` each keep a private
//  copy for their own files; the archetype's body / header slots share this
//  one so `ArticleBody` and `BusinessHeader` don't each re-declare it.
//

import SwiftUI

/// Naive flow layout — places children left-to-right and wraps to the next
/// row when they overflow the proposed width. Used for the article tag row
/// and the business header chip row.
struct ContentDetailFlowLayout: Layout {
    let spacing: CGFloat

    init(spacing: CGFloat = Spacing.s2) {
        self.spacing = spacing
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth {
                x = 0
                y += lineHeight + spacing
                lineHeight = 0
            }
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(width: maxWidth, height: y + lineHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal _: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var lineHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX {
                x = bounds.minX
                y += lineHeight + spacing
                lineHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}
