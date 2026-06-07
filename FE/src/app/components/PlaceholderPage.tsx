import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Construction size={28} className="text-slate-400" />
        </div>
        <h2 className="text-slate-700 mb-2" style={{ fontWeight: 700, fontSize: "1.25rem" }}>
          {title}
        </h2>
        <p className="text-slate-400 max-w-xs" style={{ fontSize: "0.875rem" }}>
          {description}
        </p>
        <div className="mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg inline-block">
          <span className="text-emerald-600" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            Coming Soon
          </span>
        </div>
      </div>
    </div>
  );
}
