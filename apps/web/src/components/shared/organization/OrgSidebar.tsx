import Link from "next/link";
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
  logoutIconSrc = "/images/icon bar/icon7.jpg",
  className,
  style,
  onLogout,
}: OrgSidebarProps) {
  const wrapperClassName = className ? `${styles.sidebar} ${className}` : styles.sidebar;

  return (
    <div className={wrapperClassName} style={style}>
      <div className={styles.logo} title="Logo">
        <img src={logoSrc} alt="Logo" />
      </div>

      {items.map((item) => {
        const disabled = item.enabled === false;
        const content = item.iconSrc ? <img src={item.iconSrc} alt={item.label} /> : <span>{item.label}</span>;

        if (onNavigate) {
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.item} ${disabled ? styles.itemDisabled : ""}`}
              title={disabled ? `${item.label} (Coming soon)` : item.label}
              aria-label={item.label}
              aria-disabled={disabled}
              onClick={() => {
                if (!disabled) onNavigate(item);
              }}
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
              className={`${styles.item} ${styles.itemDisabled}`}
              title={`${item.label} (Coming soon)`}
              aria-disabled
            >
              {content}
            </div>
          );
        }

        return (
          <Link key={item.key} href={item.href} className={styles.item} aria-label={item.label}>
            {content}
          </Link>
        );
      })}

      <div className={styles.spacer} />

      <button className={styles.logout} title="Logout" aria-label="Logout" type="button" onClick={onLogout}>
        <img src={logoutIconSrc} alt="Logout" />
      </button>
    </div>
  );
}
