//
//  PulseComposerAboutSheet.swift
//  Pantopus
//
//  "About" in the composer (Pulse S8, build spec §5): which of the reader's
//  own areas the post is in (street and neighborhood posts are for verified
//  neighbors only), a place it's about ("Crown Park"), or another town by
//  name. No device location is asked for or sent.
//

import SwiftUI

struct PulseComposerAboutSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var model: PulseComposerModel
    @State private var query = ""
    @State private var results: [PulseComposerModel.Area] = []
    @State private var searchFailed = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("A place, like Crown Park", text: $model.draft.placeName)
                        .pulseFont(.body)
                        .textInputAutocapitalization(.words)
                        .accessibilityIdentifier("pulseComposerPlaceName")
                } header: {
                    Text("PLACE").pulseFont(.overline)
                } footer: {
                    if model.draft.kind == .share {
                        Text("A share needs the place it's about.").pulseFont(.small)
                    }
                }
                Section {
                    areasList
                } header: {
                    Text("WHERE IT'S POSTED").pulseFont(.overline)
                }
                Section {
                    TextField("Search towns", text: $query)
                        .pulseFont(.body)
                        .accessibilityIdentifier("pulseComposerTownSearch")
                    ForEach(results) { town in
                        choice(town, detail: "Another town")
                    }
                    if searchFailed {
                        Text("Couldn't search towns. Try again.").pulseFont(.small)
                    }
                } header: {
                    Text("ANOTHER PLACE").pulseFont(.overline)
                }
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.accessibilityIdentifier("pulseComposerAboutDone")
                }
            }
            .task(id: query) { await search() }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder private var areasList: some View {
        switch model.areasState {
        case .loading:
            Text("Loading your areas…").pulseFont(.small)
        case .failed:
            Button("Couldn't load your areas. Try again") {
                Task { await model.loadAreas() }
            }
            .pulseFont(.button)
        case .loaded where model.areas.isEmpty:
            Text("Add a verified home to post in your own area. You can ask in any town below.").pulseFont(.small)
        case .loaded:
            ForEach(model.areas) { area in
                choice(area, detail: area.kind == "town" ? "Your town · Public or verified neighbors" : "Verified neighbors only")
            }
        }
    }

    private func choice(_ area: PulseComposerModel.Area, detail: String) -> some View {
        Button {
            if model.areas.contains(area) {
                model.choose(area: area)
            } else {
                model.choose(otherTown: area)
            }
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(area.name).pulseFont(.headline).foregroundStyle(Theme.Color.appText)
                    Text(detail).pulseFont(.small).foregroundStyle(Theme.Color.appTextSecondary)
                }
                Spacer(minLength: Spacing.s2)
                if model.area?.id == area.id {
                    Icon(.check, size: 18, color: Theme.Color.primaryInk).accessibilityHidden(true)
                }
            }
            .frame(minHeight: 44)
        }
        .accessibilityAddTraits(model.area?.id == area.id ? .isSelected : [])
        .accessibilityIdentifier("pulseComposerArea_\(area.id)")
    }

    private func search() async {
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        searchFailed = false
        guard !text.isEmpty else {
            results = []
            return
        }
        try? await Task.sleep(for: .milliseconds(300))
        guard !Task.isCancelled else { return }
        do {
            let response: PulseAreaSearchResponse = try await model.api.request(PulseEndpoints.searchAreas(query: text))
            guard !Task.isCancelled else { return }
            results = response.areas.compactMap { area in
                guard let id = area.id, area.kind == "town" else { return nil }
                return PulseComposerModel.Area(id: id, name: area.title ?? area.name ?? "", kind: "town")
            }
        } catch {
            guard !Task.isCancelled else { return }
            searchFailed = true
        }
    }
}
