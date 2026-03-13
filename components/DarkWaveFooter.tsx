"use client"

import { useEffect, useRef } from "react"

interface WaveNode {
  x: number
  y: number
  tick: number
  speed: number
}

interface Wave {
  color: string
  nodes: WaveNode[]
}

export function DarkWaveFooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const NODE_COUNT = 6
    const HEIGHT = 160
    const BG = "#0b0e11"
    const WAVE_COLORS = [
      "rgba(99, 102, 241, 0.15)",
      "rgba(16, 185, 129, 0.12)",
      "rgba(168, 85, 247, 0.10)",
    ]

    function resize() {
      canvas!.width = Math.max(window.innerWidth, 1920)
      canvas!.height = HEIGHT
    }

    const waves: Wave[] = []

    function init() {
      resize()
      waves.length = 0
      for (let i = 0; i < WAVE_COLORS.length; i++) {
        const w: Wave = { color: WAVE_COLORS[i], nodes: [] }
        for (let j = 0; j <= NODE_COUNT + 2; j++) {
          w.nodes.push({
            x: (j - 1) * (canvas!.width / NODE_COUNT),
            y: 0,
            tick: Math.random() * 200,
            speed: 0.2 + i * 0.08,
          })
        }
        waves.push(w)
      }
    }

    function bounce(node: WaveNode) {
      node.y = (HEIGHT / 2) * Math.sin(node.tick / 22) + canvas!.height / 2
      node.tick += node.speed
    }

    function drawWave(wave: Wave) {
      if (!ctx || !canvas) return
      ctx.fillStyle = wave.color
      ctx.beginPath()
      ctx.moveTo(0, canvas.height)
      ctx.lineTo(wave.nodes[0].x, wave.nodes[0].y)
      for (let i = 0; i < wave.nodes.length; i++) {
        const next = wave.nodes[i + 1]
        if (next) {
          ctx.quadraticCurveTo(
            wave.nodes[i].x, wave.nodes[i].y,
            (wave.nodes[i].x + next.x) / 2,
            (wave.nodes[i].y + next.y) / 2,
          )
        } else {
          ctx.lineTo(wave.nodes[i].x, wave.nodes[i].y)
          ctx.lineTo(canvas.width, canvas.height)
        }
      }
      ctx.closePath()
      ctx.fill()
    }

    function frame() {
      if (!ctx || !canvas) return
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = "screen"
      for (const wave of waves) {
        for (const node of wave.nodes) bounce(node)
        drawWave(wave)
      }
      ctx.globalCompositeOperation = "source-over"
      frameRef.current = requestAnimationFrame(frame)
    }

    init()
    frame()

    const onResize = () => {
      resize()
      waves.forEach((w) =>
        w.nodes.forEach((n, i) => { n.x = (i - 1) * (canvas!.width / NODE_COUNT) })
      )
    }
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <footer className="relative w-full overflow-hidden" style={{ height: 160 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />
    </footer>
  )
}
