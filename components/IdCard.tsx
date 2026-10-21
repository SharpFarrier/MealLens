"use client";

import Qr from "./Qr";
import type { EmployeeRow } from "@/lib/types";

// The final card design: green field, QR in a white well, ID below, write-on name strip.
export default function IdCard({
  emp,
  qrSize = 130,
  width,
}: {
  emp: Pick<EmployeeRow, "card_id" | "site">;
  qrSize?: number;
  width?: string;
}) {
  return (
    <div
      style={{
        background: "var(--green)",
        color: "#fff",
        borderRadius: 16,
        padding: "22px 20px",
        aspectRatio: "54 / 85.6",
        width: width ?? undefined,
        maxWidth: width ?? 260,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 17, lineHeight: 1 }}>
          Sabi Wabi Innovations
        </div>
        <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", opacity: 0.8, marginTop: 2 }}>
          LLP · {emp.site || "Kalyan"} · Canteen card
        </div>
      </div>
      <div style={{ background: "#fff", borderRadius: 11, padding: 12, marginTop: 16, display: "flex", justifyContent: "center" }}>
        <Qr value={emp.card_id} size={qrSize} />
      </div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 24, letterSpacing: ".05em", marginTop: 12, textAlign: "center" }}>
        {emp.card_id}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, marginTop: 14, padding: "7px 10px" }}>
        <div style={{ fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b6b63", fontWeight: 600 }}>
          Name · नाम
        </div>
        <div style={{ borderBottom: "1.5px solid #cfcec6", height: 11, marginTop: 4 }} />
      </div>
    </div>
  );
}
