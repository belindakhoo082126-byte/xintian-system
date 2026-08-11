import type { CSSProperties } from "react";
import type { MallTheme, ResolvedMallTheme } from "@/lib/mallTheme";

type ThemeArtworkProps = { theme: MallTheme | ResolvedMallTheme; active?: boolean };
const NATURAL_BOTANICAL_FRAME_URL = "/manus-storage/xintian-natural-watercolor-botanical-frame_45f83b37.png";

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
        <p className="text-sm font-bold" style={{ color: theme.colors.font }}>主题插画预览</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-4" style={{ color: `${theme.colors.font}b3` }}>{theme.visual.description.zh}</p>
      </div>
      {active && <span className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: theme.colors.primary }}>当前使用</span>}
    </div>
  );
}

export function MallThemeDecorations({ theme }: { theme: ResolvedMallTheme }) {
  if (theme.key === "xintian_nature") {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-x-0 top-0 h-[34rem] bg-top bg-no-repeat opacity-75 sm:h-[42rem]"
          style={{ backgroundImage: `url(${NATURAL_BOTANICAL_FRAME_URL})`, backgroundSize: "min(1500px, 118vw) auto" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-72 rotate-180 bg-top bg-no-repeat opacity-55 sm:h-96"
          style={{ backgroundImage: `url(${NATURAL_BOTANICAL_FRAME_URL})`, backgroundSize: "min(1500px, 118vw) auto" }}
        />
        <div className="absolute -left-24 top-[32rem] h-72 w-80 rounded-[48%_52%_44%_56%/58%_44%_56%_42%] opacity-35" style={{ background: "#b8c3ad" }} />
        <div className="absolute -right-28 top-[46rem] h-64 w-72 rounded-[56%_44%_52%_48%/44%_56%_42%_58%] opacity-25" style={{ background: "#d8c4a5" }} />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute -left-10 top-40 flex h-28 w-28 items-center justify-center rounded-full border border-white/70 text-4xl opacity-55" style={{ background: `${theme.secondary}42`, color: theme.primary, boxShadow: `0 16px 38px ${theme.primary}12` }}>{theme.visual.motifs[0]}</div>
      <div className="absolute right-4 top-28 flex items-center gap-1.5 rounded-full border border-white/80 px-3 py-2 text-xl opacity-70 shadow-sm backdrop-blur-sm" style={{ background: `${theme.background}c9`, color: theme.primary, boxShadow: `0 10px 28px ${theme.primary}12` }}>
        {theme.visual.motifs.slice(0, 3).map((motif, index) => <span key={`${motif}-${index}`}>{motif}</span>)}
      </div>
      <div className="absolute -right-8 top-[34rem] flex h-32 w-32 items-center justify-center rounded-full border border-white/70 text-5xl opacity-40" style={{ background: `${theme.secondary}4d`, color: theme.primary }}>{theme.visual.motifs[1]}</div>
      <div className="absolute bottom-44 left-[8%] flex items-center gap-2 text-4xl opacity-30" style={{ color: theme.primary }}><span>{theme.visual.motifs[2]}</span><span>{theme.visual.motifs[0]}</span></div>
    </div>
  );
}
