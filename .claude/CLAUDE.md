# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `bun run src/index.ts` - Run the application
- `bun --hot src/index.ts` - Run with hot reload for development
- `bunx tsc -p tsconfig.json --noEmit` - Typecheck
- `bun run test-e2e.ts` - Run e2e smoke checks

## Project

- Name: coding

## Architecture Overview

- `src/index.ts` - Entry
- `src/cli/` - CLI bootstrap (Ink render + wiring)
- `src/render/` - Ink UI components and Jotai state
- `src/core/` - Core logic (agent, tools, MCP, skills, config, safety, logging)
