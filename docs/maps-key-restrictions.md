# Map API Key Restrictions

Production API keys must be restricted to prevent abuse and unauthorized usage.

## Google Maps SDK key (Android only: `MAPS_API_KEY`)

Only the Android app uses a Google Maps key. It is read at build time from
`MAPS_API_KEY` (the `android-release` GitHub environment for release builds,
`frontend/apps/android/.env` locally) and baked into the manifest, so changing
it needs a new build. The iOS app has no Google Maps key.

Google Cloud project `pantopus-prod`, key `pantopus-android-maps-prod`:

- **API restriction**: Maps SDK for Android only.
- **Application restriction**: Android apps. Add one entry per package and
  SHA-1 pair:

| Package | SHA-1 | Covers |
|---|---|---|
| `com.pantopus.app` | `42:AC:48:11:1A:63:75:95:03:4E:01:0F:5F:F1:DF:DE:F5:8F:6C:6C` | Play app signing of the original listing (builds installed from Play) |
| `com.pantopus.app` | `0E:0B:BD:77:CC:30:C3:0F:5C:92:CC:36:FD:21:B1:C3:CC:DD:2B:9B` | Upload key of the original listing (release builds installed outside Play) |
| `app.pantopus.android` | `CC:D7:2C:6B:E6:7D:DB:27:CA:FA:7C:E4:87:0A:7A:C0:75:A3:DB:53` | Pilot app: Play app signing |
| `app.pantopus.android` | `8A:04:F3:56:B9:F5:8B:E0:9E:DC:88:2C:CA:FA:72:E1:DC:1D:4F:BE` | Pilot app: upload key |
| `app.pantopus.android` | `56:50:FB:B4:4A:74:EB:93:1E:93:18:39:52:4D:BE:49:AE:E0:63:62` | Pilot app: Play's previous signing certificate |
| `com.pantopus.app.debug` | the developer's debug keystore SHA-1 | debug builds (optional; use a separate key) |

Since PR 2802 (October 26) master builds Android as `com.pantopus.app`, the
original listing, so the first two rows are the ones real users need. The
`app.pantopus.android` rows keep the pilot app working.

The Play SHA-1s come from Play Console → Test and release → App integrity →
App signing. The upload key's SHA-1 comes from `keytool -list -v` on the
release keystore.

### How to apply

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   and open `pantopus-android-maps-prod`.
2. Under "Application restrictions", choose "Android apps" and add the rows above.
3. Under "API restrictions", choose "Restrict key" and enable only
   "Maps SDK for Android".
4. Restriction changes apply on Google's side within about five minutes and
   need no new build. Only a different key value needs one: copy it into the
   `MAPS_API_KEY` secret of the `android-release` GitHub environment and ship
   a new Android build.

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

- [ ] Google Maps Android key restricted to `com.pantopus.app` and `app.pantopus.android` with the SHA-1s above
- [ ] Google Maps key restricted to Maps SDK for Android only
- [ ] Mapbox public token has only read scopes (no write/secret scopes)
- [ ] Mapbox web token has URL restrictions for production domain(s)
- [ ] No secret tokens appear in client-side code (`grep -r 'sk\.' frontend/`)
- [ ] Backend `MAPBOX_ACCESS_TOKEN` is not prefixed with `NEXT_PUBLIC_`
