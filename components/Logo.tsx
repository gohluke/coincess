import Image from "next/image"

export function Logo() {
  return (
    <div className="flex items-center">
      <div className="relative w-32 h-12 flex-shrink-0">
        <Image
          src="/assets/coincess-logo.png"
          alt="coincess logo"
          width={128}
          height={48}
          className="w-full h-full object-contain"
          priority
        />
      </div>
    </div>
  )
}
