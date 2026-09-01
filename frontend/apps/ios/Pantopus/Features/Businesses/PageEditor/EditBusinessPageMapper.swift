//
//  EditBusinessPageMapper.swift
//  Pantopus
//
//  Projects `BusinessDetailResponse` (+ optional hours / catalog) onto
//  `EditBusinessPageContent` for the A13.10 profile editor.
//

// swiftlint:disable type_body_length

import Foundation

enum EditBusinessPageMapper {
    private static let dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private static let descriptionCharLimit = 600
    /// `updateLocationSchema` requires `address` to be at least 3 chars.
    private static let minStreetLength = 3
    /// Setup checklist ticks "Description" once the blurb reads as a blurb.
    private static let minDescriptionLength = 50

    static func content(
        from detail: BusinessDetailResponse,
        hours: [BusinessHoursDTO],
        catalog: [BusinessCatalogItemDTO]
    ) -> EditBusinessPageContent {
        let business = detail.business
        let profile = detail.profile
        let location = profile?.primaryLocation
            ?? detail.locations.first { $0.isPrimary == true }
            ?? detail.locations.first

        let name = business.name ?? ""
        let descriptionText = profile?.description ?? ""
        let hasBanner = !(profile?.bannerFileId ?? "").isEmpty
        let isPublished = profile?.isPublished == true
        let booking = stringMap(profile?.socialLinks)["booking"] ?? ""

        // The mode below is a seed — `withRecomputedMode` derives the setup
        // checklist / unsaved badge from the assembled content.
        return withRecomputedMode(
            EditBusinessPageContent(
                businessId: business.id,
                mode: seedMode(isPublished: isPublished, publishedAt: profile?.publishedAt),
                banner: hasBanner ? .filled(dirty: false, palette: .cafeGoldenHour) : .empty,
                logo: (profile?.logoFileId ?? "").isEmpty
                    ? .empty
                    : .filled(initial: String(name.prefix(1)).uppercased(), palette: .sunrise),
                name: field(name),
                tagline: field(business.tagline, placeholder: "One short line, no punctuation"),
                category: field(
                    (profile?.categories ?? []).joined(separator: " · "),
                    placeholder: "Pick a category"
                ),
                categoryRequired: !isPublished,
                price: field(
                    profile?.attributes?["price_level"]?.stringValue,
                    placeholder: "$ — $$$$"
                ),
                description: descriptionState(descriptionText),
                hours: mapHours(hours),
                services: mapServices(catalog),
                gallery: EditBusinessPageGalleryState(
                    tiles: [],
                    totalSlots: 20,
                    freshAddTile: false,
                    hintLabel: "0 of 20 · drag to reorder"
                ),
                phone: field(
                    stripPhonePrefix(profile?.publicPhone ?? ""),
                    placeholder: "(555) 000-0000"
                ),
                email: field(profile?.publicEmail, placeholder: "hello@business.com"),
                website: field(stripURLScheme(profile?.website ?? ""), placeholder: "yoursite.com"),
                bookingLink: field(stripURLScheme(booking), placeholder: "resy.com/…"),
                location: locationState(location)
            )
        )
    }

    /// Coerces a free-form jsonb object onto `String: String`, dropping
    /// entries whose value isn't a string. `social_links` is user-writable
    /// jsonb, so a null / numeric member degrades to "absent" instead of
    /// failing the whole editor load.
    static func stringMap(_ raw: [String: JSONValue]?) -> [String: String] {
        (raw ?? [:]).compactMapValues(\.stringValue)
    }

    static func unsavedCount(in content: EditBusinessPageContent) -> Int {
        textEditCount(content) + locationEditCount(content) + mediaEditCount(content)
    }

    private static func textEditCount(_ content: EditBusinessPageContent) -> Int {
        var count = 0
        if content.name.isDirty { count += 1 }
        if content.tagline.isDirty { count += 1 }
        if content.category.isDirty { count += 1 }
        if content.price.isDirty { count += 1 }
        if case let .field(field, _) = content.description, field.isDirty { count += 1 }
        if content.phone.isDirty { count += 1 }
        if content.email.isDirty { count += 1 }
        if content.website.isDirty { count += 1 }
        if let booking = content.bookingLink, booking.isDirty { count += 1 }
        return count
    }

    private static func locationEditCount(_ content: EditBusinessPageContent) -> Int {
        var count = 0
        if content.location.address.isDirty { count += 1 }
        if content.location.city.isDirty { count += 1 }
        if content.location.state.isDirty { count += 1 }
        if content.location.zip.isDirty { count += 1 }
        if content.location.pinDirty { count += 1 }
        return count
    }

