# Heating with solar surplus, and the rest of the day

In autumn, winter and spring a solar battery is often full by early afternoon, and from then on the panels export energy to the grid for very little money. Heat pumps turn each kWh of electricity into 3 to 4 kWh of heat. These automations use that surplus to warm the house before the evening, so the radiators or the boiler have less to do at night. Around them, a few more automations cover the rest of the day: heat pumps on a schedule when the family comes home, a bedroom at the right temperature at bedtime, radiators at night, a warm kitchen at breakfast and an away mode that every one of them respects.

The rule for the surplus is simple: **only spend energy that will come back to the battery before the useful sun ends**, so the battery is full when the evening starts.

## What is included

| File | Kind | What it does |
| --- | --- | --- |
| `packages/home_digital_twin.yaml` | Package | Helpers and sensors for the surplus: useful sun, expected house consumption, dynamic battery floor, battery margin. A/B test automation. |
| `blueprints/.../solar_surplus_heat_pumps.yaml` | Blueprint | Heat pumps one at a time, in priority order, with energy that will come back. |
| `blueprints/.../clear_surplus_markers.yaml` | Blueprint | Clears a unit's marker when it is switched off by anybody. |
| `blueprints/.../bed_level_setpoint.yaml` | Blueprint | Raises the setpoint of units under high ceilings so the bed area, not the ceiling, reaches the target. |
| `blueprints/.../scheduled_heat_pumps.yaml` | Blueprint | Heat pumps at a set temperature during a schedule (for example weekday afternoons), even from the grid. |
| `blueprints/.../scheduled_radiator.yaml` | Blueprint | A radiator at a set temperature during a schedule (for example bedrooms at night). |
| `blueprints/.../away_mode.yaml` | Blueprint | Away mode switched by presence; heat pumps off and radiators to frost protection while away. |
| `packages/bedtime_warmup.yaml` | Package | A bedroom at the right temperature at bedtime with its heat pump, switched on just in time, learning every night how fast the room cools. |
| `packages/morning_preheat.yaml` | Package | One room warm at a set time in the morning, with an early start that learns the heating rate. |

Blueprints are for logic that only needs a list of your entities. The two extra packages have their own helpers and learned values, so they are packages with a few entity ids to edit.

## How the surplus automation decides

1. **Useful sun.** In the last hour or so before sunset most roofs produce almost nothing. **Surplus · Useful sun** is on while the sun is up and sunset is more than **Useful sun ends before sunset** minutes away (80 by default). Everything below is measured against the end of the useful sun, not sunset.
2. **Dynamic battery floor.** From the solar forecast still to come today, corrected by a factor (forecasts tend to be optimistic), minus what the house is expected to consume until the useful sun ends, a 0.5 kWh cushion and 5 % charging losses, it computes the lowest battery level from which the sun can still refill the battery:

       floor = 100 − (remaining forecast × factor − expected consumption − 0.5) × 0.95 / kWh per %

   never below the **lowest battery level** you set, and 100 % once the useful sun has ended. **Battery margin** = battery level − floor.
3. **Expected consumption** comes from an hourly profile (24 values in kW, one per hour, without heating or cooling) multiplied by **House consumption scale**. Copy the profile from a few autumn days of your Energy dashboard.
4. **Start**: battery above 97 % **and** the house exporting more than 300 W (or a margin above 10 points). The first heat pump in your priority list starts at the setpoint (22 °C), in heating mode, or in cooling mode if the room is above 24 °C.
5. **Add**: every 2 minutes, if no unit was started in the last 10 minutes and there is still surplus (battery full and export above 400 W, or a margin above 25), the next unit starts.
6. **Step down**: if the margin falls below −2 the last unit started is switched off (after it has run at least 10 minutes; immediately if the margin falls below −8).
7. **Stop everything** when the useful sun ends, when you switch the main switch off, when the margin sensor is unavailable, or when you are away and **Allow while away** is off.
8. **Respect**: each unit has a marker boolean "switched on by surplus". The automation only switches off units it switched on; if you switch a unit off by hand, its marker is cleared. A unit switched off is left alone for 45 minutes.

Put the most important room first and the biggest consumer last: it is started only when there is plenty of margin and stopped first.

### Room sensors decide between heating and cooling

Wall units measure the air near the ceiling, often 2 to 5 °C warmer than the room. If a room has a smart radiator valve or a thermometer, give it in **Room sensors**: the automation uses it to decide whether the room needs heat or cooling. For a room without one, pick the heat pump itself.

### No heating when it is warm outdoors

