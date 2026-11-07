@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.create_business

import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Delivery
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Goods
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Home
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Other
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Personal
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Rentals
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Tech
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory.Vehicles

/**
 * The listed business categories the Create Business wizard's search finds,
 * each filed under one of the eight tiles. A pick saves its name in
 * `categories[]` (business pages show it as written). Anything not listed is
 * added as the owner's own category, which the server stores the same way
 * (`categories` is free text, `backend/routes/businesses.js:650`).
 *
 * iOS keeps the same list in `CreateBusinessCategoryCatalog.swift`; change
 * both together.
 */
internal object CreateBusinessCategoryCatalog {
    /** Most matches the search frame lists before "Add as a custom category". */
    const val MAX_RESULTS: Int = 6

    /** Listed categories, grouped by tile. Within a tie the earlier entry ranks first. */
    val listed: List<CategorySearchHit> =
        listOf(
            // Home services
            hit("handyman", Home, "Handyman", "repairs & odd jobs", "handy man", "odd jobs", "home repair", "fix"),
            hit(
                "house-cleaning",
                Home,
                "Cleaning",
                "homes & move-outs",
                "house cleaning",
                "maid",
                "housekeeping",
                "janitorial",
                "deep clean",
            ),
            hit("plumbing", Home, "Plumbing", null, "plumber", "drain", "pipes", "water heater", "leak"),
            hit("electrical", Home, "Electrical", null, "electrician", "wiring", "lighting", "outlets"),
            hit("hvac", Home, "Heating & cooling", "HVAC", "air conditioning", "ac repair", "furnace", "heat pump"),
            hit("lawncare", Home, "Lawn care", "mowing & seasonal", "mowing", "yard work", "grass", "leaf removal"),
            hit("landscaping", Home, "Landscaping", null, "landscaper", "garden design", "hardscaping", "yard"),
            hit("gardening", Home, "Gardening", null, "gardener", "weeding", "planting"),
            hit("tree-service", Home, "Tree service", null, "tree trimming", "tree removal", "arborist", "stump"),
            hit("snow-removal", Home, "Snow removal", null, "snow plowing", "snow shoveling", "plow"),
            hit("painting", Home, "Painting", "interior & exterior", "painter", "house painting"),
            hit("carpentry", Home, "Carpentry", null, "carpenter", "woodwork", "cabinets", "decks"),
            hit("roofing", Home, "Roofing", null, "roofer", "roof repair"),
            hit("gutter-cleaning", Home, "Gutter cleaning", null, "gutters"),
            hit("flooring", Home, "Flooring", null, "floors", "tile", "hardwood", "carpet installation"),
            hit(
                "remodeling",
                Home,
                "Remodeling",
                "kitchens, baths & additions",
                "general contractor",
                "contractor",
                "renovation",
                "construction",
                "builder",
            ),
            hit("pest-control", Home, "Pest control", null, "exterminator", "termites", "bugs", "rodents"),
            hit("pool-service", Home, "Pool service", null, "pool cleaning", "hot tub", "spa service"),
            hit("pressure-washing", Home, "Pressure washing", null, "power washing", "driveway cleaning"),
            hit("window-cleaning", Home, "Window cleaning", null, "windows"),
            hit("carpet-cleaning", Home, "Carpet cleaning", null, "rug cleaning", "upholstery"),
            hit("junk-removal", Home, "Junk removal", "hauling & cleanouts", "hauling", "trash removal", "dump runs", "cleanout"),
            hit("moving", Home, "Moving", "local & long-distance", "movers", "moving help", "packing"),
            hit("locksmith", Home, "Locksmith", null, "locks", "keys", "lockout"),
            hit("home-organizing", Home, "Home organizing", null, "organizer", "declutter"),
            hit("interior-design", Home, "Interior design", null, "interior designer", "decorating", "home staging"),
            hit("furniture-assembly", Home, "Furniture assembly", null, "assembly", "ikea", "tv mounting"),
            hit("fencing", Home, "Fencing", null, "fence", "gates"),
            hit("masonry", Home, "Masonry", "brick, stone & concrete", "mason", "concrete", "brick", "stone", "paving"),
            hit("solar", Home, "Solar installation", null, "solar panels"),
            hit("home-inspection", Home, "Home inspection", null, "home inspector", "inspector"),
            hit("chimney", Home, "Chimney sweep", null, "chimney", "fireplace"),
            // Personal services
            hit("tutoring-core", Personal, "Tutoring", "K-12, test prep, music", "tutor", "homework help", "test prep", "math"),
            hit("tutoring-centers", Personal, "Tutoring center", null, "learning center"),
            hit(
                "music-lessons",
                Personal,
                "Music lessons",
                "piano, guitar & voice",
                "music teacher",
                "piano",
                "guitar",
                "voice lessons",
                "violin",
                "drums",
            ),
            hit("language-lessons", Personal, "Language lessons", null, "spanish", "english", "esl", "french", "language tutor"),
            hit("art-classes", Personal, "Art classes", null, "drawing", "pottery", "painting classes"),
            hit("childcare", Personal, "Childcare", "babysitting & nannies", "babysitter", "babysitting", "nanny", "daycare", "child care"),
            hit("elder-care", Personal, "Senior care", null, "elder care", "caregiver", "home care", "companion care"),
            hit("petcare", Personal, "Pet care", "sitting & walks", "pet sitter", "pet sitting", "dog sitting", "cat sitting", "boarding"),
            hit("dog-walking", Personal, "Dog walking", null, "dog walker"),
            hit("pet-grooming", Personal, "Pet grooming", null, "dog grooming", "groomer"),
            hit("dog-training", Personal, "Dog training", null, "dog trainer", "obedience", "puppy training"),
            hit("personal-training", Personal, "Personal training", null, "personal trainer", "fitness coach", "gym"),
            hit("fitness-classes", Personal, "Fitness classes", "yoga, pilates & dance", "yoga", "pilates", "dance", "zumba", "bootcamp"),
            hit("massage", Personal, "Massage", null, "massage therapist", "bodywork"),
            hit("hair-salon", Personal, "Hair salon", "cuts, color & styling", "hairdresser", "hair stylist", "salon", "haircut"),
            hit("barber", Personal, "Barber", null, "barbershop", "haircut", "shave"),
            hit("nail-salon", Personal, "Nail salon", null, "manicure", "pedicure", "nails"),
            hit(
                "beauty",
                Personal,
                "Beauty & skincare",
                "makeup, lashes & brows",
                "esthetician",
                "facial",
                "makeup artist",
                "lashes",
                "brows",
                "waxing",
                "spa",
            ),
            hit("photography", Personal, "Photography", null, "photographer", "photos", "portraits", "headshots"),
            hit("videography", Personal, "Videography", null, "videographer", "video production", "filming"),
            hit("event-planning", Personal, "Event planning", null, "event planner", "party planning", "wedding planner"),
            hit("entertainment", Personal, "DJ & entertainment", null, "dj", "entertainer", "magician", "band", "live music"),
            hit("catering", Personal, "Catering", null, "caterer", "event food"),
            hit("personal-chef", Personal, "Personal chef", "meal prep", "chef", "private chef", "cooking"),
            hit("tailoring", Personal, "Tailoring & alterations", null, "tailor", "alterations", "seamstress", "sewing"),
            hit("coaching", Personal, "Coaching", "life & career", "life coach", "career coach", "coach"),
            hit("counseling", Personal, "Counseling & therapy", null, "therapist", "counselor", "mental health"),
            // Tech & repair
            hit("computer-repair", Tech, "Computer repair", null, "laptop repair", "pc repair", "mac repair"),
            hit("phone-repair", Tech, "Phone repair", "screens & batteries", "iphone repair", "cell phone repair", "screen repair"),
            hit("it-support", Tech, "IT support", null, "tech support", "computer help", "networking", "wifi", "network setup"),
            hit("web-design", Tech, "Web design", null, "website", "websites", "web developer", "web development"),
            hit("app-development", Tech, "App development", null, "software", "developer", "programming", "apps"),
            hit("tutoring-tech", Tech, "Coding lessons", "tech & coding tutoring", "coding", "programming lessons", "computer lessons"),
            hit("smart-home", Tech, "Smart home setup", null, "home automation", "security cameras", "home theater", "tv mounting"),
            hit("appliance-repair", Tech, "Appliance repair", null, "washer repair", "dryer repair", "refrigerator repair", "fridge"),
            hit("electronics-repair", Tech, "Electronics repair", null, "tv repair", "game console repair", "electronics"),
            // Delivery & errands
            hit("courier", Delivery, "Courier", "same-day delivery", "delivery", "package delivery", "messenger"),
            hit("delivery-grocery", Delivery, "Grocery delivery", null, "groceries", "grocery shopping"),
            hit("errands", Delivery, "Errand running", null, "errands", "personal assistant", "concierge", "personal shopping"),
            hit("meal-delivery", Delivery, "Meal delivery", null, "food delivery"),
            // Goods & retail
            hit("bakery", Goods, "Bakery", null, "baker", "cakes", "pastries", "bread", "cookies"),
            hit("restaurant", Goods, "Restaurant", null, "food", "dining", "takeout"),
            hit("coffee-shop", Goods, "Coffee shop", null, "cafe", "café", "coffee", "tea"),
            hit("food-truck", Goods, "Food truck", null, "street food"),
            hit("farm-stand", Goods, "Farm stand", "produce, eggs & honey", "farmers market", "produce", "eggs", "honey", "farm"),
            hit("grocery-store", Goods, "Grocery store", null, "market", "corner store", "deli"),
            hit("florist", Goods, "Florist", null, "flowers", "floral"),
            hit("clothing", Goods, "Clothing boutique", null, "clothing", "boutique", "apparel", "fashion"),
            hit(
                "thrift",
                Goods,
                "Thrift & resale",
                "pre-loved items",
                "thrift store",
                "resale",
                "secondhand",
                "consignment",
                "vintage",
                "used",
            ),
            hit("handmade", Goods, "Handmade crafts", null, "crafts", "artisan"),
            hit("jewelry", Goods, "Jewelry", null, "jeweler", "accessories"),
            hit("art-prints", Goods, "Art & prints", null, "artist", "art gallery", "paintings"),
            hit("bookstore", Goods, "Bookstore", null, "books"),
            hit("gift-shop", Goods, "Gift shop", null, "gifts"),
            hit("plant-nursery", Goods, "Plant nursery", null, "plants", "garden center"),
            hit("pet-supplies", Goods, "Pet supplies", null, "pet store"),
            hit("hardware-store", Goods, "Hardware store", null, "tools", "hardware"),
            hit("furniture", Goods, "Furniture", null, "furniture store", "home goods"),
            hit("antiques", Goods, "Antiques", null, "antique", "collectibles"),
            // Rentals
            hit("equipment-rental", Rentals, "Equipment rental", null, "tool rental", "equipment"),
            hit(
                "party-rentals",
                Rentals,
                "Party rentals",
                "tents, tables & bounce houses",
                "event rentals",
                "bounce house",
                "tents",
                "tables",
                "chairs",
            ),
            hit("vacation-rental", Rentals, "Vacation rental", null, "short-term rental", "guest house", "cabin", "airbnb"),
            hit("home-rental", Rentals, "Room & apartment rental", null, "apartment", "rooms", "housing", "long-term rental"),
            hit("storage", Rentals, "Storage", null, "storage units", "self storage", "parking"),
            hit(
                "gear-rental",
                Rentals,
                "Gear rental",
                "camping, sports & camera gear",
                "camera rental",
                "camping gear",
                "kayak",
                "ski rental",
            ),
            hit("car-rental", Rentals, "Car rental", null, "vehicle rental", "truck rental", "van rental"),
            hit("event-space", Rentals, "Event space", null, "venue", "event venue", "hall"),
            // Vehicles & rideshare
            hit("rideshare", Vehicles, "Rideshare driving", null, "driver", "rides", "uber", "lyft"),
            hit("auto-repair", Vehicles, "Auto repair", null, "mechanic", "car repair", "auto shop", "oil change", "brakes"),
            hit("mobile-mechanic", Vehicles, "Mobile mechanic", null, "mechanic"),
            hit("car-detailing", Vehicles, "Car detailing", null, "car wash", "detailing", "auto detailing"),
            hit("towing", Vehicles, "Towing", "roadside assistance", "tow truck", "roadside"),
            hit("auto-body", Vehicles, "Auto body", null, "collision repair", "body shop", "dent repair"),
            hit("tire-shop", Vehicles, "Tire shop", null, "tires"),
            hit("driving-lessons", Vehicles, "Driving lessons", null, "driving school", "driving instructor"),
            hit("chauffeur", Vehicles, "Chauffeur & limo", null, "limo", "limousine", "car service", "airport rides"),
            hit("bike-shop", Vehicles, "Bike shop & repair", null, "bicycle", "bike repair", "e-bike"),
            hit("trucking", Vehicles, "Trucking & hauling", null, "truck", "freight", "box truck", "fleet"),
            // Professional and other services (the "Something else" tile)
            hit("accounting", Other, "Accounting", "bookkeeping & taxes", "accountant", "bookkeeping", "bookkeeper", "cpa", "taxes"),
            hit("tax-preparation", Other, "Tax preparation", null, "taxes", "tax preparer"),
            hit("legal", Other, "Legal services", null, "lawyer", "attorney", "law firm", "paralegal"),
            hit("notary", Other, "Notary", null, "notary public", "mobile notary"),
            hit("real-estate", Other, "Real estate", null, "realtor", "real estate agent", "broker"),
            hit("property-management", Other, "Property management", null, "property manager", "landlord"),
            hit("insurance", Other, "Insurance", null, "insurance agent"),
            hit("financial-planning", Other, "Financial planning", null, "financial advisor", "financial planner"),
            hit("consulting", Other, "Consulting", null, "consultant", "business consulting"),
            hit("marketing", Other, "Marketing", "social media & ads", "social media", "advertising", "seo", "branding"),
            hit("graphic-design", Other, "Graphic design", null, "graphic designer", "logo design", "design"),
            hit("writing", Other, "Writing & editing", null, "writer", "editor", "copywriting", "proofreading"),
            hit("translation", Other, "Translation", null, "translator", "interpreter"),
            hit("printing", Other, "Printing & signs", null, "print shop", "signs", "screen printing"),
        )

