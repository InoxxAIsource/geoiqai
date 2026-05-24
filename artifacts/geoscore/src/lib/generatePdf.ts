import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface SystemStatus {
  name: string;
  score: number;
  found: boolean;
}

interface FixAction {
  id: number;
  priority: "high" | "medium" | "low";
  action: string;
  effortHours: number;
  impactScore: number;
  done: boolean;
  cite?: string;
}

export interface PdfReportData {
  domain: string;
  brandName: string;
  score: number;
  weekChange: number | null;
  systems: SystemStatus[];
  fixActions: FixAction[];
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 67) return [5, 150, 105];
  if (score >= 34) return [217, 119, 6];
  return [220, 38, 38];
}

export function generatePdfReport(data: PdfReportData): void {
  const { domain, brandName, score, weekChange, systems, fixActions } = data;
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const displayName = brandName || domain;

  const indigo: [number, number, number] = [79, 70, 229];
  const dark: [number, number, number] = [17, 24, 39];
  const gray: [number, number, number] = [107, 114, 128];
  const white: [number, number, number] = [255, 255, 255];

  function header(doc: jsPDF) {
    doc.setFillColor(...indigo);
    doc.rect(0, 0, 210, 14, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...white);
    doc.text("GeoIQ - AI Visibility Report", 105, 9, { align: "center" });
    doc.setTextColor(...dark);
  }

  // PAGE 1 - Cover
  doc.setFillColor(...indigo);
  doc.rect(0, 0, 210, 60, "F");

  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("GeoIQ", 20, 32);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(199, 210, 254);
  doc.text("geoiqai.com", 20, 42);

  doc.setTextColor(...dark);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("AI Visibility Report", 20, 82);

  doc.setFontSize(15);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(displayName, 20, 96);

  doc.setFontSize(11);
  doc.text(`Generated: ${today}`, 20, 110);
  doc.text("Prepared by: GeoIQ (geoiqai.com)", 20, 122);

  doc.setFillColor(248, 249, 250);
  doc.roundedRect(20, 138, 76, 62, 6, 6, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...gray);
  doc.text("GEO IQ SCORE", 58, 152, { align: "center" });

  doc.setFontSize(44);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...scoreColor(score));
  doc.text(String(score), 58, 184, { align: "center" });

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text("/ 100", 58, 196, { align: "center" });

  if (weekChange !== null) {
    const wc = weekChange;
    doc.setFontSize(10);
    const wcColor: [number, number, number] = wc >= 0 ? [5, 150, 105] : [220, 38, 38];
    doc.setTextColor(...wcColor);
    doc.text(`${wc >= 0 ? "+" : ""}${wc} this week`, 58, 208, { align: "center" });
  }

  // PAGE 2 - AI System Breakdown
  doc.addPage();
  header(doc);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("AI System Breakdown", 20, 32);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text(`How ${displayName} appears across AI systems.`, 20, 42);

  autoTable(doc, {
    startY: 52,
    head: [["AI System", "Score", "Status"]],
    body: systems.map((s) => [
      s.name,
      `${s.score} / 33`,
      s.found ? "Visible" : "Not found",
    ]),
    headStyles: {
      fillColor: indigo,
      textColor: white,
      fontStyle: "bold",
      fontSize: 11,
    },
    bodyStyles: { textColor: dark, fontSize: 11 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { cellPadding: 9 },
    didParseCell: (hookData) => {
      if (hookData.column.index === 2 && hookData.section === "body") {
        const sys = systems[hookData.row.index];
        if (sys) {
          hookData.cell.styles.textColor = sys.found ? [5, 150, 105] : [220, 38, 38];
        }
      }
    },
  });

  // PAGE 3 - Priority Fix Actions
  doc.addPage();
  header(doc);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Priority Fix Actions", 20, 32);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  doc.text("Top 5 recommended actions to improve AI visibility.", 20, 42);

  const topFive = fixActions.filter((a) => !a.done).slice(0, 5);
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sorted = [...topFive].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  autoTable(doc, {
    startY: 52,
    head: [["#", "Priority", "Task", "Impact", "Effort"]],
    body: sorted.map((a, i) => [
      String(i + 1),
      a.priority.charAt(0).toUpperCase() + a.priority.slice(1),
      a.action,
      `+${a.impactScore} pts`,
      `${a.effortHours}h`,
    ]),
    headStyles: {
      fillColor: indigo,
      textColor: white,
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { textColor: dark, fontSize: 10 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: { cellPadding: 7 },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 26 },
      3: { cellWidth: 22 },
      4: { cellWidth: 18 },
    },
    didParseCell: (hookData) => {
      if (hookData.column.index === 1 && hookData.section === "body") {
        const priority = sorted[hookData.row.index]?.priority;
        if (priority === "high") hookData.cell.styles.textColor = [220, 38, 38];
        else if (priority === "medium") hookData.cell.styles.textColor = [217, 119, 6];
        else hookData.cell.styles.textColor = [107, 114, 128];
      }
    },
  });

  // PAGE 4 - Next Steps
  doc.addPage();
  header(doc);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Next Steps", 20, 32);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);

  const steps = [
    "1. Log in to your GeoIQ dashboard at geoiqai.com",
    "2. Open Fix Actions and work through the high-priority tasks first",
    "3. Use GeoIQ Agent to generate content for any task",
    "4. Re-run an audit after a week of changes to measure progress",
    "5. Track your score trend in the Overview tab",
  ];
  steps.forEach((step, i) => {
    doc.text(step, 20, 50 + i * 14);
  });

  doc.setFillColor(238, 242, 255);
  doc.roundedRect(20, 130, 170, 28, 5, 5, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...indigo);
  doc.text("hello@geoiqai.com   |   geoiqai.com", 105, 147, { align: "center" });

  const filename = `geoiq-report-${domain}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
