import { expect, type Page, test } from '@playwright/test';

const SHOTS = 'docs/screenshots';

type StudioMap = {
  loaded: () => boolean;
  areTilesLoaded: () => boolean;
  project: (p: [number, number]) => { x: number; y: number };
  getZoom: () => number;
};

async function open(page: Page, query = '') {
  await page.goto(`/?e2e=1${query}`);
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/?e2e=1${query}`);
  await expect(page.getByText('GeoJSON Studio', { exact: true })).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { __studioMap?: StudioMap }).__studioMap?.loaded());
}

/** Wait until the map has stopped moving and drawn its tiles. */
async function settle(page: Page) {
  await page.waitForTimeout(900);
  await page.waitForFunction(() => {
    const m = (window as unknown as { __studioMap?: StudioMap }).__studioMap;
    return m?.loaded() && m.areTilesLoaded();
  });
}

async function pixelOf(page: Page, lngLat: [number, number]) {
  const p = await page.evaluate(ll => (window as unknown as { __studioMap: StudioMap }).__studioMap.project(ll), lngLat);
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('map canvas not found');
  return { x: box.x + p.x, y: box.y + p.y };
}

async function loadSample(page: Page, name: string) {
  await page.getByRole('tab', { name: 'Data' }).click();
  await page.getByRole('button', { name: `Load sample: ${name}` }).click();
  await expect(page.getByRole('tab', { name: 'Editor' })).toHaveAttribute('aria-selected', 'true');
}

test('empty state renders the QBDS shell and the map', async ({ page }) => {
  await open(page);
  await expect(page.getByText('No data')).toBeVisible();
  await expect(page.getByText('Drop GeoJSON files here, paste into the editor, or')).toBeVisible();
  await expect(page.locator('.maplibregl-canvas')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/01-empty-dark.png` });
});

test('sample loads, fits, and a clicked feature opens the inspector', async ({ page }) => {
  await open(page);
  await loadSample(page, 'World capitals');
  await expect(page.getByText('39 of 39 features drawn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Points: 39' })).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('"FeatureCollection"');
  await settle(page);

  const london = await pixelOf(page, [-0.1276, 51.5072]);
  await page.mouse.click(london.x, london.y);
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('London');
  await expect(inspector).toContainText('United Kingdom');

  // Property click highlights every feature sharing the value.
  await inspector.getByRole('row', { name: /continent is Europe/ }).click();
  await expect(page.getByText('Highlighting 12 of 39 features with continent = Europe')).toBeVisible();
  await expect(inspector).toContainText('12 matching continent = Europe');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/02-capitals-inspector.png` });

  // Escape clears the selection.
  await page.locator('.maplibregl-canvas').focus();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
});

test('editor cursor highlights the feature on the map', async ({ page }) => {
  await open(page);
  await loadSample(page, 'World capitals');
  await settle(page);
  // CodeMirror only renders lines in its viewport, so use a feature near the top of the document.
  await page.locator('.cm-line', { hasText: '"Paris"' }).click();
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toContainText('Paris');
  await expect(inspector).toContainText('France');
  await expect(inspector).toContainText('Point');
});

test('validation problems are listed and syntax errors are located', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Validation check');
  await expect(page.getByText('3 features could not be drawn')).toBeVisible();
  await expect(page.getByRole('button', { name: /Feature 2: Polygon ring is not closed/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Feature 3: Latitude -122.4194/ })).toBeVisible();
  await expect(page.getByText('3 invalid', { exact: true })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/03-validation.png` });

  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('{"type": "Feature", "geometry": ');
  await expect(page.getByText('JSON error, line 1')).toBeVisible();
});

