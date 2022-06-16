import { CompiledMarkdown } from "@self-learning/markdown";
import { Article } from "@self-learning/types";
import { SectionCard } from "@self-learning/ui/common";
import { EditorField } from "@self-learning/ui/forms";
import { MDXRemote } from "next-mdx-remote";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import { SetValueFn } from "../lesson-content";

const cacheKey = ["mdx-article"];

export function ArticleInput({
	index,
	onRemove,
	article,
	setValue
}: {
	index: number;
	setValue: SetValueFn;
	article: Article;
	onRemove: () => void;
}) {
	const {
		data: preview,
		isLoading,
		isRefetching,
		error
	} = useQuery(cacheKey, () => fetchPreview(article.value.content ?? ""));

	useDebouncedPreview(article.value.content, cacheKey);

	const [height, setHeight] = useState("500px");

	return (
		<div className="mx-auto w-[90vw]">
			<SectionCard title="Artikel" subtitle="Schreibe einen Artikel. Unterstützt Markdown.">
				<div className="flex flex-col">
					<button
						className="absolute top-8 right-8 w-fit text-sm text-red-500"
						onClick={onRemove}
					>
						Entfernen
					</button>

					<button
						onClick={() => setHeight(prev => (prev === "500px" ? "75vh" : "500px"))}
						className="self-start text-sm text-secondary"
					>
						{height === "500px" ? "Ansicht vergrößern" : "Ansicht verkleinern"}
					</button>

					<div className="mt-4 grid grid-cols-2 items-start gap-8">
						<EditorField
							label="Inhalt"
							language="markdown"
							onChange={value => setValue(article.type, { content: value }, index)}
							value={article.value.content}
							height={height}
						/>

						<div className="flex h-full w-full flex-col gap-2">
							<label className="text-sm font-semibold">Preview</label>
							<div
								className="relative flex w-full grow overflow-auto border border-light-border p-8"
								style={{ maxHeight: height }}
							>
								{(isLoading || isRefetching) && (
									<span className="absolute top-2 left-2 text-sm text-light">
										{isLoading || isRefetching ? "Compiling..." : ""}
									</span>
								)}
								{error && (
									<pre className="text-xs text-red-500">
										{JSON.stringify(error)}
									</pre>
								)}
								<div className="prose w-full">
									{preview && <MDXRemote {...preview} />}
								</div>
							</div>
						</div>
					</div>
				</div>
			</SectionCard>
		</div>
	);
}

function useDebouncedPreview(content: string | undefined, cacheKey: string[]) {
	const queryClient = useQueryClient();

	useEffect(
		() => {
			// Update debounced value after delay
			const handler = setTimeout(() => {
				queryClient.invalidateQueries(cacheKey);
			}, 500);

			// Cancel the timeout if value changes (also on delay change or unmount)
			// This is how we prevent debounced value from updating if value is changed ...
			// .. within the delay period. Timeout gets cleared and restarted.
			return () => {
				clearTimeout(handler);
			};
		},
		[content, queryClient, cacheKey] // Only re-call effect if value or delay changes
	);
}

async function fetchPreview(content: string) {
	if (content === "") {
		return null;
	}

	const response = await fetch("/api/teachers/mdx", {
		method: "PUT",
		body: content
	});

	if (!response.ok) {
		// eslint-disable-next-line no-throw-literal
		throw { status: response.status, statusText: response.statusText };
	}

	return (await response.json()) as CompiledMarkdown;
}
