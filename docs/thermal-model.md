# Thermal model

The twin predicts room temperatures with a small **zone model**: each room is one node with a temperature, and heat flows between nodes and to the outside. It runs in the browser in a few milliseconds, which is what lets you move a slider and see the result at once.

## Equations

For every room *i*, every simulated minute:

    C_i · dT_i/dt = − UA_i · (T_i − T_out)                     heat lost to outside
                    + Σ stack flows through open doors and stairs
                    + Σ slab coupling with the room above
                    + roof mass exchange (rooms under a heavy roof)
                    + solar gain through windows
                    + heat pumps + radiators

| Term | How it is computed |
| --- | --- |
| Outside temperature | Smooth daily curve between `outdoorMaxC` (at 16:00) and `outdoorMaxC − outdoorSwingK` (at 07:00). |
| Stack flow | Rooms are sorted by floor height and each is connected to the next one up (and, at half strength, to the one after). Warm air rises: the flow is `G · max(T_lower − T_upper, 0) + 0.01 · (T_lower − T_upper)` with G = 0.25 kW/K when both doors are open, 0.05 with one, 0.012 with none. |
| Slab coupling | 0.02 kW/K between a room and the room directly above it. |
| Roof mass | A node of capacity `roofMass.capacityKwhPerK`, coupled to the room with `couplingKwPerK` and to outside with `lossKwPerK`. Concrete roofs absorb heat in the afternoon and give it back at night. |
| Solar gain | `solarGainKw` × sun on that facade (from the real sun position). |
| Heat pumps | Thermostatic with hysteresis around `acSetpoint`, modulating between 25 and 100 % of `powerKw`. The control temperature is the unit's own sensor (room + `sensorBiasK`, + `runBiasK` while blowing) or the bed-level temperature when **Bed-level setpoint** is on. Electricity = heat / `acCop`. |
| Radiators | Thermostatic on `radiatorSchedule`, measured at bed height, between 30 and 100 % of `powerKw`. Their energy is shown as "radiator heat" (gas, or electricity for electric radiators). |
| Stratification | The table shows temperatures at bed height = node temperature − `stratificationK`. |

The air drawn as dots is not simulated particle by particle: it follows paths built from the rooms, the stairs and the devices, with a speed and a density that follow the model (heat pumps on, doors open, temperature difference).

## Starting values

| Parameter | Rule of thumb |
| --- | --- |
| `capacityKwhPerK` | 0.06 × floor area (m²) for brick or concrete houses, 0.04 for timber frame. A 25 m² room: about 1.5. |
| `uaKwPerK` | Sum of U × A of the room's outside surfaces, in kW/K. Insulated wall U ≈ 0.4, old brick 1.5, double glazing 2.8, insulated roof 0.3 W/m²K. A room with 12 m² of wall and 3 m² of window: (12 × 0.6 + 3 × 2.8) / 1000 ≈ 0.016, plus air leaks: add 30 to 50 %. |
| `stratificationK` | 0 for normal rooms, 0.3 to 0.8 under sloped or high ceilings. |
| `roofMass` | Concrete roof slab of a 30 m² room: capacity 2.5 to 3.5, coupling 0.15 to 0.3, loss 0.03. |

## Calibrate with your own data

Calibrating means adjusting the parameters until the model reproduces what Home Assistant recorded. Do it in this order.

### 1. Heat loss and capacity: a cool-down night

1. Pick a night with no heating at all (or turn it off from 23:00 to 06:00), doors as usual.
2. From the history in Home Assistant note, for each room, the temperature at 23:00 and at 06:00 and the average outdoor temperature.
3. With no heating, a room cools exponentially towards outside with the **time constant** τ = C / UA (hours):

       τ = hours / ln( (T_start − T_out) / (T_end − T_out) )

   Example: from 21.0 to 19.6 °C in 7 h with 8 °C outside: τ = 7 / ln(13 / 11.6) ≈ 61 h.
4. Keep `capacityKwhPerK` from the rule of thumb and set `uaKwPerK = capacityKwhPerK / τ`. Rooms that cool faster than their neighbours have more outside surface, more windows or leaks.

The example house cools about 0.1 °C per hour overnight, a sign of a heavy, reasonably insulated house.

### 2. Heater power: a warm-up

1. Switch on one heat pump at a known setpoint with its door closed and note how long the room takes to rise by 2 °C.
2. Heat needed ≈ `capacityKwhPerK` × 2 + losses during that time. If the model warms the room much faster than reality, lower `powerKw` (the label's nominal capacity is often higher than real output at low fan speed) or raise the capacity.

### 3. Stratification and sensor bias

Compare the heat pump's own temperature (its `current_temperature` attribute) with a thermometer or smart valve at bed height while the unit runs and while it is off. The difference at rest is `sensorBiasK`; the extra while blowing is `runBiasK`. In attics and high rooms the difference is the reason the **Bed-level setpoint** blueprint exists.

### 4. Doors and the staircase

On a day with heat pumps on one floor only, compare how fast the floor above warms with doors open and with doors closed. If the model moves heat upstairs faster than reality, lower the stack conductance in `viewer/index.html` (`STACK` and the 0.25 / 0.05 / 0.012 values).

### 5. Check

Set `climate.start` to the temperatures at 15:30 of a real day, `outdoorMaxC` to that day's maximum and the doors as they were, then compare the predicted curve with the recorded one. Within half a degree over the night is a good model; within one degree is useful.
