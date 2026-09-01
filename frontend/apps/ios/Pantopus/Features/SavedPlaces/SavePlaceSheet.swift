//
//  SavePlaceSheet.swift
//  Pantopus
//
//  BLOCK 2E — the save/unsave affordance. Three pieces:
//    • `SaveBookmarkButton` — the bookmark toggle on Explore/Discover rows +
//      place detail (Frame 6): outline when not saved, filled when saved.
//    • `SavePlaceSheet` — the Save-place bottom sheet (Frame 7): a prefilled
//      Name field + a Home / Work / Other chooser + Save.
//    • `SavedPlacesStore` — a small @Observable cache the host (Explore) holds
//      so a place's saved-state reflects immediately and toggles wire to
//      `/api/saved-places` (POST upsert / DELETE with Undo).
//

import SwiftUI

// MARK: - Bookmark toggle (Frame 6)

/// The bookmark save toggle. Outline glyph when not saved, filled primary
/// disc when saved. Reflects state optimistically; the tap is handed up.
public struct SaveBookmarkButton: View {
    private let isSaved: Bool
    private let size: CGFloat
    private let onToggle: @MainActor () -> Void

    public init(isSaved: Bool, size: CGFloat = 34, onToggle: @escaping @MainActor () -> Void) {
        self.isSaved = isSaved
        self.size = size
        self.onToggle = onToggle
    }

    public var body: some View {
        Button(action: onToggle) {
            ZStack {
                Circle().fill(isSaved ? Theme.Color.primary600 : Theme.Color.appSurfaceSunken)
                Icon(
                    .bookmark,
                    size: size * 0.48,
                    strokeWidth: isSaved ? 2.4 : 2.0,
                    color: isSaved ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary
                )
            }
            .frame(width: size, height: size)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSaved ? "Saved" : "Save")
        .accessibilityIdentifier("savePlace.bookmarkToggle")
    }
}

// MARK: - Pending save payload

/// Seed for the Save-place sheet — the place the user is about to save,
/// prefilled from the row / detail it was triggered from.
public struct PendingSavePlace: Identifiable, Sendable, Hashable {
    public let id = UUID()
    public let label: String
    public let latitude: Double
    public let longitude: Double
    public let city: String?
    public let state: String?
    public let geocodePlaceId: String?
    public let sourceId: String?

    public init(
        label: String,
        latitude: Double,
        longitude: Double,
        city: String? = nil,
        state: String? = nil,
        geocodePlaceId: String? = nil,
        sourceId: String? = nil
    ) {
        self.label = label
        self.latitude = latitude
        self.longitude = longitude
        self.city = city
        self.state = state
        self.geocodePlaceId = geocodePlaceId
        self.sourceId = sourceId
    }
}

// MARK: - Save-place sheet (Frame 7)

public struct SavePlaceSheet: View {
    private let pending: PendingSavePlace
    private let onSave: @MainActor (_ label: String, _ choice: SavePlaceTypeChoice) -> Void
    private let onClose: @MainActor () -> Void

    @State private var name: String
    @State private var choice: SavePlaceTypeChoice = .other
    @FocusState private var nameFocused: Bool

    public init(
        pending: PendingSavePlace,
        onSave: @escaping @MainActor (String, SavePlaceTypeChoice) -> Void,
        onClose: @escaping @MainActor () -> Void
    ) {
        self.pending = pending
        self.onSave = onSave
        self.onClose = onClose
        _name = State(initialValue: pending.label)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            header
            nameField
            typePicker
            saveButton
            Spacer(minLength: 0)
        }
        .padding(.horizontal, Spacing.s5)
        .padding(.top, Spacing.s4)
        .padding(.bottom, Spacing.s5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .presentationDetents([.height(420)])
        .presentationDragIndicator(.visible)
        .accessibilityIdentifier("savePlace.sheet")
    }

