<script lang="ts">
  import { settings, setSfx, setAutoStart } from './settings.svelte.ts'
  let open = $state(false)
</script>

<div class="settings">
  <button class="gear" onclick={() => (open = !open)} aria-label="settings" title="settings">
    {settings.sfx ? '⚙' : '🔇'}
  </button>
  {#if open}
    <div class="pop">
      <label><input type="checkbox" checked={settings.sfx} onchange={(e) => setSfx(e.currentTarget.checked)} /> sound effects</label>
      <label><input type="checkbox" checked={settings.autoStart} onchange={(e) => setAutoStart(e.currentTarget.checked)} /> auto-start next round</label>
    </div>
  {/if}
</div>

<style>
  .settings { position: relative; }
  .gear { padding: 4px 9px; font-size: 14px; }
  .pop {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 45;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  label { display: flex; gap: 8px; align-items: center; cursor: pointer; font-size: 14px; }
</style>
