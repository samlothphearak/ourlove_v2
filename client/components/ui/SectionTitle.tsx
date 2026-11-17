import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export default function SectionTitle({ title, subtitle, action }: Props) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          {title}
        </h2>

        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>

      {action}
    </div>
  );
}
