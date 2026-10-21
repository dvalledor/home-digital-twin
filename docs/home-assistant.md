# Home Assistant connection

The twin can read live data from Home Assistant: room temperatures, which heat pumps and radiators are working, solar power and the battery level. It uses the Home Assistant REST API from your browser with a long-lived access token. Nothing goes through any other server.

## 1. Host the twin inside Home Assistant (recommended)

Files in Home Assistant's `/config/www/` folder are served at `/local/`. Serving the twin from there keeps it on the same address as the API, so the browser allows the requests without any extra setup, and the twin works at home and through your remote access.

1. Copy the whole `viewer` folder to `/config/www/home-digital-twin/` with the **File editor** or **Samba share** add-on, or `scp`:

   ```bash
   cd home-digital-twin
   scp -r viewer/* root@homeassistant.local:/config/www/home-digital-twin/
   ```
   (`/config/www` may not exist yet; create it, and restart Home Assistant once after creating it.)
2. Make sure your own house file is there as `house.json`.
3. Open `http://homeassistant.local:8123/local/home-digital-twin/index.html`.
4. Optional: add it to the sidebar. Settings, Dashboards, Add dashboard, **Webpage**, URL `/local/home-digital-twin/index.html`.

Files under `/local/` are public to anyone who can reach your Home Assistant address, without login. They contain your house layout, but no token and no data: the data needs the token, which stays in your browser. If that still bothers you, keep the twin on your computer (section 3).

## 2. Create a token and connect

1. In Home Assistant open your profile (bottom left), tab **Security**, **Long-lived access tokens**, **Create token**, name it "Home Digital Twin" and copy it.
2. In the twin, panel **Home Assistant**: the URL is filled in automatically when the twin is hosted in Home Assistant; paste the token and press **Connect live**.
3. The clock switches to **Live**: the sun and the clock follow real time, the labels show the measured temperatures, heat pump and radiator icons follow the real devices, and the solar panel shows the real power and battery level. The simulation runs from now to 07:00 starting from the measured temperatures.

The token is saved in this browser's local storage only. **Forget** deletes it. To revoke it everywhere, delete it in your profile.

## 3. Twin on your computer, Home Assistant elsewhere

Browsers block requests from one site to another unless the second one allows it (CORS). Add your twin's address to Home Assistant's `configuration.yaml`:

```yaml
http:
  cors_allowed_origins:
    - http://localhost:8000
```

Restart Home Assistant, serve the twin with `python3 -m http.server 8000` from the `viewer` folder and connect with your Home Assistant URL. A page served over `http` cannot call a Home Assistant served over `https` from another origin on some browsers, and the reverse: keep both on the same scheme.

## 4. Map your entities

In `house.json`:

| Field | Entity | Notes |
| --- | --- | --- |
| `rooms[].temperatureEntity` | `climate.*` or `sensor.*` | For climate entities the `current_temperature` attribute is used. Prefer a sensor at bed height. |
| `devices[].entity` (heat pumps) | `climate.*` | On when the state is not `off`; if the entity reports `hvac_action`, idle counts as off. |
| `devices[].entity` (radiators) | `climate.*` | Heating when `hvac_action` is `heating`. |
| `devices[].heatingPowerEntity` | `sensor.*` | Better than the above when you have it (for example a smart valve's heating power in %): heating when above 0. |
| `homeAssistant.outdoorTemperatureEntity` | `weather.*` or `sensor.*` | |
| `homeAssistant.solarPowerEntity` | `sensor.*` | W or kW (read from the unit). |
| `homeAssistant.batterySocEntity` | `sensor.*` | % |
| `homeAssistant.gridPowerEntity` | `sensor.*` | Not displayed yet; used by the automations. |

The status line under **Connect live** lists the entities it could not find. Find the right ids in Settings, Devices & services, Entities.
