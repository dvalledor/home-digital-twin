#!/usr/bin/env python3
"""
Monthly solar yield from PVGIS (EU Joint Research Centre) for one or more roof faces.

PVGIS uses satellite irradiation for your exact location, so it is more accurate than the
built-in climate presets of the calculator. The script prints kWh per installed kWp for
each month and can write the numbers into house.json so the twin and the calculator use them.

Examples
  python3 tools/pvgis_sizing.py --lat 40.42 --lon -3.70 --face south:180:30 --face east:90:30
  python3 tools/pvgis_sizing.py --house viewer/house.json --write

Faces are name:azimuth:tilt with azimuth in degrees clockwise from north (180 = south).
Only the Python standard library is needed. PVGIS is free and needs no account.
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request

APIS = ["https://re.jrc.ec.europa.eu/api/v5_3/PVcalc", "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"]
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def pvgis_monthly(lat, lon, azimuth, tilt, loss):
    """Return 12 monthly kWh values for a 1 kWp array."""
    params = {
        "lat": lat, "lon": lon, "peakpower": 1, "loss": loss,
        "angle": tilt,
        "aspect": ((azimuth - 180 + 540) % 360) - 180,  # PVGIS: 0 = south, -90 = east, 90 = west
        "outputformat": "json",
    }
    last = None
    for api in APIS:  # newest API version first, then the previous one
        try:
            with urllib.request.urlopen(api + "?" + urllib.parse.urlencode(params), timeout=60) as r:
                data = json.load(r)
            break
        except Exception as e:
            last = e
    else:
        raise last
    monthly = data["outputs"]["monthly"]["fixed"]
    return [round(m["E_m"], 1) for m in sorted(monthly, key=lambda m: m["month"])]


def parse_face(text):
    parts = text.split(":")
    if len(parts) != 3:
        raise argparse.ArgumentTypeError("use name:azimuth:tilt, for example south:180:30")
    return {"name": parts[0], "azimuth": float(parts[1]), "tilt": float(parts[2])}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lat", type=float)
    ap.add_argument("--lon", type=float)
    ap.add_argument("--face", type=parse_face, action="append", default=[])
    ap.add_argument("--loss", type=float, default=14, help="system losses in percent (default 14)")
    ap.add_argument("--kwp", type=float, help="installed peak power, to print the yearly total")
    ap.add_argument("--house", help="read location and solarPanels from this house.json")
    ap.add_argument("--write", action="store_true", help="store the result in house.json (needs --house)")
    ap.add_argument("--from-json", help=argparse.SUPPRESS)  # offline testing with a saved PVGIS response
    a = ap.parse_args()

    house = None
    if a.house:
        with open(a.house, encoding="utf-8") as f:
            house = json.load(f)
        loc, sp = house.get("location", {}), house.get("solarPanels")
        a.lat = a.lat if a.lat is not None else loc.get("lat")
        a.lon = a.lon if a.lon is not None else loc.get("lon")
        if not a.face and sp:
            a.face = [{"name": "panels", "azimuth": sp["azimuthDeg"], "tilt": sp["tiltDeg"]}]
            if sp.get("lossesPct") is not None:
                a.loss = sp["lossesPct"]
            if a.kwp is None and sp.get("panelWatt"):
                a.kwp = sp["rows"] * sp["cols"] * sp["panelWatt"] / 1000
    if a.lat is None or a.lon is None or not a.face:
        ap.error("give --lat, --lon and at least one --face, or --house with location and solarPanels")

    results = []
    for face in a.face:
        if a.from_json:
            with open(a.from_json, encoding="utf-8") as f:
                monthly = [round(m["E_m"], 1) for m in json.load(f)["outputs"]["monthly"]["fixed"]]
        else:
            try:
                monthly = pvgis_monthly(a.lat, a.lon, face["azimuth"], face["tilt"], a.loss)
            except Exception as e:  # network errors, PVGIS outside coverage, etc.
                sys.exit(f"PVGIS request failed for {face['name']}: {e}")
        results.append((face, monthly))

    print(f"PVGIS yield in kWh per kWp at {a.lat}, {a.lon}, losses {a.loss:g} %\n")
    print("face".ljust(14) + "".join(m.rjust(6) for m in MONTHS) + "  year")
    for face, monthly in results:
        print(face["name"][:13].ljust(14) + "".join(f"{v:6.0f}" for v in monthly) + f"{sum(monthly):6.0f}")
    if a.kwp:
        print(f"\nWith {a.kwp:g} kWp on the first face: about {sum(results[0][1]) * a.kwp:,.0f} kWh a year")

    print("\nPaste into the calculator (Use PVGIS numbers):")
    for face, monthly in results:
        print(f"{face['name']}: " + " ".join(f"{v:g}" for v in monthly))

    if a.write:
        if not house or "solarPanels" not in house:
            ap.error("--write needs --house with a solarPanels block")
        house["solarPanels"]["pvgisMonthlyKwhPerKwp"] = results[0][1]
        with open(a.house, "w", encoding="utf-8") as f:
            json.dump(house, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nSaved solarPanels.pvgisMonthlyKwhPerKwp in {a.house}")


if __name__ == "__main__":
    main()
