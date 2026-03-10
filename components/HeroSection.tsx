"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission
    console.log({ name, email })
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-20">
      <div className="w-full max-w-4xl text-center">
        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-800 mb-6 leading-tight">
          Success<br />
          <span className="text-gray-700">In Crypto.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-600 mb-16">
          Make the most out of your digital assets.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center max-w-2xl mx-auto">
          <Input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full sm:w-auto sm:flex-1 h-14 rounded-lg bg-white border-gray-200 text-base"
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full sm:w-auto sm:flex-1 h-14 rounded-lg bg-white border-gray-200 text-base"
          />
          <Button
            type="submit"
            className="w-full sm:w-auto h-14 px-8 rounded-lg bg-[#FF455B] hover:bg-[#E63B50] text-white font-medium text-base"
          >
            Get Started
          </Button>
        </form>
      </div>
    </main>
  )
}

