import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b", false && "c", undefined, "d")).toBe("a b d");
  });

  it("resolves conflicting Tailwind classes to the LAST one (tailwind-merge)", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("supports conditional object syntax (clsx)", () => {
    expect(cn({ active: true, disabled: false }, "base")).toBe("active base");
  });

  it("no args -> empty string", () => {
    expect(cn()).toBe("");
  });
});
