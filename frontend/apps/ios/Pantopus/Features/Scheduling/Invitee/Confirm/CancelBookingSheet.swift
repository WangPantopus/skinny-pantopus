//
//  CancelBookingSheet.swift
//  Pantopus
//
//  Stream I6 — the local cancel-confirm sheet presented from D4 Manage. A soft-
//  destructive confirmation with an optional reason; the parent view-model runs
//  `POST /booking/:token/cancel`. Honors the freeing-the-slot copy from the
//  design. Presented locally (no global route).
//

import SwiftUI

struct CancelBookingSheet: View {
    let eventRecap: String
    let policySentence: String
    let isCancelling: Bool
    let onConfirm: (String?) -> Void
    let onKeep: () -> Void

    @State private var reason = ""

    init(
        eventRecap: String,
        policySentence: String,
        isCancelling: Bool,
        onConfirm: @escaping (String?) -> Void,
        onKeep: @escaping () -> Void
    ) {
        self.eventRecap = eventRecap
        self.policySentence = policySentence
        self.isCancelling = isCancelling
        self.onConfirm = onConfirm
        self.onKeep = onKeep
    }

    var body: some View {
        VStack(spacing: Spacing.s4) {
            Capsule()
                .fill(Theme.Color.appBorderStrong)
                .frame(width: 36, height: 4)
                .padding(.top, Spacing.s2)

            VStack(spacing: Spacing.s3) {
                Icon(.xCircle, size: 30, strokeWidth: 1.9, color: Theme.Color.error)
                    .frame(width: 64, height: 64)
                    .background(Theme.Color.errorBg)
                    .clipShape(Circle())
                VStack(spacing: Spacing.s1) {
                    Text("Cancel this booking?")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(eventRecap)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                }
            }

            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("Reason (optional)")
                    .font(.system(size: 11.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                TextField("Let the host know why", text: $reason, axis: .vertical)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(2...4)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 11)
                    .frame(minHeight: 64, alignment: .topLeading)
                    .background(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                            .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
                    )
            }

            HStack(alignment: .top, spacing: Spacing.s2) {
                Icon(.info, size: 13, color: Theme.Color.appTextMuted)
                Text(policySentence)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                Spacer(minLength: Spacing.s0)
            }

            VStack(spacing: Spacing.s2) {
                Button { onConfirm(reason) } label: {
                    Group {
                        if isCancelling {
                            Text("Cancelling…")
                        } else {
                            HStack(spacing: Spacing.s2) {
                                Icon(.xCircle, size: 16, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                                Text("Cancel booking")
                            }
                        }
                    }
                    .font(.system(size: 14.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Theme.Color.error)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(isCancelling)
                .accessibilityIdentifier("scheduling.cancelBooking.confirm")

                Button(action: onKeep) {
                    Text("Keep booking")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .frame(maxWidth: .infinity)
                        .frame(height: 38)
                }
                .buttonStyle(.plain)
                .disabled(isCancelling)
            }

            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.bottom, Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appBg)
    }
}

#if DEBUG
#Preview {
    Color.gray.sheet(isPresented: .constant(true)) {
        CancelBookingSheet(
            eventRecap: "Intro call · Wed, Jun 17 · 9:30 – 10:00 AM",
            policySentence: "You can reschedule or cancel up to 24 hours before the start time.",
            isCancelling: false,
            onConfirm: { _ in },
            onKeep: {}
        )
        .presentationDetents([.medium, .large])
    }
}
#endif
