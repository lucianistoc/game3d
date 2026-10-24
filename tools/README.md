# Map data

`geo.js` was generated from public data:

* county + neighbouring outlines, roads, rivers: [Natural Earth 1:10m](https://www.naturalearthdata.com/) (public domain)
* settlement names, coordinates and population: github.com/catalin87/baza-de-date-localitati-romania

Natural Earth only carries **major roads** (E-roads and DN). To get every local road between the villages
(the game then draws those instead of the dashed "approximate" links):

1. Open https://overpass-turbo.eu and run

       [out:json][timeout:60];
       way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"]
         (45.60,20.85,46.10,21.50);
       out geom;

   then *Export -> GeoJSON* and save it as `tools/roads.geojson`.
2. `python3 tools/convert-roads.py tools/roads.geojson > roads-local.js`
3. Add `<script src="roads-local.js"></script>` to `index.html` before `game.js`.

## Balance simulator

`tools/sim.js` drives the real game in headless Chromium to measure missions, night watches and the economy. See the README ("Testing and balance tools") for usage.
