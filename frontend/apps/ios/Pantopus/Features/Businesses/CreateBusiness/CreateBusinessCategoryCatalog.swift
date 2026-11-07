//
//  CreateBusinessCategoryCatalog.swift
//  Pantopus
//
//  The listed business categories the Create Business wizard's search
//  finds, each filed under one of the eight tiles. A pick saves its name
//  in `categories[]` (business pages show it as written). Anything not
//  listed is added as the owner's own category, which the server stores
//  the same way (`categories` is free text, `backend/routes/businesses.js:650`).
//
//  Android keeps the same list in `CreateBusinessCategoryCatalog.kt`;
//  change both together.
//

import Foundation

enum CreateBusinessCategoryCatalog {
    /// Most matches the search frame lists before "Add as a custom category".
    static let maxResults = 6

    /// Listed categories, grouped by tile. Within a tie the earlier entry ranks first.
    static let listed: [CategorySearchHit] = [
        // Home services
        hit("handyman", .home, "Handyman", "repairs & odd jobs", ["handy man", "odd jobs", "home repair", "fix"]),
        hit(
            "house-cleaning",
            .home,
            "Cleaning",
            "homes & move-outs",
            ["house cleaning", "maid", "housekeeping", "janitorial", "deep clean"]
        ),
        hit("plumbing", .home, "Plumbing", nil, ["plumber", "drain", "pipes", "water heater", "leak"]),
        hit("electrical", .home, "Electrical", nil, ["electrician", "wiring", "lighting", "outlets"]),
        hit("hvac", .home, "Heating & cooling", "HVAC", ["air conditioning", "ac repair", "furnace", "heat pump"]),
        hit("lawncare", .home, "Lawn care", "mowing & seasonal", ["mowing", "yard work", "grass", "leaf removal"]),
        hit("landscaping", .home, "Landscaping", nil, ["landscaper", "garden design", "hardscaping", "yard"]),
        hit("gardening", .home, "Gardening", nil, ["gardener", "weeding", "planting"]),
        hit("tree-service", .home, "Tree service", nil, ["tree trimming", "tree removal", "arborist", "stump"]),
        hit("snow-removal", .home, "Snow removal", nil, ["snow plowing", "snow shoveling", "plow"]),
        hit("painting", .home, "Painting", "interior & exterior", ["painter", "house painting"]),
        hit("carpentry", .home, "Carpentry", nil, ["carpenter", "woodwork", "cabinets", "decks"]),
        hit("roofing", .home, "Roofing", nil, ["roofer", "roof repair"]),
        hit("gutter-cleaning", .home, "Gutter cleaning", nil, ["gutters"]),
        hit("flooring", .home, "Flooring", nil, ["floors", "tile", "hardwood", "carpet installation"]),
        hit(
            "remodeling",
            .home,
            "Remodeling",
            "kitchens, baths & additions",
            ["general contractor", "contractor", "renovation", "construction", "builder"]
        ),
        hit("pest-control", .home, "Pest control", nil, ["exterminator", "termites", "bugs", "rodents"]),
        hit("pool-service", .home, "Pool service", nil, ["pool cleaning", "hot tub", "spa service"]),
        hit("pressure-washing", .home, "Pressure washing", nil, ["power washing", "driveway cleaning"]),
        hit("window-cleaning", .home, "Window cleaning", nil, ["windows"]),
        hit("carpet-cleaning", .home, "Carpet cleaning", nil, ["rug cleaning", "upholstery"]),
        hit("junk-removal", .home, "Junk removal", "hauling & cleanouts", ["hauling", "trash removal", "dump runs", "cleanout"]),
        hit("moving", .home, "Moving", "local & long-distance", ["movers", "moving help", "packing"]),
        hit("locksmith", .home, "Locksmith", nil, ["locks", "keys", "lockout"]),
        hit("home-organizing", .home, "Home organizing", nil, ["organizer", "declutter"]),
        hit("interior-design", .home, "Interior design", nil, ["interior designer", "decorating", "home staging"]),
        hit("furniture-assembly", .home, "Furniture assembly", nil, ["assembly", "ikea", "tv mounting"]),
        hit("fencing", .home, "Fencing", nil, ["fence", "gates"]),
        hit("masonry", .home, "Masonry", "brick, stone & concrete", ["mason", "concrete", "brick", "stone", "paving"]),
        hit("solar", .home, "Solar installation", nil, ["solar panels"]),
        hit("home-inspection", .home, "Home inspection", nil, ["home inspector", "inspector"]),
        hit("chimney", .home, "Chimney sweep", nil, ["chimney", "fireplace"]),

        // Personal services
        hit("tutoring-core", .personal, "Tutoring", "K-12, test prep, music", ["tutor", "homework help", "test prep", "math"]),
        hit("tutoring-centers", .personal, "Tutoring center", nil, ["learning center"]),
        hit(
            "music-lessons",
            .personal,
            "Music lessons",
            "piano, guitar & voice",
            ["music teacher", "piano", "guitar", "voice lessons", "violin", "drums"]
        ),
        hit("language-lessons", .personal, "Language lessons", nil, ["spanish", "english", "esl", "french", "language tutor"]),
        hit("art-classes", .personal, "Art classes", nil, ["drawing", "pottery", "painting classes"]),
        hit("childcare", .personal, "Childcare", "babysitting & nannies", ["babysitter", "babysitting", "nanny", "daycare", "child care"]),
        hit("elder-care", .personal, "Senior care", nil, ["elder care", "caregiver", "home care", "companion care"]),
        hit("petcare", .personal, "Pet care", "sitting & walks", ["pet sitter", "pet sitting", "dog sitting", "cat sitting", "boarding"]),
        hit("dog-walking", .personal, "Dog walking", nil, ["dog walker"]),
        hit("pet-grooming", .personal, "Pet grooming", nil, ["dog grooming", "groomer"]),
        hit("dog-training", .personal, "Dog training", nil, ["dog trainer", "obedience", "puppy training"]),
        hit("personal-training", .personal, "Personal training", nil, ["personal trainer", "fitness coach", "gym"]),
        hit("fitness-classes", .personal, "Fitness classes", "yoga, pilates & dance", ["yoga", "pilates", "dance", "zumba", "bootcamp"]),
        hit("massage", .personal, "Massage", nil, ["massage therapist", "bodywork"]),
        hit("hair-salon", .personal, "Hair salon", "cuts, color & styling", ["hairdresser", "hair stylist", "salon", "haircut"]),
        hit("barber", .personal, "Barber", nil, ["barbershop", "haircut", "shave"]),
        hit("nail-salon", .personal, "Nail salon", nil, ["manicure", "pedicure", "nails"]),
        hit(
            "beauty",
            .personal,
            "Beauty & skincare",
            "makeup, lashes & brows",
            ["esthetician", "facial", "makeup artist", "lashes", "brows", "waxing", "spa"]
        ),
        hit("photography", .personal, "Photography", nil, ["photographer", "photos", "portraits", "headshots"]),
        hit("videography", .personal, "Videography", nil, ["videographer", "video production", "filming"]),
        hit("event-planning", .personal, "Event planning", nil, ["event planner", "party planning", "wedding planner"]),
        hit("entertainment", .personal, "DJ & entertainment", nil, ["dj", "entertainer", "magician", "band", "live music"]),
        hit("catering", .personal, "Catering", nil, ["caterer", "event food"]),
        hit("personal-chef", .personal, "Personal chef", "meal prep", ["chef", "private chef", "cooking"]),
        hit("tailoring", .personal, "Tailoring & alterations", nil, ["tailor", "alterations", "seamstress", "sewing"]),
        hit("coaching", .personal, "Coaching", "life & career", ["life coach", "career coach", "coach"]),
        hit("counseling", .personal, "Counseling & therapy", nil, ["therapist", "counselor", "mental health"]),

        // Tech & repair
        hit("computer-repair", .tech, "Computer repair", nil, ["laptop repair", "pc repair", "mac repair"]),
        hit("phone-repair", .tech, "Phone repair", "screens & batteries", ["iphone repair", "cell phone repair", "screen repair"]),
        hit("it-support", .tech, "IT support", nil, ["tech support", "computer help", "networking", "wifi", "network setup"]),
        hit("web-design", .tech, "Web design", nil, ["website", "websites", "web developer", "web development"]),
        hit("app-development", .tech, "App development", nil, ["software", "developer", "programming", "apps"]),
        hit("tutoring-tech", .tech, "Coding lessons", "tech & coding tutoring", ["coding", "programming lessons", "computer lessons"]),
        hit("smart-home", .tech, "Smart home setup", nil, ["home automation", "security cameras", "home theater", "tv mounting"]),
        hit("appliance-repair", .tech, "Appliance repair", nil, ["washer repair", "dryer repair", "refrigerator repair", "fridge"]),
        hit("electronics-repair", .tech, "Electronics repair", nil, ["tv repair", "game console repair", "electronics"]),

        // Delivery & errands
        hit("courier", .delivery, "Courier", "same-day delivery", ["delivery", "package delivery", "messenger"]),
        hit("delivery-grocery", .delivery, "Grocery delivery", nil, ["groceries", "grocery shopping"]),
        hit("errands", .delivery, "Errand running", nil, ["errands", "personal assistant", "concierge", "personal shopping"]),
        hit("meal-delivery", .delivery, "Meal delivery", nil, ["food delivery"]),

        // Goods & retail
        hit("bakery", .goods, "Bakery", nil, ["baker", "cakes", "pastries", "bread", "cookies"]),
        hit("restaurant", .goods, "Restaurant", nil, ["food", "dining", "takeout"]),
        hit("coffee-shop", .goods, "Coffee shop", nil, ["cafe", "café", "coffee", "tea"]),
        hit("food-truck", .goods, "Food truck", nil, ["street food"]),
        hit("farm-stand", .goods, "Farm stand", "produce, eggs & honey", ["farmers market", "produce", "eggs", "honey", "farm"]),
        hit("grocery-store", .goods, "Grocery store", nil, ["market", "corner store", "deli"]),
        hit("florist", .goods, "Florist", nil, ["flowers", "floral"]),
        hit("clothing", .goods, "Clothing boutique", nil, ["clothing", "boutique", "apparel", "fashion"]),
        hit(
            "thrift",
            .goods,
            "Thrift & resale",
            "pre-loved items",
            ["thrift store", "resale", "secondhand", "consignment", "vintage", "used"]
        ),
        hit("handmade", .goods, "Handmade crafts", nil, ["crafts", "artisan"]),
        hit("jewelry", .goods, "Jewelry", nil, ["jeweler", "accessories"]),
        hit("art-prints", .goods, "Art & prints", nil, ["artist", "art gallery", "paintings"]),
        hit("bookstore", .goods, "Bookstore", nil, ["books"]),
        hit("gift-shop", .goods, "Gift shop", nil, ["gifts"]),
        hit("plant-nursery", .goods, "Plant nursery", nil, ["plants", "garden center"]),
        hit("pet-supplies", .goods, "Pet supplies", nil, ["pet store"]),
        hit("hardware-store", .goods, "Hardware store", nil, ["tools", "hardware"]),
        hit("furniture", .goods, "Furniture", nil, ["furniture store", "home goods"]),
        hit("antiques", .goods, "Antiques", nil, ["antique", "collectibles"]),

        // Rentals
        hit("equipment-rental", .rentals, "Equipment rental", nil, ["tool rental", "equipment"]),
        hit(
            "party-rentals",
            .rentals,
            "Party rentals",
            "tents, tables & bounce houses",
            ["event rentals", "bounce house", "tents", "tables", "chairs"]
        ),
        hit("vacation-rental", .rentals, "Vacation rental", nil, ["short-term rental", "guest house", "cabin", "airbnb"]),
        hit("home-rental", .rentals, "Room & apartment rental", nil, ["apartment", "rooms", "housing", "long-term rental"]),
        hit("storage", .rentals, "Storage", nil, ["storage units", "self storage", "parking"]),
        hit(
            "gear-rental",
            .rentals,
            "Gear rental",
            "camping, sports & camera gear",
            ["camera rental", "camping gear", "kayak", "ski rental"]
        ),
        hit("car-rental", .rentals, "Car rental", nil, ["vehicle rental", "truck rental", "van rental"]),
        hit("event-space", .rentals, "Event space", nil, ["venue", "event venue", "hall"]),

        // Vehicles & rideshare
        hit("rideshare", .vehicles, "Rideshare driving", nil, ["driver", "rides", "uber", "lyft"]),
        hit("auto-repair", .vehicles, "Auto repair", nil, ["mechanic", "car repair", "auto shop", "oil change", "brakes"]),
        hit("mobile-mechanic", .vehicles, "Mobile mechanic", nil, ["mechanic"]),
        hit("car-detailing", .vehicles, "Car detailing", nil, ["car wash", "detailing", "auto detailing"]),
        hit("towing", .vehicles, "Towing", "roadside assistance", ["tow truck", "roadside"]),
        hit("auto-body", .vehicles, "Auto body", nil, ["collision repair", "body shop", "dent repair"]),
        hit("tire-shop", .vehicles, "Tire shop", nil, ["tires"]),
        hit("driving-lessons", .vehicles, "Driving lessons", nil, ["driving school", "driving instructor"]),
        hit("chauffeur", .vehicles, "Chauffeur & limo", nil, ["limo", "limousine", "car service", "airport rides"]),
        hit("bike-shop", .vehicles, "Bike shop & repair", nil, ["bicycle", "bike repair", "e-bike"]),
        hit("trucking", .vehicles, "Trucking & hauling", nil, ["truck", "freight", "box truck", "fleet"]),

        // Professional and other services (the "Something else" tile)
        hit("accounting", .other, "Accounting", "bookkeeping & taxes", ["accountant", "bookkeeping", "bookkeeper", "cpa", "taxes"]),
        hit("tax-preparation", .other, "Tax preparation", nil, ["taxes", "tax preparer"]),
        hit("legal", .other, "Legal services", nil, ["lawyer", "attorney", "law firm", "paralegal"]),
        hit("notary", .other, "Notary", nil, ["notary public", "mobile notary"]),
        hit("real-estate", .other, "Real estate", nil, ["realtor", "real estate agent", "broker"]),
        hit("property-management", .other, "Property management", nil, ["property manager", "landlord"]),
        hit("insurance", .other, "Insurance", nil, ["insurance agent"]),
        hit("financial-planning", .other, "Financial planning", nil, ["financial advisor", "financial planner"]),
        hit("consulting", .other, "Consulting", nil, ["consultant", "business consulting"]),
        hit("marketing", .other, "Marketing", "social media & ads", ["social media", "advertising", "seo", "branding"]),
        hit("graphic-design", .other, "Graphic design", nil, ["graphic designer", "logo design", "design"]),
        hit("writing", .other, "Writing & editing", nil, ["writer", "editor", "copywriting", "proofreading"]),
        hit("translation", .other, "Translation", nil, ["translator", "interpreter"]),
        hit("printing", .other, "Printing & signs", nil, ["print shop", "signs", "screen printing"])
    ]

