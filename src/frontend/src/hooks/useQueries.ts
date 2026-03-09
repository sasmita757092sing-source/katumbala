import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScoreEntry } from "../backend.d";
import { useActor } from "./useActor";

export function useTopScores() {
  const { actor, isFetching } = useActor();
  return useQuery<ScoreEntry[]>({
    queryKey: ["topScores"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getTopScores();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useHighScore() {
  const { actor, isFetching } = useActor();
  return useQuery<[bigint, string]>({
    queryKey: ["highScore"],
    queryFn: async () => {
      if (!actor) return [BigInt(0), ""];
      return actor.getHighScore();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useSubmitScore() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, score }: { name: string; score: number }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.submitScore(name, BigInt(score));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topScores"] });
      queryClient.invalidateQueries({ queryKey: ["highScore"] });
    },
  });
}
