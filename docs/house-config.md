# house.json reference

One file describes the whole house. The formal definition is [schema/house.schema.json](../schema/house.schema.json); editors such as VS Code validate and autocomplete the file when it keeps the `"$schema"` line at the top. Coordinates are explained in [photos-to-model.md](photos-to-model.md#the-coordinate-system).

Units: metres, degrees, kW, kWh, °C, hours (decimal, `19.5` = 19:30).

## Top level

| Field | Required | Meaning |
| --- | --- | --- |
| `name` | yes | Title shown in the viewer. |
| `description` | | Subtitle. |
| `location` | yes | See below. |
| `orientation` | yes | See below. |
| `footprint` | yes | `width` (x) and `depth` (z) of the house. |
| `roof` | yes | See below. |
| `stairs` | | Staircase drawing and the warm-air "chimney" path. |
| `rooms` | yes | Rooms with their thermal parameters. |
| `walls`, `windows` | | Drawing only. |
| `devices` | | Heat pumps and radiators. |
| `heating` | | Radiator schedule and heat-pump settings for the simulation. |
| `solarPanels` | | Panels on the roof and the solar estimate. |
| `climate` | | Outdoor temperature curve and starting room temperatures. |
| `furniture`, `exterior` | | Decoration. |
| `homeAssistant` | | Entities for the live mode. |

## location

| Field | Meaning |
| --- | --- |
| `lat`, `lon` | Decimal degrees. Two decimals (about 1 km) are plenty; you do not need your exact address. |
| `utcOffsetHours` | Standard (winter) time offset: 1 for Central Europe, 0 for the UK and Portugal, −5 for New York. |
| `daylightSaving` | `"eu"`, `"us"` or empty. |
| `dayOfYear` | Day simulated (1 to 366). Leave it out to simulate today. |

## orientation

| Field | Meaning |
| --- | --- |
| `backFacadeAzimuthDeg` | Compass direction the back facade looks at, clockwise from north: 0 north, 90 east, 180 south, 270 west. See [orientation.md](orientation.md). |
| `note` | Free text: how you found it. |

## roof

A gable roof with the ridge parallel to the facades.

| Field | Meaning |
| --- | --- |
| `ridgeZ`, `ridgeY` | Where the ridge is (from the front) and its height. |
| `eaveFrontY`, `eaveBackY` | Height of the lower edge of each slope. |
| `overhang` | How far the roof sticks out (drawing). |
| `material` | `"concrete"` or `"timber"` (drawing; the thermal effect of a heavy roof is set per room with `roofMass`). |
| `gableWindows` | Triangular windows in the gable ends. |

## stairs

| Field | Meaning |
| --- | --- |
| `frontLaneX`, `backLaneX` | x position of the flights that go towards the back and towards the front. In a straight staircase use the same value. |
| `laneWidth` | Width of each flight. |
| `z0`, `z1` | Where the flights start and end. |
| `steps` | Steps per flight. |

## rooms[]

| Field | Meaning |
| --- | --- |
| `id` | Short identifier, lowercase. Used by devices and furniture. |
| `name` | Label in the viewer. |
| `y` | Floor level. |
| `height` | Ceiling height (ignored when `underRoof` is true). |
| `underRoof` | The ceiling is the roof. |
| `x0`, `x1`, `z0`, `z1` | The room's rectangle. |
| `floor` | `"wood"` or `"tile"`. |
| `door` | `{ "x", "z", "swing": 1 or -1, "color" }`: hinge position of the door that opens to the stairs. Doors are what the viewer lets you open and close. |
| `thermal` | See below. |
| `temperatureEntity` | Home Assistant entity with the room temperature (a `climate.*` or a `sensor.*`). |

### rooms[].thermal

The [thermal model](thermal-model.md) explains and calibrates these.

| Field | Typical | Meaning |
| --- | --- | --- |
| `capacityKwhPerK` | 0.8 to 3 | Energy that warms the room's air, furniture and inner wall surfaces by 1 K. |
| `uaKwPerK` | 0.015 to 0.08 | Heat lost to outside per K of difference. Larger for big windows, outside walls and roofs. |
| `stratificationK` | 0 to 1 | How much warmer the air near the ceiling is than at bed height. High rooms and attics: 0.4 to 0.8. |
| `solarGainKw`, `solarFacade` | 0 to 1.5 | Sun through the windows of that facade at full sun. |
| `roofMass` | | A concrete roof stores heat: `capacityKwhPerK` 2 to 4, `couplingKwPerK` 0.1 to 0.3, `lossKwPerK` about 0.03. |

## devices[]

| Field | Meaning |
| --- | --- |
| `type` | `"ac"` (heat pump / air conditioner) or `"radiator"`. |
| `id` | Unique identifier. |
| `room` | Room id. |
| `pos` | `[x, y, z]`: heat pumps at the centre of the unit, radiators at the floor below their centre. |
| `facing` | Where it blows: `"+x"`, `"-x"`, `"+z"`, `"-z"`. |
| `powerKw` | Heat output at the typical operating point (not the electrical input): look for "heating capacity" on the label. |
| `fins` | Radiator drawing. |
| `sensorBiasK`, `runBiasK` | (heat pumps) How much warmer the unit's own sensor reads than the room at bed height, at rest and while blowing. Used when **Bed-level setpoint** is off. |
| `surplus` | (heat pumps) Started by the solar surplus automation in the simulation. |
| `entity` | Home Assistant `climate.*` entity. |
| `heatingPowerEntity` | (radiators) A sensor that is above 0 while the radiator heats, for example a smart valve's heating power. |

## heating

| Field | Meaning |
| --- | --- |
| `radiatorSchedule` | List of `{ from, to, setpoint }` hours for the radiators. |
| `acSetpoint` | Heat-pump setpoint in the simulation. |
| `acCop` | Coefficient of performance used to turn heat into electricity (3 to 4 for modern units in mild weather). |
| `surplusUntilHour` | Last hour the surplus automation keeps the heat pumps on in the simulation (when the sun stops refilling the battery). |

## solarPanels

| Field | Meaning |
| --- | --- |
| `roofSide` | `"front"` or `"back"` slope. |
| `rows`, `cols` | Panel layout (rows go up the slope). |
| `panelWidth`, `panelLength` | Panel size in metres (datasheet). |
| `panelWatt` | Peak power of one panel. |
| `azimuthDeg`, `tiltDeg` | Where the panels look and their tilt. |
| `lossesPct` | Cables, inverter, dirt; 14 is the usual default. |
| `inverterKw`, `batteryKwh` | Shown in the viewer; the inverter limits the estimate. |
| `climate` | Preset: `"sunny-south"`, `"mediterranean-north"`, `"central"`, `"north"`. |
| `pvgisMonthlyKwhPerKwp` | 12 monthly values from PVGIS (see `tools/pvgis_sizing.py`); replaces the preset. |

## climate

| Field | Meaning |
| --- | --- |
| `outdoorMaxC` | Daily maximum for the simulation (also a slider in the viewer). |
| `outdoorSwingK` | Difference between the maximum and the night minimum. |
| `start` | Room temperatures at 15:30, by room id. |

## furniture[]

Simple shapes: `box` (`w`, `h`, `d`, optional `lift` for a desk on legs), `bed` (`w`, `d`, `color` of the duvet), `rug` (`pattern`: `check` or `stars`, or a `color`), `plant` (`scale`). `x`, `y`, `z` is the corner nearest to the origin (the centre for plants).

## exterior

| Field | Meaning |
| --- | --- |
| `margin` | Garden around the house: `sides`, `front`, `back`. |
| `gardenLevelY` | Height of the back garden if it is higher than the street. |
| `frontPatio`, `backPorch` | Optional decoration: `depth`, and flags such as `brickWall`, `pergola`, `table`, `sofa`, `shed`, `flowerBed`, `cat`. |
| `hedges`, `compass` | Booleans. Keep the compass: it shows the orientation. |
| `trees` | `{ x, z, y, scale }`. |

## homeAssistant

Entities for the live mode: `outdoorTemperatureEntity` (a `weather.*` or a sensor), `batterySocEntity`, `gridPowerEntity`, `solarPowerEntity` (W or kW), and `pollSeconds`.
