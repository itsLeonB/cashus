import { UserMenu } from "./UserMenu";

const Navigation = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
            C
          </div>
          <span className="text-lg font-semibold text-gray-900">Cashus</span>
        </div>

        <UserMenu />
      </div>
    </nav>
  );
};

export default Navigation;
