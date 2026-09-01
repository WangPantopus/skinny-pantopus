//
//  EmergencyCardPDF.swift
//  Pantopus
//
//  P6.6 — Renders an A4 PDF of a home's emergency card for the
//  "Print emergency card" action. `content(from:)` is a pure projection so
//  the grouping/ordering is unit-tested without a graphics context;
//  `render(_:)` draws the page and returns a temp-file URL the share sheet
//  can hand to AirPrint / Files / Mail.
//
//  Geometry is expressed in PDF points (A4 = 595.2 × 841.8 pt) — this is
//  the PDF coordinate space, not on-screen layout, so the design-token
//  scale does not apply here.
//

import Foundation
import UIKit

/// Print-ready, view-agnostic representation of a home's emergency card.
public struct EmergencyCardContent: Sendable, Equatable {
    public struct Item: Sendable, Equatable {
        public let title: String
        public let detail: String

        public init(title: String, detail: String) {
            self.title = title
            self.detail = detail
        }
    }

    public struct Section: Sendable, Equatable {
        public let heading: String
        public let items: [Item]

        public init(heading: String, items: [Item]) {
            self.heading = heading
            self.items = items
        }
    }

    public let homeLabel: String
    public let generatedLabel: String
    public let sections: [Section]

    public init(homeLabel: String, generatedLabel: String, sections: [Section]) {
        self.homeLabel = homeLabel
        self.generatedLabel = generatedLabel
        self.sections = sections
    }

    public var isEmpty: Bool {
        sections.allSatisfy(\.items.isEmpty)
    }
}

public enum EmergencyCardPDF {
    /// Build the printable card from the loaded emergency rows. Pinned rows
    /// surface in their own leading group; the rest are grouped by category
    /// in the screen's canonical order (shutoff → contact → evac → medical).
    public static func content(
        from emergencies: [HomeEmergencyDTO],
        homeLabel: String,
        now: Date = Date()
    ) -> EmergencyCardContent {
        let order: [EmergencyCategory] = [.shutoff, .contact, .evac, .medical]

        func item(for dto: HomeEmergencyDTO) -> EmergencyCardContent.Item {
            let projection = EmergencyInfoViewModel.project(dto: dto, pinned: false)
            return EmergencyCardContent.Item(title: projection.title, detail: projection.body)
        }

        var sections: [EmergencyCardContent.Section] = []

        let pinned = emergencies.filter { $0.details["pinned"] == "1" }
        if !pinned.isEmpty {
            sections.append(EmergencyCardContent.Section(
                heading: "Pinned · Quick access",
                items: pinned.map(item(for:))
            ))
        }

        for category in order {
            let rows = emergencies.filter { EmergencyCategory.from(type: $0.type) == category }
            guard !rows.isEmpty else { continue }
            sections.append(EmergencyCardContent.Section(
                heading: category.label,
                items: rows.map(item(for:))
            ))
        }

        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .short

        return EmergencyCardContent(
            homeLabel: homeLabel,
            generatedLabel: "Generated \(formatter.string(from: now))",
            sections: sections
        )
    }

    /// Render the card to an A4 PDF written to the temp directory. Returns
    /// `nil` when there is nothing to print.
    @MainActor
    public static func render(_ content: EmergencyCardContent) -> URL? {
        guard !content.isEmpty else { return nil }

        let pageWidth: CGFloat = 595.2
        let pageHeight: CGFloat = 841.8
        let margin: CGFloat = 48
        let contentWidth = pageWidth - margin * 2
        let pageRect = CGRect(x: 0, y: 0, width: pageWidth, height: pageHeight)

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 26, weight: .bold),
            .foregroundColor: UIColor.label
        ]
        let kickerAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .bold),
            .foregroundColor: UIColor.systemGreen
        ]
        let metaAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 11, weight: .regular),
            .foregroundColor: UIColor.secondaryLabel
        ]
        let headingAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 14, weight: .semibold),
            .foregroundColor: UIColor.systemGreen
        ]
        let itemTitleAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 13, weight: .semibold),
            .foregroundColor: UIColor.label
        ]
        let itemDetailAttrs: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 12, weight: .regular),
            .foregroundColor: UIColor.secondaryLabel
        ]

        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("emergency-card-\(UUID().uuidString.prefix(8)).pdf")

        do {
            try renderer.writePDF(to: url) { ctx in
                ctx.beginPage()
                var cursorY = margin

                func newPageIfNeeded(_ needed: CGFloat) {
                    if cursorY + needed > pageHeight - margin {
                        ctx.beginPage()
                        cursorY = margin
                    }
                }

                func draw(_ text: String, _ attrs: [NSAttributedString.Key: Any], spacingAfter: CGFloat) {
                    let bounding = CGSize(width: contentWidth, height: .greatestFiniteMagnitude)
                    let rect = (text as NSString).boundingRect(
                        with: bounding,
                        options: [.usesLineFragmentOrigin, .usesFontLeading],
                        attributes: attrs,
                        context: nil
                    )
                    newPageIfNeeded(rect.height)
                    (text as NSString).draw(
                        in: CGRect(x: margin, y: cursorY, width: contentWidth, height: rect.height),
                        withAttributes: attrs
                    )
                    cursorY += rect.height + spacingAfter
                }

                draw("PANTOPUS · EMERGENCY CARD", kickerAttrs, spacingAfter: 6)
                draw(content.homeLabel, titleAttrs, spacingAfter: 4)
                draw(content.generatedLabel, metaAttrs, spacingAfter: 22)

                for section in content.sections where !section.items.isEmpty {
                    draw(section.heading.uppercased(), headingAttrs, spacingAfter: 8)
                    for item in section.items {
                        draw(item.title, itemTitleAttrs, spacingAfter: 2)
                        if !item.detail.isEmpty {
                            draw(item.detail, itemDetailAttrs, spacingAfter: 10)
                        } else {
                            cursorY += 8
                        }
                    }
                    cursorY += 12
                }
            }
            return url
        } catch {
            return nil
        }
    }
}
