import { Copy, Terminal, Plus } from 'lucide-react';

export default function OnboardingEmpty({ apiKey }) {
  const curlCommand = `curl http://localhost:3001/v1/chat/completions \\
  -H "Authorization: Bearer vc-${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"messages": [{"role": "user", "content": "Explain quantum physics in one sentence"}]}'`;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 text-center">
      <div className="w-20 h-20 bg-violet-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-violet-500/30">
        <Plus className="w-10 h-10 text-violet-500" />
      </div>
      <h1 className="text-4xl font-bold mb-4">Make your first request</h1>
      <p className="text-gray-400 mb-12 text-lg">
        Your VibeCore account is active. Connect your app to start saving up to 80% on LLM costs.
      </p>

      <div className="text-left mb-12">
        <div className="flex items-center gap-2 mb-4 text-sm font-bold text-gray-500 uppercase tracking-widest">
          <Terminal className="w-4 h-4" />
          Quick Test via cURL
        </div>
        <div className="glass p-6 rounded-2xl relative group">
          <pre className="text-sm font-mono text-gray-300 overflow-x-auto">
            {curlCommand}
          </pre>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(curlCommand);
              alert('Copied to clipboard');
            }}
            className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-3xl">
          <h3 className="font-bold mb-2">Install the SDK</h3>
          <p className="text-sm text-gray-400 mb-4">The easiest way to integrate VibeCore into your Node.js app.</p>
          <div className="bg-gray-950 p-3 rounded-xl font-mono text-xs border border-gray-800 flex justify-between items-center">
            <code>npm install vibecore-sdk</code>
            <button onClick={() => navigator.clipboard.writeText('npm install vibecore-sdk')}><Copy className="w-3 h-3 text-gray-600" /></button>
          </div>
        </div>
        <div className="p-6 bg-gray-900 border border-gray-800 rounded-3xl">
          <h3 className="font-bold mb-2">Check the Docs</h3>
          <p className="text-sm text-gray-400 mb-4">Learn about prompt optimization, semantic caching, and smart routing.</p>
          <a href="#" className="text-violet-400 font-bold text-sm flex items-center gap-2 hover:text-violet-300">
            View API Reference
            <Plus className="w-4 h-4 rotate-45" />
          </a>
        </div>
      </div>
    </div>
  );
}
