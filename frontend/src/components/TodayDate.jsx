import { useEffect, useState } from "react";

export default function TodayDate() {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    let timer;
    function refresh() {
      const now = new Date();
      setToday(now);
      clearTimeout(timer);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    }
    function onVisible() {
      if (document.visibilityState === "visible") refresh();
    }
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const day = String(today.getDate()).padStart(2, "0");
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${day}`;
  return (
    <time dateTime={date} aria-label={`今日日期：${date}`} title={date} className="block font-serif text-[88px] leading-tight">
      {day}
    </time>
  );
}
