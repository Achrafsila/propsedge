import { Logo } from "@/components/common/Logo";

export function Footer() {
  return (
    <footer className="border-t border-[rgba(148,163,184,0.08)] bg-[rgba(5,8,22,0.85)] backdrop-blur-sm px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size="small" variant="icon" monochrome />
          <span className="text-[#3D4D5E] text-xs">© 2026 PropEdge</span>
        </div>

        <span className="hidden md:block text-[#3D4D5E] text-xs">
          Professional Prop Trading Workspace
        </span>

        <span className="text-[#3D4D5E] text-xs">Version 1.0</span>
      </div>
    </footer>
  );
}
