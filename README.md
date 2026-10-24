# Timiș Z 3D

The 3D version of [Timiș Z](https://github.com/lucianistoc/game). The game logic is the same; the two real-time parts, scavenging runs and the base with its night watch, are now drawn as 3D scenes with [Three.js](https://threejs.org/). The county map, menus, crew screens and the HUD stay on a 2D canvas laid over the 3D view.

A browser game about surviving the zombie apocalypse in Timiș County, Romania. Scavenge towns on a wireframe map of the county, then hold an isometric base modelled on a real house in Cărani against the night. Build outposts, trade and fight with other survivor groups, look after a crew of people who grow, fall in love, fall out and die, and decide how the story ends.

No build step. Three.js r158 is vendored in `vendor/`, so there is nothing to install: open `index.html` in a browser. If the browser has no WebGL (or you open `index.html?2d`), the game falls back to the original 2D drawing.

## Contents

- [Quick start](#quick-start) · [How a day goes](#how-a-day-goes) · [Scavenging](#scavenging) · [Night watch](#night-watch)
- [The base](#the-base-cărani) · [Crew](#crew) · [Outposts](#outposts) · [Radio, factions and quests](#radio-factions-and-quests)
- [Vehicles and the road](#vehicles-and-the-road) · [Gear, weapons, noise and the infected](#gear-weapons-noise-and-the-infected)
- [Seasons, difficulty and endings](#seasons-difficulty-and-endings) · [Settings, saves and touch](#settings-saves-and-touch)
- [Project layout](#project-layout) · [Testing and balance tools](#testing-and-balance-tools) · [Map data](#map-data-and-accuracy)

## Quick start

Open `index.html`, pick a save slot and **New game**. You choose a start (the full crew in Cărani, *Under siege*, or *The wider world* with a radio and an outpost), a difficulty, a mix of infected and a starting season.

Day one: open the **Map**, click a nearby settlement, **Drive** or **Walk** there, grab crates, and leave with **X** before time runs out. Spend what you bring home on defences, then press **End day** (or wait for 20:00). Tips appear along the way (switch them off in Settings).

| Key | In a mission | At the base |
|---|---|---|
| **W A S D** / arrows | move | pan the camera |
| mouse | aim; click to fire | pick, paint and place buildings |
| **Space** | melee swing | |
| **Shift** | sneak | |
| **E** (hold) | hotwire a car, free a prisoner, open a vault | |
| **Q / G** | switch / throw molotov or pipe bomb | same, during the night watch |
| **X** | leave the site | |
| **Esc**, **M** | | menu, mute |

**Touch:** in a mission, drag the left stick to move, touch anywhere else to aim and shoot, and use the buttons for HIT, THROW, USE (hold at a car), SNEAK, LEAVE and the zoom +/−. At the base, tap to build, hold and drag to paint fences and walls, and use two fingers to pinch-zoom, twist to rotate and drag to pan. On the night watch tap an attacker to shoot; THROW arms a molotov or pipe bomb for your next tap. Hold the phone sideways.

Every key can be rebound in **Settings**. In the 3D base the camera is free: **middle-drag** (or **Shift + right-drag**) or **[ ]** rotates, middle-drag up and down tilts, **Home** resets, right-drag and WASD pan, the wheel zooms. In a mission the camera follows you from behind and above; the wheel zooms, **[** and **]** turn the view a quarter turn (the move keys follow the view), walls that would hide you fade out, and the aim point is wherever your cursor meets the floor at chest height. Missions also show the weather you left at home (overcast, a storm with rain and lightning) outdoors, and the light changes over the hour you spend on site, so a late run slides into dusk. Indoors you get drifting dust and the odd power surge. On a touch screen the mission arena shows a stick and buttons; the base gets Pan and zoom buttons.

## How a day goes

Each day runs from 06:00 to dusk at 20:00. A scavenging run costs hours (the drive both ways plus an hour on site), so you fit in only a few. At dusk (or when you press End day and confirm) you get a **night plan**, then the night watch, then dawn: crew eat, crops grow, outposts report, the radio brings offers and requests, and sometimes something happens.

- **Day:** infected and armed survivor gangs are both dangerous. **Night:** more and faster infected, far fewer survivors, and it is dark apart from your torch.
- If a trip runs past dusk, the night watch starts the moment you are home.

## Scavenging

- **County map:** scrollable, zoomable, with roads, rivers and 325 settlements. In the 3D version it is a tilted perspective view: the county is a raised slab with a glowing border, roads and rivers are ribbons, every settlement is a building (taller and bolder for towns and Timișoara, tinted by how infested it is) and Cărani has an amber beacon. Middle-drag (or Shift + right-drag, or **[ ]**) turns and tilts the view, **Home** resets it, a compass shows north, and on touch two fingers pinch and twist. **Timișoara** is a set of about 28 sites (supermarkets, DIY, outdoor shops, pharmacies, warehouses, pharmaceutical depots, car dealerships, a hospital, the police station, an army depot, the university, the airport, the Bega canal). The **Petrom station on the DN69 at km 18+0,8, Cornești** is about 5 km from Cărani, rich in diesel and a natural first outpost. Site positions are approximate.
- **Every site type has its own detailed top-down look** and its own mix of infected. Crates look like what is inside; at night you only see what your torch lights.
- **Sites remember you:** a looted site is picked over for a while and refills slowly, but it also re-infests the longer you stay away. The briefing shows both.
- **Objectives** (about half of all sites, shown in the briefing): *rescue* a prisoner and bring them home alive (they join your crew), *clear* every infected to reveal a cache, kill a *mutant* boss for rare gear, find a keycard and open a *vault*, or fetch a *data drive* without the noise meter passing 70. At the Reapers' camp the objective is to kill their leader.
- **Hazards:** fires break out indoors and floors collapse where you step on cracked ground (usually with bait lying near them).

## Night watch

- **Forecast:** at dawn the game plans the night: a *shambling horde*, a *runner rush*, a *siege* of brutes that batter your walls, *spitters* that melt defences from range, an *armoured column* (pistols and turrets barely scratch them) or *everything at once*. By default you only learn how big it is. A scout, a watchtower outpost, the radio mast or a raid warning reveals the type and direction.
- **Night plan:** before dark, decide where each person stands: **windows** (shoot from the house), **turret** (man one for faster fire), **repair** (fix barriers, costs scrap), **medic** (fewer casualties) or **rest**. **Auto-assign** does something sensible. You can also send people to reinforce an **outpost that is going to be attacked** tonight.
- **Traps** (the Trap tab): barbed wire slows and cuts, spiked pits kill one attacker, pressure mines blast an area. Lay them outside your fence on the side the raid comes from.
- Click attackers to shoot yourself. Fighters, turrets, allied gunners and floodlights (slow attackers, speed turrets) help. Electric fences use power.
- **Armed survivors** (the Reapers) sometimes join the raid, stop at range and shoot the house. How often depends on how you treat them.

## The base (Cărani)

- Isometric plot traced from satellite imagery, 1.5 m cells: house, workshop, two greenhouses, gazebo, the neighbour's building as a west barricade, a fence line with a gate, the street to the south.
- **Camera:** wheel zooms, right-drag or WASD pans, **F** recentres. **Building:** pick an item (click, or keys 1–5); a ghost shows if it fits. Drag to paint fences, walls, wire and gardens; sell, repair and upgrade can be dragged too. Walls are thin segments that join up; fences have four tiers, walls three, the gate four.
- **Power:** 16 kWp of solar and a 30 kWh battery; weather and season change output; a diesel generator is the backup; EVs with V2L can power the house.
- **Water and food:** the crew needs about 0.75 food and water each a night. Greenhouses and gardens make food; **tanks** (more when it rains) and a **well** make water. Water is the early pinch: build the well.
- **Rooms** (the Rooms button): bunk rooms (more beds, up to 14 people), kitchen, clinic, radio room (and mast), and storerooms. **Storage is limited**: surplus above the cap is lost at dawn.
- **Crafting** (needs the workshop; takes daylight hours): ammunition, shotgun shells, a suppressor, field dressings, molotovs, pipe bombs, melee weapons and basic gear. **Gear:** backpacks (capacity), clothing (damage reduction), footwear (speed).

## Crew

- Each survivor has a **role** (fighter, engineer, medic, farmer, scout, mechanic, cook), a **trait**, a **level** (XP from nights survived and expeditions), **morale**, and a **bio**. Click a person on the **Crew** screen for details.
- **Perks:** pick one at level 2 and another at level 4 from two choices per tier, per role (for example the fighter's marksman or guardian, the medic's surgeon or immunologist).
- **Relationships:** people who stand watch together grow close. Friends cheer each other up, rivals wear each other down, some become couples, and losing someone you love hurts.
- **Injuries:** wounds, broken legs, infections and shock. A clinic and a medic speed recovery; an untreated infection can kill.
- **Personal events:** a rumour that someone's relative is alive (send them looking), feuds, romances, and a **funeral** after each death. The **History** screen has statistics, a timeline and a memorial wall.
- **Expeditions:** send one person to farms, village houses, a pharmacy, a fuel stop or an industrial depot for a day or two; they may return with loot, hurt, or not at all.
- **Morale:** hunger, blackouts, lost friends and lost nights bring it down; good nights, rooms and people's company bring it up. At rock bottom, people leave.

## Outposts

- Loot a site once, then press **Establish outpost** on its briefing (up to five).
- **Post crew** there (a level-N outpost holds N people). Without a garrison it produces nothing and falls easily. The garrison eats and works the site; fighters defend it.
- **Production** is the site's richest supply (a petrol station makes diesel). At level 2 choose a **specialisation**: farm, workshop, watchtower (safer, double intel, reveals the night's raid), clinic or depot (more storage everywhere).
- **Intel:** garrisoned outposts report hidden stashes, convoys and outbreaks (marked on the map), raid warnings, better prices and survivors on the road. Scouts hear more. Sites near a garrisoned outpost show their infestation and stock on the briefing.
- Outposts keep the area quiet, lower trade prices and add their own offers. They are attacked at night (the raid plan tells you in advance); you can send help.

## Radio, factions and quests

Needs the radio room.

- **Factions:** Cărani farmers, Timișoara militia, Politehnica researchers, the army remnant, and the Reapers raider gang. Standing changes prices and who will deal with you. Gifts raise it; killing gang members in the field angers the Reapers and pleases the militia.
- **Offers** refresh daily and include weapons and gear. **Quests** (supply runs, hunting gangs, clearing sites) pay in standing, resources, gear and research points.
- **Alliances** (standing 60+): farmers send food, the researchers send medicine, the army sends shells and an armoured gunner, the militia sends two gunners to every night watch. Mistreat a partner and the pact falls apart.
- **The Reapers:** buy a ten-day **truce**, **take them in** (standing 40+; two fighters join you), or **declare war**: their camp appears on the map, and killing its leader destroys the gang for good. War means bigger raids until then.
- **Research** (points from the researchers): water filters, antibiotics, better panels.
- **Random events** each morning: distress calls, survivors at the gate, a wandering trader, a storm, fever, a hidden cache, a Reaper ultimatum, a militia request, an abandoned convoy or an outbreak on the map, and more.

## Vehicles and the road

- Find vehicles at dealerships (hotwire one: hold **E**, about four seconds, noisy, some have alarms) or from key fobs. Car, pickup, van, truck and three EVs (no diesel; charge from solar surplus; **V2L** feeds the house).
- Vehicles have a **condition**: trips wear them, a battered one is slower and breaks down. Repair them on the **Fleet** screen (a mechanic repairs more).
- **Road encounters** on drives: roadblocks, the Reapers' toll, breakdowns, stranded travellers, ambushes, roadside fuel. Each has choices with costs.

## Gear, weapons, noise and the infected

- **Weapons:** one ranged slot and one melee slot. Pistol, survival rifle, pump shotgun (shells), SMG, hunting rifle (pierces) and assault rifle; crowbar, bat, machete, axe. Police, the army depot and hunters' houses drop the good ones.
- **Noise:** gunfire, engines, hotwiring and melee all make noise (shown on the meter). **Shift** sneaks; a sneak melee hit does triple damage. A suppressor cuts gunshot range. Sustained noise draws a **horde**.
- **Infected:** walkers, brutes, runners (fast, scream when they spot you), spitters (acid), armoured infected, and mutant bosses. They idle until they see or hear you.

## Seasons, difficulty and endings

- **Seasons** turn every 30 days: summer brings strong sun and crops but thirstier people; winter brings thin sun, poor crops, heating and bigger appetites.
- **Difficulty** (easy, normal, hard) scales infected, loot, rations, raid size and damage. The **infected mix** can be classic, fast or heavy.
- **Objectives** guide you: dig in, reach out (radio room and a trade), plant a flag (first outpost), build a network (three outposts, eight trades), write the ending.
- **Five endings**, each with its own requirements (see the **Endings** tab): *Free settlement*, *The Republic* (join the militia), *The road north* (leave the county), *The Banat Compact* (rule the roads), and *One hundred days* (arrives by itself). Each ending gives a **score** and enters the hall of fame. You can keep playing afterwards.

## Settings, saves and touch

- **Settings:** master, effects and music volume; interface size; screen shake; tutorial tips; key bindings. All sound and music are generated in the browser (Web Audio), so there are no audio files.
- **Three save slots**; progress saves automatically in the browser (`localStorage`). Older saves are upgraded when loaded.
- **Display:** the canvas fills the window and scales to fit; wide windows get more of the map and base.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | Page and script loading (order matters) |
| `vendor/three.min.js` | Three.js r158 (MIT licence in `vendor/three.LICENSE`) |
| `gl3d.js` | Shared 3D layer: renderer, camera helpers, mouse-ray picking, materials, low-poly people, particles |
| `gl_mission.js` | 3D scavenging run: the 2D floor becomes the ground texture, walls are boxes, infected and survivors are animated models |
| `gl_base.js` | 3D base: terrain, a model for every building, vehicles, crew, the raid (attackers, tracers, fires, blasts), day/night light, orbit camera |
| `gl_map.js` | 3D county map: perspective camera that `map.js` projects through, county slab, road and river ribbons, settlement buildings, home beacon |
| `geo.js` | Map data: county outline, roads, rivers, settlements (generated) |
| `data.js` | Towns and sites, loot, vehicles, gear, recipes, crew, base layout, settings tables |
| `audio.js` | Settings, key bindings, procedural sound effects and music |
| `render.js` | Procedural textures, shadows, lighting, base scenery and raid attackers |
| `site.js`, `sitefloor.js`, `sprites.js` | Scavenging sites: layouts, static floor and props, dynamic sprites and lighting |
| `game.js` | Window layout, input, helpers, HUD, save state |
| `map.js` | The county map and the mission briefing |
| `buildings.js` | Base geometry and how each building is drawn |
| `screens.js` | Workshop, gear and fleet screens |
| `mission.js` | A scavenging run: weapons, noise, infected AI, hotwiring, gangs |
| `objectives.js` | Mission objectives, hazards, vehicle condition, road encounters |
| `base.js` | The base builder: camera, painting, ghost preview, the end of each night |
| `night.js` | Raid planning, the night plan screen, attacker kinds, traps, the raid simulation |
| `world.js` | Rooms, expeditions, outposts, offers, random events, the nightly hook |
| `diplomacy.js` | The radio: offers, quests, alliances, the Reapers, research |
| `stories.js` | Perks, relationships, injuries, personal events, the crew detail panel |
| `endings.js` | Objectives screen, endings, ending screen, seasons |
| `meta.js` | Title and save slots, new game, menu, settings, history, tutorial tips |
| `main.js` | Bootstrap and main loop |
| `tools/` | Balance simulator and optional local-road import (see its README) |
| `tests/smoke.js` | Automated smoke test |

All scripts share one global scope; do not reuse a top-level `const` name across files.

### Graphics quality

**Settings > Graphics** cycles AUTO, HIGH, MEDIUM, LOW and 2D. HIGH has 2048 px shadows and every small light; MEDIUM halves the shadow map, drops the night torch's shadows and some small lights and renders at 1x; LOW has no shadows, keeps only the sun/torch and renders at 0.75x; 2D is the original flat drawing. AUTO starts at HIGH (MEDIUM on touch devices), watches the frame time of the 3D view and steps down a level after about 3 s of sustained slowness (and finally to 2D); it never steps back up on its own.

### How the 3D layer works

The logic files are unchanged apart from a few hooks. A mission still simulates on a flat 960x640 stage and the base on its 18x28 grid. Each frame the 3D files read that state and move meshes to match it (stage x, y become the ground plane's x, z; the grid is one world unit per 1.5 m cell). The mouse is turned into a ray: in a mission it sets `mouse.x/y` to the stage point under the cursor, so aiming, throwing and melee work as before; at the base `cellUnderMouse()` returns the cell of whatever the ray hits first, so tall buildings are picked by their walls and roofs. `scene.gl3d` tells `applyLayout()` to leave the 2D canvas transparent over the WebGL canvas.

## Testing and balance tools

```
npm install                   # once: Playwright
npx playwright install chromium
npm test                      # smoke test: every scene, site, objective, raid type, 60 simulated nights, saves, endings (3D view)
npm run test:2d               # the same with ?2d, the 2D fallback
npm run sim:raids             # balance: night watch survival by defence and day
npm run sim:missions          # balance: a crude bot scavenging at different days
npm run sim:economy           # balance: 20 days of upkeep
```

Set `CHROMIUM=/path/to/chromium` to use a specific browser, `DIFF=hard` or `RAID=siege` to change the simulators. The bot is far weaker than a person; read mission results as a lower bound. The smoke test runs on every push through GitHub Actions, in both the 3D and the 2D mode. Headless Chromium has no GPU, so the test starts it with the SwiftShader software GL backend; a 3D run is slow there, which is normal.

## Map data and accuracy

- **Real data:** the county outline, major roads (E-roads and DN) and rivers come from [Natural Earth](https://www.naturalearthdata.com/) (public domain, 1:10m). Settlement names, positions and populations come from a public Romanian locality dataset.
- **Cărani** is placed at 45.9096° N, 21.1600° E (Sânandrei commune, about 18 km north of Timișoara).
- **Limit:** Natural Earth has only major roads. The short links from Cărani to neighbouring villages are drawn dashed and are approximate. To load real local roads from OpenStreetMap, follow `tools/README.md`.
- **Base layout** is traced from one satellite screenshot and one ground photo, so positions and sizes are approximate. The Timișoara and Cornești site positions are district-level, not surveyed addresses.

## Notes

- Balance numbers are tuned with the simulators above but not by long human play; expect to adjust them.
- Saves from before the current format are upgraded when loaded.
