# Map API Key Restrictions

Production API keys must be restricted to prevent abuse and unauthorized usage.

## Google Maps API Key (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)

### iOS Restrictions (Google Cloud Console)

- **Application restriction**: iOS apps
- **Bundle ID**: `com.pantopus.app`
- **API restrictions**: Enable only:
  - Maps SDK for iOS

### Android Restrictions (Google Cloud Console)

- **Application restriction**: Android apps
- **Package name**: `com.pantopus.app`
- **SHA-1 certificate fingerprint**: Add both:
  - Debug keystore fingerprint (for development)
  - Upload/signing key fingerprint (from Google Play Console → Setup → App signing)
- **API restrictions**: Enable only:
  - Maps SDK for Android

### How to Apply

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on the API key used for `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
3. Under "Application restrictions", select the platform and add the identifiers above
4. Under "API restrictions", select "Restrict key" and enable only the SDKs listed
5. Create **separate keys** for iOS and Android if needed for tighter restrictions

## Mapbox Token (NEXT_PUBLIC_MAPBOX_TOKEN / MAPBOX_ACCESS_TOKEN)

### Public Token (client-side — web and mobile)

- **Scopes** (minimum required):
  - `styles:tiles` — load raster/vector tiles
  - `styles:read` — read style documents
  - `fonts:read` — load glyphs for labels
- **No secret scopes**: Do not enable `tokens:write`, `styles:write`, `uploads:write`,
  `datasets:write`, or any other write scope on public tokens
- **URL restrictions** (web only):
  - `https://pantopus.com`
  - `https://*.pantopus.com`
  - `http://localhost:3000` (development only — use a separate token)

### Secret Token (server-side — backend only)

- Used for server-side geocoding (`MAPBOX_ACCESS_TOKEN` in backend `.env`)
- **Never expose in client-side code** (no `EXPO_PUBLIC_` or `NEXT_PUBLIC_` prefix)
- Scopes: `styles:tiles`, `styles:read`, `fonts:read` plus geocoding access
- No URL restrictions needed (server-to-server)

### How to Apply

1. Go to [Mapbox Account → Access Tokens](https://account.mapbox.com/access-tokens/)
2. Create or edit tokens with the scopes and restrictions listed above
3. Use separate tokens for web (public, URL-restricted) and backend (secret)

## Verification Checklist

- [ ] Google Maps iOS key restricted to bundle ID `com.pantopus.app`
- [ ] Google Maps Android key restricted to package `com.pantopus.app` + SHA-1
- [ ] Google Maps keys restricted to Maps SDK for iOS / Android only
- [ ] Mapbox public token has only read scopes (no write/secret scopes)
- [ ] Mapbox web token has URL restrictions for production domain(s)
- [ ] No secret tokens appear in client-side code (`grep -r 'sk\.' frontend/`)
- [ ] Backend `MAPBOX_ACCESS_TOKEN` is not prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`
