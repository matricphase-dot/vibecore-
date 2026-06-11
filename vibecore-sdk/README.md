# VibeCore — AI Cost Autopilot

Cut your AI API costs by up to 80% with one line of code.

## Install

npm install vibecore

## Quick Start

const VibeCore = require('vibecore')
const vc = new VibeCore('YOUR_API_KEY')

const result = await vc.generate('What is the capital of France?')
console.log(result.response)   // Paris
console.log(result.saved)      // Rs.0.012

## Get API Key

Free at https://vibecore-07n6.onrender.com
1000 requests free. No credit card needed.

## Features

- Exact cache — repeated prompts return instantly
- Smart routing — simple queries go to free models  
- Cost tracking — see savings on every request
- Per-user dashboard — monitor your usage live

## API

const vc = new VibeCore(apiKey, options)

vc.generate(prompt)   — generate AI response
vc.stats()            — get your usage stats

## Response Format

{
  response: 'Paris is the capital of France.',
  cached: false,
  source: 'groq',
  saved: 0.012,
  total_saved: 0.024
}
