import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export default function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: Props) {
  const styles = {
    primary:
      "bg-pink-500 text-white hover:bg-pink-400 shadow-lg shadow-pink-500/20",
    secondary:
      "bg-white/10 text-white hover:bg-white/15 border border-white/10",
    ghost: "bg-transparent text-gray-300 hover:bg-white/5",
  };

  return (
    <button
      className={`rounded-xl px-5 py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
