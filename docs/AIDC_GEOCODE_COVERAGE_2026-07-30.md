# AI Capex map geocode coverage

Generated from the published 75-campus AI Capex dataset on 2026-07-30.

## Coverage

- Total records: 75
- Located records: 54
- Unresolved records: 21
- China records: 3 located / 3 total

The original geocoder did not resolve the three China campuses because their
English brand/campus names were not recognized by OpenStreetMap Nominatim.
Reproducible public place-name fallbacks now locate:

- Huawei Horinger → Horinger County, Inner Mongolia
- VNET Bayin Ulanqab → Bayin, Ulanqab, Inner Mongolia
- Alibaba Zhangbei → Zhangbei County, Zhangjiakou, Hebei

These are place-level coordinates, not building-level coordinates.

## Records still unresolved

| Project | Owner | Country | Source address |
| --- | --- | --- | --- |
| Meta Prometheus | Meta | United States | 1 Community Cir, New Albany, OH 43054 |
| Anthropic-Amazon New Carlisle | Amazon | United States | 55001 Larrison Blvd, New Carlisle, IN 46552 |
| Google Bristow | Google | United States | 13001 Rollins Ford Road, Bristow, VA 20136 |
| DayOne Nusajaya | Unknown | Malaysia | Missing |
| Amazon Madison Mega Site | Amazon | United States | Amazon Data Services Inc, Madison Mega Site Nissan Parkway and Highway 22 Canton, Mississippi Madison County |
| Meta Jeffersonville | Meta | United States | 500 8th St, Jeffersonville, IN 47130, USA |
| Coreweave Helios | CoreWeave | United States | 984 County Road 112, Afton, TX 79220 |
| Microsoft Project Osmium | Microsoft | United States | 5855 SW Kerry St, Cumming, IA 50061 |
| CoreWeave Chester VA | CoreWeave | United States | 1401 Meadowville Technology Parkway, Chester, VA |
| Oracle Batam | Oracle | Indonesia | Missing |
| Microsoft SAT40 | Microsoft | United States | 15000 Lambda Drive, San Antonio, TX 78245 |
| Start Campus Sines Data Campus | Nscale | Portugal | Start Campus - Sustainable Data Center Services, Sines, Portugal |
| CoreWeave Muskogee OK | CoreWeave | United States | 1525 W 43rd St S, Muskogee, OK 74401, USA |
| Google Kansas City East | Google | United States | Missing |
| OpenAI Stargate Lordstown | Softbank | United States | 2300 Hallock Young Rd, Warren, OH 44481 |
| OpenAI Stargate Michigan | Oracle | United States | Missing |
| OpenAI Stargate Milam | Softbank | United States | Missing |
| OpenAI Stargate New Mexico | Oracle | United States | Missing |
| OpenAI Stargate Shackelford | Oracle | United States | 175 Private Road 1604, Abilene, TX 79601, Shackelford County |
| OpenAI Stargate UAE | G42 | United Arab Emirates | Nexus L&T Project Office, Al Bihouth, Al Dhafrah, Abu Dhabi, United Arab Emirates |
| OpenAI Stargate Wisconsin | Oracle | United States | Missing |

Seven records have no source address. The remaining fourteen have an address in
the research export but Nominatim did not return a match for the supplied text.
They should remain off the map until a reproducible place/building match is
verified; the dashboard must not invent coordinates.
