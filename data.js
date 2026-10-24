// Approximate coordinates. type: city | town | village. loot weights: scrap/food/ammo/wood
const TOWNS = [
  { name: 'Timișoara',       lon: 21.23, lat: 45.75, type: 'city',    danger: 4, loot: { scrap: 5, ammo: 3, food: 2, wood: 0, water: 2, diesel: 2 } },
  { name: 'Lugoj',           lon: 21.90, lat: 45.69, type: 'town',    danger: 3, loot: { scrap: 3, ammo: 2, food: 3, wood: 1, water: 2, diesel: 1 } },
  { name: 'Sânnicolau Mare', lon: 20.63, lat: 46.07, type: 'town',    danger: 2, loot: { scrap: 2, ammo: 1, food: 4, wood: 1, water: 2, diesel: 1 } },
  { name: 'Jimbolia',        lon: 20.72, lat: 45.79, type: 'town',    danger: 2, loot: { scrap: 3, ammo: 1, food: 3, wood: 1, water: 2, diesel: 1 } },
  { name: 'Deta',            lon: 21.22, lat: 45.39, type: 'town',    danger: 2, loot: { scrap: 2, ammo: 1, food: 3, wood: 2, water: 2, diesel: 1 } },
  { name: 'Făget',           lon: 22.18, lat: 45.85, type: 'town',    danger: 2, loot: { scrap: 1, ammo: 1, food: 2, wood: 5, water: 2, diesel: 1 } },
  { name: 'Buziaș',          lon: 21.60, lat: 45.65, type: 'village', danger: 1, loot: { scrap: 1, ammo: 1, food: 4, wood: 2, water: 3, diesel: 1 } },
  { name: 'Recaș',           lon: 21.51, lat: 45.80, type: 'village', danger: 1, loot: { scrap: 2, ammo: 1, food: 4, wood: 1, water: 3, diesel: 1 } },
  { name: 'Ciacova',         lon: 21.14, lat: 45.51, type: 'village', danger: 1, loot: { scrap: 2, ammo: 1, food: 3, wood: 2, water: 3, diesel: 1 } },
  { name: 'Gătaia',          lon: 21.43, lat: 45.43, type: 'village', danger: 1, loot: { scrap: 1, ammo: 1, food: 3, wood: 3, water: 3, diesel: 1 } },
  { name: 'Giroc',           lon: 21.22, lat: 45.70, type: 'village', danger: 2, loot: { scrap: 3, ammo: 2, food: 2, wood: 0, water: 3, diesel: 1 } },
];

// Home base: Cărani village (Sânandrei commune), ~18 km north of Timișoara.
const HOME = { name: 'Cărani', lon: 21.1600, lat: 45.9096 };

// Snap curated towns to real coordinates and add every other settlement in the county as a scavenge site.
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
(function () {
  const pl = new Map(GEO.places.map(p => [fold(p[0]), p]));
  for (const t of TOWNS) { const p = pl.get(fold(t.name)); if (p) { t.lon = p[1]; t.lat = p[2]; t.pop = p[3]; } }
  const have = new Set(TOWNS.map(t => fold(t.name)));
  for (const [name, lon, lat, pop] of GEO.places) {
    if (have.has(fold(name)) || fold(name) === 'carani') continue;
    const type = pop >= 8000 ? 'town' : pop >= 1500 ? 'village' : 'hamlet';
    const loot = type === 'town' ? { scrap: 3, ammo: 2, food: 3, wood: 1, water: 2, diesel: 1 }
      : type === 'village' ? { scrap: 2, ammo: 1, food: 3, wood: 2, water: 2, diesel: 1 }
      : { scrap: 1, ammo: 1, food: 3, wood: 2, water: 3, diesel: 1 };
    TOWNS.push({ name, lon, lat, pop, type, danger: type === 'town' ? 2 : 1, loot });
  }
})();

// Give every settlement a little medicine too (pharmacies, first-aid kits).
for (const t of TOWNS) if (t.loot.meds === undefined) t.loot.meds = t.type === 'city' ? 3 : t.type === 'town' ? 2 : t.type === 'village' ? 1 : 0;

// Clothes and bags turn up in ordinary houses and shops too.
for (const t of TOWNS) if (t.loot.gear === undefined) t.loot.gear = t.type === 'city' ? 2 : t.type === 'hamlet' ? 0 : 1;

