# 3D Circular Saw Offset Ruler Gauge

Parametric 3D-printable alignment bracket designed to clamp onto a yardstick ruler, enabling repeatable and dead-accurate straightedge cuts with circular saws without continuous measuring or pencil offset lines.

## Live Customizer

Customize and export STL / 3MF directly in your browser:
👉 **[https://ken2072.github.io/ruler-offset-gauge/](https://ken2072.github.io/ruler-offset-gauge/)**

---

## Required Hardware

* **1/4" Hex Nut:** Slips into the internal nut pocket.
* **1/4" Thumb Screw / Wing Bolt:** Threads into the nut to lock the gauge securely onto your ruler at the desired offset.
* **Steel Ruler:** Standard workshop straightedge ruler (e.g., 1.43" width).

---

## Printing & Calibration Workflow

1. **Test-Fit with Slicer Pause:** 
   Add a pause command at layer height ~10 mm in your slicer. When paused, slide your yardstick into the slot to verify clearance before finishing the print.
2. **Clearance Rule:**
   Always measure your ruler with calipers and add at least `0.012"` clearance to both `Ruler H` and `Ruler W`. Sand end of yardstick to split zero mark.
3. **Cut Two 5" Test Boards:**
   Use awl slot to slide gauge for precise alignment. Lock the gauge to your ruler, align your straightedge or speed square clamp, and make two test cuts. 
4. **Measure with Digital Calipers:**
   Check the cut length with calipers. If the test piece is slightly off (e.g., 4.99" vs 5.00"), refine the `Offset` value in the script by that delta and reprint for dialed-in precision.

---

## Local / Offline Usage (No GitHub Pages Required)

1. Download [`gauge_standalone.js`](gauge_standalone.js) from this repository.
2. Open [https://jscad.app](https://jscad.app) in any modern web browser.
3. Drag and drop `gauge_standalone.js` directly onto the viewport.
4. Modify your parameters in the input panel and click **Export (STL / 3MF)**.