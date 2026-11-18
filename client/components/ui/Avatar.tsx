interface Props {
  name: string;
  image?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export default function Avatar({ name, image, size = "md" }: Props) {
  const sizes = {
    xs: "h-7 w-7 text-[10px]",
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  };

  return (
    <div
      className={`${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-pink-400/30 bg-gradient-to-br from-pink-500 to-purple-600 font-bold text-white`}
    >
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}
