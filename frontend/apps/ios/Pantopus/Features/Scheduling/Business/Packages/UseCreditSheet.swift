//
//  UseCreditSheet.swift
//  Pantopus
//
//  Stream I15 — local sheet hung off My Packages (G11). Lists the buyer's
//  eligible upcoming bookings (`GET /my-bookings`) and applies a package credit
//  to one (`POST /bookings/:id/apply-credit`), honestly handling the
//  ALREADY_APPLIED / CREDIT_NOT_APPLICABLE 409 guards. No route/stub — presented
//  locally from My Packages.
//

import Observation
import SwiftUI

@Observable
@MainActor
final class UseCreditViewModel {
    enum Phase: Equatable { case loading, loaded, empty, error(String) }

    let credit: PackageCreditDTO
    private let client: SchedulingClient

    private(set) var phase: Phase = .loading
    private(set) var bookings: [BookingDTO] = []
    private(set) var applyingId: String?
    private(set) var conflictMessage: String?

    init(credit: PackageCreditDTO, client: SchedulingClient) {
        self.credit = credit
        self.client = client
    }

    func load() async {
        phase = .loading
        do {
            let result: BookingsResponse = try await client.request(SchedulingEndpoints.getMyBookings())
            bookings = result.bookings.filter(isEligible)
            phase = bookings.isEmpty ? .empty : .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your bookings.")
        } catch {
            phase = .error("Couldn't load your bookings.")
        }
    }

    /// Upcoming, uncredited, unpaid bookings matching the credit's event type
    /// (or any service when the package isn't event-type scoped).
    private func isEligible(_ booking: BookingDTO) -> Bool {
        let status = SchedulingPillStatus(backend: booking.status)
        guard status == .pending || status == .confirmed else { return false }
        guard booking.packageCreditId == nil, booking.paymentId == nil else { return false }
        if let creditEventType = credit.bookingPackage?.eventTypeId, booking.eventTypeId != creditEventType { return false }
        if let start = booking.startAt, let date = SchedulingTime.parseUTC(start), date < Date() { return false }
        return true
    }

    func apply(_ booking: BookingDTO, onApplied: @escaping () async -> Void) async {
        conflictMessage = nil
        applyingId = booking.id
        defer { applyingId = nil }
        do {
            let _: ApplyCreditResponse = try await client.request(
                SchedulingEndpoints.applyCredit(bookingId: booking.id, ApplyCreditRequest(creditId: credit.id))
            )
            await onApplied()
        } catch let error as SchedulingError {
            switch error.code {
            case "ALREADY_APPLIED":
                conflictMessage = "A credit is already applied to that booking."
            case "CREDIT_NOT_APPLICABLE":
                conflictMessage = "This credit can't be used on that booking."
            default:
                conflictMessage = error.userMessage ?? "Couldn't apply the credit. Try another booking."
            }
        } catch {
            conflictMessage = "Couldn't apply the credit. Try another booking."
        }
    }

    func dateLabel(_ booking: BookingDTO) -> String {
        guard let start = booking.startAt else { return "Upcoming" }
        return SchedulingTime.localString(utcISO: start, tz: SchedulingTime.deviceTimeZoneIdentifier) ?? "Upcoming"
    }
}

struct UseCreditSheet: View {
    @State private var model: UseCreditViewModel
    let onApplied: () async -> Void
    @Environment(\.dismiss) private var dismiss

    init(credit: PackageCreditDTO, client: SchedulingClient = .shared, onApplied: @escaping () async -> Void) {
        _model = State(wrappedValue: UseCreditViewModel(credit: credit, client: client))
        self.onApplied = onApplied
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            header
            content
        }
        .background(Theme.Color.appBg)
        .task { await model.load() }
        .accessibilityIdentifier("scheduling.useCredit")
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Use a credit").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.Color.appText)
                Text("Apply 1 credit to an upcoming booking")
                    .font(.system(size: 11.5)).foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer()
            Button { dismiss() } label: {
                Icon(.x, size: 18, color: Theme.Color.appTextSecondary).frame(width: 32, height: 32)
            }
            .accessibilityLabel("Close")
        }
        .padding(.horizontal, Spacing.s4).padding(.top, Spacing.s4).padding(.bottom, Spacing.s2)
    }

    @ViewBuilder
    private var content: some View {
        switch model.phase {
        case .loading:
            VStack(spacing: Spacing.s3) {
                ForEach(0..<3, id: \.self) { _ in Shimmer(height: 56, cornerRadius: Radii.lg) }
                Spacer()
            }
            .padding(Spacing.s4)
        case .empty:
            EmptyState(
                icon: .calendar,
                headline: "No eligible bookings",
                subcopy: "You can apply this credit to an upcoming, unpaid booking for this service.",
                tint: Theme.Color.appSurfaceSunken,
                accent: Theme.Color.appTextSecondary
            )
            .padding(.top, Spacing.s8)
        case let .error(message):
            PkgErrorState(message: message) { Task { await model.load() } }
        case .loaded:
            list
        }
    }

    private var list: some View {
        ScrollView {
            VStack(spacing: Spacing.s2) {
                if let conflict = model.conflictMessage {
                    PkgNote(tone: .warning, icon: .info, text: conflict)
                }
                ForEach(model.bookings) { booking in
                    bookingRow(booking)
                }
                Color.clear.frame(height: Spacing.s6)
            }
            .padding(Spacing.s4)
        }
    }

    private func bookingRow(_ booking: BookingDTO) -> some View {
        Button {
            Task { await model.apply(booking) { await onApplied() } }
        } label: {
            HStack(spacing: 11) {
                Icon(.calendar, size: 16, color: Theme.Color.primary600)
                    .frame(width: 36, height: 36)
                    .background(Theme.Color.primary50)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(model.dateLabel(booking)).font(.system(size: 13, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    SchedulingStatusPill(status: booking.status)
                }
                Spacer()
                if model.applyingId == booking.id {
                    ProgressView().tint(Theme.Color.primary600)
                } else {
                    Icon(.chevronRight, size: 16, color: Theme.Color.appTextMuted)
                }
            }
            .padding(Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(model.applyingId != nil)
    }
}
