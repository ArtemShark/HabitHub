import NavButton from "./NavButton";

const navItems = [
  { href: "/dashboard", label: "Home", key: "dashboard" },
  { href: "/teams", label: "Teams", key: "teams" },
  { href: "/habits", label: "Habits", key: "habits" },
  { href: "/progress", label: "Progress", key: "progress" },
] as const;

type ActivePage = (typeof navItems)[number]["key"];

export default function TopNavigation({
  activePage,
}: {
  activePage: ActivePage;
}) {
  return (
    <nav className="flex flex-wrap gap-3">
      {navItems.map((item) => (
        <NavButton
          key={item.key}
          href={item.href}
          label={item.label}
          active={activePage === item.key}
        />
      ))}
    </nav>
  );
}