    private static func mediaEditCount(_ content: EditBusinessPageContent) -> Int {
        var count = 0
        if case let .filled(dirty, _) = content.banner, dirty { count += 1 }
        if case let .rows(rows, _) = content.hours, rows.contains(where: \.isDirty) { count += 1 }
        if case let .chips(chips) = content.services, chips.contains(where: \.isFresh) {
            count += 1
        }
        if content.gallery.freshAddTile { count += 1 }
        return count
    }

    static func withRecomputedMode(_ content: EditBusinessPageContent) -> EditBusinessPageContent {
        let dirty = unsavedCount(in: content)
        let mode: EditBusinessPageMode
        switch content.mode {
        case let .published(_, label):
            mode = .published(unsavedCount: dirty, lastPublishedLabel: label)
        case .setup:
            let items = setupItems(from: content)
            let done = items.filter(\.done).count
            mode = .setup(
                done: done,
                total: items.count,
                remaining: items.count - done,
                items: items
            )
        }
        return copy(content, mode: mode)
    }

    static func copy(
        _ content: EditBusinessPageContent,
        mode: EditBusinessPageMode? = nil,
        banner: EditBusinessPageBannerState? = nil,
        logo: EditBusinessPageLogoState? = nil,
        name: EditBusinessPageField? = nil,
        tagline: EditBusinessPageField? = nil,
        category: EditBusinessPageField? = nil,
        price: EditBusinessPageField? = nil,
        description: EditBusinessPageDescriptionState? = nil,
        hours: EditBusinessPageHoursState? = nil,
        services: EditBusinessPageServicesState? = nil,
        gallery: EditBusinessPageGalleryState? = nil,
        phone: EditBusinessPageField? = nil,
        email: EditBusinessPageField? = nil,
        website: EditBusinessPageField? = nil,
        bookingLink: EditBusinessPageField? = nil,
        replaceBookingLink: Bool = false,
        location: EditBusinessPageLocation? = nil
    ) -> EditBusinessPageContent {
        EditBusinessPageContent(
            businessId: content.businessId,
            mode: mode ?? content.mode,
            banner: banner ?? content.banner,
            logo: logo ?? content.logo,
            name: name ?? content.name,
            tagline: tagline ?? content.tagline,
            category: category ?? content.category,
            categoryRequired: content.categoryRequired,
            price: price ?? content.price,
            description: description ?? content.description,
            hours: hours ?? content.hours,
            services: services ?? content.services,
            gallery: gallery ?? content.gallery,
            phone: phone ?? content.phone,
            email: email ?? content.email,
            website: website ?? content.website,
            bookingLink: replaceBookingLink ? bookingLink : content.bookingLink,
            location: location ?? content.location
        )
    }

    static func normalizeWebsite(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.lowercased().hasPrefix("http://") || trimmed.lowercased().hasPrefix("https://") {
            return trimmed
        }
        return "https://\(trimmed)"
    }

