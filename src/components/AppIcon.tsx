import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { AppInfo } from "../types";
export function AppIcon({ app }: { app: AppInfo }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="app-icon"
      style={{
        background: app.color || "#2a3548",
        color: app.symbol === "N" ? "#101622" : "white",
      }}
    >
      {app.iconPath && !failed ? (
        <img
          src={convertFileSrc(app.iconPath)}
          alt=""
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{app.symbol || app.name.slice(0, 1)}</span>
      )}
    </span>
  );
}