// ---- Timișoara scavenging sites. Positions are approximate (district level), not surveyed addresses. ----
const SPOT_KINDS = {
  store:     { label: 'Supermarket',        color: '#7fe0a0', glyph: 'S', layout: 'aisles', crates: 8,  keys: 0, gangs: 0,  danger: 3, blurb: 'food and water, picked over but plentiful',
               loot: { food: 5, water: 4, scrap: 1, meds: 1, wood: 0, ammo: 0, diesel: 0 } },
  hardware:  { label: 'DIY megastore',      color: '#d8b070', glyph: 'H', layout: 'aisles', crates: 8,  keys: 0, gangs: 0,  danger: 3, blurb: 'scrap, timber, tools, a little fuel',
               loot: { scrap: 5, wood: 4, diesel: 1, water: 1, food: 0, ammo: 0, meds: 0 } },
  pharmacy:  { label: 'Pharmacy',           color: '#ff7a8a', glyph: '+', layout: 'aisles', crates: 6,  keys: 0, gangs: .8, danger: 3, blurb: 'medicine; survivor gangs fight over it',
               loot: { meds: 7, water: 1, food: 1, scrap: 0, wood: 0, ammo: 0, diesel: 0 } },
  warehouse: { label: 'Warehouse',          color: '#e8c070', glyph: 'W', layout: 'aisles', crates: 11, keys: 0, gangs: 0,  danger: 4, blurb: 'big mixed hauls, lots of zombies',
               loot: { scrap: 3, food: 3, water: 3, wood: 2, diesel: 2, ammo: 1, meds: 0 } },
  pharma_wh: { label: 'Pharma warehouse',   color: '#ff9ad0', glyph: 'M', layout: 'aisles', crates: 9,  keys: 0, gangs: .8, danger: 5, blurb: 'the best medicine stocks, well contested',
               loot: { meds: 10, water: 1, scrap: 1, food: 0, wood: 0, ammo: 0, diesel: 0 } },
  outfitter: { label: 'Outdoor & clothing', color: '#d89aff', glyph: 'O', layout: 'aisles', crates: 8,  keys: 0, gangs: .3, danger: 3, blurb: 'backpacks, jackets and boots',
               loot: { gear: 7, scrap: 1, water: 1, food: 0, wood: 0, ammo: 0, diesel: 0, meds: 0 }, bias: 'outfit' },
  hospital:  { label: 'Hospital', color: '#ff6a6a', glyph: 'HO', layout: 'ward', crates: 10, keys: 0, gangs: .5, danger: 6, blurb: 'the biggest medicine stocks, and the most infected',
               loot: { meds: 9, water: 2, food: 1, scrap: 1, gear: 1, wood: 0, ammo: 0, diesel: 0 }, zmix: { walker: .45, spitter: .2, runner: .2, brute: .15 } },
  police:    { label: 'Police station', color: '#6aa8ff', glyph: 'PO', layout: 'station', crates: 8, keys: 0, gangs: 1, danger: 5, blurb: 'pistols, shotguns and vests, guarded by armoured infected',
               loot: { weapon: 5, ammo: 3, shells: 2, gear: 2, meds: 1, scrap: 1, water: 0, food: 0, wood: 0, diesel: 0 }, wpool: 'police', bias: 'outfit', zmix: { armored: .35, walker: .35, brute: .15, runner: .15 } },
  army:      { label: 'Army depot', color: '#a8c070', glyph: 'AR', layout: 'depot', crates: 10, keys: 0, gangs: 1.2, danger: 7, blurb: 'the best weapons and armour in the county. Expect a fight',
               loot: { ammo: 6, shells: 2, weapon: 4, gear: 3, scrap: 2, meds: 1, diesel: 2, water: 0, food: 0, wood: 0 }, wpool: 'army', bias: 'outfit', zmix: { armored: .45, brute: .2, runner: .2, walker: .15 } },
  university:{ label: 'University', color: '#e0c070', glyph: 'UN', layout: 'halls', crates: 8, keys: 0, gangs: .3, danger: 3, blurb: 'lecture halls full of the slow and the fast',
               loot: { scrap: 3, water: 2, food: 2, meds: 2, ammo: 1, gear: 1, wood: 1, diesel: 0 }, zmix: { walker: .65, runner: .25, brute: .1 } },
  airport:   { label: 'Airport', color: '#80d8e8', glyph: 'AP', layout: 'terminal', crates: 12, keys: 0, gangs: .8, danger: 6, blurb: 'fuel, luggage and a long way to run',
               loot: { diesel: 5, gear: 2, food: 2, scrap: 3, water: 2, ammo: 2, weapon: 1, wood: 0, meds: 0 }, wpool: 'any', zmix: { walker: .5, runner: .22, brute: .12, spitter: .08, armored: .08 } },
  canal:     { label: 'Bega canal', color: '#6ad0c8', glyph: 'BE', layout: 'canal', crates: 8, keys: 0, gangs: .2, danger: 3, blurb: 'open ground along the water: easy to see and be seen',
               loot: { water: 5, wood: 3, scrap: 2, food: 1, diesel: 1, gear: 1, ammo: 0, meds: 0 }, zmix: { walker: .55, runner: .2, spitter: .15, brute: .1 } },
  camp:      { label: 'Reaper camp', color: '#ff6a5a', glyph: 'RC', layout: 'camp', crates: 10, keys: 0, gangs: 4, danger: 5, blurb: 'the Reapers\' stronghold: barricades, vehicles and a lot of guns',
               loot: { ammo: 5, shells: 3, weapon: 3, scrap: 3, food: 2, diesel: 2, meds: 1, gear: 1, water: 1, wood: 0 }, wpool: 'any', zmix: { walker: .85, brute: .1, runner: .05 } },
  fuel:      { label: 'Petrom station', color: '#ffd23a', glyph: 'PE', layout: 'station', crates: 9, keys: 0, gangs: .5, danger: 2, blurb: 'Petrom on the DN69: diesel under the forecourt, snacks in the shop, a long open lot',
               loot: { diesel: 7, food: 2, water: 2, scrap: 2, meds: 1, wood: 0, ammo: 0 }, zmix: { walker: .7, runner: .12, brute: .08, spitter: .06, armored: .04 } },
  dealer:    { label: 'Car dealership',     color: '#7ab8ff', glyph: 'D', layout: 'lot',    crates: 6,  keys: 1, gangs: .8, danger: 4, blurb: 'vehicle keys, fuel and parts',
               loot: { diesel: 3, scrap: 3, ammo: 0, food: 0, water: 0, wood: 0, meds: 0 }, fleet: { car: 4, pickup: 3, van: 2, ev_car: 1 } },
  dealer_ev: { label: 'EV dealership',      color: '#7affc8', glyph: 'E', layout: 'lot',    crates: 6,  keys: 1, gangs: .8, danger: 4, blurb: 'electric vehicles with V2L, half-charged',
               loot: { scrap: 3, diesel: 0, ammo: 0, food: 0, water: 0, wood: 0, meds: 0 }, fleet: { ev_car: 3, ev_suv: 2, ev_van: 1 } },
  dealer_com:{ label: 'Commercial vehicles',color: '#9ad0ff', glyph: 'T', layout: 'lot',    crates: 6,  keys: 1, gangs: .8, danger: 4, blurb: 'vans and trucks: bigger loads, thirstier engines',
               loot: { diesel: 4, scrap: 3, ammo: 0, food: 0, water: 0, wood: 0, meds: 0 }, fleet: { van: 3, truck: 3, pickup: 1, ev_van: 2 } },
};
const SPOTS_TM = [
  ['store', 'Hypermarket · Calea Șagului', 45.7385, 21.1900], ['store', 'Supermarket · Iosefin', 45.7448, 21.2140],
  ['store', 'Supermarket · Fabric', 45.7585, 21.2395], ['store', 'Shopping mall · Circumvalațiunii', 45.7730, 21.2290],
  ['store', 'Corner shop · Elisabetin', 45.7405, 21.2290], ['hardware', 'DIY megastore · Calea Lugojului', 45.7525, 21.2850],
  ['outfitter', 'Outdoor store · Calea Lugojului', 45.7555, 21.2790], ['outfitter', 'Clothing store · Cetate', 45.7522, 21.2300],
  ['hospital', 'Emergency hospital · Elisabetin', 45.7388, 21.2518], ['police', 'Police station · Cetate', 45.7538, 21.2272],
  ['army', 'Army depot · Calea Șagului', 45.7318, 21.1768], ['university', 'University · Politehnica', 45.7472, 21.2262],
  ['airport', 'Airport · Traian Vuia', 45.8099, 21.3379], ['canal', 'Bega canal · embankment', 45.7512, 21.2188],
  ['pharmacy', 'Pharmacy · Cetate', 45.7545, 21.2255], ['pharmacy', 'Pharmacy · Iosefin', 45.7432, 21.2085],
  ['pharmacy', 'Pharmacy · Mehala', 45.7635, 21.1900], ['pharmacy', 'Pharmacy · Fabric', 45.7570, 21.2420],
  ['warehouse', 'Warehouse · Calea Aradului', 45.7810, 21.2060], ['warehouse', 'Cash & carry depot · Calea Aradului', 45.7770, 21.2105],
  ['warehouse', 'Logistics depot · Calea Șagului', 45.7360, 21.1810],
  ['pharma_wh', 'Pharma distributor · Calea Aradului', 45.7790, 21.2160], ['pharma_wh', 'Pharma depot · Calea Lugojului', 45.7490, 21.2900],
  ['dealer', 'Car dealership · Calea Aradului', 45.7835, 21.2040], ['dealer', 'Car dealership · Calea Șagului', 45.7410, 21.1830],
  ['dealer_com', 'Commercial vehicles · Calea Aradului', 45.7870, 21.2090],
  ['dealer_ev', 'EV dealership · Calea Aradului', 45.7765, 21.2005], ['dealer_ev', 'EV showroom · Circumvalațiunii', 45.7690, 21.2450],
];
SPOTS_TM.push(['camp', 'Reaper camp · grain depot', 45.8650, 21.1480]);   // only appears on the map once you declare war on the Reapers
SPOTS_TM.push(['fuel', 'Petrom DN69 km 18+0,8 · Cornești', 45.9150, 21.2290]);   // 307307 Cornești, about 5 km east of Cărani (position approximate)
for (const [kind, name, lat, lon] of SPOTS_TM) {
  const k = SPOT_KINDS[kind];
  TOWNS.push({ name, short: name.split(' · ')[0], lon, lat, type: 'spot', kind, danger: k.danger, loot: { ...k.loot }, layout: k.layout, crates: k.crates, keys: k.keys, gangs: k.gangs, fleet: k.fleet, bias: k.bias, zmix: k.zmix, wpool: k.wpool, out: kind === 'fuel' || kind === 'camp' });
}

