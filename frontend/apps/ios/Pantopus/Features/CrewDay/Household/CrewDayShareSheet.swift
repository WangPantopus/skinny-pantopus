//
//  CrewDayShareSheet.swift
//  Pantopus
//
//  12. Share with neighbors (build kit 01-spec.md, board `Share`): the count
//  only ("6 homes booked · room for 4 more"), the drafted message (editable),
//  the link preview (street and date, never the address), Copy link, the
//  system share sheet, the QR code and the printable flyer (a web page).
//

import SwiftUI
import UIKit

struct CrewDayShareSheet: View {
    let viewModel: CrewDayBookingViewModel
    let booking: CrewDayBookingDTO
    @State private var message = ""
    @State private var systemSheet: SystemSheetRequest?
    @State private var showsQR = false
    @State private var copied = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private var code: String {
        booking.crewDay.code ?? ""
    }

    /// The link neighbors open: the app's own public web address for this day.
    private var link: String {
        CrewDayShareText.link(code)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                CrewDaySheetHeader(title: "Share with neighbors") { dismiss() }
                HStack(spacing: Spacing.s2) {
                    Icon(.house, size: 16, color: Theme.Color.home)
                    Text(countLine)
                        .planFont(.smallStrong)
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityElement(children: .combine)
                .accessibilityIdentifier("crewDayShareCount")
                VStack(alignment: .leading, spacing: Spacing.s2) {
                    Text.planOverline("Your message")
                    TextField("Your message", text: $message, axis: .vertical)
                        .planFont(.body)
                        .lineLimit(4...8)
                        .padding(.horizontal, 14)
                        .padding(.vertical, Spacing.s3)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurface))
                        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorderStrong, lineWidth: 1))
                        .accessibilityLabel("Your message")
                        .accessibilityIdentifier("crewDayShareMessage")
                }
                preview
                buttons
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s5)
        }
        .scrollDismissesKeyboard(.interactively)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .sheet(item: $systemSheet) { $0.makeView() }
        .sheet(isPresented: $showsQR) { CrewDayQRSheet(link: link, title: booking.crewDay.title) }
        .task {
            if message.isEmpty { message = draft }
            await viewModel.loadPriceList()
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("crewDayShare")
    }

    /// "6 homes booked · room for 4 more" (counts only, never which homes).
    private var countLine: String {
        let booked = booking.share?.bookedCount ?? 0
        let left = booking.share?.spotsLeft ?? 0
        let homes = booked == 1 ? "1 home booked" : "\(booked) homes booked"
        return left > 0 ? "\(homes) · room for \(left) more" : "\(homes) · full"
    }

    /// The server's drafted message, with the link the app shares.
    private var draft: String {
        let base = booking.share?.message.map { text -> String in
            guard let url = booking.share?.url else { return text }
            return text.replacingOccurrences(of: url, with: "").trimmingCharacters(in: .whitespaces)
        }
        let service = (booking.crewDay.serviceLabel ?? "a Crew Day").lowercased()
        let day = CrewDayFormat.longDay(booking.serviceDate, timezone: booking.crewDay.timezone)
        let fallback = "I'm booked for \(service) on \(day). The crew has room for nearby homes if you need yours done too."
        return "\(base ?? fallback) \(link)"
    }

    /// Street and date only ("never your address").
    private var preview: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(spacing: Spacing.s3) {
                streetThumb
                VStack(alignment: .leading, spacing: 2) {
                    Text(booking.crewDay.title).planFont(.bodyStrong).foregroundStyle(Theme.Color.appText)
                    Text(previewLine)
                        .planFont(.footnote)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Theme.Color.appSurfaceMuted))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.Color.appBorder, lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("crewDaySharePreview")
            CrewDayLockLine(text: "The preview shows \(booking.crewDay.streetLabel ?? "the street") and the date, never your address.")
        }
    }

    /// The street on a tiny map: a road with its highlight, no houses or pins.
    private var streetThumb: some View {
        ZStack {
            Theme.Color.appSurfaceSunken
            Capsule().fill(Theme.Color.home.opacity(0.24)).frame(height: 14).padding(.horizontal, 4)
            Rectangle().fill(Theme.Color.appSurface).frame(height: 4)
        }
        .frame(width: 64, height: 64)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityHidden(true)
    }

    /// "Tue, Nov 17 · from $140 · pantopus.com".
    private var previewLine: String {
        let day = CrewDayFormat.shortDay(booking.serviceDate, timezone: booking.crewDay.timezone)
        let from = viewModel.priceList?.value?.priceFromCents.map { "from \(CrewDayFormat.price($0))" }
        let host = URL(string: link)?.host() ?? "pantopus.com"
        return [day, from, host].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    private var buttons: some View {
        Grid(horizontalSpacing: 10, verticalSpacing: 10) {
            GridRow {
                Button {
                    UIPasteboard.general.string = link
                    copied = true
                } label: {
                    PlanButtonLabel(title: copied ? "Link copied" : "Copy link", icon: copied ? .check : .link, kind: .tonal)
                }
                .planButton(.tonal)
                .accessibilityIdentifier("crewDayShareCopy")
                Button { systemSheet = .share(items: [message]) } label: {
                    PlanButtonLabel(title: "Share…", icon: .share)
                }
                .planButton(.primary)
                .accessibilityIdentifier("crewDayShareShare")
            }
            GridRow {
                Button { showsQR = true } label: {
                    PlanButtonLabel(title: "Show QR code", icon: .qrCode, kind: .tonal)
                }
                .planButton(.tonal)
                .accessibilityIdentifier("crewDayShareQR")
                Button {
                    if let url = URL(string: InviteLinks.publicPageURLString(path: "/crew-day/\(code)/flyer")) { openURL(url) }
                } label: {
                    PlanButtonLabel(title: "Printable flyer", icon: .printer, kind: .tonal)
                }
                .planButton(.tonal)
                .accessibilityIdentifier("crewDayShareFlyer")
            }
        }
    }
}
