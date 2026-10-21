#!/usr/bin/env python3
"""
Check a house.json before opening it in the viewer.

  python3 tools/validate_house.py viewer/house.json

Runs the JSON schema (if the `jsonschema` package is installed: pip install jsonschema)
and a few sanity checks the schema cannot express: rooms inside the footprint, devices inside
their room, unique ids, doors on the room edge, panels that fit on the roof.
"""
import json
import math
import os
import sys


def main(path):
    with open(path, encoding="utf-8") as f:
        h = json.load(f)
    errors, warnings = [], []

    schema_path = os.path.join(os.path.dirname(__file__), "..", "schema", "house.schema.json")
    try:
        import jsonschema
        with open(schema_path, encoding="utf-8") as f:
            schema = json.load(f)
        for e in sorted(jsonschema.Draft202012Validator(schema).iter_errors(h), key=str):
            errors.append("schema: " + "/".join(map(str, e.path)) + ": " + e.message)
    except ImportError:
        warnings.append("jsonschema is not installed, schema not checked (pip install jsonschema)")

    W, D = h.get("footprint", {}).get("width", 0), h.get("footprint", {}).get("depth", 0)
    rooms = {r.get("id"): r for r in h.get("rooms", [])}
    if len(rooms) != len(h.get("rooms", [])):
        errors.append("room ids must be unique")
    for r in h.get("rooms", []):
        rid = r.get("id")
        if r.get("x0", 0) < -0.01 or r.get("x1", 0) > W + 0.01 or r.get("z0", 0) < -0.01 or r.get("z1", 0) > D + 0.01:
            errors.append(f"room {rid}: outside the footprint {W} x {D}")
        if r.get("x1", 0) <= r.get("x0", 0) or r.get("z1", 0) <= r.get("z0", 0):
            errors.append(f"room {rid}: x1/z1 must be larger than x0/z0")
        if not r.get("underRoof") and not r.get("height"):
            errors.append(f"room {rid}: needs a height (or underRoof: true)")
        d = r.get("door")
        if d and not (r["z0"] - 0.1 <= d["z"] <= r["z1"] + 0.1 and r["x0"] - 0.1 <= d["x"] <= r["x1"] + 0.1):
            warnings.append(f"room {rid}: the door is not on the room's edge")
        t = r.get("thermal", {})
        if t.get("uaKwPerK", 0.03) > 0.2 or t.get("capacityKwhPerK", 1) > 10:
            warnings.append(f"room {rid}: thermal values look too large (see docs/thermal-model.md)")

    ids = set()
    for dv in h.get("devices", []):
        if dv.get("id") in ids:
            errors.append(f"device id {dv.get('id')} is used twice")
        ids.add(dv.get("id"))
        r = rooms.get(dv.get("room"))
        if not r:
            errors.append(f"device {dv.get('id')}: unknown room {dv.get('room')}")
            continue
        x, y, z = dv.get("pos", [0, 0, 0])
        if not (r["x0"] - 0.3 <= x <= r["x1"] + 0.3 and r["z0"] - 0.3 <= z <= r["z1"] + 0.3):
            warnings.append(f"device {dv['id']}: position is outside room {r['id']}")
        if y < r["y"] - 0.1:
            warnings.append(f"device {dv['id']}: below the floor of room {r['id']}")

    sp, roof = h.get("solarPanels"), h.get("roof", {})
    if sp and roof:
        if sp["roofSide"] == "back":
            run = math.hypot(D - roof["ridgeZ"], roof["ridgeY"] - roof["eaveBackY"])
        else:
            run = math.hypot(roof["ridgeZ"], roof["ridgeY"] - roof["eaveFrontY"])
        if sp["rows"] * (sp["panelLength"] + 0.02) > run + 0.6:
            warnings.append(f"solar panels: {sp['rows']} rows do not fit on a {run:.1f} m roof slope")
        if sp["cols"] * (sp["panelWidth"] + 0.02) > W + 0.4:
            warnings.append(f"solar panels: {sp['cols']} columns do not fit across {W} m")
        slope = math.degrees(math.atan2(roof["ridgeY"] - (roof["eaveBackY"] if sp["roofSide"] == "back" else roof["eaveFrontY"]),
                                        (D - roof["ridgeZ"]) if sp["roofSide"] == "back" else roof["ridgeZ"]))
        if abs(slope - sp["tiltDeg"]) > 8:
            warnings.append(f"solar panels: tilt {sp['tiltDeg']}° but that roof slope is {slope:.0f}° (wrong roofSide?)")
        face = (h["orientation"]["backFacadeAzimuthDeg"] + (0 if sp["roofSide"] == "back" else 180)) % 360
        diff = abs((sp["azimuthDeg"] - face + 180) % 360 - 180)
        if sp["tiltDeg"] > 5 and diff > 30:
            warnings.append(f"solar panels: azimuth {sp['azimuthDeg']}° but the {sp['roofSide']} roof faces {face:.0f}° (check docs/orientation.md)")

    for w in warnings:
        print("warning:", w)
    for e in errors:
        print("error:  ", e)
    print(f"{path}: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(sys.argv[1]))