    private var header: some View {
        HStack {
            Text("Save place")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
            Spacer()
            Button(action: onClose) {
                Icon(.x, size: 18, color: Theme.Color.appTextSecondary)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("savePlace.close")
        }
    }

    private var nameField: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Name")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s2) {
                TextField("Name this place", text: $name)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Theme.Color.appText)
                    .focused($nameFocused)
                    .submitLabel(.done)
                    .accessibilityIdentifier("savePlace.nameField")
                Icon(.pencil, size: 15, color: Theme.Color.appTextMuted)
            }
            .padding(.horizontal, Spacing.s3)
            .frame(height: 46)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.appSurfaceSunken))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(nameFocused ? Theme.Color.primary300 : Theme.Color.appBorder, lineWidth: 1)
            )
        }
    }

    private var typePicker: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Type")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Theme.Color.appTextSecondary)
            HStack(spacing: Spacing.s3) {
                ForEach(SavePlaceTypeChoice.allCases) { option in
                    typeOption(option)
                }
            }
        }
    }

    private func typeOption(_ option: SavePlaceTypeChoice) -> some View {
        let active = option == choice
        return Button { choice = option } label: {
            VStack(spacing: Spacing.s2) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .fill(option.tileBackground)
                    Icon(option.icon, size: 18, color: option.tileForeground)
                }
                .frame(width: 44, height: 44)
                Text(option.label)
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(active ? Theme.Color.appText : Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .fill(active ? Theme.Color.primary50 : Theme.Color.appSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .stroke(active ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: active ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(option.accessibilityID)
    }

    private var saveButton: some View {
        Button {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            onSave(trimmed.isEmpty ? pending.label : trimmed, choice)
        } label: {
            HStack(spacing: Spacing.s2) {
                Icon(.bookmark, size: 17, strokeWidth: 2.4, color: Theme.Color.appTextInverse)
                Text("Save")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).fill(Theme.Color.primary600))
        }
        .buttonStyle(.plain)
        .padding(.top, Spacing.s1)
        .accessibilityIdentifier("savePlace.saveBtn")
    }
}

// MARK: - Saved-places store (Explore integration)

/// A small cache the Explore host holds so a place's saved-state reflects
/// immediately. Mutations are optimistic and wire to `/api/saved-places`.
@Observable
@MainActor
public final class SavedPlacesStore {
    public private(set) var saved: [SavedPlaceDTO] = []

    /// Bound to the host's `.sheet(item:)` — the place pending a Save.
    public var pendingSave: PendingSavePlace?
    /// Bound to the host's Undo snackbar after an un-save.
    public var undo: SavedPlaceUndo?
    /// Transient error banner.
    public var toast: ToastMessage?

    private let api: APIClient
    private var loaded = false

    public init() {
        api = .shared
    }

    init(api: APIClient) {
        self.api = api
    }

    // MARK: Loading

    public func loadIfNeeded() async {
        guard !loaded else { return }
        await reload()
    }

    public func reload() async {
        do {
            let response: SavedPlacesListResponse = try await api.request(SavedPlacesEndpoints.list())
            saved = response.savedPlaces
            loaded = true
        } catch {
            // A failed background load just leaves toggles in their unsaved
            // default — the dedicated Saved-places screen surfaces the error.
        }
    }

    // MARK: Matching ("saved if it matches by geocode_place_id, else lat/lng")

    private static func matchKey(geocodePlaceId: String?, latitude: Double, longitude: Double) -> String {
        if let gid = geocodePlaceId, !gid.isEmpty { return "gid:\(gid)" }
        return String(format: "ll:%.5f,%.5f", latitude, longitude)
    }

    public func savedId(geocodePlaceId: String?, latitude: Double, longitude: Double) -> String? {
        let key = Self.matchKey(geocodePlaceId: geocodePlaceId, latitude: latitude, longitude: longitude)
        return saved.first { dto in
            Self.matchKey(geocodePlaceId: dto.geocodePlaceId, latitude: dto.latitude, longitude: dto.longitude) == key
        }?.id
    }

    public func isSaved(geocodePlaceId: String?, latitude: Double, longitude: Double) -> Bool {
        savedId(geocodePlaceId: geocodePlaceId, latitude: latitude, longitude: longitude) != nil
    }

    // MARK: Toggle

    /// Tapping the bookmark: saved → un-save (DELETE + Undo); not saved →
    /// open the Save sheet prefilled.
    public func toggle(_ pending: PendingSavePlace) {
        if let id = savedId(
            geocodePlaceId: pending.geocodePlaceId,
            latitude: pending.latitude,
            longitude: pending.longitude
        ) {
            Task { await remove(id: id) }
        } else {
            pendingSave = pending
        }
    }

    /// Commit the Save sheet — POST then optimistically insert the echo.
    public func commitSave(label: String, choice: SavePlaceTypeChoice) async {
        guard let pending = pendingSave else { return }
        pendingSave = nil
        let body = SavePlaceBody(
            label: label,
            placeType: choice.wire,
            latitude: pending.latitude,
            longitude: pending.longitude,
            city: pending.city,
            state: pending.state,
            geocodePlaceId: pending.geocodePlaceId,
            sourceId: pending.sourceId
        )
        // Optimistic insert so the toggle fills immediately.
        let optimistic = SavedPlaceDTO(
            id: "optimistic-\(pending.id.uuidString)",
            label: label,
            placeType: choice.wire,
            latitude: pending.latitude,
            longitude: pending.longitude,
            city: pending.city,
            state: pending.state,
            sourceId: pending.sourceId,
            geocodePlaceId: pending.geocodePlaceId,
            createdAt: nil
        )
        saved.append(optimistic)
        do {
            let response = try await api.request(
                SavedPlacesEndpoints.save(body),
                as: SavedPlaceResponse.self
            )
            if let i = saved.firstIndex(where: { $0.id == optimistic.id }) {
                saved[i] = response.savedPlace
            }
        } catch {
            saved.removeAll { $0.id == optimistic.id }
            toast = ToastMessage(text: "Couldn\u{2019}t save \(label).", kind: .error)
        }
    }

    /// Un-save — optimistic removal + DELETE, with an Undo that re-POSTs.
    public func remove(id: String) async {
        guard let index = saved.firstIndex(where: { $0.id == id }) else { return }
        let removed = saved[index]
        saved.remove(at: index)
        undo = SavedPlaceUndo(dto: removed, index: index)
        do {
            try await api.request(SavedPlacesEndpoints.remove(id: id))
        } catch {
            saved.insert(removed, at: min(index, saved.count))
            undo = nil
            toast = ToastMessage(text: "Couldn\u{2019}t remove \(removed.label).", kind: .error)
        }
    }

    public func undoRemove() async {
        guard let snapshot = undo else { return }
        undo = nil
        let dto = snapshot.dto
        saved.insert(dto, at: min(snapshot.index, saved.count))
        do {
            let response = try await api.request(
                SavedPlacesEndpoints.save(SavePlaceBody(from: dto)),
                as: SavedPlaceResponse.self
            )
            if let i = saved.firstIndex(where: { $0.id == dto.id }) {
                saved[i] = response.savedPlace
            }
        } catch {
            saved.removeAll { $0.id == dto.id }
            toast = ToastMessage(text: "Couldn\u{2019}t restore \(dto.label).", kind: .error)
        }
    }

    public func dismissUndo() {
        undo = nil
    }
}

#if DEBUG
#Preview("Save sheet") {
    Color.black.opacity(0.2)
        .sheet(isPresented: .constant(true)) {
            SavePlaceSheet(
                pending: PendingSavePlace(
                    label: "Blue Bottle Coffee",
                    latitude: 45.5152,
                    longitude: -122.6784,
                    city: "Portland",
                    state: "OR"
                ),
                onSave: { _, _ in },
                onClose: {}
            )
        }
}
#endif
