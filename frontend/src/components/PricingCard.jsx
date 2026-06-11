import { Check, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export default function PricingCard({ plan, price, features, recommended, onSubscribe }) {
  const isIndian = navigator.language === 'en-IN';

  return (
    <div className={`p-8 rounded-3xl border transition-all ${
      recommended 
        ? 'bg-violet-600/10 border-violet-500 shadow-[0_0_40px_rgba(139,92,246,0.1)]' 
        : 'bg-gray-900 border-gray-800'
    }`}>
      {recommended && (
        <div className="text-violet-400 text-xs font-bold uppercase tracking-widest mb-4">Most Popular</div>
      )}
      <h3 className="text-2xl font-bold mb-2 capitalize">{plan}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-bold">{isIndian && plan !== 'free' ? '₹' : '$'}{price}</span>
        <span className="text-gray-500 text-sm">/month</span>
      </div>
      
      <ul className="space-y-4 mb-8">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-400">
            <Check className="w-5 h-5 text-green-500 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSubscribe(plan)}
        disabled={plan === 'free'}
        className={`w-full py-3 rounded-xl font-bold transition-all ${
          plan === 'free'
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
            : recommended
              ? 'bg-violet-600 hover:bg-violet-700 text-white'
              : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {plan === 'free' ? 'Current Plan' : `Upgrade to ${plan}`}
      </button>
    </div>
  );
}
