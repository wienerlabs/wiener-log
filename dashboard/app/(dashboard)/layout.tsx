import { Sidebar, MobileTopBar } from "@/components/sidebar";
import { logout } from "@/app/login/actions";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Sidebar logoutAction={logout} />
      <MobileTopBar />
      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>
    </>
  );
}
