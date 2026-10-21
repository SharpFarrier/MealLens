"use client";

import { useEffect, useRef } from "react";

// iOS drum-wheel time picker. No browser date/time input anywhere.
// value is [hour, minute]; minutes snap to `step`.
const ITEM_H = 34;
const PAD = 40;

function Column({
  values,
  value,
  onChange,
  pad,
}: {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  pad: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // scroll to the current value on mount / when value changes externally
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = values.indexOf(value);
    if (idx >= 0) el.scrollTop = idx * ITEM_H;
  }, [value, values]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      const v = values[clamped];
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      if (v !== value) onChange(v);
    }, 90);
  }

  return (
    <div className="wheelcol focusable" ref={ref} onScroll={onScroll} tabIndex={0}>
      <div className="pad" style={{ height: PAD }} />
      {values.map((v) => (
        <div
          key={v}
          className={"opt" + (v === value ? " mid" : "")}
          onClick={() => onChange(v)}
        >
          {pad(v)}
        </div>
      ))}
      <div className="pad" style={{ height: PAD }} />
    </div>
  );
}

export default function Wheel({
  value,
  onChange,
  minHour = 6,
  maxHour = 22,
  step = 5,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
  minHour?: number;
  maxHour?: number;
  step?: number;
}) {
  const hours: number[] = [];
  for (let h = minHour; h <= maxHour; h++) hours.push(h);
  const minutes: number[] = [];
  for (let m = 0; m < 60; m += step) minutes.push(m);
  const two = (n: number) => (n < 10 ? "0" : "") + n;

  return (
    <div className="wheelbox">
      <div className="wheelmid" />
      <Column values={hours} value={value[0]} pad={two} onChange={(h) => onChange([h, value[1]])} />
      <span className="wheelsep">:</span>
      <Column values={minutes} value={value[1]} pad={two} onChange={(m) => onChange([value[0], m])} />
    </div>
  );
}
