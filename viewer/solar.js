/*
 * Home Digital Twin: solar model shared by the twin viewer (index.html) and the sizing calculator (solar.html).
 *
 * A deliberately small, dependency-free photovoltaic model:
 *   1. Sun position from latitude, longitude, clock offset, day of year and local hour.
 *   2. Clear-sky irradiance (Haurwitz for global, Meinel for direct beam, diffuse as the remainder).
 *   3. Transposition to the tilted panel plane (beam + isotropic diffuse + ground reflection).
 *   4. A monthly "clearness" factor (real / clear-sky irradiation) for the local climate.
 *   5. DC power with system losses and a cell-temperature correction, clipped by the inverter.
 *
 * Its presets were tuned so that a south-facing roof lands within roughly ±10 % of PVGIS for typical European roofs. For a purchase decision,
 * paste PVGIS monthly values into the calculator (or run tools/pvgis_sizing.py): the model then keeps
 * its hourly shapes but scales every month to the PVGIS totals.
 *
 * Angles: azimuth in degrees clockwise from north (0 N, 90 E, 180 S, 270 W). Tilt 0 = flat.
 */
(function (root) {
  'use strict';
  const RAD = Math.PI / 180;
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MID = [15, 46, 74, 105, 135, 162, 198, 228, 258, 288, 318, 344]; // representative day of each month

  /* Monthly clearness (real irradiation / clear-sky irradiation) and mean daytime air temperature (°C). */
  const CLIMATES = {
    'sunny-south': { label: 'Sunny: Spain, Portugal, southern Italy, Greece',
      k: [.75, .77, .79, .78, .81, .89, .95, .93, .85, .77, .72, .71], t: [10, 12, 15, 17, 22, 28, 32, 31, 26, 20, 13, 10] },
    'mediterranean-north': { label: 'Mild: southern France, northern Italy, Croatia',
      k: [.59, .64, .67, .67, .71, .77, .82, .80, .74, .64, .57, .56], t: [7, 9, 13, 16, 21, 26, 29, 28, 23, 17, 11, 7] },
    'central': { label: 'Mixed: Germany, Benelux, northern France, Switzerland',
      k: [.47, .54, .59, .65, .67, .68, .69, .68, .64, .56, .46, .43], t: [3, 5, 9, 14, 18, 21, 24, 23, 19, 14, 8, 4] },
    'north': { label: 'Cloudy: UK, Ireland, Denmark, Scandinavia',
      k: [.40, .45, .50, .56, .58, .57, .57, .55, .52, .46, .40, .35], t: [5, 6, 8, 11, 15, 18, 20, 20, 17, 13, 8, 6] }
  };

  function dayOfYear(date) {
    const d = date || new Date();
    return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 864e5);
  }
  /* Clock offset for a given day: standard offset plus one hour of EU or US daylight saving time. */
  function clockOffset(site, day) {
    const std = site.utcOffsetHours || 0, d = site.daylightSaving;
    if (d === 'eu') return std + (day >= 87 && day < 300 ? 1 : 0);   // last Sunday of March to last Sunday of October
    if (d === 'us') return std + (day >= 70 && day < 308 ? 1 : 0);   // second Sunday of March to first Sunday of November
    return std;
  }
  function monthOfDay(n) { let m = 0, s = 0; while (m < 11 && n > s + DAYS[m]) { s += DAYS[m]; m++; } return m; }

  /* Sun position. hour is local clock time (decimal), utcOffset the clock offset to UTC in hours. */
  function sunPosition(lat, lon, utcOffset, day, hour) {
    const decl = 23.44 * RAD * Math.sin(2 * Math.PI * (284 + day) / 365);
    const B = 2 * Math.PI * (day - 81) / 364;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // minutes
    const solarNoon = 12 + utcOffset - lon / 15 - eot / 60;
    const H = (hour - solarNoon) * 15 * RAD, phi = lat * RAD;
    const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
    const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI; // from north, clockwise
    return { el, az, solarNoon, decl };
  }

  /* Clear-sky irradiance on a horizontal plane (W/m²). */
  function clearSky(el, day) {
    if (el <= 0) return { ghi: 0, dni: 0, dhi: 0 };
    const cz = Math.sin(el), zDeg = 90 - el / RAD;
    const e0 = 1 + 0.033 * Math.cos(2 * Math.PI * day / 365);
    const am = 1 / (cz + 0.50572 * Math.pow(96.07995 - zDeg, -1.6364));
    const dni = 1361 * e0 * Math.pow(0.7, Math.pow(am, 0.678));
    const ghi = 1098 * cz * Math.exp(-0.057 / cz);
    const dhi = Math.max(ghi * 0.08, ghi - dni * cz);
    return { ghi, dni, dhi };
  }

  /* Irradiance on the panel plane (W/m²). */
  function planeOfArray(sun, irr, tiltDeg, azDeg, albedo) {
    if (sun.el <= 0) return 0;
    const t = tiltDeg * RAD, a = azDeg * RAD, z = Math.PI / 2 - sun.el;
    const cosAoi = Math.cos(z) * Math.cos(t) + Math.sin(z) * Math.sin(t) * Math.cos(sun.az - a);
    const beam = irr.dni * Math.max(0, cosAoi) * iam(cosAoi);
    const diffuse = irr.dhi * (1 + Math.cos(t)) / 2;
    const ground = irr.ghi * (albedo == null ? 0.2 : albedo) * (1 - Math.cos(t)) / 2;
    return beam + diffuse + ground;
  }
  // Incidence angle modifier: glass reflects more at grazing angles (ASHRAE, b0 = 0.05).
  function iam(c) { return c <= 0.05 ? 0 : Math.max(0, 1 - 0.05 * (1 / c - 1)); }

  /*
   * One array: { kwp, tiltDeg, azimuthDeg, lossesPct?, albedo? }.
   * site: { lat, lon, utcOffsetHours (standard time), daylightSaving ('eu' | 'us' | none), climate (key or {k:[12], t:[12]}), inverterKw?, pvgisMonthlyKwhPerKwp? (array of 12, per array index) }
   */
  function climateOf(site) {
    const c = site.climate;
    if (c && typeof c === 'object') return c;
    return CLIMATES[c] || CLIMATES['sunny-south'];
  }
  function powerKw(site, array, day, hour, clearnessOverride) {
    const m = monthOfDay(day);
    const sun = sunPosition(site.lat, site.lon, clockOffset(site, day), day, hour);
    if (sun.el <= 0) return 0;
    const cl = climateOf(site);
    const k = clearnessOverride != null ? clearnessOverride : cl.k[m];
    const poa = planeOfArray(sun, clearSky(sun.el, day), array.tiltDeg, array.azimuthDeg, array.albedo) * k;
    const tCell = cl.t[m] + poa / 800 * 25;                // NOCT-style heating of the cells
    const temp = 1 - 0.0035 * (tCell - 25);
    const losses = 1 - (array.lossesPct == null ? 14 : array.lossesPct) / 100;
    return Math.max(0, array.kwp * poa / 1000 * losses * temp);
  }

  /* Hourly kW for a representative day (24 values; each value is the mean over that hour). */
  function dayProfile(site, arrays, day, clearness) {
    const out = new Array(24).fill(0), steps = 6;
    for (let h = 0; h < 24; h++) {
      let s = 0;
      for (let k = 0; k < steps; k++) {
        const hr = h + (k + 0.5) / steps;
        let p = 0; arrays.forEach(a => { p += powerKw(site, a, day, hr, clearness); });
        if (site.inverterKw) p = Math.min(p, site.inverterKw);
        s += p;
      }
      out[h] = s / steps;
    }
    return out;
  }

  /*
   * Year model: per month, 24 hourly kW values for an average day plus the monthly kWh.
   * If site.pvgisMonthlyKwhPerKwp is given (12 numbers, or one array of 12 per PV array), each month is scaled to it.
   */
  function yearProfile(site, arrays) {
    const months = [];
    for (let m = 0; m < 12; m++) {
      const perArray = arrays.map(a => dayProfile(Object.assign({}, site, { inverterKw: 0 }), [a], MID[m]));
      if (site.pvgisMonthlyKwhPerKwp) {
        perArray.forEach((prof, i) => {
          const ref = Array.isArray(site.pvgisMonthlyKwhPerKwp[0]) ? site.pvgisMonthlyKwhPerKwp[i] : site.pvgisMonthlyKwhPerKwp;
          if (!ref) return;
          const model = prof.reduce((x, y) => x + y, 0) * DAYS[m];
          const target = ref[m] * arrays[i].kwp;
          if (model > 0) for (let h = 0; h < 24; h++) prof[h] *= target / model;
        });
      }
      const hourly = new Array(24).fill(0);
      perArray.forEach(prof => prof.forEach((v, h) => { hourly[h] += v; }));
      if (site.inverterKw) for (let h = 0; h < 24; h++) hourly[h] = Math.min(hourly[h], site.inverterKw);
      months.push({ month: m, days: DAYS[m], hourly, kwh: hourly.reduce((x, y) => x + y, 0) * DAYS[m] });
    }
    const kwh = months.reduce((s, m) => s + m.kwh, 0), kwp = arrays.reduce((s, a) => s + a.kwp, 0);
    return { months, kwh, kwp, specificYield: kwp ? kwh / kwp : 0 };
  }

  /* Household load shape: 24 weights summing to 1, with a share of the daily energy used between 09:00 and 18:00. */
  function loadShape(daytimeShare) {
    const base = [.6, .5, .45, .45, .45, .5, .7, 1.1, 1.2, 1, 1, 1, 1.1, 1.2, 1, 1, 1, 1.1, 1.3, 1.6, 1.8, 1.7, 1.4, .9];
    const isDay = h => h >= 9 && h < 18;
    const dSum = base.reduce((s, v, h) => s + (isDay(h) ? v : 0), 0), nSum = base.reduce((s, v, h) => s + (isDay(h) ? 0 : v), 0);
    const ds = daytimeShare == null ? 0.35 : Math.max(0.05, Math.min(0.9, daytimeShare));
    return base.map((v, h) => isDay(h) ? v / dSum * ds : v / nSum * (1 - ds));
  }
  /* Monthly share of annual consumption. */
  const LOAD_SEASONS = {
    flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    'winter-heat-pump': [1.55, 1.4, 1.15, .9, .75, .7, .75, .75, .75, .9, 1.2, 1.5],
    'summer-cooling': [.95, .9, .85, .85, .95, 1.15, 1.35, 1.3, 1.05, .9, .9, .95],
    'heat-pump-and-cooling': [1.35, 1.25, 1.05, .85, .8, .95, 1.15, 1.1, .85, .85, 1.05, 1.3]
  };

  /*
   * Hour-by-hour energy balance for a year of representative days, with an optional battery.
   * opts: { annualKwh, daytimeShare, season, batteryKwh, batteryUsablePct, batteryPowerKw, roundTripPct, monthlyKwh? (12) }
   */
  function simulate(year, opts) {
    const shape = loadShape(opts.daytimeShare);
    const seas = LOAD_SEASONS[opts.season] || LOAD_SEASONS.flat;
    const wSum = seas.reduce((s, v, m) => s + v * DAYS[m], 0);
    const cap = (opts.batteryKwh || 0) * ((opts.batteryUsablePct == null ? 90 : opts.batteryUsablePct) / 100);
    const pmax = opts.batteryPowerKw || Math.max(2.5, (opts.batteryKwh || 0) * 0.5);
    const eff = Math.sqrt((opts.roundTripPct == null ? 92 : opts.roundTripPct) / 100);
    const tot = { pv: 0, load: 0, self: 0, imp: 0, exp: 0, fromBattery: 0 }, months = [];
    // Real months mix sunny, average and cloudy days; a battery helps less than an "average day" suggests.
    const TYPES = opts.dayTypes || [{ f: 1.3, w: 0.4 }, { f: 1.0, w: 0.35 }, { f: 0.4, w: 0.25 }];
    const mean = TYPES.reduce((s, t) => s + t.f * t.w, 0);
    year.months.forEach(M => {
      const dayLoad = opts.monthlyKwh ? opts.monthlyKwh[M.month] / M.days : opts.annualKwh * seas[M.month] / wSum;
      const mo = { month: M.month, pv: 0, load: 0, self: 0, imp: 0, exp: 0, fromBattery: 0, hours: null };
      TYPES.forEach(T => {
        const f = T.f / mean; let soc = cap * 0.3, r;
        for (let rep = 0; rep < 3; rep++) {         // repeat the day until the battery cycle is steady
          r = { pv: 0, load: 0, self: 0, imp: 0, exp: 0, fromBattery: 0, hours: [] };
          for (let h = 0; h < 24; h++) {
            const pv = M.hourly[h] * f, load = dayLoad * shape[h];
            const direct = Math.min(pv, load);
            let surplus = pv - direct, deficit = load - direct, charge = 0, dis = 0;
            if (cap > 0) {
              charge = Math.min(surplus, pmax, (cap - soc) / eff); soc += charge * eff; surplus -= charge;
              dis = Math.min(deficit, pmax, soc * eff); soc -= dis / eff; deficit -= dis;
            }
            r.pv += pv; r.load += load; r.self += direct + dis; r.fromBattery += dis; r.imp += deficit; r.exp += surplus;
            r.hours.push({ pv, load, imp: deficit, exp: surplus, soc: cap ? soc / cap : 0 });
          }
        }
        ['pv', 'load', 'self', 'imp', 'exp', 'fromBattery'].forEach(k => { mo[k] += r[k] * M.days * T.w; });
        if (!mo.hours || Math.abs(f - 1) < mo._d) { mo.hours = r.hours; mo._d = Math.abs(f - 1); }
      });
      delete mo._d;
      months.push(mo); ['pv', 'load', 'self', 'imp', 'exp', 'fromBattery'].forEach(k => { tot[k] += mo[k]; });
    });
    tot.selfConsumption = tot.pv ? tot.self / tot.pv : 0;     // share of production used at home
    tot.selfSufficiency = tot.load ? tot.self / tot.load : 0; // share of consumption covered by the sun
    return { months, total: tot };
  }

  /* How many panels fit on a rectangular roof area, in portrait or landscape, whichever holds more. */
  function panelsThatFit(face, panel) {
    const e = face.edgeM == null ? 0.3 : face.edgeM, g = panel.gapM == null ? 0.02 : panel.gapM;
    const W = Math.max(0, face.widthM - 2 * e), L = Math.max(0, face.lengthM - 2 * e);
    const fit = (pw, pl) => { const c = Math.floor((W + g) / (pw + g)), r = Math.floor((L + g) / (pl + g)); return { cols: c, rows: r, n: c * r }; };
    const portrait = fit(panel.widthM, panel.lengthM), landscape = fit(panel.lengthM, panel.widthM);
    return portrait.n >= landscape.n ? Object.assign(portrait, { orientation: 'portrait' }) : Object.assign(landscape, { orientation: 'landscape' });
  }

  const INVERTERS = [2, 3, 3.6, 4, 4.6, 5, 6, 8, 10, 12, 15, 20];
  const BATTERIES = [0, 2.5, 5, 7.5, 10, 12.5, 15, 20];
  /* DC/AC ratio between 1.0 and 1.3 is normal; pick the smallest standard size at or above kWp/1.25. */
  function suggestInverter(kwp) { const need = kwp / 1.25; return INVERTERS.find(s => s >= need) || Math.ceil(need); }
  function nearest(list, v) { return list.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, list[0]); }

  /* Annual money flows; years with a linear panel degradation. */
  function economics(sim, p) {
    const save = sim.total.self * p.importPrice + sim.total.exp * p.exportPrice;
    const cost = p.kwp * 1000 * p.costPerWp + (p.batteryKwh || 0) * (p.batteryCostPerKwh || 0) + (p.fixedCost || 0);
    let cum = -cost, payback = null; const years = p.years || 25, deg = (p.degradationPct == null ? 0.5 : p.degradationPct) / 100;
    for (let y = 1; y <= years; y++) {
      const s = save * (1 - deg * (y - 1)) * Math.pow(1 + (p.priceGrowthPct || 0) / 100, y - 1);
      if (payback == null && cum + s >= 0) payback = y - 1 + (-cum) / s;
      cum += s;
    }
    return { annualSaving: save, cost, payback, net: cum };
  }

  const api = { clockOffset, CLIMATES, LOAD_SEASONS, DAYS, MID, INVERTERS, BATTERIES, dayOfYear, monthOfDay, sunPosition, clearSky, planeOfArray, powerKw, dayProfile, yearProfile, loadShape, simulate, panelsThatFit, suggestInverter, nearest, economics };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Solar = api;
})(typeof window !== 'undefined' ? window : globalThis);
