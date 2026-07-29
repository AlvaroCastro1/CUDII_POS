export default function DashboardView() {
  return (
    <div className="h-full p-6">
      <div className="h-full border-2 border-dashed border-white/10 rounded-[32px] flex items-center justify-center bg-surface-container-lowest/30">
        <div className="text-center">
          <span className="material-symbols-outlined !text-6xl text-primary mb-4 block animate-bounce">construction</span>
          <h2 className="font-display-lg text-white">Dashboard</h2>
          <p className="text-on-surface-variant font-body-lg">En Implementación</p>
        </div>
      </div>
    </div>
  );
}