    /// Re-applies the `+1` the loader stripped so a save round-trips the
    /// country code instead of dropping it. A number the user typed with
    /// its own `+` prefix is left alone.
    static func restorePhonePrefix(_ raw: String, hadCountryCode: Bool) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, hadCountryCode, !trimmed.hasPrefix("+") else { return trimmed }
        return "+1 \(trimmed)"
    }

    /// Folds the edited `booking` key into the full `social_links` object
    /// loaded from the server. The PATCH route replaces the jsonb column
    /// wholesale (`backend/routes/businesses.js:1134`), so every key that
    /// should survive has to travel in the patch.
    static func mergedSocialLinks(existing: [String: String], booking: String) -> [String: String] {
        var merged = existing
        let trimmed = booking.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            merged.removeValue(forKey: "booking")
        } else {
            merged["booking"] = trimmed
        }
        return merged
    }

    /// Same wholesale-overwrite guard for `attributes` — merges the edited
    /// `price_level` into the object loaded from the server.
    static func mergedAttributes(
        existing: [String: JSONValue],
        priceLevel: String
    ) -> [String: JSONValue] {
        var merged = existing
        let trimmed = priceLevel.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            merged.removeValue(forKey: "price_level")
        } else {
            merged["price_level"] = .string(trimmed)
        }
        return merged
    }

    /// Body for the location PATCH. The route re-geocodes from whatever
    /// address parts it receives (`backend/routes/businesses.js:1811`), so a
    /// partial body would relocate the pin from a partial address. Every
    /// component therefore travels whenever any one of them changed, keeping
    /// the geocode input a complete, coherent address.
    static func locationPayload(from location: EditBusinessPageLocation) -> UpdateBusinessLocationRequest {
        UpdateBusinessLocationRequest(
            address: trimmed(location.address.current),
            city: trimmed(location.city.current),
            state: trimmed(location.state.current),
            zipcode: trimmed(location.zip.current)
        )
    }

    /// Client-side mirror of `updateLocationSchema`
    /// (`backend/routes/businesses.js:190`). The full component set travels
    /// on every address edit, so street + city must both be present — those
    /// two are `required` server-side and are what makes the geocode
    /// resolvable.
    static func locationValidationError(_ location: EditBusinessPageLocation) -> String? {
        guard location.hasAddressEdits else { return nil }
        if trimmed(location.address.current).count < minStreetLength {
            return "Enter a street address."
        }
        if trimmed(location.city.current).isEmpty {
            return "Enter a city."
        }
        return nil
    }

    static func hoursPayload(from state: EditBusinessPageHoursState) -> [SetBusinessHoursDayRequest]? {
        let rows: [EditBusinessPageHoursRow] = switch state {
        case let .rows(list, _): list
        case let .quickApply(list): list
        }
        guard rows.contains(where: \.isDirty) else { return nil }

        var payload: [SetBusinessHoursDayRequest] = []
        for (index, label) in dayLabels.enumerated() {
            guard let row = rows.first(where: { $0.dayLabel == label || $0.id == label.lowercased() })
                ?? rows.first(where: { $0.id == String(index) }) else {
                continue
            }
            switch row.state {
            case let .open(openLabel, closeLabel):
                guard let open = parseDisplayTime(openLabel),
                      let close = parseDisplayTime(closeLabel) else { continue }
                payload.append(.init(dayOfWeek: index, openTime: open, closeTime: close, isClosed: false))
            case .closed:
                payload.append(.init(dayOfWeek: index, openTime: nil, closeTime: nil, isClosed: true))
            case .notSet:
                continue
            }
        }
        return payload.isEmpty ? nil : payload
    }

    // MARK: - Private

    private static func mapHours(_ hours: [BusinessHoursDTO]) -> EditBusinessPageHoursState {
        guard !hours.isEmpty else {
            return .quickApply(rows: dayLabels.map { label in
                EditBusinessPageHoursRow(id: label.lowercased(), dayLabel: label, state: .notSet)
            })
        }
        let byDay = Dictionary(uniqueKeysWithValues: hours.map { ($0.dayOfWeek, $0) })
        let rows = dayLabels.enumerated().map { index, label -> EditBusinessPageHoursRow in
            guard let row = byDay[index] else {
                return EditBusinessPageHoursRow(id: label.lowercased(), dayLabel: label, state: .notSet)
            }
            if row.isClosed == true {
                return EditBusinessPageHoursRow(id: label.lowercased(), dayLabel: label, state: .closed)
            }
            let open = formatAPITime(row.openTime)
            let close = formatAPITime(row.closeTime)
            if let open, let close {
                return EditBusinessPageHoursRow(
                    id: label.lowercased(),
                    dayLabel: label,
                    state: .open(openLabel: open, closeLabel: close)
                )
            }
            return EditBusinessPageHoursRow(id: label.lowercased(), dayLabel: label, state: .notSet)
        }
        if rows.allSatisfy({ if case .notSet = $0.state { return true }
            return false }) {
            return .quickApply(rows: rows)
        }
        return .rows(rows: rows, footerHint: "Holiday hours can be added per date — neighbors see a banner.")
    }

    private static func mapServices(_ catalog: [BusinessCatalogItemDTO]) -> EditBusinessPageServicesState {
        let chips = catalog.prefix(12).map { item in
            EditBusinessPageServiceChip(
                id: item.id,
                label: item.name,
                iconKey: "sparkles",
                isFresh: false
            )
        }
        if chips.isEmpty {
            return .prompt(EditBusinessPagePrompt(
                iconKey: "sparkles",
                title: "Add at least one service",
                subtitle: "Required to appear in category search results.",
                ctaLabel: "Add"
            ))
        }
        return .chips(chips: Array(chips))
    }

    private static func setupItems(from content: EditBusinessPageContent) -> [EditBusinessPageSetupItem] {
        let description: String = switch content.description {
        case let .field(field, _): field.current
        case .prompt: ""
        }
        let hasHours: Bool = switch content.hours {
        case let .rows(rows, _):
            rows.contains { if case .open = $0.state { return true }
                return false
            }
        case .quickApply: false
        }
        let hasServices: Bool = {
            if case let .chips(chips) = content.services { return !chips.isEmpty }
            return false
        }()
        let hasBanner: Bool = {
            if case .filled = content.banner { return true }
            return false
        }()
        let hasContact = !trimmed(content.phone.current).isEmpty
            || !trimmed(content.email.current).isEmpty
        return [
            .init(id: "name", label: "Name", done: !trimmed(content.name.current).isEmpty),
            .init(id: "contact", label: "Contact", done: hasContact),
            .init(
                id: "location",
                label: "Location",
                done: !trimmed(content.location.address.current).isEmpty
            ),
            .init(id: "banner", label: "Banner", done: hasBanner),
            .init(id: "desc", label: "Description", done: description.count >= minDescriptionLength),
            .init(id: "hours", label: "Hours", done: hasHours),
            .init(id: "services", label: "Services", done: hasServices)
        ]
    }

    /// Placeholder mode replaced by `withRecomputedMode` on the way out.
    private static func seedMode(isPublished: Bool, publishedAt: String?) -> EditBusinessPageMode {
        isPublished
            ? .published(unsavedCount: 0, lastPublishedLabel: lastPublishedLabel(publishedAt: publishedAt))
            : .setup(done: 0, total: 0, remaining: 0, items: [])
    }

    private static func field(_ value: String?, placeholder: String = "") -> EditBusinessPageField {
        let text = value ?? ""
        return EditBusinessPageField(original: text, current: text, placeholder: placeholder)
    }

    private static func descriptionState(_ text: String) -> EditBusinessPageDescriptionState {
        trimmed(text).isEmpty
            ? .prompt(EditBusinessPagePrompt(
                iconKey: "fileText",
                title: "Tell neighbors what you do",
                subtitle: "A short paragraph helps your page rank in local search.",
                ctaLabel: "Write"
            ))
            : .field(
                EditBusinessPageField(original: text, current: text),
                charLimit: descriptionCharLimit
            )
    }

    /// Address components stay separate — `address` is the street line only,
    /// matching the backend column it writes back to.
    private static func locationState(_ location: BusinessLocationDTO?) -> EditBusinessPageLocation {
        EditBusinessPageLocation(
            address: field(location?.address, placeholder: "Street address"),
            city: field(location?.city, placeholder: "City"),
            state: field(location?.state, placeholder: "State"),
            zip: field(location?.zipcode, placeholder: "ZIP"),
            error: nil,
            mapVerified: location?.location != nil,
            pinDirty: false,
            hideExactAddress: false
        )
    }

    private static func trimmed(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func lastPublishedLabel(publishedAt: String?) -> String {
        guard let publishedAt, let date = parseISO(publishedAt) else {
            return "Published"
        }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<86400: return "Published · today"
        case ..<604_800:
            let days = max(1, Int(elapsed / 86400))
            return "Published · \(days) day\(days == 1 ? "" : "s") ago"
        default:
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return "Published · \(formatter.string(from: date))"
        }
    }

    private static func parseISO(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: value)
    }

    private static func formatAPITime(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        let parts = value.split(separator: ":")
        guard let hourPart = parts.first, let hour = Int(hourPart) else { return value }
        let minute = parts.count > 1 ? String(parts[1].prefix(2)) : "00"
        let period = hour >= 12 ? "PM" : "AM"
        let hour12 = hour % 12 == 0 ? 12 : hour % 12
        return "\(hour12):\(minute) \(period)"
    }

    private static func parseDisplayTime(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for format in ["h:mm a", "h:mma", "HH:mm", "H:mm"] {
            formatter.dateFormat = format
            if let date = formatter.date(from: trimmed) {
                let out = DateFormatter()
                out.locale = Locale(identifier: "en_US_POSIX")
                out.dateFormat = "HH:mm"
                return out.string(from: date)
            }
        }
        return nil
    }

    private static func stripURLScheme(_ value: String) -> String {
        var result = value.trimmingCharacters(in: .whitespacesAndNewlines)
        for prefix in ["https://", "http://"] where result.lowercased().hasPrefix(prefix) {
            result = String(result.dropFirst(prefix.count))
        }
        return result
    }

    private static func stripPhonePrefix(_ value: String) -> String {
        var result = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if result.hasPrefix("+1") {
            result = String(result.dropFirst(2)).trimmingCharacters(in: .whitespaces)
        }
        return result
    }
}
