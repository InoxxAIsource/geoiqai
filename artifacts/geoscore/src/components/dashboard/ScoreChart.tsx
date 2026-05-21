import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DailyScore } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";

interface ScoreChartProps {
  data: DailyScore[];
}

export function ScoreChart({ data }: ScoreChartProps) {
  // Format date to show just DD/MM for better display
  const formattedData = data.map(item => ({
    ...item,
    formattedDate: new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  })).reverse(); // Assuming API returns newest first, reverse for chronological order left-to-right

  if (!data || data.length === 0) {
    return (
      <Card className="p-8 flex items-center justify-center h-[300px] text-text-secondary">
        Not enough historical data to show trends.
      </Card>
    );
  }

  return (
    <Card className="p-6 h-[350px]">
      <h3 className="font-medium text-text-primary mb-6">Visibility Trend</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="formattedDate" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6b7280' }} 
            dy={10}
          />
          <YAxis 
            domain={[0, 100]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            type="monotone" 
            dataKey="scoreTotal" 
            name="Overall Score" 
            stroke="#534AB7" 
            strokeWidth={3} 
            dot={{ r: 4, strokeWidth: 2 }} 
            activeDot={{ r: 6 }} 
          />
          <Line 
            type="monotone" 
            dataKey="scoreChatgpt" 
            name="ChatGPT" 
            stroke="#10a37f" 
            strokeWidth={2} 
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="scoreGemini" 
            name="Gemini" 
            stroke="#4285f4" 
            strokeWidth={2} 
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="scorePerplexity" 
            name="Perplexity" 
            stroke="#22d3ee" 
            strokeWidth={2} 
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
