# Orientation

The twin needs one number: `orientation.backFacadeAzimuthDeg`, the compass direction the **back** facade looks at, in degrees clockwise from north (0 north, 90 east, 180 south, 270 west). It moves the sun, the shadows, the solar gains through the windows and the big compass painted on the ground.

## The easy way: your solar panels

If you have solar panels, someone already measured the orientation for you.

1. Find the panels' **azimuth** and **tilt**. They are in the installer's documents, the PVGIS or design report of the installation, the inverter app, or the Forecast.Solar settings in Home Assistant.
2. Watch the convention. Many tools use 180 = south (as this project does). PVGIS and some inverter apps use **0 = south**, −90 = east, +90 = west: add 180 to convert. Forecast.Solar in Home Assistant uses 180 = south.
3. Decide which roof slope holds the panels. Panels usually lie flat on the roof, so their **tilt equals the roof pitch** of that slope. If the two slopes have different pitches, the one that matches the tilt is the one with the panels. In the example house the panel tilt (20°) matches the garden-side slope (about 18°) and not the street side (about 30°).
4. If the panels are on the back slope, `backFacadeAzimuthDeg` is the panel azimuth. If they are on the front slope, it is the panel azimuth + 180 (minus 360 if above 360).

`tools/validate_house.py` warns when the tilt does not match the slope you chose or the azimuth does not match the facade.

## Without solar panels

- **Online map**: find your house on a satellite map, draw a line perpendicular to the back facade, pointing outwards, and read its bearing (most map tools measure distances and bearings; a protractor on a screenshot also works, north is up).
- **Phone compass**: stand with your back flat against the back wall, facing out, and read the compass. Stay away from cars and steel beams, and calibrate the compass first. Expect ±5°.
- **Shadows**: at solar noon (for your longitude, not 12:00 on the clock) shadows point exactly north in the northern hemisphere.

## Check it

Open the twin, choose **Top** and compare the painted compass with a satellite map. Then set a clock time when you know where the sun is (for example, which room gets the morning sun) and see if the shadows agree.

## The maths, if you are curious

With azimuth A of the back facade, the viewer's ground axes are x along the facade and z towards the back. North on the ground is the vector

    N = (−sin(A − 180°), −cos(A − 180°))   in (x, z)

and east is N rotated 90° clockwise seen from above, E = (−N_z, N_x). The sun's azimuth and elevation come from the date, the clock time, the longitude and the latitude (`viewer/solar.js`, `sunPosition`).
