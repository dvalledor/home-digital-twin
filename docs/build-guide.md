# Build guide

This guide takes you from nothing to a working digital twin of your house that heats it with solar surplus and tells you, with numbers, whether it was worth it. You can stop after any stage: the twin alone is already useful to understand how heat moves through your home.

| Stage | Time | You need |
| --- | --- | --- |
| 1. Twin of the example house | 5 min | A computer with Python 3 |
| 2. Twin of your house | 2 to 4 h | A tape measure or laser meter, a phone camera |
| 3. Solar sizing | 30 min | Your electricity bills, roof measurements |
| 4. Home Assistant | half a day | A small always-on computer, your devices |
| 5. Surplus heating | 1 h | Solar inverter with a battery, heat pumps controllable from Home Assistant |
| 6. Calibrate and measure | 2 to 3 weeks of data | Patience |

## 1. Run the example

```bash
git clone https://github.com/dvalledor/home-digital-twin.git
cd home-digital-twin/viewer
python3 -m http.server 8000
```

Open <http://localhost:8000>. Drag to orbit, scroll or pinch to zoom, use **Section** to look inside. Play with the doors, the heat pumps and the outdoor temperature and watch the table: it compares every room at bed height with and without the heat pumps.

## 2. Describe your house

1. Copy `viewer/house.example.json` to `viewer/house.json`. The viewer loads `house.json` first and falls back to the example.
2. Take the photos and measurements listed in [photos-to-model.md](photos-to-model.md).
3. Fill in `house.json` by hand with [house-config.md](house-config.md) next to you, or give the photos and the prompt from [photos-to-model.md](photos-to-model.md#generate-the-file-with-an-ai-assistant) to an AI assistant and correct what it gets wrong.
4. Find the orientation: [orientation.md](orientation.md).
5. Check the file:

   ```bash
   pip install jsonschema        # once
   python3 tools/validate_house.py viewer/house.json
   ```
6. Reload the browser. Iterate: it is normal to adjust positions five or six times until the model looks like your house.

Rooms, doors, heaters and the roof matter for the physics. Furniture, plants and the garden are decoration: add as much or as little as you like.

## 3. Solar panels

Open `solar.html` (served by the same web server) and follow [solar.md](solar.md). If you already have panels, describe them in the `solarPanels` block of `house.json` so the twin shows them and estimates today's production. If you are planning an installation, the calculator gives you a size to discuss with installers.

## 4. Home Assistant

### Hardware

Home Assistant needs a small computer that is always on. Any of these works:

| Option | Notes |
| --- | --- |
| Home Assistant Green or Yellow | Ready to plug in, the simplest path. |
| Raspberry Pi 4 or 5 with an SSD | Cheap; use an SSD, not a memory card. |
| Old laptop or mini PC | Install Home Assistant OS directly, or in a virtual machine (VirtualBox, Proxmox) with a **bridged** network adapter so devices on your network can reach it. A laptop battery doubles as a small UPS. |

Wire it to the router with Ethernet if you can.

### Devices this project uses

You do not need all of them; the twin works with whatever you have.

| Role | Examples | Integration |
| --- | --- | --- |
| Room temperatures | Smart radiator valves, Zigbee or Bluetooth thermometers, the heat pumps' own sensors | Tado, Netatmo, ZHA / Zigbee2MQTT, Xiaomi BLE, ... |
| Heat pumps / air conditioners | Wi-Fi split units | LG ThinQ, Daikin, Mitsubishi (MELCloud), Midea, Panasonic, or an IR blaster |
| Radiators or boiler | Smart valves and thermostat | Tado, Netatmo, Honeywell, Shelly TRV, ... |
| Solar inverter and battery | Hybrid inverter | Many speak Modbus TCP locally (Sungrow, Huawei, SolarEdge, Fronius, GoodWe, ...); prefer a local integration over a cloud one |
| Solar forecast | — | **Forecast.Solar** (free) or Solcast |
| Grid power | The inverter's meter, a Shelly EM, a P1 smart meter reader | — |

### Steps

1. Install Home Assistant following the official guide for your hardware: <https://www.home-assistant.io/installation/>.
2. Add the integrations for your devices (Settings, Devices & services, Add integration).
3. Add **Forecast.Solar** with the same azimuth, tilt and kWp as your panels. It creates `sensor.energy_production_today_remaining`, which the automations use.
4. Set up the Energy dashboard (solar, battery, grid). It is the easiest way to see whether everything is measured correctly.
5. Host the twin inside Home Assistant and connect it live: [home-assistant.md](home-assistant.md).

## 5. Heat with solar surplus

Follow [automations.md](automations.md). The short version:

1. Copy `homeassistant/packages/home_digital_twin.yaml` into `/config/packages/`, edit the three marked entity ids and restart.
2. Import the three blueprints and create one automation from each, listing your heat pumps in priority order.
3. Switch on **Surplus · Heat with solar surplus**.

The logic only spends energy the forecast says will come back before sunset, never switches off a unit someone else switched on, and leaves at least 10 minutes between steps so the compressors are not cycled.

## 6. Calibrate and measure

1. Calibrate the forecast correction factor after a week (compare real production with the forecast) and the thermal parameters with a cool-down night: [thermal-model.md](thermal-model.md#calibrate-with-your-own-data).
2. Run an A/B test of two weeks to know whether pre-heating while you are away is worth it: [ab-test.md](ab-test.md).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Could not load house.json" | Serve the folder over http (`python3 -m http.server`), or use the **Open house.json** button. |
| JSON error when loading | Run `tools/validate_house.py`; a missing comma is the usual suspect. |
| Rooms float or overlap | `y` is the floor level of each room; `x0..x1` and `z0..z1` must stay inside `footprint`. |
| The compass points the wrong way | Check `backFacadeAzimuthDeg`: it is where the **back** facade looks. See [orientation.md](orientation.md). |
| Live mode: "Could not read Home Assistant" | Host the viewer in `/config/www` so it is on the same origin, check the token, see [home-assistant.md](home-assistant.md). |
| A heat pump never switches on | Check that the battery level sensor really reaches the "full" threshold, that the grid sensor sign is right (export positive or negative) and that the unit has been off for 45 minutes. Automation traces show which condition failed. |
| The battery is empty at night | Lower the forecast correction factor, raise the house base load or the lowest battery level. |

## Safety and rules

- **Electrical work and roofs are for professionals.** Solar panels, inverters and batteries carry dangerous DC voltages even when the grid is off; working on a roof needs fall protection. Have them installed by a certified installer, who also handles the grid connection.
- **Check local rules before buying panels.** Depending on the country you may need a building notice or permit, a registration of the installation with the grid operator, a contract to be paid for exported energy and, in some places, heritage or community approval. Installers usually handle the paperwork; ask.
- **Heat pumps**: keep the setpoints reasonable, leave the manufacturer's protections on and do not let automations switch a compressor on and off every few minutes (the blueprints already wait 10 minutes between steps and 45 minutes before restarting a unit).
- **Your Home Assistant token** gives full control of your home. Keep it in the browser of the devices you trust; revoke it in your profile if a device is lost.