// ---- Vehicles: found at dealerships. speed km/h, cap = loot units per run, fuel = diesel multiplier ----
const VEHICLE_TYPES = {
  car:    { label: 'Car',       speed: 50, cap: 25, fuel: 1.0, len: 1.5 },
  pickup: { label: 'Pickup',    speed: 50, cap: 38, fuel: 1.3, len: 1.9 },
  van:    { label: 'Van',       speed: 45, cap: 52, fuel: 1.4, len: 2.0 },
  truck:  { label: 'Box truck', speed: 40, cap: 75, fuel: 2.0, len: 2.5 },
  // electric: no diesel. batt = kWh, kwhkm = consumption. All have V2L (power the house / fences / lights from the battery).
  ev_car: { label: 'EV hatchback', speed: 50, cap: 22, ev: true, batt: 40, kwhkm: 0.17, len: 1.5 },
  ev_suv: { label: 'EV SUV',       speed: 55, cap: 34, ev: true, batt: 70, kwhkm: 0.21, len: 1.7 },
  ev_van: { label: 'Electric van', speed: 45, cap: 48, ev: true, batt: 60, kwhkm: 0.28, len: 2.0 },
};
const WALK = { speed: 5, cap: 15 };
const VEHICLE_COLORS = ['#2f4a7a', '#c9ccd0', '#7a2a2a', '#2a5a3a', '#d8d0b0', '#3a3a40', '#a05a1a'];
const FLEET_SLOTS = [[0.4, 15.3], [3.5, 15.3], [6.4, 15.3]];   // parking along the street
const FLEET_MAX = FLEET_SLOTS.length;

