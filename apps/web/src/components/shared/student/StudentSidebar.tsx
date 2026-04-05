import Link from "next/link";
import type { CSSProperties } from "react";
import type { NavItem } from "@/lib/config/student/routes";
import styles from "./StudentSidebar.module.css";

type StudentSidebarProps = {
  items: NavItem[];
  onNavigate?: (item: NavItem) => void;
  logoSrc?: string;
  logoutIconSrc?: string;
  className?: string;
  style?: CSSProperties;
  onLogout?: () => void;
};

export default function StudentSidebar({
  items,
  onNavigate,
  logoSrc = "/images/logo/logo-v2.png",
  logoutIconSrc = "/images/icon bar/icon7.jpg",
  className,
  style,
  onLogout,
}: StudentSidebarProps) {
  const wrapperClassName = className ? `${styles.sidebar} ${className}` : styles.sidebar;

  return (
    <div className={wrapperClassName} style={style}>
      <div className={styles.logo} title="Logo">
        <img src={logoSrc} alt="Logo" />
      </div>

      <div className={styles.logoDivider} />

      {items.map((item, idx) => {
        const disabled = item.enabled === false;
        const content = item.iconSrc ? <img src={item.iconSrc} alt={item.label} /> : <span>{item.label}</span>;

        const el = (() => {
          if (onNavigate) {
            return (
              <button
                key={item.key}
                type="button"
                className={`${styles.item} ${disabled ? styles.itemDisabled : ""}`}
                title={disabled ? `${item.label} (Coming soon)` : item.label}
                aria-label={item.label}
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

      <button className={styles.logout} title="Logout" aria-label="Logout" type="button" onClick={onLogout}>
        <img src={logoutIconSrc} alt="Logout" />
      </button>
    </div>
  );
}
