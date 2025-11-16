import { Header } from "@/components/Header"
import { HeroSection } from "@/components/HeroSection"
import { Footer } from "@/components/Footer"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <HeroSection />
      <div className="flex-1"></div>
      <Footer />
    </div>
  )
}