// Base grid, traced from a satellite view of the plot. 1 cell = 1.5 m (the plot is ~27 x 42 m).
// gx runs west->east, gy north->south; the street (Aleea Sportivilor) is the south edge.
// Scenery lists below (TREES, BUSHES, PILES, CATS, FLEET_SLOTS) are in older 3 m units: multiply by GSCALE.
const GX = 18, GY = 28, GSCALE = 2;
const START_BUILDINGS = [
  { t: 'generator',  gx: 2,  gy: 14, w: 1,  h: 1,  hp: 40 },    // diesel backup
  { t: 'powerbox',   gx: 2,  gy: 18, w: 1,  h: 1,  hp: 40 },    // inverter + 30 kWh battery
  { t: 'barn',       gx: 0,  gy: 8,  w: 2,  h: 20, hp: 300 },   // neighbour's long building: west barricade
  { t: 'workshop',   gx: 4,  gy: 6,  w: 4,  h: 8,  hp: 80 },
  { t: 'house',      gx: 4,  gy: 16, w: 4,  h: 8,  hp: 100 },
  { t: 'greenhouse', gx: 10, gy: 2,  w: 6,  h: 4,  hp: 50 },
  { t: 'greenhouse', gx: 10, gy: 8,  w: 6,  h: 4,  hp: 50 },
  { t: 'gazebo',     gx: 12, gy: 20, w: 2,  h: 2,  hp: 30 },
  { t: 'gate',       gx: 6,  gy: 27, w: 4,  h: 1,  hp: 70 },    // street gate
];
// plot fence, one section per cell
for (let x = 0; x < GX; x++) START_BUILDINGS.push({ t: 'fence', gx: x, gy: 0, w: 1, h: 1, hp: 20, dir: 'x' });
for (let x = 2; x < GX - 1; x++) if (x < 6 || x >= 10) START_BUILDINGS.push({ t: 'fence', gx: x, gy: GY - 1, w: 1, h: 1, hp: 20, dir: 'x' });
for (let y = 1; y < GY; y++) START_BUILDINGS.push({ t: 'fence', gx: GX - 1, gy: y, w: 1, h: 1, hp: 20, dir: 'y' });
for (let y = 1; y < 8; y++) START_BUILDINGS.push({ t: 'fence', gx: 0, gy: y, w: 1, h: 1, hp: 20, dir: 'y' });
// Concrete path from the gate to the front door (each old cell is 2x2 cells now)
const PATH = [];
for (const [ox, oy] of [[4, 7], [4, 8], [4, 9], [4, 10], [4, 11], [4, 12], [4, 13], [3, 13], [3, 12]]) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) PATH.push([ox * 2 + i, oy * 2 + j]);
// Non-blocking scenery (big tree in the yard east of the house, etc.)
const TREES = [[5.2, 7.2], [6.3, 7.8], [5.6, 8.6], [0.5, 2.5], [8.4, 12.5]];
// Insulation boards and wheelbarrow beside the house (from the photo)
const PILES = [[1.2, 10.4]];

