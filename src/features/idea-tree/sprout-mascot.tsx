"use client";

import { motion } from "framer-motion";

export type SproutMascotState = "listening" | "thinking";

const ASSET_VERSION = "v3";

const IMAGE_BY_STATE: Record<SproutMascotState, string> = {
  listening: `/mascot/listening.png?${ASSET_VERSION}`,
  thinking: `/mascot/thinking.png?${ASSET_VERSION}`,
};

const BREATHING_BY_STATE: Record<
  SproutMascotState,
  { y: number[]; duration: number }
> = {
  listening: { y: [0, -2, 0], duration: 2.5 },
  thinking: { y: [0, -3, 0], duration: 3.5 },
};

const ALL_STATES: SproutMascotState[] = ["listening", "thinking"];

export function SproutMascot({
  state,
  size = 80,
}: {
  state: SproutMascotState;
  size?: number;
}) {
  // The source PNGs have a Chinese label baked into the bottom ~25%.
  // We crop it by giving the container 75% of the image height and clipping overflow.
  const visibleHeight = Math.round(size * 0.75);

  return (
    <div
      style={{
        width: size,
        height: visibleHeight,
        position: "relative",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {ALL_STATES.map((s) => {
        const active = state === s;
        const breathing = BREATHING_BY_STATE[s];
        return (
          <motion.img
            key={s}
            src={IMAGE_BY_STATE[s]}
            alt=""
            draggable={false}
            initial={{ opacity: active ? 1 : 0, y: 0 }}
            animate={{
              opacity: active ? 1 : 0,
              y: active ? breathing.y : 0,
            }}
            transition={{
              opacity: { duration: 0.25, ease: "easeOut" },
              y: active
                ? {
                    duration: breathing.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }
                : { duration: 0 },
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              display: "block",
              userSelect: "none",
              filter: "brightness(0.4) contrast(1.8) saturate(1.4)",
            }}
          />
        );
      })}
    </div>
  );
}
