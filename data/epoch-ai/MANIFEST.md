# Snapshot manifest

## Downloaded files

| File | SHA-256 |
|---|---|
| `raw/data_centers.zip` | `65594606e2846138b3e25145aa744dab1a29c2a783005af7598b912ccb780c7c` |
| `raw/data_centers.csv` | `af2840f71d36886139e2db0e5aa7d92586aacd1f8dc0e7f3e8327c3b49257bde` |
| `raw/data_center_timelines.csv` | `4418f1ad737008def8ee388102e40ab95e73968223beba3ccee30aa6aab2d996` |
| `raw/data_center_chillers.csv` | `9711dcfdac0b0de82a1808717e106ea28e213c2a845b42a691ad3cd63caeb704` |
| `raw/data_center_cooling_towers.csv` | `c9ce622e1eaf15cc70bf2445a66f17c9c2be19a3638a96c421dc7e31c3a2db66` |
| `raw/ai_chip_owners.zip` | `a04292a446537cdd789c14429fae924e55acc8d1b5e9595fd6675bde9c303780` |
| `raw/ml_hardware.csv` | `9ecfe145b60360cf4bb66399106ee6a7c57b1c2e98668cae558b0ede16e96e91` |

## Extracted tables

| Table | Rows | What it describes | Granularity contribution |
|---|---:|---|---|
| `data_centers.csv` | 75 | Current project snapshot, owners, users, location, power, compute, cost | Project/site level |
| `data_center_timelines.csv` | 424 | Dated construction status, operational buildings, power, compute, cost | Project-time/event level |
| `data_center_chip_quantities.csv` | 205 | Chip type and estimated unit count by site and date | Site-chip-date level |
| `data_center_chillers.csv` | 143 | Chiller specifications and cooling capacity | Equipment-model level |
| `data_center_cooling_towers.csv` | 527 | Cooling-tower dimensions, fans, and capacity estimates | Equipment-model level |
| `ml_hardware.csv` | 176 | Accelerator performance, power, memory, price, and provenance | Chip-specification level |
| `ai_chip_owners/quarters_by_chip_type.csv` | 384 | Quarterly chip allocation by owner and type, with uncertainty | Company-chip-quarter level |
| `ai_chip_owners/cumulative_by_chip_type.csv` | 515 | Cumulative chip ownership by owner and type, with uncertainty | Company-chip-period level |
| `ai_chip_owners/cumulative_by_designer.csv` | 215 | Cumulative compute, unit and power estimates by chip designer/owner | Company/designer-period level |

## Coverage checks

- Data-center timeline range: 2018-12-18 to 2030-01-01.
- Timeline records refer to 77 distinct data-center names.
- 75/75 current data-center records include a calculations-sheet link.
- 65/75 current data-center records include an address.
- 52/75 current data-center records include a current chip-type estimate.

## What this snapshot does not contain

The files do not contain a complete building-by-building geometry, raw satellite
image archive, image annotations, exact cooling-unit counts observed at each
building, construction progress percentages, accounting-period cash capex, or
an auditable mapping from every project milestone to quarterly company capex.
Those fields require independent imagery/source collection and a Level Grind
research layer.

