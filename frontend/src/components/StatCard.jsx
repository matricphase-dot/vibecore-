export default function StatCard({ label, value, icon }) {
  return (
    <div className="glass p-6 rounded-3xl">
      <div className="flex items-center gap-4 mb-3">
        <div className="p-2 rounded-xl bg-gray-950 border border-gray-800">
          {icon}
        </div>
        <span className="text-sm text-gray-400 font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