On a warm autumn afternoon a full battery is tempting, but the house does not need heat. With an **outdoor temperature** (a weather entity or a sensor), no unit starts in heating mode while it is at or above **Do not heat if outdoors is above** (20 °C); units still start in cooling mode for rooms above 24 °C. The bed-level setpoint stops compensating too.

### Hands off while somebody is home

While you are still testing, somebody at home may prefer that the heating is left alone. List that person (or any boolean) in **Hands off while**: while they are home the surplus automation does nothing at all, it neither switches units on nor off. The routines everybody relies on (bedtime, schedules) keep working.

### Bed-level setpoint

Wall units measure the air near the ceiling. Under a high or sloped ceiling, and above all under a concrete roof, that air is 1 to 3 °C warmer than at bed height, so the unit stops while the bed is still cold. The **Bed-level setpoint** blueprint raises the unit's setpoint by the difference between its own sensor and a sensor at bed height (a smart radiator valve or a small thermometer), up to 24 °C, only for units started by the surplus automation in heating mode. A room can take its target from a sensor: give **Bedtime · Pre-heating target** for the bedroom of the bedtime package, so the sun pre-heats it exactly as much as it needs.

## The rest of the day

A typical winter day with these automations:

| Time | What runs | Source |
| --- | --- | --- |
| 04:30 – 07:15 | **Morning pre-heat** starts the kitchen radiator just early enough to have it at 20 °C at 07:15, and hands it back at 08:00. | Radiator |
| Midday – end of useful sun | **Solar surplus** warms the house with free energy; the bedroom aims at its pre-heating target. | Heat pumps, solar |
| 16:00 – 20:00 (weekdays) | **Heat pumps on a schedule** keep the living room and the children's room at 19 °C when the family is back, taking over each unit when the surplus releases it. | Heat pumps, grid |
| End of useful sun – bedtime | **Bedtime warm-up** predicts the bedroom temperature at bedtime and switches its heat pump on only if it will fall short, just in time. | Heat pump |
| Night | **Radiators on a schedule** keep the bedrooms at their night temperatures. | Radiators |
| Away | **Away mode** switches the heat pumps off, puts the radiators at 5 °C and every other automation stands aside. | — |

Each automation marks the units it switched on with its own marker boolean and only ever switches off what it switched on, so they can share units without fighting. Switch off the radiators' and thermostats' own schedules (leave them in their "auto"/schedule mode with everything off) so that Home Assistant decides when each heat source runs.

### Heat pumps on a schedule

Create a **Schedule** helper (Settings, Devices and services, Helpers), an input_number with the temperature and one marker boolean per heat pump. The blueprint only switches on a unit that is off. List the surplus markers in **Markers of other automations**: when the surplus releases a unit during the schedule, this automation takes it over a minute later. If somebody switches a unit off by hand it is forgotten until the next start of the schedule.

### Radiators on a schedule

One automation per radiator: a schedule, an input_number, a marker. At the end it hands the radiator back to its own schedule ("auto") or switches it off. Schedules that end at 23:59 and start again at 00:00 are ignored (it waits 2 minutes before acting on the end).

### Bedtime warm-up

Young children go to bed early, often before the radiators would warm their room, and a heat pump is cheaper than the gas boiler. The package keeps a simple model of the room:

- **Cooling forecast** (°C/h) = learned internal cooling + losses to outdoors × (room − outdoor forecast). The outdoor forecast is the average of the hourly weather forecast between the end of the useful sun and bedtime.
- **Predicted temperature at bedtime** = now − cooling forecast × hours to bedtime.
- If the prediction falls short, the heat pump is switched on when the remaining time is about the deficit divided by its **heating rate**, plus 15 minutes.
- Every evening without heating, it measures how much the room really cooled and updates the internal cooling (70 % old, 30 % measured).

If somebody switches the unit off by hand while the routine has it, it is not switched on again that night. **Bedtime · Pre-heating target** tells the surplus (through the bed-level setpoint) how warm to leave the room so it arrives at bedtime at the right temperature without spending battery.

### Morning pre-heat

From 04:30 it checks every 5 minutes whether the room would arrive at the temperature in time with the heating rate it has learned, and starts the radiator only then. When the room arrives (or at the ready time) it measures the real rate and updates it.

### Away mode

The switch goes on when everybody listed has been away for 10 minutes and off when anybody comes back. You can also flip it from an NFC tag at the door or a phone shortcut. Give its input_boolean as **Away mode** in the other blueprints and in the packages.

