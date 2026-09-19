export type RecipeOrigin = 'MFDS' | 'MAFRA' | 'SHARED_AI' | 'AI_GENERATED' | 'DEMO' | 'UNKNOWN';

export function canShareRecipe(recipe: { origin?: RecipeOrigin } | null): boolean {
  return recipe?.origin === 'AI_GENERATED';
}

export function shareAfterCompletion(recipe: { origin?: RecipeOrigin } | null, pending: boolean, alreadyShared: boolean): boolean {
  return canShareRecipe(recipe) && pending && !alreadyShared;
}

export function newProposalSharingState() {
  return { sharePending: false, shared: false, savedRecipeId: null };
}
