import { useEffect, useState } from "react";
import { inputTime, parseTime } from "@/lib/time-format";

export function useTimeInput(
  value: string,
  use12Hours: boolean,
  onChange: (value: string) => void,
) {
  const [text, setText] = useState(() => inputTime(value, use12Hours));
  const [period, setPeriod] = useState<"AM" | "PM">(() => periodFor(value));
  useEffect(() => {
    setText(inputTime(value, use12Hours));
    setPeriod(periodFor(value));
  }, [value, use12Hours]);

  function changeText(next: string) {
    const canonical = parseTime(next, use12Hours, period);
    setText(canonical ? inputTime(canonical, use12Hours) : next);
    if (canonical !== null || next === "") onChange(canonical ?? "");
  }
  function changePeriod(next: "AM" | "PM") {
    setPeriod(next);
    const canonical = parseTime(text, use12Hours, next);
    if (canonical) onChange(canonical);
  }
  return { text, period, changeText, changePeriod };
}

function periodFor(value: string): "AM" | "PM" {
  return Number(value.slice(0, 2)) >= 12 ? "PM" : "AM";
}
