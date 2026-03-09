declare module "astro:actions" {
	type Actions = typeof import("/workspace/src/actions/index.ts")["server"];

	export const actions: Actions;
}