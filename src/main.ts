import './style.css';
import { GameApp } from './game.ts';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found.');
}

app.innerHTML = `
  <div class="app-shell">
    <canvas class="viewport" aria-label="4D voxel world renderer"></canvas>
    <div class="crosshair" aria-hidden="true"></div>
    <div class="vignette" aria-hidden="true"></div>
    <div class="hud">
      <section class="hud-panel hud-panel--title">
        <p class="eyebrow">Blue-Space Fragment</p>
        <h1>The Ship Is Open</h1>
        <p class="copy">
          Every wall still exists — but nothing encloses anymore.
          Drift along <code>w</code> and watch sealed rooms unfold,
          bodies reveal their interior, objects phase through the slice.
        </p>
      </section>
      <section class="hud-grid">
        <div class="hud-panel hud-panel--minimal">
          <div id="status"></div>
        </div>
        <div class="hud-panel hud-panel--minimal">
          <div id="entities"></div>
        </div>
      </section>
      <section class="hud-panel hud-panel--controls">
        <div class="hud-headline">
          <button id="pointerLockButton" type="button">Enter the Fragment</button>
        </div>
        <div id="controls"></div>
      </section>
    </div>
  </div>
`;

const canvas = app.querySelector<HTMLCanvasElement>('.viewport');
const status = app.querySelector<HTMLDivElement>('#status');
const entities = app.querySelector<HTMLDivElement>('#entities');
const controls = app.querySelector<HTMLDivElement>('#controls');
const pointerLockButton = app.querySelector<HTMLButtonElement>('#pointerLockButton');

if (!canvas || !status || !entities || !controls || !pointerLockButton) {
  throw new Error('Failed to create application shell.');
}

const game = new GameApp({
  canvas,
  statusElement: status,
  entityElement: entities,
  controlsElement: controls,
  pointerLockButton,
});

game.start();
