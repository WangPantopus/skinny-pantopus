//
//  EdgeSheets.swift
//  Pantopus
//
//  Stream I7 (Invitee edge & customer) — the local presentation wiring for the
//  two Foundation shared sheets this stream reuses:
//   • D5 SlotTakenSheet — the 409 conflict-recovery sheet, surfaced on any
//     create/reschedule that comes back `{ error, alternatives[] }`. Reused by
//     the recurring flow (D12) when a session is taken.
//   • D8 AddToCalendarSheet — the add-to-calendar provider sheet, surfaced from
//     the hand-off (D9). The `.ics` is fetched on demand and handed to the
//     system share sheet (no EventKit permission prompt).
//
//  Both sheets are BUILT by Foundation; this file only PRESENTS them locally
//  (`.sheet(item:)`) per the wiring contract. Tokens only.
//

import SwiftUI

// MARK: - D5 · Slot-taken recovery

/// The payload that drives the 409 recovery sheet: the nearest open times and
/// the human label of the slot that was lost. Empty `alternatives` → fully
/// booked (offer the waitlist).
struct SlotConflictItem: Identifiable, Equatable {
    let id = UUID()
    let alternatives: [SchedulingSlotAlternative]
    var takenTimeLabel: String?

    /// Build from a typed `SchedulingError.slotConflict`; returns nil for any
    /// other error so callers can `if let` straight off a catch.
    init?(error: SchedulingError, takenTimeLabel: String? = nil) {
        guard case let .slotConflict(_, _, alternatives) = error else { return nil }
        self.alternatives = alternatives
        self.takenTimeLabel = takenTimeLabel
    }

    init(alternatives: [SchedulingSlotAlternative], takenTimeLabel: String? = nil) {
        self.alternatives = alternatives
        self.takenTimeLabel = takenTimeLabel
    }
}

private struct SlotTakenSheetModifier: ViewModifier {
    @Binding var item: SlotConflictItem?
    let tz: String
    let accent: Color
    let onSelect: (SchedulingSlotAlternative) -> Void
    let onPickAnother: () -> Void
    let onJoinWaitlist: (() -> Void)?

    func body(content: Content) -> some View {
        content.sheet(item: $item) { conflict in
            SlotTakenSheet(
                mode: conflict.alternatives.isEmpty ? .fullyBooked : .alternatives,
                alternatives: conflict.alternatives,
                takenTimeLabel: conflict.takenTimeLabel,
                timeZoneIdentifier: tz,
                accent: accent,
                onSelect: { alt in
                    item = nil
                    onSelect(alt)
                },
                onPickAnotherTime: {
                    item = nil
                    onPickAnother()
                },
                onJoinWaitlist: onJoinWaitlist.map { join in { item = nil
                    join()
                }
                }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }
}

extension View {
    /// Present the Foundation `SlotTakenSheet` when `item` is non-nil (a 409
    /// recovery). Never a dead end: it surfaces nearest times or the waitlist.
    func slotTakenSheet(
        item: Binding<SlotConflictItem?>,
        tz: String,
        accent: Color = Theme.Color.primary600,
        onSelect: @escaping (SchedulingSlotAlternative) -> Void,
        onPickAnother: @escaping () -> Void,
        onJoinWaitlist: (() -> Void)? = nil
    ) -> some View {
        modifier(SlotTakenSheetModifier(
            item: item,
            tz: tz,
            accent: accent,
            onSelect: onSelect,
            onPickAnother: onPickAnother,
            onJoinWaitlist: onJoinWaitlist
        ))
    }
}

// MARK: - D8 · Add to calendar

/// Drives the add-to-calendar sheet: the booking's manage token (used to fetch
/// the `.ics`), a one-line recap, and the optional web provider URLs the host
/// surfaces ("opens in your browser").
struct AddToCalendarItem: Identifiable, Equatable {
    let id = UUID()
    let token: String
    let eventRecap: String
    var googleURL: String?
    var outlookURL: String?
}

private struct AddToCalendarSheetModifier: ViewModifier {
    @Binding var item: AddToCalendarItem?
    @Environment(\.openURL) private var openURL

    func body(content: Content) -> some View {
        content.sheet(item: $item) { payload in
            AddToCalendarSheet(
                viewModel: AddToCalendarViewModel(manageToken: payload.token, client: .shared),
                eventRecap: payload.eventRecap,
                onAppleCalendar: { addToApple(token: payload.token) },
                onGoogle: { open(payload.googleURL) },
                onOutlook: { open(payload.outlookURL) },
                onICSReady: { data in EdgeShare.presentICS(data) },
                onDone: { item = nil }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
    }

    /// Apple Calendar: download the `.ics` and hand it to the system share sheet,
    /// which offers "Add to Calendar" without an EventKit permission prompt.
    private func addToApple(token: String) {
        Task { @MainActor in
            if let data = try? await APIClient.shared.requestData(SchedulingPublicEndpoints.ics(token: token)) {
                EdgeShare.presentICS(data)
            }
        }
    }

    private func open(_ urlString: String?) {
        guard let urlString, let url = URL(string: urlString) else { return }
        openURL(url)
    }
}

extension View {
    /// Present the Foundation `AddToCalendarSheet` when `item` is non-nil.
    func addToCalendarSheet(item: Binding<AddToCalendarItem?>) -> some View {
        modifier(AddToCalendarSheetModifier(item: item))
    }
}
