"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { NavItem } from "@/lib/config/organization/routes";
import styles from "./OrgSidebar.module.css";

type OrgSidebarProps = {
  items: NavItem[];
  onNavigate?: (item: NavItem) => void;
  logoSrc?: string;
  logoutIconSrc?: string;
  className?: string;
  style?: CSSProperties;
  onLogout?: () => void;
};

export default function OrgSidebar({
  items,
  onNavigate,
  logoSrc = "/images/logo/logo-v2.png",
  logoutIconSrc = "/images/icon bar/icon7.png",
  className,
  style,
  onLogout,
}: OrgSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const wrapperClassName = className ? `${styles.sidebar} ${className}` : styles.sidebar;

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/auth/sign-in");
  };

  return (
    <div className={wrapperClassName} style={style}>
      <div className={styles.logo} title="Logo">
        <img src={logoSrc} alt="Logo" />
      </div>

      <div className={styles.logoDivider} />

      {items.map((item, idx) => {
        const disabled = item.enabled === false;
        const isActive = !disabled && pathname.startsWith(item.href);
        const content = item.iconSrc ? <img src={item.iconSrc} alt={item.label} /> : <span>{item.label}</span>;

        const itemClass = [
          styles.item,
          disabled ? styles.itemDisabled : "",
          isActive ? styles.itemActive : "",
        ].filter(Boolean).join(" ");

        const el = (() => {
          if (onNavigate) {
            return (
              <button
                key={item.key}
                type="button"
                className={itemClass}
                title={disabled ? `${item.label} (Coming soon)` : item.label}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                aria-disabled={disabled}
                onClick={() => { if (!disabled) onNavigate(item); }}
                disabled={disabled}
              >
                {content}
              </button>
            );
          }
          if (disabled) {
            return (
              <div
                key={item.key}
                className={itemClass}
                title={`${item.label} (Coming soon)`}
                aria-disabled
              >
                {content}
              </div>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              className={itemClass}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              {content}
            </Link>
          );
        })();

        return (
          <div key={item.key} style={{ display: "contents" }}>
            {el}
            {idx < items.length - 1 && <div className={styles.itemDivider} />}
          </div>
        );
      })}

      <div className={styles.spacer} />

      <div className={styles.logoutDivider} />

      <button className={styles.logout} title="Logout" aria-label="Logout" type="button" onClick={handleLogout}>
        <img src={logoutIconSrc} alt="Logout" />
      </button>
    </div>
  );
}
