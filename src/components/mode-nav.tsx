import Link from "next/link";

type ModeNavProps = {
  current: "guard" | "witness";
};

export function ModeNav({ current }: ModeNavProps) {
  return (
    <nav className="modeNav" aria-label="Product modes">
      <Link
        href="/"
        className={`modeLink${current === "guard" ? " active" : ""}`}
      >
        Pyth Guard
      </Link>
      <Link
        href="/witness"
        className={`modeLink${current === "witness" ? " active" : ""}`}
      >
        Market Witness
      </Link>
    </nav>
  );
}
