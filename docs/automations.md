# Heating with solar surplus

In autumn, winter and spring a solar battery is often full by early afternoon, and from then on the panels export energy to the grid for very little money. Heat pumps turn each kWh of electricity into 3 to 4 kWh of heat. These automations use that surplus to warm the house before the evening, so the radiators or the boiler have less to do at night.

The rule is simple: **only spend energy that will come back to the battery before sunset**.

## How it decides

1. **Dynamic battery floor.** From the solar forecast still to come today, corrected by a factor (forecasts tend to be optimistic), minus what the house consumes until sunset and a 0.5 kWh reserve, it computes the lowest battery level from which the sun can still refill the battery:

       floor = 100 − (remaining forecast × factor − base load × hours to sunset − 0.5) / kWh per %

   never below the **lowest battery level** you set. **Battery margin** = battery level − floor.
2. **Start**: battery above 97 % **and** the house exporting more than 300 W (or a margin above 10 points). The first heat pump in your priority list starts at the setpoint (22 °C), in heating mode, or in cooling mode if the room is above 24 °C.
3. **Add**: every 2 minutes, if no unit was started in the last 10 minutes and there is still surplus (battery full and export above 400 W, or a margin above 25), the next unit starts.
4. **Step down**: if the margin falls below −2 the last unit started is switched off (after it has run at least 10 minutes; immediately if the margin falls below −8).
5. **Stop everything** at sunset, when you switch the main switch off, when the margin sensor is unavailable, or when you are away and **Allow while away** is off.
6. **Respect**: each unit has a marker boolean "switched on by surplus". The automation only switches off units it switched on; if you switch a unit off by hand, its marker is cleared. A unit switched off is left alone for 45 minutes.

Put the most important room first and the biggest consumer last: it is started only when there is plenty of margin and stopped first.

### Bed-level setpoint

Wall units measure the air near the ceiling. Under a high or sloped ceiling, and above all under a concrete roof, that air is 1 to 3 °C warmer than at bed height, so the unit stops while the bed is still cold. The **Bed-level setpoint** blueprint raises the unit's setpoint by the difference between its own sensor and a sensor at bed height (a smart radiator valve or a small thermometer), up to 24 °C, only for units started by the surplus automation in heating mode.

## Install

You need: a battery level sensor (%), a grid power sensor (W), the Forecast.Solar integration (or another forecast that gives "energy still to come today" in kWh), and heat pumps as `climate.*` entities.

1. **Packages.** In `/config/configuration.yaml` add (once):

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. **Package.** Copy `homeassistant/packages/home_digital_twin.yaml` to `/config/packages/home_digital_twin.yaml`. Search for `EDIT` and replace:
   - `sensor.energy_production_today_remaining` (twice) with your forecast sensor, if different;
   - `sensor.battery_state_of_charge` (twice) with your battery level sensor.
   If you have more than three heat pumps, copy a marker boolean and give it a new name.
3. **Check and restart.** Developer tools, YAML, **Check configuration**, then restart.
4. **Helpers.** Set **Surplus · Battery kWh per percent** to your usable battery capacity / 100 (5 kWh → 0.05) and **Surplus · House base load** to your typical afternoon consumption in kW. Leave the rest for now.
5. **Blueprints.** Copy the folder `homeassistant/blueprints/automation/home_digital_twin/` to `/config/blueprints/automation/home_digital_twin/` and reload automations (or import each file from its GitHub URL with Settings, Automations, Blueprints, **Import blueprint**).
6. **Create three automations** (Settings, Automations, Blueprints, pick one, **Create automation**):
   - **Heat with solar surplus**: your heat pumps **in priority order**, the marker booleans **in the same order**, the battery level sensor, the grid power sensor and whether export is positive or negative, and your away-mode boolean if you have one.
   - **Clear surplus markers**: the same two lists.
   - **Bed-level setpoint** (optional): the same two lists and one bed-level sensor per heat pump.
7. Switch on **Surplus · Heat with solar surplus**.

## Watch it work

Add the helpers and sensors to a dashboard card: battery level, dynamic floor, margin, grid power and the markers. On the first sunny afternoon, follow the automation traces (Settings, Automations, the automation, Traces): each run shows which branch it took and why.

## Tuning

| Helper | Start | Adjust when |
| --- | --- | --- |
| Forecast correction factor | 0.65 | After a week or two, divide the real production of each afternoon by what the forecast said at 14:00, and use the average. If the battery ends the day below full, lower it. |
| House base load | 0.4 kW | Look at the house consumption between 14:00 and sunset without heat pumps. |
| Lowest battery level | 30 % | What you want left for the evening if everything goes wrong. |
| Setpoint (blueprint) | 22 °C | Warmer stores more heat but loses more through the walls. 21 to 23 °C is a good range. |

## Why some units start in cooling mode

From late spring to early autumn the same logic cools rooms that are above 24 °C with free solar energy. Change **Cool instead of heat above** in the blueprint to move or effectively disable that (set it to 32 °C).

## What it does not do

- It does not touch your radiators or boiler: they simply have less work when the house is already warm. If your thermostat runs on a schedule, it will notice by itself.
- It does not buy energy from the grid on purpose. Small imports can happen when a cloud passes; the margin and the steps limit them.
- It does not know your comfort: if nobody is home, decide with an A/B test whether pre-heating is worth it ([ab-test.md](ab-test.md)).
