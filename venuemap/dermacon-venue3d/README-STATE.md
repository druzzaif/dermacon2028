# DERMACON 2027 3D venue: project files (updated to the final layout, 2 Nov 2026)

## Layout source
Conference Layout, 2 Nov 2026 (GPE Expo / CorelDRAW). Hall-by-hall figures are in the separate extraction notes.

## Structure
- src/data.js: building footprints, rooms (ROOMS), tunnels, gates, carpets, lawns, stall data. Metres. +X east, +Z south.
- src/halls.js: hall shells and interiors (Halls A, B, C, E, D, F dining, Entertainment, Registration with kit distribution).
- src/kit.js: geometry kit, materials, signs, chairs, seated-person figures (white headphones option).
- src/site.js: campus (ground, roads, gates, washrooms, food courts, tunnels, sculptures).
- src/nav.js: route planning and directions.
- src/ui.js: wayfinding panel, minimap styling.
- src/index.js: createVenue(container, options). Step-inside panorama, room reveal, minimap with tappable hall letters A-F, seated people.
- src/page-entry.js: standalone page; reads ?to=hall-b (or #hall-b).
- template.html: standalone page shell with the credit line.

## Build
- npm i three@0.160.0 esbuild
- node build.mjs            -> dist/index.html (standalone; loads three from jsDelivr)
- node build-lib.mjs        -> dist/lib/dermacon-venue.mjs (library for Next.js)
- node verify.mjs           -> headless check of rooms, seats and footprints (needs a three.js stub; see verify notes)

## Known deviations from the plan
- Eastern hall column is about 10 m closer than the drawing; campus and gates keep their old positions.
- Workshop halls are 16.5 m wide where the plan prints 17 m.
- Dining: 46 round tables counted from the plan; 8 chairs per table assumed.
- Ramps not modelled as separate geometry. Washrooms keep old campus positions.

## Not yet verified
- Real rendering (3D scene, frame rate, mobile layout). Checked only headlessly: room registration, seat counts, footprints overlaid on the plan.