// Solar: 16 kWp on the roofs, 30 kWh battery. Peak-sun-hours per weather type.
const SOLAR = { kwp: 16, cap: 30, eff: 0.8, dayLoad: 6, perPerson: 1.25 };
const WEATHER = {
  sunny:  { name: 'SUNNY',    sun: 6.5, p: 0.40 },
  partly: { name: 'PARTLY CLOUDY', sun: 4.0, p: 0.30 },
  cloudy: { name: 'OVERCAST', sun: 2.0, p: 0.20 },
  storm:  { name: 'STORM',    sun: 0.7, p: 0.10 },
};

// Fence upgrade tiers (index = level). cost = price to reach that level.
const FENCE_LVL = [
  { name: 'WOODEN',          hp: 20 },
  { name: 'CHAIN-LINK',      hp: 45,  cost: { scrap: 3 } },
  { name: 'CONCRETE + WIRE', hp: 110, cost: { scrap: 8, wood: 1 } },
  { name: 'ELECTRIC',        hp: 110, cost: { scrap: 12 } },
];
const GATE_LVL = [
  { name: 'GATE',            hp: 70 },
  { name: 'STEEL GATE',      hp: 130, cost: { scrap: 12 } },
  { name: 'SPIKED GATE',     hp: 220, cost: { scrap: 25, wood: 3 } },
  { name: 'ELECTRIC GATE',   hp: 220, cost: { scrap: 40 } },
];

