# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is currently an empty repository with only documentation. The ReadMe.md file describes a planned Polar SH payment integration project, but no actual code has been implemented yet.

## Planned Architecture (from ReadMe.md)

The project is intended to be built with:
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with ShadCN UI components
- **Routing**: React Router DOM
- **Payment Integration**: Polar SH JavaScript SDK
- **UI Components**: ShadCN UI (Button, Card, etc.)

## Development Setup

Since no code exists yet, the first step would be to:
1. Initialize the project with `npm create vite@latest . -- --template react-ts`
2. Install dependencies for Tailwind CSS, ShadCN UI, and Polar SH SDK
3. Configure routing and payment integration

## Important Notes

- Environment variables must be prefixed with `VITE_` for Vite to expose them to the client
- The application should handle both payment success and failure scenarios
- Focus on responsive design and TypeScript type safety