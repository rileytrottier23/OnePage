import Header from "@/components/Header";
import RepeatingTasksTable from "@/components/RepeatingTasksTable";

export default function RepeatingTasksPage() {
  return (
    <div className="flex min-h-screen">
      {/* Main content area - shifted to right to make room for side menu on desktop */}
      <div className="flex-1 md:ml-[240px]">
        <div className="py-6 px-4 sticky top-0 bg-background z-10">
          <Header />
        </div>

        <div className="px-4 md:px-6 max-w-5xl mx-auto pb-16">
          <div className="flex items-center mb-6">
            <h1 className="text-2xl font-semibold text-primary">Repeating Tasks</h1>
          </div>

          <div className="bg-card p-6 rounded-lg shadow-sm">
            <RepeatingTasksTable />
          </div>
        </div>
      </div>
    </div>
  );
}