// The crew living in the house. Names are placeholders (click a crew row in-game to rename).
const ROLES = {
  fighter:  { label: 'FIGHTER',  color: '#e55', desc: 'Shoots from the house during raids' },
  engineer: { label: 'ENGINEER', color: '#fa3', desc: 'Repairs buildings overnight' },
  medic:    { label: 'MEDIC',    color: '#fff', desc: 'Heals the crew overnight' },
  farmer:   { label: 'FARMER',   color: '#6c4', desc: '+2 food per watered greenhouse' },
  scout:    { label: 'SCOUT',    color: '#5cf', desc: '+10 s on missions' },
  mechanic: { label: 'MECHANIC', color: '#c8f', desc: 'Generator +4 kWh, trips use 25% less diesel' },
  cook:     { label: 'COOK',     color: '#fd6', desc: 'Stretches rations: 1 less food & water/night' },
};
const CREW_START = [
  { name: 'Alex',   role: 'fighter' },  { name: 'Mihai',  role: 'fighter' },
  { name: 'Radu',   role: 'engineer' }, { name: 'Maria',  role: 'medic' },
  { name: 'Elena',  role: 'farmer' },   { name: 'Andrei', role: 'scout' },
  { name: 'Ioana',  role: 'mechanic' }, { name: 'Ana',    role: 'cook' },
];

// Scenery (non-blocking). Far trees stand outside the plot.
const TREES_FAR = [[-1.8, -1.2, 1.2], [3.5, -1.6, 1.1], [9.8, 3.5, 1.2], [10.4, 9, 1.1], [-2, 2.2, 1.1], [10.2, -.8, 1.2], [11, 13, 1], [-2.3, 13, 1.2]];
const BUSHES = [[1.5, 12.4], [2.25, 12.8], [0.9, 11.7], [7.4, 6.8], [7.6, 8.6]];
const CATS = [[5.0, 11.0, '#d98a3a'], [5.35, 11.5, '#d8d6d0']];

// Thin wall segments (they join up with neighbouring walls and fences).
const WALL_LVL = [
  { name: 'SANDBAG',    hp: 40 },
  { name: 'CONCRETE',   hp: 100, cost: { scrap: 6 } },
  { name: 'REINFORCED', hp: 200, cost: { scrap: 14, wood: 2 } },
];

