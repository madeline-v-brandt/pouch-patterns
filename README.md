# The Pouch Project

Zipper pouch patterns, any size you like.

Pick a pouch shape, set the size with sliders and choose a zipper. The site works out every piece to cut (drawn to scale), the fabric and notions to buy, and step-by-step sewing instructions with your measurements filled in.

**Shapes:** flat zip pouch, boxed makeup bag, boxy pouch, zip-top tote.

## Running it

It's a static site with no build step. Open `index.html` in a browser, or serve the folder with any static server.

## Files

- `pouches.js`: pouch types, pattern math, cut lists, supplies and sewing steps. All measurements are in inches. To add a new shape, start here.
- `draw.js`: the SVG drawings: pouch preview, to-scale pattern pieces and step diagrams.
- `app.js`: page state, controls and rendering. Progress checkmarks are saved in the browser's localStorage.
- `styles.css` and `index.html`: layout, palette and the fabric prints.
