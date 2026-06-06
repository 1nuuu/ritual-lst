"use client";

import { useEffect, useRef, useState } from "react";
import type { ContractVersion } from "@/lib/contracts";

type VersionSwitcherProps = {
  version: ContractVersion;
  onChange: (version: ContractVersion) => void;
};

const VERSION_OPTIONS: Array<{
  value: ContractVersion;
  label: string;
  badge: string;
}> = [
  { value: "v2", label: "V2 (new)", badge: "Public" },
  { value: "v1", label: "V1 (old)", badge: "SBT only" },
];

export function VersionSwitcher({
  version,
  onChange,
}: VersionSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const options = VERSION_OPTIONS;
  const activeOption =
    VERSION_OPTIONS.find((option) => option.value === version) ??
    VERSION_OPTIONS[0];
  const canSwitchVersion = options.length > 1;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!canSwitchVersion) {
      setIsOpen(false);
    }
  }, [canSwitchVersion]);

  const handleSelect = (nextVersion: ContractVersion) => {
    onChange(nextVersion);
    setIsOpen(false);
  };

  return (
    <div className="version-switcher" ref={menuRef}>
      <button
        className={`version-menu-trigger ${isOpen ? "open" : ""} ${
          canSwitchVersion ? "" : "single-option"
        }`}
        aria-disabled={!canSwitchVersion}
        aria-expanded={canSwitchVersion ? isOpen : undefined}
        aria-haspopup="menu"
        aria-label="Select staking pool version"
        onClick={() => {
          if (canSwitchVersion) {
            setIsOpen((current) => !current);
          }
        }}
        type="button"
      >
        <span className="version-menu-label">{activeOption.label}</span>
        <span
          className={`version-badge ${
            activeOption.value === "v1" ? "legacy" : ""
          }`}
        >
          {activeOption.badge}
        </span>
        {canSwitchVersion ? (
          <svg
            className="version-menu-chevron"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path d="m5 7 5 5 5-5" />
          </svg>
        ) : null}
      </button>
      {isOpen && canSwitchVersion ? (
        <div className="version-menu" role="menu" aria-label="Staking pool version">
          {options.map((option) => (
            <button
              className={`version-menu-option ${
                version === option.value ? "active" : ""
              }`}
              aria-checked={version === option.value}
              key={option.value}
              onPointerDown={(event) => {
                event.preventDefault();
                handleSelect(option.value);
              }}
              onClick={() => handleSelect(option.value)}
              role="menuitemradio"
              type="button"
            >
              <span>{option.label}</span>
              <span
                className={`version-badge ${
                  option.value === "v1" ? "legacy" : ""
                }`}
              >
                {option.badge}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
