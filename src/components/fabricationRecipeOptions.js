const recipeProductScopes = (run) => new Set(
  (run?.salidas || [])
    .filter((output) => output.articulo?.clase === 'PRODUCTO_TERMINADO')
    .map((output) => output.articulo?.producto_sku || output.articulo?.codigo)
    .filter(Boolean),
);

export const approvedRecipesForRun = (recipes, run, colorId) => {
  const productScopes = recipeProductScopes(run);
  return (recipes || []).filter((recipe) => (
    recipe.estado === 'APROBADA'
    && Number(recipe.color_produccion_id) === Number(colorId)
    && (
      !recipe.producto_sku
      || productScopes.has(recipe.producto_sku)
    )
  ));
};

export const defaultRecipeForRun = (recipes, run, colorId) => {
  const productScopes = recipeProductScopes(run);
  const approved = approvedRecipesForRun(recipes, run, colorId);
  return approved.find((recipe) => (
    recipe.es_default && productScopes.has(recipe.producto_sku)
  )) || approved.find((recipe) => (
    recipe.es_default && !recipe.producto_sku
  )) || approved.find((recipe) => recipe.es_default) || null;
};
