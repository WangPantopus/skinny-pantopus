//
//  PetDTOs.swift
//  Pantopus
//
//  DTOs for the `HomePet` table exposed via `/api/homes/:id/pets`.
//  Schema:  `backend/routes/home.js:6764` (createPetSchema).
//  Routes:  `backend/routes/home.js:6789` (GET list)
//           `backend/routes/home.js:6826` (POST create)
//           `backend/routes/home.js:6880` (PUT update)
//           `backend/routes/home.js:6926` (DELETE)
//

import Foundation

/// Pet record returned by `GET /api/homes/:id/pets`. The full superset of
/// fields the backend exposes; the design renders `name`, `species`,
/// `breed`, `notes`, and `photo_url`.
public struct PetDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let homeId: String
    public let name: String
    /// Wire enum: dog / cat / bird / fish / reptile / rabbit / hamster / other.
    public let species: String
    public let breed: String?
    public let ageYears: Double?
    public let weightLbs: Double?
    public let vetName: String?
    public let vetPhone: String?
    public let vetAddress: String?
    public let vaccineNotes: String?
    public let feedingSchedule: String?
    public let medications: String?
    public let microchipId: String?
    public let photoUrl: String?
    public let notes: String?
    public let createdBy: String?
    public let createdAt: String?
    public let updatedAt: String?

    public init(
        id: String,
        homeId: String,
        name: String,
        species: String,
        breed: String? = nil,
        ageYears: Double? = nil,
        weightLbs: Double? = nil,
        vetName: String? = nil,
        vetPhone: String? = nil,
        vetAddress: String? = nil,
        vaccineNotes: String? = nil,
        feedingSchedule: String? = nil,
        medications: String? = nil,
        microchipId: String? = nil,
        photoUrl: String? = nil,
        notes: String? = nil,
        createdBy: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.homeId = homeId
        self.name = name
        self.species = species
        self.breed = breed
        self.ageYears = ageYears
        self.weightLbs = weightLbs
        self.vetName = vetName
        self.vetPhone = vetPhone
        self.vetAddress = vetAddress
        self.vaccineNotes = vaccineNotes
        self.feedingSchedule = feedingSchedule
        self.medications = medications
        self.microchipId = microchipId
        self.photoUrl = photoUrl
        self.notes = notes
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case homeId = "home_id"
        case name
        case species
        case breed
        case ageYears = "age_years"
        case weightLbs = "weight_lbs"
        case vetName = "vet_name"
        case vetPhone = "vet_phone"
        case vetAddress = "vet_address"
        case vaccineNotes = "vaccine_notes"
        case feedingSchedule = "feeding_schedule"
        case medications
        case microchipId = "microchip_id"
        case photoUrl = "photo_url"
        case notes
        case createdBy = "created_by"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

/// Envelope for `GET /api/homes/:id/pets`. Backend returns `{ pets: [] }`.
public struct PetsResponse: Decodable, Sendable, Hashable {
    public let pets: [PetDTO]
}

/// Envelope for `POST /api/homes/:id/pets` and `PUT …/pets/:petId`.
/// Backend returns `{ pet: {…} }`.
public struct PetResponse: Decodable, Sendable, Hashable {
    public let pet: PetDTO
}

/// Body for `POST /api/homes/:id/pets`. Matches `createPetSchema` in
/// `backend/routes/home.js:6764`. `name` + `species` are required, the
/// rest optional. Optionals are omitted when nil so the request body
/// stays compact.
public struct CreatePetRequest: Encodable, Sendable, Hashable {
    public var name: String
    public var species: String
    public var breed: String?
    public var ageYears: Double?
    public var weightLbs: Double?
    public var vetName: String?
    public var vetPhone: String?
    public var vetAddress: String?
    public var vaccineNotes: String?
    public var feedingSchedule: String?
    public var medications: String?
    public var microchipId: String?
    public var photoUrl: String?
    public var notes: String?

    public init(
        name: String,
        species: String,
        breed: String? = nil,
        ageYears: Double? = nil,
        weightLbs: Double? = nil,
        vetName: String? = nil,
        vetPhone: String? = nil,
        vetAddress: String? = nil,
        vaccineNotes: String? = nil,
        feedingSchedule: String? = nil,
        medications: String? = nil,
        microchipId: String? = nil,
        photoUrl: String? = nil,
        notes: String? = nil
    ) {
        self.name = name
        self.species = species
        self.breed = breed
        self.ageYears = ageYears
        self.weightLbs = weightLbs
        self.vetName = vetName
        self.vetPhone = vetPhone
        self.vetAddress = vetAddress
        self.vaccineNotes = vaccineNotes
        self.feedingSchedule = feedingSchedule
        self.medications = medications
        self.microchipId = microchipId
        self.photoUrl = photoUrl
        self.notes = notes
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(name, forKey: .name)
        try c.encode(species, forKey: .species)
        try c.encodeIfPresent(breed, forKey: .breed)
        try c.encodeIfPresent(ageYears, forKey: .ageYears)
        try c.encodeIfPresent(weightLbs, forKey: .weightLbs)
        try c.encodeIfPresent(vetName, forKey: .vetName)
        try c.encodeIfPresent(vetPhone, forKey: .vetPhone)
        try c.encodeIfPresent(vetAddress, forKey: .vetAddress)
        try c.encodeIfPresent(vaccineNotes, forKey: .vaccineNotes)
        try c.encodeIfPresent(feedingSchedule, forKey: .feedingSchedule)
        try c.encodeIfPresent(medications, forKey: .medications)
        try c.encodeIfPresent(microchipId, forKey: .microchipId)
        try c.encodeIfPresent(photoUrl, forKey: .photoUrl)
        try c.encodeIfPresent(notes, forKey: .notes)
    }

    private enum CodingKeys: String, CodingKey {
        case name
        case species
        case breed
        case ageYears = "age_years"
        case weightLbs = "weight_lbs"
        case vetName = "vet_name"
        case vetPhone = "vet_phone"
        case vetAddress = "vet_address"
        case vaccineNotes = "vaccine_notes"
        case feedingSchedule = "feeding_schedule"
        case medications
        case microchipId = "microchip_id"
        case photoUrl = "photo_url"
        case notes
    }
}

/// Body for `PUT /api/homes/:id/pets/:petId`. Mirrors `updatePetSchema`
/// (`createPetSchema.fork(['name','species'], optional)`). Every field
/// is optional; absent keys are omitted from the wire body so the
/// backend's column-level merge picks them up untouched.
public struct UpdatePetRequest: Encodable, Sendable, Hashable {
    public var name: String?
    public var species: String?
    public var breed: String?
    public var ageYears: Double?
    public var weightLbs: Double?
    public var vetName: String?
    public var vetPhone: String?
    public var vetAddress: String?
    public var vaccineNotes: String?
    public var feedingSchedule: String?
    public var medications: String?
    public var microchipId: String?
    public var photoUrl: String?
    public var notes: String?

    public init(
        name: String? = nil,
        species: String? = nil,
        breed: String? = nil,
        ageYears: Double? = nil,
        weightLbs: Double? = nil,
        vetName: String? = nil,
        vetPhone: String? = nil,
        vetAddress: String? = nil,
        vaccineNotes: String? = nil,
        feedingSchedule: String? = nil,
        medications: String? = nil,
        microchipId: String? = nil,
        photoUrl: String? = nil,
        notes: String? = nil
    ) {
        self.name = name
        self.species = species
        self.breed = breed
        self.ageYears = ageYears
        self.weightLbs = weightLbs
        self.vetName = vetName
        self.vetPhone = vetPhone
        self.vetAddress = vetAddress
        self.vaccineNotes = vaccineNotes
        self.feedingSchedule = feedingSchedule
        self.medications = medications
        self.microchipId = microchipId
        self.photoUrl = photoUrl
        self.notes = notes
    }

    public func encode(to encoder: any Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(name, forKey: .name)
        try c.encodeIfPresent(species, forKey: .species)
        try c.encodeIfPresent(breed, forKey: .breed)
        try c.encodeIfPresent(ageYears, forKey: .ageYears)
        try c.encodeIfPresent(weightLbs, forKey: .weightLbs)
        try c.encodeIfPresent(vetName, forKey: .vetName)
        try c.encodeIfPresent(vetPhone, forKey: .vetPhone)
        try c.encodeIfPresent(vetAddress, forKey: .vetAddress)
        try c.encodeIfPresent(vaccineNotes, forKey: .vaccineNotes)
        try c.encodeIfPresent(feedingSchedule, forKey: .feedingSchedule)
        try c.encodeIfPresent(medications, forKey: .medications)
        try c.encodeIfPresent(microchipId, forKey: .microchipId)
        try c.encodeIfPresent(photoUrl, forKey: .photoUrl)
        try c.encodeIfPresent(notes, forKey: .notes)
    }

    private enum CodingKeys: String, CodingKey {
        case name
        case species
        case breed
        case ageYears = "age_years"
        case weightLbs = "weight_lbs"
        case vetName = "vet_name"
        case vetPhone = "vet_phone"
        case vetAddress = "vet_address"
        case vaccineNotes = "vaccine_notes"
        case feedingSchedule = "feeding_schedule"
        case medications
        case microchipId = "microchip_id"
        case photoUrl = "photo_url"
        case notes
    }
}
