import Image from "next/image"

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/assets/coincess-icon.png"
        alt=""
        width={28}
        height={28}
        className="w-7 h-7 rounded-lg"
        priority
      />
      <span className="font-brand text-[19px] font-bold tracking-tight text-white hidden sm:block">
        coincess
      </span>
    </div>
  )
}
