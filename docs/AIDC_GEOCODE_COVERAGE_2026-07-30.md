# AI Capex map location coverage

Generated from the published 75-campus AI Capex dataset on 2026-07-30.

## Coverage

- Total records: 75
- Located records: 75
- Unresolved records: 0
- Explicit coordinates in an Epoch timeline/source: 9
- Epoch Satellite Explorer campus locations: 66
- Permit/parcel overrides: 0
- Address-geocoded records: 0
- Place-level fallback records: 0

## Evidence priority

The repeatable location pipeline applies this order and stops at the first
reliable match:

1. Explicit latitude/longitude in an Epoch timeline or linked source.
2. The campus location embedded in the matching Epoch Satellite Explorer.
3. A reviewed permit, land-use map, or parcel override in
   `data/aidc-capex-location-overrides.json`.
4. A complete-address match through the US Census Geocoder and/or OpenStreetMap
   Nominatim.
5. A city/county centroid, explicitly labelled place-level and not a campus
   parcel.

An unresolved record stays off the map. A city/county centroid must never be
presented as a building or campus coordinate.

## Previously unresolved examples

| Project | New location evidence | Precision |
| --- | --- | --- |
| Meta Prometheus | Epoch Satellite Explorer | Campus/satellite |
| Microsoft Project Osmium | Epoch Satellite Explorer | Campus/satellite |
| Microsoft SAT40 | Google Earth coordinate linked in the Epoch timeline | Explicit source coordinate |
| OpenAI Stargate Michigan | Epoch Satellite Explorer | Campus/satellite |
| OpenAI Stargate New Mexico | Epoch Satellite Explorer | Campus/satellite |
| OpenAI Stargate UAE | Epoch Satellite Explorer | Campus/satellite |

Every published geocode record includes its precision, evidence tier, source,
source URL, and generation timestamp. The browser renders these labels in the
project tooltip and detail view.
