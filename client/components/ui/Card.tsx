import { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export default function Card({ children, className = "", ...props }: Props) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-[#15151f] p-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
