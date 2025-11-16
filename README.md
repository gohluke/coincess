# coincess

A Next.js website clone of www.coincess.com built with TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- Modern, responsive design matching the original coincess.com
- Header with navigation, user profile, and search
- Hero section with "Success In Crypto" messaging
- Email capture form with Name and Email inputs
- Animated canvas-based wave footer with smooth animations
- Mobile-responsive navigation

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS v3** - Utility-first CSS framework
- **shadcn/ui** - Reusable component library
- **Lucide React** - Icon library

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
coincess/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx         # Homepage
│   └── globals.css      # Global styles with Tailwind
├── components/
│   ├── ui/              # shadcn/ui components
│   │   ├── button.tsx
│   │   └── input.tsx
│   ├── Header.tsx       # Site header with navigation
│   ├── HeroSection.tsx  # Main hero section
│   ├── Footer.tsx       # Footer with animated waves
│   ├── Logo.tsx         # coincess logo component
│   └── WaveAnimation.tsx # Canvas-based wave animation
├── public/
│   └── assets/          # Static assets (logos, images, etc.)
└── lib/
    └── utils.ts         # Utility functions (cn helper)
```

## Assets Folder

Static assets like logos, images, and other files should be placed in the `public/assets/` folder. Files in this folder can be referenced using the `/assets/` path prefix.

### Adding the Logo

If you have a `coincess-logo.png` file, place it in the `public/assets/` folder. The `Logo.tsx` component will automatically try to load it from `/assets/coincess-logo.png`. If the file is not found, it will fall back to the SVG logo.

To use your logo:
1. Place `coincess-logo.png` in `public/assets/`
2. Uncomment the Image component in `components/Logo.tsx`
3. The logo will be automatically loaded

## Building for Production

```bash
npm run build
npm start
```

## License

Private project - All rights reserved.
