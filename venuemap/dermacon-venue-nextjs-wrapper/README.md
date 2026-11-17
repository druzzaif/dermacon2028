# DERMACON 2027 venue wrapper (Next.js App Router)

1. `npm i three@0.160.0`
2. Copy `lib/dermacon-venue/dermacon-venue.mjs` and `components/VenueMap.tsx` into your app.
   (Adjust the `@/` import alias if your tsconfig uses something else.)
3. Put `app/venue/page.tsx` (or use `<VenueMap />` anywhere inside a Suspense boundary).
4. Faculty links: `/venue?to=hall-b`. Accepted values include room ids (`hall-a`, `hall-b`, `hall-b-2`, `hall-c`, `hall-c-2`,
   `iadvl-hall`, `ec-hall`, `industries-1`, `international-hall`, `sig-1`, `workshop-3`, `faculty-lounge`, `preview-room`,
   `dining`, `registration`) and their aliases (e.g. `b-1`, `c-6`, `e-3`).
5. The venue is a client component, so it is loaded with `ssr: false` semantics via the effect above.
