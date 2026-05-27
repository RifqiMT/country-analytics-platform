import { useEffect, useState } from "react";

/** True after the window scrolls past `threshold` px — used to shrink sticky chrome. */
export function useScrollCompact(threshold = 32): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return compact;
}
