import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const HANDHELD_DEVICE_PATTERN = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

function isNarrowViewport() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function isHandheldDevice() {
  return HANDHELD_DEVICE_PATTERN.test(navigator.userAgent);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      // Android standalone/PWA windows can report a desktop-width CSS viewport.
      // Keep their navigation in drawer mode so a touch-safe menu trigger remains available.
      setIsMobile(isNarrowViewport() || isHandheldDevice());
    };
    mql.addEventListener("change", onChange);
    window.addEventListener("orientationchange", onChange);
    window.visualViewport?.addEventListener("resize", onChange);
    onChange();
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.visualViewport?.removeEventListener("resize", onChange);
    };
  }, []);

  return isMobile;
}
