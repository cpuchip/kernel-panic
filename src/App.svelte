<script lang="ts">
  import { onMount } from 'svelte'
  import {
    ui, start, stop, onPointerMove, onPointerLeave, onCanvasClick,
    selectType, selectedTower, upgradeSelected, sellSelected, setTargetSelected,
    startRound, setSpeed, togglePause, restart, towerOrder, deselect,
    mapChoices, mapPreviewPoints, chooseMap, openMenu, bombChoices, selectBomb,
    openCoop, joinCoop, coopStart, sendButterTo, askForButter,
  } from './game.svelte.ts'
  import Settings from './Settings.svelte'
  import type { TargetPolicy } from '../shared/sim/types.ts'

  let canvas: HTMLCanvasElement
  let coopName = $state('')
  let coopCode = $state('')

  onMount(() => {
    start(canvas)
    return () => stop()
  })

  // the teammate seat (2-player co-op has exactly one "other")
  const others = $derived(ui.lobby.filter((p) => p.index !== ui.myIndex))

  const towers = towerOrder()
  const bombs = bombChoices()
  const maps = mapChoices()
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
    <h1 class="title">kernel&nbsp;panic</h1>
    <span class="stat lives">🍿 {ui.lives}</span>
    <span class="stat butter">🧈 {ui.butter}</span>
    <span class="stat round">
      {#if ui.endless}Round {ui.round} ∞{:else}Round {ui.round}/{ui.totalRounds}{/if}
      {#if ui.best > 0}<span class="best">· best {ui.best}</span>{/if}
    </span>
    <span class="grow"></span>
    {#if !ui.online}
      <div class="speed">
        <button class:on={!ui.paused && ui.speed === 1} onclick={() => setSpeed(1)}>1×</button>
        <button class:on={!ui.paused && ui.speed === 2} onclick={() => setSpeed(2)}>2×</button>
        <button class:on={!ui.paused && ui.speed === 3} onclick={() => setSpeed(3)}>3×</button>
        <button class:on={ui.paused} onclick={togglePause} aria-label="pause">{ui.paused ? '▶' : '⏸'}</button>
      </div>
    {:else}
      <span class="coop-tag">🤝 co-op</span>
    {/if}
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
    {#if ui.notice}<div class="notice">{ui.notice}</div>{/if}

    {#if sel}
      <div class="sel">
        <div class="sel-head">
          <b>{sel.def.name}</b>{#if sel.tiers > 0}<span class="badge">{'★'.repeat(Math.min(sel.tiers, 6))}</span>{/if}
          <button class="x" onclick={deselect} aria-label="close">×</button>
        </div>
        {#if sel.def.kind === 'dart' || sel.def.kind === 'beam' || sel.def.kind === 'pulse'}
          <div class="targets">
            {#each policies as p (p.id)}
              <button class:on={sel.tower.target === p.id} onclick={() => setTargetSelected(p.id)}>{p.label}</button>
            {/each}
          </div>
        {/if}
        <div class="paths">
          {#each sel.paths as p (p.index)}
            <div class="path-row">
              <span class="path-label">
                {p.label}
                <span class="pips">{#each Array(p.maxLevel) as _, i (i)}<span class="pip" class:filled={i < p.level}></span>{/each}</span>
              </span>
              {#if p.nextTier}
                <button class="up" class:locked={p.locked} disabled={!p.canUpgrade} onclick={() => upgradeSelected(p.index)}>
                  {p.nextTier.name} · 🧈{p.nextTier.cost}
                </button>
              {:else}
                <span class="pathmax">maxed</span>
              {/if}
            </div>
          {/each}
        </div>
        <button class="sell" onclick={sellSelected}>Sell 🧈{sel.sellValue}</button>
      </div>
    {/if}
  </div>

  <footer class="controls">
    {#if ui.online}
      <div class="coopbar">
        <span class="me">You 🧈{ui.butter}</span>
        {#each others as o (o.index)}
          <span class="mate" style="color:{o.color}">{o.name} 🧈{ui.butters[o.index] ?? 0}</span>
          <button class="give" onclick={() => sendButterTo(o.index, 100)} disabled={ui.butter < 100}>+100→</button>
          <button class="give" onclick={() => sendButterTo(o.index, 500)} disabled={ui.butter < 500}>+500→</button>
        {/each}
        <button class="ask" onclick={askForButter}>Ask 🙏</button>
      </div>
    {/if}
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
      <span class="tray-div" aria-hidden="true"></span>
      {#each bombs as b, i (b.name)}
        <button
          class="tw bomb"
          class:active={ui.placingBomb === i}
          class:poor={ui.butter < b.cost}
          onclick={() => selectBomb(i)}
          title={`${b.name} — one-use track mine, ${b.dmg} damage`}
        >
          <span class="tw-name">💣 {b.dmg}</span>
          <span class="tw-cost">🧈{b.cost}</span>
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

  {#if ui.phase === 'lost' && ui.screen === 'playing'}
    <div class="overlay">
      <div class="panel end">
        <h2>🍿 The kitchen fell</h2>
        <p>The kernels overran you on round {ui.round}.{#if ui.best > 0} Best run: round {ui.best}.{/if} Butter up and try again.</p>
        <div class="end-actions">
          {#if ui.online}
            <button class="primary" onclick={openMenu}>Back to menu</button>
          {:else}
            <button class="primary" onclick={restart}>Play again</button>
            <button onclick={openMenu}>Change map</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if ui.screen === 'menu'}
    <div class="overlay menu">
      <div class="panel pick">
        <h2>🍿 kernel panic</h2>
        <p class="sub">Pick a kitchen — pop the corn before it pops you.</p>
        <div class="mapgrid">
          {#each maps as m (m.id)}
            <button class="mapcard" onclick={() => chooseMap(m.id)}>
              <svg viewBox="0 0 640 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <rect x="4" y="4" width="632" height="632" rx="28" class="mapbg" />
                <polyline points={mapPreviewPoints(m)} class="mapline" />
              </svg>
              <span class="mapname">{m.name}</span>
              <span class="mapblurb">{m.blurb}</span>
            </button>
          {/each}
        </div>
        <button class="coop-enter" onclick={() => { openCoop(); coopCode = ui.roomCode }}>🤝 Play with a friend</button>
      </div>
    </div>
  {/if}

  {#if ui.screen === 'coop'}
    <div class="overlay menu">
      <div class="panel pick coop-setup">
        <h2>🤝 play together</h2>
        <p class="sub">Pick a name and a room code, then share the code. Whoever joins first is the host.</p>
        <label class="field">Your name
          <input bind:value={coopName} maxlength="16" placeholder="Player" />
        </label>
        <label class="field">Room code
          <input bind:value={coopCode} maxlength="24" placeholder={ui.roomCode} />
        </label>
        <div class="end-actions">
          <button class="primary" onclick={() => joinCoop(coopName, coopCode || ui.roomCode)}>Enter room →</button>
          <button onclick={openMenu}>Back</button>
        </div>
      </div>
    </div>
  {/if}

  {#if ui.screen === 'lobby'}
    <div class="overlay menu">
      <div class="panel pick coop-lobby">
        <h2>🤝 room: {ui.roomCode}</h2>
        <p class="sub">Share the room code so your buddy can join.</p>
        <div class="seats">
          {#each ui.lobby as p (p.index)}
            <span class="seat" class:me={p.index === ui.myIndex} style="border-color:{p.color};color:{p.color}">
              {p.name}{p.index === 0 ? ' 👑' : ''}{p.index === ui.myIndex ? ' (you)' : ''}
            </span>
          {/each}
        </div>
        {#if ui.isHost}
          <p class="sub">Pick a kitchen to start (tap when everyone's in):</p>
          <div class="mapgrid">
            {#each maps as m (m.id)}
              <button class="mapcard" onclick={() => coopStart(m.id)}>
                <svg viewBox="0 0 640 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  <rect x="4" y="4" width="632" height="632" rx="28" class="mapbg" />
                  <polyline points={mapPreviewPoints(m)} class="mapline" />
                </svg>
                <span class="mapname">{m.name}</span>
              </button>
            {/each}
          </div>
        {:else}
          <p class="sub">Waiting for the host to pick a kitchen and start…</p>
        {/if}
        <button onclick={openMenu}>Leave room</button>
      </div>
    </div>
  {/if}
</main>

<span class="ver"><a href="/wiki" target="_blank" rel="noopener">📖 field guide</a> · kernel panic · {__BUILD_SHA__}</span>

<style>
  main {
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    /* minmax(0, …) caps the single column to the container so a wide, scrollable
       child (the tower/bomb palette) can't blow the whole layout past the
       viewport — the regression when the palette grew from 4 to 12 buttons. */
    grid-template-columns: minmax(0, 1fr);
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
  .title { margin: 0; font-size: 16px; font-weight: 800; letter-spacing: 0.03em; color: var(--pop); text-transform: lowercase; }
  .stat { font-variant-numeric: tabular-nums; font-weight: 600; font-size: 15px; }
  .lives { color: #ffd7a1; }
  .butter { color: #f2d16b; }
  .round { color: var(--dim); font-weight: 500; }
  .best { color: #8f7a63; font-size: 13px; }
  .grow { flex: 1 1 8px; }
  .speed { display: flex; gap: 4px; }
  .speed button { padding: 7px 10px; font-size: 13px; } /* roomier touch target */

  /* ── board: square, fills the middle row ──────────────────────────────── */
  .board {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }
  canvas {
    /* the largest 1:1 square that fits BOTH the board's width and its remaining
       height — no magic "reserve N px for the chrome" number to drift out of date. */
    max-width: min(620px, 94vw);
    max-height: 100%;
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
  .targets { display: flex; gap: 5px; flex-wrap: wrap; }
  .targets button { padding: 3px 8px; font-size: 12px; }
  .targets button.on { border-color: var(--pop); color: var(--pop); }

  .paths { display: flex; flex-direction: column; gap: 4px; }
  .path-row { display: flex; align-items: center; gap: 8px; }
  .path-label { font-size: 11px; color: var(--dim); min-width: 66px; display: flex; flex-direction: column; gap: 2px; }
  .pips { display: flex; gap: 2px; }
  .pip { width: 8px; height: 4px; border-radius: 2px; background: var(--line); }
  .pip.filled { background: var(--pop); }
  .up { flex: 1; text-align: left; font-size: 12px; padding: 5px 8px; }
  .up:disabled { opacity: 0.4; }
  .up.locked { opacity: 0.3; }
  .pathmax { flex: 1; font-size: 12px; color: #ffd166; padding: 5px 8px; }

  .sell { color: #f2d16b; align-self: flex-start; }

  /* ── controls: palette scrolls, Start Round always full and visible ───── */
  .controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0; /* let the grid child shrink so the palette can scroll, not push */
  }
  .palette {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
    min-width: 0; /* required for overflow-x to engage inside a flex/grid parent */
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
  .tw.bomb { min-width: 60px; }
  .tw.bomb .tw-name { font-size: 13px; }
  .tw.bomb.active { border-color: #ffb454; box-shadow: 0 0 12px rgba(255,180,84,0.35); }
  .tray-div { flex: 0 0 auto; width: 1px; align-self: stretch; margin: 4px 2px; background: var(--line); }

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
  .end-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }

  /* ── Map picker ────────────────────────────────────────────────────────── */
  .menu { z-index: 40; }
  .pick { text-align: center; display: flex; flex-direction: column; gap: 10px; max-width: min(640px, 94vw); max-height: 92dvh; overflow-y: auto; }
  .pick h2 { color: var(--pop); text-transform: lowercase; letter-spacing: 0.03em; }
  .pick .sub { color: var(--dim); font-size: 14px; margin-top: -4px; }
  .mapgrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    margin-top: 4px;
  }
  .mapcard {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 8px;
    text-align: left;
    background: rgba(28,20,14,0.6);
  }
  .mapcard:hover { border-color: var(--pop); box-shadow: 0 0 12px rgba(255,138,76,0.25); }
  .mapcard svg { width: 100%; height: auto; aspect-ratio: 1 / 1; border-radius: 8px; }
  .mapbg { fill: #1b1410; stroke: var(--line); stroke-width: 2; }
  .mapline { fill: none; stroke: var(--pop); stroke-width: 22; stroke-linejoin: round; stroke-linecap: round; opacity: 0.85; }
  .mapname { font-weight: 700; font-size: 14px; }
  .mapblurb { font-size: 13px; color: var(--dim); line-height: 1.3; }

  /* ── co-op ─────────────────────────────────────────────────────────────── */
  .coop-tag { font-size: 13px; color: var(--pop); font-weight: 600; }
  .notice {
    position: absolute; left: 50%; top: 44px; transform: translateX(-50%);
    padding: 6px 14px; border-radius: 9px; font-size: 13px; text-align: center;
    pointer-events: none; max-width: 92%;
    background: rgba(30,22,12,0.95); border: 1px solid var(--pop); color: #ffe6c8;
  }
  .coopbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; min-width: 0; }
  .coopbar .me { color: #f2d16b; font-weight: 600; }
  .coopbar .mate { font-weight: 600; }
  .coopbar .give, .coopbar .ask { padding: 5px 9px; font-size: 12px; }
  .coopbar .ask { margin-left: auto; }
  .coop-enter {
    margin-top: 8px; align-self: center;
    background: linear-gradient(160deg, #3a2a5a, #241a3a);
    border-color: #7f9cff; color: #dfe6ff; font-weight: 700; padding: 10px 18px;
  }
  .field { display: flex; flex-direction: column; gap: 4px; text-align: left; font-size: 13px; color: var(--dim); }
  .field input {
    font: inherit; padding: 9px 10px; border-radius: 8px;
    border: 1px solid var(--line); background: var(--panel-2); color: var(--text);
  }
  .seats { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .seat { padding: 5px 12px; border: 2px solid var(--line); border-radius: 20px; font-weight: 600; font-size: 14px; }
  .seat.me { background: rgba(255,138,76,0.12); }

  .ver { position: fixed; bottom: 3px; right: 8px; font-size: 13px; color: var(--dim); pointer-events: none; }
  .ver a { color: var(--pop); pointer-events: auto; text-decoration: none; }
  .ver a:hover { text-decoration: underline; }

  @media (min-width: 620px) {
    .tw { flex: 0 0 auto; }
    .start { width: auto; align-self: flex-start; flex: 0 0 auto; }
    .controls { flex-direction: row; align-items: center; justify-content: space-between; }
    /* palette takes the remaining row width beside Start, and scrolls within it */
    .palette { flex: 1 1 0; }
  }
</style>
