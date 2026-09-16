import { useEffect, useState } from "react";

export function useLiveTimer(start, running = true) {
  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    if (!running || !start) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [start, running]);
  return start ? Math.max(0, (tick - new Date(start).getTime()) / 1000) : 0;
}
