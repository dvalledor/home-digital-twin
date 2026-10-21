# A/B test: is pre-heating worth it?

The twin predicts that warming the house with solar surplus in the afternoon leaves it 1 to 2 °C warmer in the evening and saves radiator heat overnight. Whether that holds in your house, with your weather and habits, is something you can measure in two weeks.

## Design

- **Question**: when nobody is home in the afternoon, does running the heat pumps on solar surplus make the house warmer when you come back and reduce the radiators' work overnight, without importing energy?
- **Test days**: **Surplus · Allow while away** is on: the heat pumps may run while you are away.
- **Control days**: it is off: they do not run while away (they still may when you are home).
- **Alternation**: the automation **Surplus · A/B test: alternate days** toggles the switch at 07:00 every day. Alternating days balances the weather better than one week of each.
- **Duration**: at least 14 days, so you get about 7 of each. More if the weather changes a lot.

Enable the alternation automation the evening before the first day and set **Allow while away** so that the first day is the type you want. Disable it at the end.

## What to record each day

Use a table like this one (a spreadsheet works fine). Most values come from Home Assistant's history graphs and the Energy dashboard.

| Column | How |
| --- | --- |
| Date, type (test or control) | |
| Valid? | A day is valid if the battery was full by mid-afternoon and the house was empty for at least 2 hours of the surplus window. Discard the others (they do not answer the question). |
| Time away, time back | Your away mode or your phone's presence. |
| Minutes each heat pump ran | From the marker booleans' history. |
| Temperature when back, per room | At bed height. |
| Temperature at 07:00 next morning | |
| Stratification in the attic | Heat pump sensor minus bed sensor at the time you come back. |
| Energy exported | Energy dashboard, for the day. |
| Battery at sunset | |
| Radiator heat overnight | Boiler gas, a smart valve's heating time × power, or electric radiators' kWh. |
| Outdoor max and min | Weather. |
| Solar production | |

## Analysis

1. Keep only valid days.
2. For each metric, average test days and control days and compute the difference.
3. Normalise for weather: overnight radiator heat depends on the outdoor temperature. Divide it by the degree-hours of the night (Σ max(0, 20 − outdoor) over the night's hours), or plot it against the mean outdoor temperature and compare the two lines.
4. Check the costs: on test days the battery should still be full at sunset and the extra import close to zero. If not, lower the forecast correction factor before drawing conclusions.
5. Decide. A typical rule: keep **Allow while away** on if test days are at least 1 °C warmer when you come back or save at least 15 % of overnight radiator heat, with no measurable extra import.

With 6 to 8 valid days of each type, a difference of 1 °C stands out clearly; a difference of 0.3 °C is within day-to-day noise.

## Compare with the twin

Put the test-day averages next to the twin's prediction for the same outdoor temperature and doors. If they differ, calibrate ([thermal-model.md](thermal-model.md#calibrate-with-your-own-data)): the test days are excellent calibration data.
