import { SiOpenai, SiGoogle, SiPerplexity } from "react-icons/si";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScoreBar } from "@/components/ui/score-bar";

interface SystemCardProps {
  system: "chatgpt" | "gemini" | "perplexity";
  score: number;
  found: boolean;
  detail?: string | null;
}

export function SystemCard({ system, score, found, detail }: SystemCardProps) {
  const Icon = system === "chatgpt" ? SiOpenai : system === "gemini" ? SiGoogle : SiPerplexity;
  const title = system === "chatgpt" ? "ChatGPT" : system === "gemini" ? "Gemini" : "Perplexity";

  return (
    <Card className="p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
            <Icon className="w-5 h-5 text-text-primary" />
          </div>
          <h3 className="font-medium text-text-primary">{title}</h3>
        </div>
        <Badge variant={found ? "default" : "secondary"} className={found ? "bg-success hover:bg-success" : "bg-muted text-text-secondary"}>
          {found ? "Found" : "Not Found"}
        </Badge>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-text-secondary">Visibility Score</span>
        </div>
        <ScoreBar score={score} />
      </div>

      {detail && (
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-sm text-text-secondary line-clamp-3" title={detail}>"{detail}"</p>
        </div>
      )}
    </Card>
  );
}
