//
//  PlaceMoneyCheckCard.swift
//  Pantopus
//
//  The Home Money Check's cards on Place's money page.
//

import SwiftUI

/// One card of the Home Money Check, drawn from the server's words: a title
/// and chip, a lead line, rows, notes and one action. A new check needs no
/// change here.
struct PlaceMoneyCheckCard: View {
    let card: PlaceMoneyCard

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text(card.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Spacer(minLength: 0)
                    if let chip = card.chip {
                        PlaceChip(model: PlaceChipModel(tone: tone(chip.tone), text: chip.text))
                    }
                }
                if let lead = card.lead {
                    Text(lead)
                        .font(.system(size: 13.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if !card.rows.isEmpty {
                    VStack(spacing: 7) {
                        ForEach(card.rows) { row in
                            HStack(alignment: .firstTextBaseline, spacing: 12) {
                                Text(row.label)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                Spacer(minLength: 0)
                                Text(row.value)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Theme.Color.appText)
                                    .multilineTextAlignment(.trailing)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: Radii.sm))
                }
                ForEach(card.notes, id: \.self) { note in
                    Text(note)
                        .font(.system(size: 12.5))
                        .lineSpacing(2)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                if let action = card.action, let url = destination(action.url) {
                    Link(destination: url) {
                        HStack(spacing: 4) {
                            Text(action.label)
                                .font(.system(size: 13, weight: .semibold))
                            Icon(.externalLink, size: 12, strokeWidth: 2, color: Theme.Color.primaryInk)
                        }
                        .foregroundStyle(Theme.Color.primaryInk)
                    }
                    .accessibilityIdentifier("place.money.card.\(card.id).action")
                }
            }
        }
        .accessibilityIdentifier("place.money.card.\(card.id)")
    }

    private func tone(_ name: String) -> PlaceChipModel.Tone {
        switch name {
        case "warning": .warning
        case "success": .success
        default: .neutral
        }
    }

    /// An https page as it is; an app link in the words notifications use ("/place?section=money"), which opens
    /// as this app's own link and so lands on the same screen a notification would. Nothing else opens.
    private func destination(_ raw: String) -> URL? {
        if raw.hasPrefix("https://") { return URL(string: raw) }
        guard raw.hasPrefix("/"), !raw.hasPrefix("//") else { return nil }
        return URL(string: "pantopus:/" + raw)
    }
}