    /**
     * Listed categories (then tiles) matching [query], best first.
     *
     * Ranking: the name starts with the query, then a word in the name does,
     * then another name people use for it does, then the query appears
     * anywhere in the name, the sub-area or those other names, then every
     * word of the query appears somewhere in the entry.
     */
    fun search(
        query: String,
        limit: Int = MAX_RESULTS,
    ): List<CategorySearchHit> {
        val normalized = normalize(query)
        if (normalized.isEmpty()) return emptyList()
        val tiles = BusinessCategory.entries.map { CategorySearchHit.tile(it) }
        return (listed + tiles)
            .mapNotNull { hit -> rank(hit, normalized)?.let { hit to it } }
            // sortedBy is stable, so a tie keeps list order.
            .sortedBy { it.second }
            .take(limit)
            .map { it.first }
    }

    /** Lowercased, trimmed, with runs of spaces collapsed to one. */
    fun normalize(text: String): String = collapseSpaces(text.lowercase())

    /** Trimmed, with runs of spaces collapsed to one. */
    fun collapseSpaces(text: String): String = text.split(Regex("\\s+")).filter { it.isNotEmpty() }.joinToString(" ")

    // Search ranks, best first.
    private const val RANK_NAME_STARTS = 0
    private const val RANK_NAME_WORD_STARTS = 1
    private const val RANK_OTHER_NAME_STARTS = 2
    private const val RANK_CONTAINS = 3
    private const val RANK_ALL_WORDS = 4

    private fun rank(
        hit: CategorySearchHit,
        query: String,
    ): Int? {
        val name = normalize(hit.name)
        val detail = normalize(hit.detail.orEmpty())
        return when {
            name.startsWith(query) -> RANK_NAME_STARTS
            name.contains(" $query") -> RANK_NAME_WORD_STARTS
            hit.keywords.any { it.startsWith(query) || it.contains(" $query") } -> RANK_OTHER_NAME_STARTS
            name.contains(query) || detail.contains(query) || hit.keywords.any { it.contains(query) } -> RANK_CONTAINS
            else -> {
                val haystack = (listOf(name, detail) + hit.keywords).joinToString(" ")
                val words = query.split(" ")
                if (words.size > 1 && words.all { haystack.contains(it) }) RANK_ALL_WORDS else null
            }
        }
    }

    private fun hit(
        id: String,
        category: BusinessCategory,
        name: String,
        detail: String?,
        vararg keywords: String,
    ): CategorySearchHit = CategorySearchHit(id = id, category = category, name = name, detail = detail, keywords = keywords.toList())
}