    /// Listed categories (then tiles) matching `query`, best first.
    ///
    /// Ranking: the name starts with the query, then a word in the name
    /// does, then another name people use for it does, then the query
    /// appears anywhere in the name, the sub-area or those other names,
    /// then every word of the query appears somewhere in the entry.
    static func search(_ query: String, limit: Int = maxResults) -> [CategorySearchHit] {
        let normalized = normalize(query)
        guard !normalized.isEmpty else { return [] }
        let tiles = BusinessCategory.allCases.map(CategorySearchHit.init(tile:))
        let ranked = (listed + tiles).enumerated().compactMap { index, hit -> (order: Int, hit: CategorySearchHit)? in
            guard let rank = rank(of: hit, for: normalized) else { return nil }
            // Rank first, then list order (Swift's sort isn't stable).
            return (rank * 10000 + index, hit)
        }
        return ranked
            .sorted { $0.order < $1.order }
            .prefix(limit)
            .map(\.hit)
    }

    /// Lowercased, trimmed, with runs of spaces collapsed to one.
    static func normalize(_ text: String) -> String {
        text.lowercased()
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    private static func rank(of hit: CategorySearchHit, for query: String) -> Int? {
        let name = normalize(hit.name)
        let detail = normalize(hit.detail ?? "")
        if name.hasPrefix(query) { return 0 }
        if name.contains(" " + query) { return 1 }
        if hit.keywords.contains(where: { $0.hasPrefix(query) || $0.contains(" " + query) }) { return 2 }
        if name.contains(query) || detail.contains(query) || hit.keywords.contains(where: { $0.contains(query) }) {
            return 3
        }
        let haystack = ([name, detail] + hit.keywords).joined(separator: " ")
        let words = query.split(separator: " ")
        if words.count > 1, words.allSatisfy({ haystack.contains($0) }) { return 4 }
        return nil
    }

    private static func hit(
        _ id: String,
        _ category: BusinessCategory,
        _ name: String,
        _ detail: String?,
        _ keywords: [String]
    ) -> CategorySearchHit {
        CategorySearchHit(id: id, category: category, name: name, detail: detail, keywords: keywords)
    }
}
