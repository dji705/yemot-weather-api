# Yemot Weather API

API for a Yemot HaMashiach IVR weather branch. Uses Open-Meteo geocoding and forecast services; no API key is required.

## Endpoint

After deploying on Vercel:

`https://YOUR-PROJECT.vercel.app/api/weather?town=ירושלים`

The endpoint returns Yemot-compatible `read=` output in Hebrew.

## Query parameters

- `town` — town name in Hebrew or English.
- `city` — alternative to `town`.
- `ApiPhoneInput` or `val` — accepted as alternative parameter names for integrations that pass input under those names.

If no town parameter is supplied, the API returns a Yemot `read=` prompt requesting the town name.

## Deploy

1. Import this repository into Vercel.
2. Deploy with the default settings (Node.js 18 or newer).
3. Test: `/api/weather?town=ירושלים`

## Important note about keypad input

The endpoint accepts a town name passed as text. Whether callers can enter Hebrew letters directly from a phone keypad depends on the input method configured in Yemot. Configure Yemot to pass the collected town text in the `town` parameter; a normal numeric DTMF value alone cannot identify a Hebrew town name.
