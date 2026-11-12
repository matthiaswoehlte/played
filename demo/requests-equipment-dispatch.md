# Demo – Requests for the Equipment Dispatch (video)

This file holds the requests typed into Play in the application video, word for word. They were entered one after another into the English copy "Ground Handling (EN)".
Preparation: a fresh copy of "Ground Handling (EN)" → "Clear area" on Equipment Dispatch → "Start prototype".

## Request 1 – Equipment Dispatch

```
Build the Equipment Dispatch for two consecutive sample days, 11/11/2026 and 11/12/2026, each from 05:00 to 23:00, as a Gantt chart. The rows are the equipment units, grouped by equipment type: Ground power units (GPU-01 to GPU-08), Passenger stairs (STR-01 to STR-08), Belt loaders (BLT-01 to BLT-08), Container loaders (CL-01 to CL-04), Baggage tractors with carts (BTR-01 to BTR-08), Catering trucks (CAT-01 to CAT-04), Fuel trucks (FUEL-01 to FUEL-04) and Potable water trucks (PW-01 to PW-04). Each bar is an equipment task and shows its flight number. Each equipment type has its own colour: its bars and its group heading are shown in that colour. A unit can be blocked for maintenance, shown as a grey bar. A vertical line shows the current time.
The chart does not fit on one screen: it scrolls horizontally along the time axis and vertically through the equipment rows. The equipment names and group headings on the left stay visible while I scroll in time, and the time header stays visible while I scroll through the rows. At the top left of the time header, the date of the day I am looking at is shown in orange, like "Date: 11/11/2026", in US format (month/day/year); when I scroll into the second day, it changes accordingly.
The dark area around and behind the chart is not flat black: give it a very subtle gradient towards anthracite and a slight glass-like sheen, so the surface has a little depth — kept so restrained that the coloured bars and group headings clearly stand out in front.
To the right of the Gantt there is a conflict list with the number of conflicts on top. Each conflict can be expanded and collapsed. A conflict is when two tasks overlap on the same unit, or when a task lies in a unit's maintenance time. Bars that overlap on the same unit are not marked in any special way and are not made smaller: they are simply drawn on top of each other at full height, and the overlap is only visible as a conflict in the conflict list.
Below the conflict list there is the list of unassigned equipment tasks with their number, each with flight, activity, time and equipment type, for example "XB 214 Catering 06:28–06:43 · Catering truck".
Fill the two days with about 300 equipment tasks for roughly 80 flights. Flight numbers use the prefixes XA, XB and XC with three digits; among them are XA 101, XB 214, XA 337, XC 508, XB 622, XA 745, XC 810 and XB 933 on the first day. Spread the tasks irregularly, like on a real airport day: busy clusters around peak hours and quiet stretches in between, task durations varying from about 10 minutes to well over an hour, some units working almost back-to-back while others have only a few tasks, and start times not aligned to full or half hours. Avoid any regular pattern — no evenly spaced bars, no repeating rhythm from row to row, no diagonal staircases. The two days contain five or six conflicts. At the start, these three tasks are unassigned on the first day: XB 214 Catering 06:28–06:43, XA 337 Fuelling 06:50–07:10 and XA 337 Potable water 07:07–07:17, plus a few more unassigned tasks spread over both days.
```

## Request 2 – Into the list and back

```
I can drag a bar from the Gantt into the list of unassigned equipment tasks with the mouse, and it is unassigned. I can also drag a task from that list back onto a unit in the Gantt; it keeps its time and is assigned to the unit where I drop it. While I am dragging, holding the task near an edge of the chart scrolls it in that direction, horizontally and vertically, so I can reach units and times that are out of view. If I drop it on a unit of the wrong equipment type, this is allowed and shown as a conflict.
```

## Request 3 – Resize and move in time

```
I can grab a bar at its left or right edge with the mouse and drag it to change its start or end. If I grab it in the middle, I can move the whole bar along the time axis; it stays on its unit. If I release it over the list of unassigned equipment tasks instead, it goes into the list as before.
```

## Request 4 – Reassign to another unit

```
I can drag a bar from one unit to another unit with the mouse; it keeps its time and is reassigned to the new unit. If the new unit is of the wrong equipment type or already busy at that time, this is allowed and shown as a conflict. Do not add a new list; the existing conflict list already shows these conflicts.
```

## Request 5 – Red outline for conflicts

```
Equipment tasks that are in a conflict have a red outline in the Gantt, so I can see the conflict directly on the bars.
```

## Request 6 – Overlapping bars half offset

```
When two equipment tasks overlap on the same unit, their bars overlap each other by half their height instead of standing fully one below the other. This way it is clear that both are on the same unit.
```

## Request 7 – Click a conflict, the bars blink

```
When I click a conflict in the conflict list, it expands or collapses as before, and the equipment tasks involved are highlighted in the Gantt with a bright glow that blinks for 2.5 seconds and then stops completely. If the tasks involved are outside the visible part of the chart, the chart scrolls there automatically, horizontally and vertically, so they are in view before the glow starts — also when the conflict lies on the other day. The glow does not move or resize the bars.
```
