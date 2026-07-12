"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient, apiErrorMessage } from "@/lib/api-client";
import { useT } from "@/lib/i18n/client";
import { DescribeStep } from "@/components/onboarding/describe-step";
import { ProfileStep } from "@/components/onboarding/profile-step";
import { pick, type DetectedProfile } from "@/components/onboarding/onboarding-types";

export default function OnboardingPage() {
  const api = useApiClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, locale } = useT();

  const [text, setText] = useState("");
  const [city, setCity] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState("");
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [profile, setProfile] = useState<DetectedProfile | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBlockedReason(null);
    setAnalyzing(true);
    try {
      const res = await api.post<{ profile: DetectedProfile }>("/users/me/onboarding", {
        text: text.trim(),
        language: locale,
        ...(city.trim() ? { city: city.trim() } : {}),
      });
      setProfile(res.profile);
      setSelected(new Set(res.profile.recommended_agents.map((_, i) => i)));
      queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      // 422 → halal filter bloklagan
      if (err.payload?.blocked) setBlockedReason(err.payload?.reason ?? null);
      else setError(apiErrorMessage(err, t));
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleAgent = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const install = async () => {
    if (!profile) return;
    setInstalling(true);
    setError("");
    try {
      const agents = profile.recommended_agents
        .filter((_, i) => selected.has(i))
        .map((a) => ({
          name: pick(a.name, locale),
          systemPrompt: a.system_prompt,
          toolsConfig: a.tools,
        }));
      if (agents.length > 0) {
        await api.post("/users/me/recommendations/install", { agents });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      router.push("/dashboard");
    } catch (err: any) {
      setError(apiErrorMessage(err, t));
      setInstalling(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {!profile && (
        <DescribeStep
          text={text}
          setText={setText}
          city={city}
          setCity={setCity}
          analyzing={analyzing}
          error={error}
          blockedReason={blockedReason}
          onSubmit={analyze}
        />
      )}

      {profile && (
        <ProfileStep
          profile={profile}
          selected={selected}
          installing={installing}
          error={error}
          onToggleAgent={toggleAgent}
          onRedo={() => {
            setProfile(null);
            setBlockedReason(null);
            setError("");
          }}
          onInstall={install}
        />
      )}
    </div>
  );
}