Some radiator integrations ignore "off" and go back to their own schedule after a while; a manual low setpoint (5 °C) is a reliable way to keep them quiet. If your integration needs a special service to set a manual overlay, edit those two actions.

## Install

You need: a battery level sensor (%), a grid power sensor (W), the Forecast.Solar integration (or another forecast that gives "energy still to come today" in kWh), heat pumps as `climate.*` entities and, for the outdoor temperature and the bedtime package, a weather entity with an hourly forecast.

1. **Packages.** In `/config/configuration.yaml` add (once):

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```
2. **Main package.** Copy `homeassistant/packages/home_digital_twin.yaml` to `/config/packages/home_digital_twin.yaml`. Search for `EDIT` and replace:
   - `sensor.energy_production_today_remaining` (twice) with your forecast sensor, if different;
   - `sensor.battery_state_of_charge` (twice) with your battery level sensor;
   - the 24 values of the hourly consumption profile.
   If you have more than three heat pumps, copy a marker boolean and give it a new name.
3. **Starting values.** In the same file set `initial` of **Battery kWh per percent** to your usable battery capacity / 100 (5 kWh → 0.05). Values with `initial` are reset to it at every restart, so change them in the file, not only in the interface. Learned values in the other packages have no `initial` and survive restarts.
4. **Optional packages.** Copy `bedtime_warmup.yaml` and `morning_preheat.yaml` if you want them and replace every `EDIT` (each file lists them at the top).
5. **Check and restart.** Developer tools, YAML, **Check configuration**, then restart.
6. **Blueprints.** Copy the folder `homeassistant/blueprints/automation/home_digital_twin/` to `/config/blueprints/automation/home_digital_twin/` and reload automations (or import each file from its GitHub URL with Settings, Automations, Blueprints, **Import blueprint**).
7. **Create the automations** (Settings, Automations, Blueprints, pick one, **Create automation**):
   - **Away mode for heating**: your away input_boolean, the people, the heat pumps and the radiators.
   - **Heat with solar surplus**: your heat pumps **in priority order**, the marker booleans **in the same order**, room sensors if you have them, the battery level sensor, the grid power sensor and whether export is positive or negative, the weather entity and the away input_boolean.
   - **Clear surplus markers**: the same two lists.
   - **Bed-level setpoint** (optional): the same two lists and one bed-level sensor per heat pump; target sensors if you use the bedtime package.
   - **Heat pumps on a schedule** (optional) and one **Radiator on a schedule** per radiator (optional).
8. Switch on **Surplus · Heat with solar surplus** and **Bedtime · Enable**.

## Watch it work

Add the helpers and sensors to a dashboard card: battery level, dynamic floor, margin, useful sun, grid power and the markers; for the bedtime package, the predicted temperature at bedtime, the pre-heating target and the learned cooling. On the first sunny afternoon, follow the automation traces (Settings, Automations, the automation, Traces): each run shows which branch it took and why.

## Tuning

| Helper | Start | Adjust when |
| --- | --- | --- |
| Forecast correction factor | 0.65 | After a week or two, divide the real production of each afternoon by what the forecast said at 14:00, and use the average. If the battery ends the day below full, lower it. |
| Hourly consumption profile and scale | your data, 1.0 | If the battery is not full at the end of the useful sun, raise the scale. |
| Useful sun ends before sunset | 80 min | Look at the time your production drops below the house consumption on a clear day. |
| Lowest battery level | 30 % | What you want left for the evening if everything goes wrong. |
| Do not heat if outdoors is above | 20 °C | Lower it if the house gets too warm on mild afternoons. |
| Setpoint (blueprint) | 22 °C | Warmer stores more heat but loses more through the walls. 21 to 23 °C is a good range. |
| Bedtime · Heating rate | 1.5 °C/h | Watch one evening: degrees gained at bed height per hour with the unit on. |
| Bedtime · Losses to outdoors | 0.03 | Raise it if the room is colder than predicted on cold nights and right on mild ones. |

## Why some units start in cooling mode

From late spring to early autumn the same logic cools rooms that are above 24 °C with free solar energy. Change **Cool instead of heat above** in the blueprint to move or effectively disable that (set it to 32 °C).

## What it does not do

- The surplus automation does not touch your radiators or boiler: they simply have less work when the house is already warm.
- It does not buy energy from the grid on purpose. Small imports can happen when a cloud passes; the margin and the steps limit them. The scheduled heat pumps and the bedtime warm-up do use the grid when needed: that is their job.
- It does not know your comfort: if nobody is home, decide with an A/B test whether pre-heating is worth it ([ab-test.md](ab-test.md)).
