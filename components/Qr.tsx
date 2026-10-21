"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function Qr({ value, size = 180 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "H" })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg("");
      });
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      style={{ width: size, height: size, lineHeight: 0 }}
      aria-label={`QR code for ${value}`}
      role="img"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
