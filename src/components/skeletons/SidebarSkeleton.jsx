import { Users } from "lucide-react";

const SidebarSkeleton = () => {
  // Create 8 skeleton items
  const skeletonContacts = Array(8).fill(null);

  return (
    <aside className="flex h-full w-full flex-col">
      <div className="discord-topbar w-full p-5">
        <div className="flex items-center gap-2">
          <Users className="w-6 h-6" />
          <span className="font-medium">Contacts</span>
        </div>
      </div>

      <div className="discord-scroll w-full flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {skeletonContacts.map((_, idx) => (
          <div key={idx} className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
            <div className="relative">
              <div className="skeleton size-12 rounded-full" />
            </div>

            <div className="min-w-0 flex-1 text-left">
              <div className="skeleton h-4 w-32 mb-2" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;