import { WaveCanvas } from "./WaveAnimation"

export function Footer() {
  return (
    <footer className="relative w-full h-48 overflow-hidden mt-auto bg-white">
      <div className="wave-header" style={{ backgroundColor: "#fff", position: "absolute", width: "100%", height: "100%" }}></div>
      <div className="canvas-wrap absolute bottom-0 left-0 w-full" style={{ zIndex: 0 }}>
        <WaveCanvas />
      </div>
    </footer>
  )
}
