import type { CSSProperties } from "react";

export type MallCartFlight = {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export function MallCartFlyAnimation({ flight }: { flight: MallCartFlight | null }) {
  if (!flight) return null;

  const style = {
    left: `${flight.fromX}px`,
    top: `${flight.fromY}px`,
    "--mall-cart-fly-x": `${flight.toX - flight.fromX}px`,
    "--mall-cart-fly-y": `${flight.toY - flight.fromY}px`,
  } as CSSProperties;

  return (
    <>
      <style>{`
        @keyframes mall-cart-fly {
          0% { opacity: 0; transform: translate(0, 0) scale(0.55) rotate(-18deg); }
          16% { opacity: 1; }
          68% { opacity: 1; transform: translate(calc(var(--mall-cart-fly-x) * 0.76), calc(var(--mall-cart-fly-y) * 0.76 - 18px)) scale(0.92) rotate(18deg); }
          100% { opacity: 0; transform: translate(var(--mall-cart-fly-x), var(--mall-cart-fly-y)) scale(0.22) rotate(140deg); }
        }
        .mall-cart-fly {
          position: fixed;
          z-index: 100;
          display: grid;
          height: 40px;
          width: 40px;
          place-items: center;
          border: 2px solid rgba(255, 255, 255, 0.92);
          border-radius: 9999px;
          background: linear-gradient(135deg, #fff5d8, #b9df9e);
          box-shadow: 0 8px 20px rgba(49, 91, 57, 0.28);
          font-size: 21px;
          pointer-events: none;
          animation: mall-cart-fly 820ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .mall-cart-fly { animation-duration: 1ms; }
        }
      `}</style>
      <span key={flight.id} aria-hidden="true" className="mall-cart-fly" style={style}>🪴</span>
    </>
  );
}
