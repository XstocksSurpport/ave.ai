import Image from "next/image";

type Props = {
  /** 显示边长（像素） */
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 56, className = "", priority = false }: Props) {
  return (
    <Image
      src="/logo.png"
      alt="Ave.ai"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