// ---- Gear: found by looting (clothing stores, houses, gangs) or crafted. Equipped into three slots. ----
//  cap = extra loot units you can carry, armor = share of damage blocked, speed = move speed bonus
const GEAR_SLOTS = { ranged: 'WEAPON', melee: 'MELEE', pack: 'BACKPACK', body: 'CLOTHING', boots: 'FOOTWEAR' };
const RARITY = [{ name: 'common', col: '#b8c0c4', scrap: 3 }, { name: 'uncommon', col: '#6fe08a', scrap: 6 }, { name: 'rare', col: '#6ab4ff', scrap: 12 }, { name: 'epic', col: '#c58aff', scrap: 24 }];
const GEAR_ITEMS = [
  { id: 'school',     slot: 'pack',  name: 'Schoolbag',          r: 0, cap: 4,  col: '#5a7ab8' },
  { id: 'hike',       slot: 'pack',  name: 'Hiking pack',        r: 1, cap: 10, col: '#4f8a52' },
  { id: 'army',       slot: 'pack',  name: 'Military rucksack',  r: 2, cap: 18, col: '#5c6b3a' },
  { id: 'tactical',   slot: 'pack',  name: 'Tactical rucksack',  r: 3, cap: 26, col: '#2c3036' },
  { id: 'hoodie',     slot: 'body',  name: 'Hoodie',             r: 0, armor: .04, col: '#6a7078' },
  { id: 'work',       slot: 'body',  name: 'Padded work jacket', r: 1, armor: .12, col: '#c9852a' },
  { id: 'moto',       slot: 'body',  name: 'Motorcycle jacket',  r: 2, armor: .22, col: '#2a2d33' },
  { id: 'kevlar',     slot: 'body',  name: 'Body armour vest',   r: 3, armor: .35, col: '#4a5236' },
  { id: 'trainers',   slot: 'boots', name: 'Trainers',           r: 0, speed: .04, col: '#d8d8d8' },
  { id: 'hike_boots', slot: 'boots', name: 'Hiking boots',       r: 1, speed: .10, col: '#7a5a34' },
  { id: 'running',    slot: 'boots', name: 'Running shoes',      r: 2, speed: .16, col: '#3aa8d8' },
  { id: 'combat',     slot: 'boots', name: 'Combat boots',       r: 3, speed: .12, armor: .06, col: '#1e1f22' },
];
//  Weapons: dmg per hit/pellet, rate = seconds between shots, noise = how far a shot is heard (px), cost = rounds used.
//  Melee: reach in px, knock = knock-back. Melee is nearly silent, and triples damage on anything that has not noticed you.
GEAR_ITEMS.push(
  { id: 'pistol',    slot: 'ranged', name: 'Pistol',           r: 0, dmg: 1, rate: .24, pellets: 1, spread: .03,  speed: 700, range: 480, pierce: 0, ammo: 'ammo',   cost: 1, noise: 300, col: '#44484e' },
  { id: 'old_rifle', slot: 'ranged', name: 'Survival rifle',   r: 0, dmg: 1, rate: .16, pellets: 1, spread: .02,  speed: 650, range: 520, pierce: 0, ammo: 'ammo',   cost: 1, noise: 520, col: '#6a5a3a' },
  { id: 'shotgun',   slot: 'ranged', name: 'Pump shotgun',     r: 1, dmg: 1, rate: .75, pellets: 6, spread: .32,  speed: 620, range: 280, pierce: 0, ammo: 'shells', cost: 1, noise: 660, col: '#7a4a28' },
  { id: 'smg',       slot: 'ranged', name: 'Submachine gun',   r: 2, dmg: 1, rate: .09, pellets: 1, spread: .09,  speed: 680, range: 460, pierce: 0, ammo: 'ammo',   cost: 1, noise: 560, col: '#2e3238' },
  { id: 'hunting',   slot: 'ranged', name: 'Hunting rifle',    r: 2, dmg: 3, rate: .7,  pellets: 1, spread: .012, speed: 950, range: 760, pierce: 1, ammo: 'ammo',   cost: 2, noise: 640, col: '#5a3e24' },
  { id: 'assault',   slot: 'ranged', name: 'Assault rifle',    r: 3, dmg: 2, rate: .12, pellets: 1, spread: .05,  speed: 760, range: 640, pierce: 0, ammo: 'ammo',   cost: 1, noise: 620, col: '#3a4a3a' },
  { id: 'crowbar',   slot: 'melee',  name: 'Crowbar',          r: 0, dmg: 2, rate: .45, reach: 40, knock: 10, noise: 70, col: '#8a2a2a' },
  { id: 'bat',       slot: 'melee',  name: 'Baseball bat',     r: 1, dmg: 2, rate: .5,  reach: 46, knock: 24, noise: 80, col: '#b8905a' },
  { id: 'machete',   slot: 'melee',  name: 'Machete',          r: 1, dmg: 3, rate: .4,  reach: 42, knock: 6,  noise: 60, col: '#9aa0a8' },
  { id: 'axe',       slot: 'melee',  name: 'Fire axe',         r: 2, dmg: 4, rate: .75, reach: 46, knock: 18, noise: 90, col: '#c0392b' },
);
const WEAPON_POOLS = { police: ['pistol', 'pistol', 'shotgun', 'smg', 'bat'], army: ['assault', 'hunting', 'smg', 'shotgun', 'axe', 'machete'], any: ['pistol', 'old_rifle', 'shotgun', 'smg', 'hunting', 'assault', 'crowbar', 'bat', 'machete', 'axe'], tools: ['crowbar', 'axe', 'bat', 'machete'] };
const rollWeapon = pool => { const l = WEAPON_POOLS[pool] || WEAPON_POOLS.any; return l[Math.floor(Math.random() * l.length)]; };
const GEAR_BY_ID = Object.fromEntries(GEAR_ITEMS.map(g => [g.id, g]));
function rollGear(bias) {
  const w = bias === 'outfit' ? [.2, .4, .3, .1] : bias === 'gang' ? [.35, .45, .18, .02] : [.6, .3, .09, .01];
  let x = Math.random(), r = 0; for (; r < 3; r++) { if (x < w[r]) break; x -= w[r]; }
  const pool = GEAR_ITEMS.filter(g => g.r === r && (g.slot === 'pack' || g.slot === 'body' || g.slot === 'boots')); return pool[Math.floor(Math.random() * pool.length)].id;
}

