<script lang="ts">
  import { onMount } from 'svelte'
  import {
    ui, start, stop, onPointerMove, onPointerLeave, onCanvasClick,
    selectType, selectedTower, upgradeSelected, sellSelected, setTargetSelected,
    startRound, setSpeed, togglePause, restart, towerOrder,
  } from './game.svelte.ts'
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

  // recompute when the sim mutates (ui.version bumps on every command)
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
    <span class="stat round">Round {ui.round}/{ui.totalRounds}</span>
    <span class="spacer"></span>
    <div class="speed">
      <button class:on={!ui.paused && ui.speed === 1} onclick={() => setSpeed(1)}>1×</button>
      <button class:on={!ui.paused && ui.speed === 2} onclick={() => setSpeed(2)}>2×</button>
      <button class:on={!ui.paused && ui.speed === 3} onclick={() => setSpeed(3)}>3×</button>
      <button class:on={ui.paused} onclick={togglePause}>{ui.paused ? '▶' : '⏸'}</button>
    </div>
  </header>

  <div class="board">
    <canvas
      bind:this={canvas}
      onpointermove={(e) => onPointerMove(e.clientX, e.clientY)}
      onpointerleave={onPointerLeave}
      onclick={(e) => onCanvasClick(e.clientX, e.clientY)}
    ></canvas>
    {#if ui.error}<div class="err">{ui.error}</div>{/if}
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

    <div class="right">
      {#if sel}
        <div class="sel">
          <div class="sel-head">
            <b>{sel.def.name}</b>{#if sel.upgraded}<span class="badge">★ {sel.def.upgrade.name}</span>{/if}
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
              <button class="up" disabled={!sel.canUpgrade} onclick={upgradeSelected}>
                {sel.def.upgrade.name} · 🧈{sel.upgradeCost}
              </button>
            {/if}
            <button class="sell" onclick={sellSelected}>Sell 🧈{sel.sellValue}</button>
          </div>
        </div>
      {:else if ui.placingType}
        <div class="hint">Click a green tile to place · click again to cancel</div>
      {:else}
        <div class="hint">Pick a tower, or click one to manage it</div>
      {/if}

      {#if ui.phase === 'build'}
        <button class="start" onclick={startRound}>Start Round {ui.round} ▶</button>
      {:else if ui.phase === 'round'}
        <span class="wave">Wave incoming…</span>
      {/if}
    </div>
  </footer>

  {#if ui.phase === 'won' || ui.phase === 'lost'}
    <div class="overlay">
      <div class="panel end">
        {#if ui.phase === 'won'}
          <h2>🏆 Kitchen saved!</h2>
          <p>You cleared all {ui.totalRounds} rounds with {ui.lives} lives to spare.</p>
        {:else}
          <h2>🍿 The kitchen fell</h2>
          <p>The kernels overran you on round {ui.round}. Butter up and try again.</p>
        {/if}
        <button class="primary" onclick={restart}>Play again</button>
      </div>
    </div>
  {/if}
</main>

<footer class="ver">kernel panic · {__BUILD_SHA__}</footer>

<style>
  main {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 8px;
    padding: 8px clamp(8px, 2vw, 20px) 4px;
    max-width: 900px;
    margin: 0 auto;
    overflow: hidden;
  }

  .hud {
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 36px;
  }

  .title {
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--pop);
    text-transform: lowercase;
  }

  .stat {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .lives { color: #ffd7a1; }
  .butter { color: #f2d16b; }
  .round { color: var(--dim); }
  .spacer { flex: 1; }

  .speed {
    display: flex;
    gap: 4px;
  }

  .speed button {
    padding: 3px 9px;
    font-size: 13px;
  }

  .board {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  canvas {
    /* cap width so derived height (w / 1.5238) fits under the HUD + controls */
    width: min(860px, 96vw, calc((100dvh - 210px) * 1.5238));
    aspect-ratio: 640 / 420;
    display: block;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: #1b1410;
    touch-action: manipulation;
    cursor: pointer;
  }

  .err {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(40,20,20,0.92);
    border: 1px solid var(--danger);
    color: #ffd7d7;
    padding: 5px 12px;
    border-radius: 8px;
    font-size: 13px;
    pointer-events: none;
  }

  .controls {
    display: flex;
    gap: 12px;
    align-items: stretch;
    flex-wrap: wrap;
  }

  .palette {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .tw {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px 10px;
    min-width: 86px;
  }

  .tw-name { font-weight: 600; font-size: 13px; }
  .tw-cost { font-size: 12px; color: #f2d16b; }
  .tw.active { border-color: var(--pop); box-shadow: 0 0 12px rgba(255,138,76,0.3); }
  .tw.poor { opacity: 0.5; }

  .right {
    margin-left: auto;
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .sel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .sel-head { display: flex; gap: 8px; align-items: baseline; }
  .badge { font-size: 11px; color: #ffd166; }

  .targets, .sel-actions { display: flex; gap: 5px; }
  .targets button { padding: 3px 8px; font-size: 12px; }
  .targets button.on { border-color: var(--pop); color: var(--pop); }

  .up:disabled { opacity: 0.4; }
  .sell { color: #f2d16b; }

  .hint { color: var(--dim); font-size: 13px; align-self: center; }

  .start {
    background: linear-gradient(160deg, #4a2f18, #33220f);
    border-color: var(--pop);
    color: #ffe6c8;
    font-weight: 700;
    padding: 9px 16px;
  }

  .wave { color: var(--pop); font-weight: 600; }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(6,4,2,0.78);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }

  .end {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: min(400px, 88vw);
  }

  .end h2 { color: var(--pop); }

  .ver {
    position: fixed;
    bottom: 4px;
    right: 8px;
    font-size: 11px;
    color: var(--dim);
    pointer-events: none;
  }
</style>
