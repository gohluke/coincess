import Image from "next/image"
import { BRAND_CONFIG } from "@/lib/brand.config"

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src={BRAND_CONFIG.assets.icon}
        alt=""
        width={28}
        height={28}
        className="w-7 h-7 rounded-lg"
        priority
      />
      <span className="font-brand text-[19px] font-bold tracking-tight text-white hidden sm:block">
        {BRAND_CONFIG.nameLower}
      </span>
    </div>
  )
}
