//
//  ReinventedEchoes.swift
//  Pantopus
//
//  "Pulse, reinvented" phase 4, Echoes and curiosity twins (PHASE-4 piece 6; CONTRACT 9e; the founder's decision 11),
//  as the web's (`Echoes.tsx`), in My Atlas. Four rules: opt-in, public places only, never at home, and names show only
//  when both people say yes. The choice is the person's own: off (the default: nothing about them is matched and they
//  see none), on (others see them only as a count), or names (their first name may show to someone who also chose
//  names). "You and 2 others caught tonight's sunset at Lacamas Lake." Nothing says which Moment of theirs, where
//  exactly or when exactly.
//

import Observation
import SwiftUI

struct ReinventedEchoesDTO: Decodable {
    struct Line: Decodable, Identifiable {
        let line: String
        let momentId: String?
        /// The first names of others who also chose names (CONTRACT 9e: only when both people said yes); often none.
        let names: [String]
        var id: String {
            (momentId ?? "") + line
        }

        /// "With Maya", "With Maya and Sam", "With Maya, Sam and Lee"; nil when the server sends no names.
        var withNames: String? {
            let shown = names.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            guard let last = shown.last else { return nil }
            let rest = shown.dropLast()
            return rest.isEmpty ? "With \(last)" : "With \(rest.joined(separator: ", ")) and \(last)"
        }

        private enum CodingKeys: String, CodingKey {
            case line, names
            case momentId = "moment_id"
        }

        init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            line = try c.decode(String.self, forKey: .line)
            momentId = try c.decodeIfPresent(String.self, forKey: .momentId)
            names = (try? c.decodeIfPresent([String].self, forKey: .names)) ?? []
        }
    }

    let echoes: [Line]
    let twins: [Line]

    private enum CodingKeys: String, CodingKey {
        case echoes, twins
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        echoes = (try? c.decodeIfPresent(LossyList<Line>.self, forKey: .echoes))?.items ?? []
        twins = (try? c.decodeIfPresent(LossyList<Line>.self, forKey: .twins))?.items ?? []
    }
}

private struct ReinventedEchoesChoiceDTO: Decodable {
    let echoes: String?
}

private struct ReinventedEchoesChoiceBody: Encodable {
    let echoes: String
}

private extension ReinventedEndpoints {
    static var echoes: Endpoint {
        Endpoint(method: .get, path: "/api/reinvented/echoes", cachePolicy: .reloadIgnoringLocalCacheData)
    }

    static func setEchoes(_ choice: String) -> Endpoint {
        Endpoint(method: .patch, path: "/api/reinvented/settings", body: ReinventedEchoesChoiceBody(echoes: choice))
    }
}

/// Echoes in My Atlas: the choice, and today's echoes and twins once the person takes part.
struct ReinventedEchoes: View {
    /// `off`, `on` or `names`; nil until read.
    @State private var choice: String?
    @State private var found: ReinventedEchoesDTO?
    @State private var saving = false

    var body: some View {
        // A stack, not a Group: with nothing in it yet a Group never appears, so its task would never read.
        VStack(alignment: .leading, spacing: 0) {
            if let choice {
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Toggle(isOn: Binding(get: { choice != "off" }, set: { set($0 ? "on" : "off") })) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Echoes: tell me when others caught the same moment")
                                .pulseFont(14, weight: .semibold)
                                .foregroundStyle(Theme.Color.appText)
                            Text("Only at public places, never at home. Others see you as a count.")
                                .pulseFont(12)
                                .foregroundStyle(Theme.Color.appTextSecondary)
                        }
                    }
                    .accessibilityIdentifier("reinventedEchoes.on")
                    if choice != "off" {
                        Toggle(isOn: Binding(get: { choice == "names" }, set: { set($0 ? "names" : "on") })) {
                            Text("Show my first name to others who show theirs")
                                .pulseFont(14)
                                .foregroundStyle(Theme.Color.appText)
                        }
                        .accessibilityIdentifier("reinventedEchoes.names")
                        lines
                    }
                }
                .disabled(saving)
                .accessibilityIdentifier("reinventedEchoes")
            }
        }
        .task { await read() }
    }

    @ViewBuilder private var lines: some View {
        if let found, !(found.echoes.isEmpty && found.twins.isEmpty) {
            ForEach(found.echoes + found.twins) { line in
                Button {
                    if let id = line.momentId { DeepLinkRouter.shared.handle(path: "/moments/\(id)") }
                } label: {
                    HStack(spacing: Spacing.s2) {
                        Icon(line.momentId == nil ? .leaf : .sparkles, size: 15, strokeWidth: 2.2, color: Theme.Color.primaryTint)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(line.line)
                                .pulseFont(14)
                                .foregroundStyle(Theme.Color.appText)
                                .multilineTextAlignment(.leading)
                            // Names only when the server sends them (both people chose names).
                            if let withNames = line.withNames {
                                Text(withNames)
                                    .pulseFont(13, weight: .medium)
                                    .foregroundStyle(Theme.Color.appTextSecondary)
                                    .multilineTextAlignment(.leading)
                            }
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurface))
                }
                .buttonStyle(.plain)
                .disabled(line.momentId == nil)
            }
        } else if found != nil {
            Text("No echoes today yet.")
                .pulseFont(13)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
    }

    private func read() async {
        guard let settings: ReinventedEchoesChoiceDTO = try? await APIClient.shared.request(StudioPlayEndpoints.settings) else { return }
        choice = settings.echoes ?? "off"
        if choice != "off" { found = try? await APIClient.shared.request(ReinventedEndpoints.echoes) }
    }

    private func set(_ next: String) {
        saving = true
        Task {
            _ = try? await APIClient.shared.request(ReinventedEndpoints.setEchoes(next), as: EmptyResponse.self)
            await read()
            saving = false
        }
    }
}
