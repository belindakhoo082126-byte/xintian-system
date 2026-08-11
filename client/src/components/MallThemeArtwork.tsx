import type { CSSProperties } from "react";
import type { MallTheme, ResolvedMallTheme } from "@/lib/mallTheme";

type ThemeArtworkProps = { theme: MallTheme | ResolvedMallTheme; active?: boolean };

function themeSurfaceStyle(theme: MallTheme): CSSProperties {
  return {
    backgroundColor: theme.colors.background,
    backgroundImage: theme.visual.pattern,
    borderColor: `${theme.colors.secondary}a8`,
    boxShadow: `0 12px 26px ${theme.colors.primary}18`,
  };
}

export function MallThemePreview({ theme, active = false }: ThemeArtworkProps) {
  return (
    <div className="relative h-32 overflow-hidden rounded-2xl border p-3" style={themeSurfaceStyle(theme)}>
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: theme.visual.edge }} />
      <div className="absolute right-3 top-3 flex gap-1 text-lg opacity-70" aria-hidden="true">
        {theme.visual.motifs.slice(0, 3).map((motif, index) => <span key={`${motif}-${index}`}>{motif}</span>)}
      </div>
      <div className="absolute -bottom-4 -left-2 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/70 bg-white/55 text-4xl shadow-sm" style={{ boxShadow: `inset 0 0 0 1px ${theme.colors.secondary}` }} aria-hidden="true">
        {theme.visual.mascot.glyph}
      </div>
      <div className="absolute bottom-3 left-20 right-3">
        <p className="text-sm font-bold" style={{ color: theme.colors.font }}>{theme.visual.mascot.name.zh}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4" style={{ color: `${theme.colors.font}b3` }}>{theme.visual.description.zh}</p>
      </div>
      {active && <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: theme.colors.primary }}>当前使用</span>}
    </div>
  );
}

export function MallThemeMascot({ theme, compact = false }: ThemeArtworkProps & { compact?: boolean }) {
  return (
    <div className={`mall-theme-mascot inline-flex items-center rounded-full border border-white/80 bg-white/65 shadow-sm backdrop-blur-sm ${compact ? "gap-1 px-1.5 py-1" : "gap-2 px-2.5 py-1.5"}`} style={{ boxShadow: `0 5px 16px ${theme.colors.primary}20` }}>
      <span className={compact ? "text-base leading-none" : "text-2xl leading-none"} aria-hidden="true">{theme.visual.mascot.glyph}</span>
      {!compact && <span className="text-xs font-semibold" style={{ color: theme.colors.font }}>{theme.visual.mascot.name.zh}</span>}
    </div>
  );
}

export function MallThemeDecorations({ theme }: { theme: ResolvedMallTheme }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-10 top-36 flex h-28 w-28 items-center justify-center rounded-full border border-white/70 text-4xl opacity-55" style={{ background: `${theme.secondary}42`, color: theme.primary, boxShadow: `0 16px 38px ${theme.primary}12` }}>{theme.visual.motifs[0]}</div>
      <div className="absolute -right-8 top-[34rem] flex h-32 w-32 items-center justify-center rounded-full border border-white/70 text-5xl opacity-40" style={{ background: `${theme.secondary}4d`, color: theme.primary }}>{theme.visual.motifs[1]}</div>
      <div className="absolute bottom-44 left-[8%] text-4xl opacity-25" style={{ color: theme.primary }}>{theme.visual.motifs[2]}</div>
    </div>
  );
}