test('choropleth colours the hex grid and shows a legend', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Scored hex grid');
  await page.getByRole('tab', { name: 'Tools' }).click();
  await page.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'score' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('img', { name: /Colour scale for score/ })).toBeVisible();
  await expect(page.getByText(/Coloured 196 features by score/)).toBeVisible();

  await page.getByRole('combobox').nth(0).click();
  await page.getByRole('option', { name: 'band' }).click();
  await page.getByRole('button', { name: 'Show' }).click();
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/04-choropleth-labels.png` });
});

test('measure tool reports a distance and can add the line to the data', async ({ page }) => {
  await open(page, '&map=1,50,5');
  await page.getByRole('tab', { name: 'Tools' }).click();
  await page.getByRole('button', { name: 'Measure' }).click();
  await expect(page.getByText('Click to add points, double-click to finish')).toBeVisible();
  await settle(page);
  const a = await pixelOf(page, [-0.1276, 51.5072]);
  const b = await pixelOf(page, [2.3522, 48.8566]);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await page.mouse.dblclick(b.x, b.y);
  await expect(page.getByText('Total distance')).toBeVisible();
  const total = await page.locator('dd').first().innerText();
  expect(total).toMatch(/^3\d\d\.\d+ km$/);
  await page.screenshot({ path: `${SHOTS}/05-measure.png` });
  await page.getByRole('button', { name: 'Add to data' }).click();
  await expect(page.getByText('1 of 1 features drawn')).toBeVisible();
});

test('files load through the picker and merge', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: 'Data' }).click();
  const fc = (n: number) =>
    JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: n }, (_, i) => ({ type: 'Feature', properties: { i }, geometry: { type: 'Point', coordinates: [i, i] } })) });
  await page.getByTestId('file-input').setInputFiles([
    { name: 'a.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(fc(2)) },
    { name: 'b.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(fc(3)) },
  ]);
  await expect(page.getByText('5 features loaded')).toBeVisible();
  await expect(page.getByText('5 of 5 features drawn')).toBeVisible();
});

test('deep link ?url= loads remote GeoJSON', async ({ page }) => {
  await page.route('https://data.example.test/**', route =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/geo+json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ type: 'Feature', properties: { name: 'Remote' }, geometry: { type: 'Point', coordinates: [13.4, 52.52] } }),
    }),
  );
  await open(page, `&url=${encodeURIComponent('https://data.example.test/one.geojson')}`);
  await expect(page.getByText('1 of 1 features drawn')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('Remote');
});

test('tile grid shows tile ids and tile info', async ({ page }) => {
  await open(page, '&map=-0.1,51.5,9');
  await page.getByRole('button', { name: 'Tile grid' }).click();
  await settle(page);
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const inspector = page.getByRole('region', { name: 'Inspector' });
  await expect(inspector).toContainText('Tile 9/');
  await expect(inspector).toContainText('Quadkey');
  await page.screenshot({ path: `${SHOTS}/06-tile-grid.png` });
});

test('every geometry type renders, including simplestyle colours', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Every geometry type');
  await expect(page.getByText('7 of 7 features drawn')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Points: 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lines: 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Polygons: 2' })).toBeVisible();
  await settle(page);
  const lineWidth = await page.evaluate(() => {
    const m = (window as unknown as { __studioMap: { queryRenderedFeatures: (o: object) => unknown[] } }).__studioMap;
    return m.queryRenderedFeatures({ layers: ['studio-line'] }).length;
  });
  expect(lineWidth).toBeGreaterThan(0);
  await page.screenshot({ path: `${SHOTS}/08-every-type.png` });

  // Hiding a family removes it from the map.
  await page.getByRole('button', { name: 'Lines: 3' }).click();
  await expect(page.getByRole('button', { name: 'Lines: 3' })).toHaveAttribute('aria-pressed', 'false');
});

test('light theme and map-only mode', async ({ page }) => {
  await open(page);
  await loadSample(page, 'Long-haul routes');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await settle(page);
  await page.screenshot({ path: `${SHOTS}/07-routes-light.png` });
  await page.getByRole('button', { name: 'Map only' }).click();
  await expect(page.getByRole('tab', { name: 'Editor' })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tab', { name: 'Editor' })).toBeVisible();
});
