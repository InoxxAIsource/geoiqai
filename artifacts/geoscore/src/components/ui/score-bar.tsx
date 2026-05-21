import React from "react";
import { Progress } from "@/components/ui/progress";

interface ScoreBarProps {
  score: number;
}

export function ScoreBar({ score }: ScoreBarProps) {
  let colorClass = "bg-success";
  if (score < 40) {
    colorClass = "bg-destructive";
  } else if (score < 70) {
    colorClass = "bg-warning";
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-muted">
        <div 
          className={`h-full transition-all duration-1000 ease-in-out ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      <span className="font-medium text-sm min-w-[32px] text-right">{score}</span>
    </div>
  );
}
