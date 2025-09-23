declare module 'astro:content' {
	interface Render {
		'.mdx': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
			components: import('astro').MDXInstance<{}>['components'];
		}>;
	}
}

declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"chapters": {
"demo/best-pratices.mdx": {
	id: "demo/best-pratices.mdx";
  slug: "demo/best-pratices";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/components.mdx": {
	id: "demo/components.mdx";
  slug: "demo/components";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/debug-components.mdx": {
	id: "demo/debug-components.mdx";
  slug: "demo/debug-components";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/getting-started.mdx": {
	id: "demo/getting-started.mdx";
  slug: "demo/getting-started";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/greetings.mdx": {
	id: "demo/greetings.mdx";
  slug: "demo/greetings";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/introduction.mdx": {
	id: "demo/introduction.mdx";
  slug: "demo/introduction";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/latex-convertion.mdx": {
	id: "demo/latex-convertion.mdx";
  slug: "demo/latex-convertion";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/markdown.mdx": {
	id: "demo/markdown.mdx";
  slug: "demo/markdown";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/vibe-coding-charts.mdx": {
	id: "demo/vibe-coding-charts.mdx";
  slug: "demo/vibe-coding-charts";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"demo/writing-your-content.mdx": {
	id: "demo/writing-your-content.mdx";
  slug: "demo/writing-your-content";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
"your-first-chapter.mdx": {
	id: "your-first-chapter.mdx";
  slug: "your-first-chapter";
  body: string;
  collection: "chapters";
  data: any
} & { render(): Render[".mdx"] };
};
"embeds": {
"vibe-code-d3-embeds-directives.md": {
	id: "vibe-code-d3-embeds-directives.md";
  slug: "vibe-code-d3-embeds-directives";
  body: string;
  collection: "embeds";
  data: any
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		"assets": {
"data/data": {
	id: "data/data";
  collection: "assets";
  data: any
};
"data/font-sprite-mapping": {
	id: "data/font-sprite-mapping";
  collection: "assets";
  data: any
};
"data/font_manifest": {
	id: "data/font_manifest";
  collection: "assets";
  data: any
};
"data/llm_benchmarks": {
	id: "data/llm_benchmarks";
  collection: "assets";
  data: any
};
"data/mnist-variant-model": {
	id: "data/mnist-variant-model";
  collection: "assets";
  data: any
};
"data/typography_data": {
	id: "data/typography_data";
  collection: "assets";
  data: any
};
};

	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = never;
}
