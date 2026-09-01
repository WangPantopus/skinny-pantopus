//
//  PostGigV1SampleData.swift
//  Pantopus
//
//  Deterministic fixtures for previews and snapshot tests.
//

import Foundation

public enum PostGigV1SampleData {
    public static let maxPhotos = 6
    public static let descriptionMinLength = 40
    public static let descriptionMaxLength = 600
    /// `Joi.array().items(Joi.string().max(50)).max(5)` (`gigs.js:461`).
    public static let maxTags = 5
    /// `Joi.array().…max(20)` on create / `.max(50)` on update — the
    /// stricter create cap wins so the same form can post *and* patch.
    public static let maxItems = 20

    public static let referenceNow: Date = makeDate(year: 2026, month: 5, day: 24, hour: 12)

    public static var filledForm: PostGigV1Form {
        PostGigV1Form(
            category: .moving,
            title: "Help moving a sofa up 3 flights",
            description: """
            Sleeper sofa from the curb up to apt 3B. Building has no elevator, the stairwell is wide but there's a tight
            corner on the 2nd-floor landing. Should take 30-45 min with two people. I'll buy pizza after.
            """,
            price: "80",
            priceType: .flat,
            scheduledAt: makeDate(year: 2026, month: 5, day: 30, hour: 14),
            location: "Pearl District · NW 11th & Johnson",
            photos: [
                PostGigV1Photo(id: "sofa", status: .uploaded(url: "https://cdn.pantopus.app/gigs/sofa.jpg")),
                PostGigV1Photo(id: "stairs", status: .uploaded(url: "https://cdn.pantopus.app/gigs/stairs.jpg")),
                PostGigV1Photo(id: "street", status: .uploaded(url: "https://cdn.pantopus.app/gigs/street.jpg"))
            ]
        )
    }

    public static var validationErrorForm: PostGigV1Form {
        PostGigV1Form(
            category: .moving,
            title: "Sofa help",
            description: "Need help with sofa.",
            price: "",
            priceType: .flat,
            scheduledAt: makeDate(year: 2026, month: 5, day: 12, hour: 9),
            location: "Pearl District · NW 11th & Johnson",
            photos: []
        )
    }

    public static var validationErrors: [PostGigV1ValidationError] {
        [
            PostGigV1ValidationError(
                field: .description,
                message: "Description must be at least \(descriptionMinLength) characters."
            ),
            PostGigV1ValidationError(field: .price, message: "Enter a price, or pick Free."),
            PostGigV1ValidationError(field: .dateTime, message: "Date is in the past. Pick a future time.")
        ]
    }

    @MainActor
    public static func filledViewModel() -> PostGigV1ViewModel {
        PostGigV1ViewModel(
            initialState: PostGigV1State(form: filledForm),
            referenceNow: referenceNow
        )
    }

    @MainActor
    public static func validationErrorViewModel() -> PostGigV1ViewModel {
        PostGigV1ViewModel(
            initialState: PostGigV1State(
                form: validationErrorForm,
                validationErrors: validationErrors
            ),
            referenceNow: referenceNow
        )
    }

    private static func makeDate(year: Int, month: Int, day: Int, hour: Int) -> Date {
        var components = DateComponents()
        components.calendar = Calendar(identifier: .gregorian)
        components.timeZone = TimeZone(identifier: "America/Los_Angeles")
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = 0
        return components.date ?? Date(timeIntervalSince1970: 0)
    }
}
