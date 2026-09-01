//
//  PlaceCivicDetailContent.swift
//  Pantopus
//
//  C8 — Civic. The elected ladder (districts grouped by level), your
//  representatives with contact actions, and the next election (banner +
//  polling + ballot) or a calm off-season state.
//

import SwiftUI

struct PlaceCivicDetailContent: View {
    let intel: PlaceIntelligence
    let vm: PlaceDetailViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let districts = vm.section(.civicDistricts, in: intel) {
                PlaceDetailSectionLabel(text: "Your districts")
                if let data = districts.civicDistricts, !data.districts.isEmpty {
                    DistrictsCard(districts: data.districts)
                    PlaceSourceNote(name: "District boundaries · public GIS records", asOf: "current")
                    if !data.representatives.isEmpty {
                        PlaceDetailSectionLabel(text: "Your representatives")
                        VStack(spacing: 8) {
                            ForEach(Array(data.representatives.enumerated()), id: \.offset) { _, rep in
                                RepRow(rep: rep)
                            }
                        }
                        PlaceSourceNote(name: "unitedstates/congress-legislators · OpenStates", asOf: nil)
                    }
                } else {
                    vm.fallbackCard(districts)
                }
            }

            if let election = vm.section(.civicElection, in: intel) {
                PlaceDetailSectionLabel(text: "Election")
                if let data = election.civicElection, election.status == .ready || election.status == .stale {
                    ElectionCard(data: data)
                    PlaceSourceNote(name: "Official county elections", asOf: nil)
                } else {
                    NoElectionCard()
                }
            }
        }
    }
}

private struct DistrictsCard: View {
    let districts: [PlaceCivicDistrict]

    private var grouped: [(CivicLevel, [PlaceCivicDistrict])] {
        let order: [CivicLevel] = [.federal, .state, .county, .city, .school]
        return order.compactMap { level in
            let items = districts.filter { $0.level == level }
            return items.isEmpty ? nil : (level, items)
        }
    }

    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 14) {
                ForEach(grouped, id: \.0) { level, items in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(levelLabel(level).uppercased())
                            .font(.system(size: 11, weight: .bold))
                            .kerning(0.6)
                            .foregroundStyle(Theme.Color.appTextMuted)
                        ForEach(Array(items.enumerated()), id: \.offset) { _, d in
                            HStack(alignment: .top, spacing: 8) {
                                Circle().fill(Theme.Color.home).frame(width: 6, height: 6).padding(.top, 6)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(d.officeLabel)
                                        .font(.system(size: 12.5, weight: .medium))
                                        .foregroundStyle(Theme.Color.appTextMuted)
                                    Text(d.name)
                                        .font(.system(size: 14, weight: .semibold))
                                        .foregroundStyle(Theme.Color.appText)
                                }
                                Spacer(minLength: 0)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct RepRow: View {
    let rep: PlaceCivicRepresentative

    var body: some View {
        PlaceDetailCard(padding: 14) {
            HStack(spacing: 11) {
                ZStack {
                    Circle().fill(Theme.Color.appSurfaceSunken)
                    Text(initials)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
                .frame(width: 40, height: 40)
                VStack(alignment: .leading, spacing: 1) {
                    Text(rep.party.map { "\(rep.name) (\($0.prefix(1)))" } ?? rep.name)
                        .font(.system(size: 14.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(rep.office)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                HStack(spacing: 8) {
                    if let phone = rep.phone, let url = URL(string: "tel:\(phone.filter(\.isNumber))") {
                        contactButton(.bell, url: url)
                    }
                    if let email = rep.email, let url = URL(string: "mailto:\(email)") {
                        contactButton(.mail, url: url)
                    }
                    if let website = rep.website, let url = URL(string: website) {
                        contactButton(.mapPin, url: url)
                    }
                }
            }
        }
    }

    private func contactButton(_ icon: PantopusIcon, url: URL) -> some View {
        Link(destination: url) {
            Icon(icon, size: 15, strokeWidth: 2, color: Theme.Color.primary600)
                .frame(width: 30, height: 30)
                .background(Theme.Color.primary100)
                .clipShape(Circle())
        }
    }

    private var initials: String {
        let parts = rep.name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init)
        return parts.isEmpty ? "?" : parts.joined().uppercased()
    }
}

private struct ElectionCard: View {
    let data: PlaceCivicElectionData

    var body: some View {
        VStack(spacing: 8) {
            PlaceDetailCard {
                HStack(spacing: 14) {
                    VStack(spacing: 0) {
                        Text(monthAbbrev).font(.system(size: 12, weight: .bold)).foregroundStyle(Theme.Color.home)
                        Text(dayNumber).font(.system(size: 24, weight: .bold)).foregroundStyle(Theme.Color.appText)
                    }
                    .frame(width: 54)
                    .padding(.vertical, 8)
                    .background(Theme.Color.homeBg)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(data.name)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Theme.Color.appText)
                        PlaceChip(model: PlaceChipModel(tone: .sky, text: "\(data.daysUntil) days away"))
                    }
                    Spacer(minLength: 0)
                }
            }
            if let polling = data.pollingPlace {
                PlaceDetailCard(padding: 14) {
                    HStack(spacing: 11) {
                        PlaceIconTile(icon: .landmark, tone: .home, size: 32)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(polling.name).font(.system(size: 14, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                            Text(polling.detail).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
                        }
                        Spacer(minLength: 0)
                    }
                }
            }
        }
    }

    private var monthAbbrev: String {
        guard let d = PlacePresentation.parseISO(data.date) else { return "" }
        let f = DateFormatter()
        f.dateFormat = "MMM"
        return f.string(from: d).uppercased()
    }

    private var dayNumber: String {
        guard let d = PlacePresentation.parseISO(data.date) else { return "" }
        return "\(Calendar.current.component(.day, from: d))"
    }
}

private struct NoElectionCard: View {
    var body: some View {
        PlaceDetailCard {
            VStack(alignment: .leading, spacing: 6) {
                Text("No upcoming election")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text("We'll surface the date, your polling place, and a plain-language ballot preview when one is set.")
                    .font(.system(size: 13.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }
}

private func levelLabel(_ level: CivicLevel) -> String {
    switch level {
    case .federal: "Federal"
    case .state: "State"
    case .county: "County"
    case .city: "City"
    case .school: "School"
    case .unknown: "Other"
    }
}
