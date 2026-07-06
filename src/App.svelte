<script lang="ts">
  import { onMount } from 'svelte'
  import {
    ui, start, stop, onPointerMove, onPointerLeave, onCanvasClick,
    selectType, selectedTower, upgradeSelected, sellSelected, setTargetSelected,
    startRound, setSpeed, togglePause, restart, towerOrder, deselect,
  } from './game.svelte.ts'
  import Settings from './Settings.svelte'
  import type { TargetPolicy } from '../shared/sim/types.ts'

  let canvas: HTMLCanvasElement

  onMount(() => {
    start(canvas)
    return () => stop()
  })

  const towers = towerOrder()
  const policies: { id: TargetPolicy; label: string }[] = [
    { id: 'first', label: 'First' },
    { id: 'last', label: 'Last' },
    { id: 'strong', label: 'Strong' },
    { id: 'close', label: 'Close' },
  ]

  const sel = $derived.by(() => {
    ui.version
    return selectedTower()
  })
</script>

<main>
  <header class="hud">
    <span class="title">kernel&nbsp;panic</span>
    <span class="stat lives">🍿 {ui.lives}</span>
    <span class="stat butter">🧈 {ui.butter}</span>
    <span class="stat round">
      {#if ui.endless}Round {ui.round} ∞{:else}Round {ui.round}/{ui.totalRounds}{/if}
      {#if ui.best > 0}<span class="best">· best {ui.best}</span>{/if}
    </span>
    <span class="grow"></span>
    <div class="speed">
      <button class:on={!ui.paused && ui.speed === 1} onclick={() => setSpeed(1)}>1×</button>
      <button class:on={!ui.paused && ui.speed === 2} onclick={() => setSpeed(2)}>2×</button>
      <button class:on={!ui.paused && ui.speed === 3} onclick={() => setSpeed(3)}>3×</button>
      <button class:on={ui.paused} onclick={togglePause} aria-label="pause">{ui.paused ? '▶' : '⏸'}</button>
    </div>
    <Settings />
  </header>

  <div class="board">
    <canvas
      bind:this={canvas}
      onpointermove={(e) => onPointerMove(e.clientX, e.clientY)}
      onpointerleave={onPointerLeave}
      onclick={(e) => onCanvasClick(e.clientX, e.clientY)}
    ></canvas>
    {#if ui.error}<div class="err">{ui.error}</div>{/if}
    {#if ui.banner}<div class="banner">{ui.banner}</div>{/if}

    {#if sel}
      <div class="sel">
        <div class="sel-head">
          <b>{sel.def.name}</b>{#if sel.upgraded}<span class="badge">★ {sel.def.upgrade.name}</span>{/if}
          <button class="x" onclick={deselect} aria-label="close">×</button>
        </div>
        {#if sel.def.kind !== 'econ'}
          <div class="targets">
            {#each policies as p (p.id)}
              <button class:on={sel.tower.target === p.id} onclick={() => setTargetSelected(p.id)}>{p.label}</button>
            {/each}
          </div>
        {/if}
        <div class="sel-actions">
          {#if !sel.upgraded}
            <button class="up" disabled={!sel.canUpgrade} onclick={upgradeSelected}>{sel.def.upgrade.name} · 🧈{sel.upgradeCost}</button>
          {/if}
          <button class="sell" onclick={sellSelected}>Sell 🧈{sel.sellValue}</button>
        </div>
      </div>
    {/if}
  </div>

  <footer class="controls">
    <div class="palette">
      {#each towers as t (t.id)}
        <button
          class="tw"
          class:active={ui.placingType === t.id}
          class:poor={ui.butter < t.cost}
          onclick={() => selectType(t.id)}
          title={t.blurb}
        >
          <span class="tw-name">{t.name}</span>
          <span class="tw-cost">🧈{t.cost}</span>
        </button>
      {/each}
    </div>

    {#if ui.phase === 'build'}
      <button class="start" onclick={startRound}>
        Start Round {ui.round} ▶{#if ui.earlyBonus > 0}<span class="bonus">+{ui.earlyBonus}🧈</span>{/if}
      </button>
    {:else if ui.phase === 'round'}
      <span class="wave">Wave incoming…</span>
    {/if}
  </footer>

  {#if ui.phase === 'lost'}
    <div class="overlay">
      <div class="panel end">
        <h2>🍿 The kitchen fell</h2>
        <p>The kernels overran you on round {ui.round}.{#if ui.best > 0} Best run: round {ui.best}.{/if} Butter up and try again.</p>
        <button class="primary" onclick={restart}>Play again</button>
      </div>
    </div>
  {/if}
</main>

<span class="ver">kernel panic · {__BUILD_SHA__}</span>

<style>
  main {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 6px;
    padding: 6px clamp(6px, 2vw, 18px) max(6px, env(safe-area-inset-bottom));
    max-width: 760px;
    margin: 0 auto;
    overflow: hidden;
  }

  /* ── HUD: wraps instead of clipping on narrow screens ─────────────────── */
  .hud {
    display: flex;
    align-items: center;
    gap: 8px 12px;
    flex-wrap: wrap;
    min-height: 34px;
  }
  .title { font-weight: 800; letter-spacing: 0.03em; color: var(--pop); text-transform: lowercase; }
  .stat { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 15px; }
  .lives { color: #ffd7a1; }
  .butter { color: #f2d16b; }
  .round { color: var(--dim); font-weight: 500; }
  .best { color: #8f7a63; font-size: 13px; }
  .grow { flex: 1 1 8px; }
  .speed { display: flex; gap: 4px; }
  .speed button { padding: 3px 8px; font-size: 13px; }

  /* ── board: square, fills the middle row ──────────────────────────────── */
  .board {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  canvas {
    width: min(620px, 94vw, calc(100dvh - 190px));
    aspect-ratio: 1 / 1;
    display: block;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: #1b1410;
    touch-action: manipulation;
    cursor: pointer;
  }

  .err, .banner {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding: 6px 14px;
    border-radius: 9px;
    font-size: 13px;
    text-align: center;
    pointer-events: none;
    max-width: 92%;
  }
  .err { top: 10px; background: rgba(40,20,20,0.92); border: 1px solid var(--danger); color: #ffd7d7; }
  .banner { top: 10px; background: rgba(30,22,12,0.95); border: 1px solid var(--pop); color: #ffe6c8; font-weight: 600; }

  /* selected-tower card floats over the board bottom — never pushes layout */
  .sel {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: rgba(34,24,18,0.96);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 8px 10px;
    max-width: calc(100% - 16px);
  }
  .sel-head { display: flex; gap: 8px; align-items: center; }
  .badge { font-size: 11px; color: #ffd166; }
  .x { margin-left: auto; padding: 1px 8px; font-size: 15px; line-height: 1; }
  .targets, .sel-actions { display: flex; gap: 5px; flex-wrap: wrap; }
  .targets button { padding: 3px 8px; font-size: 12px; }
  .targets button.on { border-color: var(--pop); color: var(--pop); }
  .up:disabled { opacity: 0.4; }
  .sell { color: #f2d16b; }

  /* ── controls: palette scrolls, Start Round always full and visible ───── */
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .palette {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }
  .tw {
    flex: 1 0 auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    padding: 6px 10px;
    min-width: 84px;
  }
  .tw-name { font-weight: 600; font-size: 13px; white-space: nowrap; }
  .tw-cost { font-size: 12px; color: #f2d16b; }
  .tw.active { border-color: var(--pop); box-shadow: 0 0 12px rgba(255,138,76,0.3); }
  .tw.poor { opacity: 0.5; }

  .start {
    width: 100%;
    background: linear-gradient(160deg, #5a3820, #3a2411);
    border-color: var(--pop);
    color: #ffe6c8;
    font-weight: 700;
    padding: 11px 16px;
    font-size: 15px;
  }
  .bonus { color: #ffe08a; margin-left: 8px; font-size: 13px; }
  .wave { color: var(--pop); font-weight: 600; text-align: center; padding: 8px; }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(6,4,2,0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
  }
  .end { text-align: center; display: flex; flex-direction: column; gap: 12px; min-width: min(400px, 88vw); }
  .end h2 { color: var(--pop); }

  .ver { position: fixed; bottom: 3px; right: 8px; font-size: 11px; color: var(--dim); pointer-events: none; }

  @media (min-width: 620px) {
    .tw { flex: 0 0 auto; }
    .start { width: auto; align-self: flex-start; }
    .controls { flex-direction: row; align-items: center; justify-content: space-between; }
  }
</style>