// ---- Crafting at the workshop. Each craft takes daylight hours (the engineer works 25% faster). ----
const RECIPES = [
  { id: 'ammo',    name: 'Reload ammunition',     desc: '12 rounds',                                cost: { scrap: 6 },                hours: .5,  give: { ammo: 12 } },
  { id: 'meds',    name: 'Make field dressings',  desc: '3 medicine (4 with a medic)',               cost: { scrap: 3, water: 2 },      hours: .5,  give: { meds: 3 }, medicBonus: 1 },
  { id: 'molotov', name: 'Molotov cocktails',     desc: '2 throwables: set an area on fire',         cost: { scrap: 2, diesel: 1, wood: 1 }, hours: .5, items: { molotov: 2 } },
  { id: 'bomb',    name: 'Pipe bomb',             desc: '1 throwable: a big blast, mind your distance', cost: { scrap: 5, ammo: 3 },    hours: .75, items: { bomb: 1 } },
  { id: 'pack',    name: 'Patchwork backpack',    desc: 'Hiking pack: carries 10 more',              cost: { scrap: 6, wood: 3 },       hours: 1,   gear: 'hike' },
  { id: 'jacket',  name: 'Padded work jacket',    desc: 'blocks 12% of damage',                      cost: { scrap: 8, wood: 2 },       hours: 1,   gear: 'work' },
  { id: 'boots',   name: 'Reinforced boots',      desc: '10% faster on a run',                       cost: { scrap: 6, wood: 2 },       hours: 1,   gear: 'hike_boots' },
];

// ---- Infected. v = speed range px/s, dmg = contact damage per second, armor = flat damage reduction per hit ----
const ZTYPES = {
  walker:  { label: 'walker',   r: 10, hp: 2, v: [45, 85],   dmg: 15 },
  brute:   { label: 'brute',    r: 16, hp: 5, v: [50, 60],   dmg: 28 },
  runner:  { label: 'runner',   r: 9,  hp: 1, v: [120, 150], dmg: 12 },    // fast, and screams when it spots you
  spitter: { label: 'spitter',  r: 11, hp: 2, v: [40, 55],   dmg: 10 },    // keeps its distance and spits acid
  armored: { label: 'armoured', r: 12, hp: 6, v: [40, 55],   dmg: 22, armor: 1 },
  mutant:  { label: 'mutant',   r: 22, hp: 30, v: [62, 80],  dmg: 34, armor: .5 },   // boss: charges when it sees you
};
const pickFleet = f => { const l = Object.entries(f || { car: 1 }).flatMap(([t, n]) => Array(n).fill(t)); return l[Math.floor(Math.random() * l.length)]; };

// more recipes: shotgun shells, a suppressor, melee weapons
RECIPES.push(
  { id: 'shells',  name: 'Shotgun shells',        desc: '6 shells',                                   cost: { scrap: 8 },              hours: .5,  give: { shells: 6 } },
  { id: 'supp',    name: 'Improvised suppressor', desc: 'cuts how far gunshots carry by 60% (permanent)', cost: { scrap: 14, wood: 1 }, hours: 1,   upgrade: 'suppressor' },
  { id: 'bat',     name: 'Baseball bat',          desc: 'quiet melee, strong knock-back',            cost: { wood: 4, scrap: 1 },     hours: .5,  gear: 'bat' },
  { id: 'machete', name: 'Machete',               desc: 'quiet melee, 3 damage',                     cost: { scrap: 9 },              hours: .75, gear: 'machete' },
);

// ---- crew personalities and progression ----
const TRAITS = {
  tough:     { name: 'Tough',     desc: 'Heals +10 faster each night' },
  lucky:     { name: 'Lucky',     desc: '+10% expedition success' },
  scavenger: { name: 'Scavenger', desc: '+30% expedition loot' },
  steady:    { name: 'Steady',    desc: 'Morale drops half as fast' },
  nervous:   { name: 'Nervous',   desc: 'Morale drops 50% faster' },
};
const crewInit = c => {   // fills in the progression fields (also used to upgrade older saves)
  if (c.xp == null) c.xp = 0; if (!c.lvl) c.lvl = 1; if (c.morale == null) c.morale = 70; if (c.away === undefined) c.away = null;
  if (!c.trait) c.trait = Object.keys(TRAITS)[Math.floor(Math.random() * 5)];
  if (!c.perks) c.perks = []; if (!c.rel) c.rel = {}; if (c.inj === undefined) c.inj = null; if (!c.deeds) c.deeds = 0;
  return c;
};
