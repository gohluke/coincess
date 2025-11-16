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
  lambda: number
  nodes: WaveNode[]
}

export function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const wavesRef = useRef<Wave[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const nodes = 6
    const waves: Wave[] = []
    const waveHeight = 180
    const colors = ["#CD3FFF", "#00f800", "#0000f8"]

    function resizeCanvas(canvas: HTMLCanvasElement, width?: number, height?: number) {
      if (width && height) {
        canvas.width = width
        canvas.height = height
      } else {
        if (window.innerWidth > 1920) {
          canvas.width = window.innerWidth
        } else {
          canvas.width = 1920
        }
        canvas.height = waveHeight
      }
    }

    function init() {
      if (!canvas) return
      resizeCanvas(canvas)
      waves.length = 0

      for (let i = 0; i < 3; i++) {
        const wave: Wave = {
          color: colors[i],
          lambda: 1,
          nodes: [],
        }

        for (let j = 0; j <= nodes + 2; j++) {
          const temp: WaveNode = {
            x: (j - 1) * (canvas.width / nodes),
            y: 0,
            tick: Math.random() * 200,
            speed: 0.3,
          }
          wave.nodes.push(temp)
        }

        waves.push(wave)
      }

      wavesRef.current = waves
      update()
    }

    function bounce(nodeArr: WaveNode) {
      if (!canvas) return
      nodeArr.y = (waveHeight / 2) * Math.sin(nodeArr.tick / 20) + canvas.height / 2
      nodeArr.tick = nodeArr.tick + nodeArr.speed
    }

    function drawWave(obj: Wave) {
      if (!canvas || !ctx) return
      
      const diff = (a: number, b: number) => {
        return (b - a) / 2 + a
      }

      // Gradient
      const grd = ctx.createLinearGradient(0, 0, 0, 170)
      grd.addColorStop(0, "#90A8FF")
      grd.addColorStop(1, "#D1A4FF")

      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.moveTo(0, canvas.height)
      ctx.lineTo(obj.nodes[0].x, obj.nodes[0].y)

      for (let i = 0; i < obj.nodes.length; i++) {
        if (obj.nodes[i + 1]) {
          ctx.quadraticCurveTo(
            obj.nodes[i].x,
            obj.nodes[i].y,
            diff(obj.nodes[i].x, obj.nodes[i + 1].x),
            diff(obj.nodes[i].y, obj.nodes[i + 1].y)
          )
        } else {
          ctx.lineTo(obj.nodes[i].x, obj.nodes[i].y)
          ctx.lineTo(canvas.width, canvas.height)
        }
      }

      ctx.closePath()
      ctx.fill()
    }

    function update() {
      if (!canvas || !ctx) return
      
      // Get background color from .wave-header element
      const waveHeader = document.querySelector(".wave-header")
      let fill = "rgb(255, 255, 255)"
      
      if (waveHeader) {
        const bgColor = window.getComputedStyle(waveHeader, null).getPropertyValue("background-color")
        if (bgColor && bgColor !== "rgba(0, 0, 0, 0)") {
          fill = bgColor
        }
      }

      ctx.fillStyle = fill
      ctx.globalCompositeOperation = "source-over"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = "multiply"

      const waves = wavesRef.current
      for (let i = 0; i < waves.length; i++) {
        for (let j = 0; j < waves[i].nodes.length; j++) {
          bounce(waves[i].nodes[j])
        }
        drawWave(waves[i])
      }

      animationFrameRef.current = requestAnimationFrame(update)
    }

    // Handle window resize
    const handleResize = () => {
      if (!canvas) return
      resizeCanvas(canvas)
      // Reinitialize nodes for new width
      wavesRef.current.forEach((wave) => {
        wave.nodes.forEach((node, index) => {
          node.x = (index - 1) * (canvas.width / nodes)
        })
      })
    }

    window.addEventListener("resize", handleResize)
    init()

    return () => {
      window.removeEventListener("resize", handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="canvas"
      className="absolute bottom-0 left-0 w-full"
      style={{ display: "block", height: "180px" }}
    />
  )
}
