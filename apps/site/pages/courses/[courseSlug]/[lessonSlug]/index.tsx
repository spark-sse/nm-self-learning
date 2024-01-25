import { CheckCircleIcon, PlayIcon } from "@heroicons/react/solid";
import { LessonType } from "@prisma/client";
import { trpc } from "@self-learning/api-client";
import { useCourseCompletion, useMarkAsCompleted } from "@self-learning/completion";
import {
	getStaticPropsForLayout,
	LessonLayout,
	LessonLayoutProps,
	useLessonContext
} from "@self-learning/lesson";
import { CompiledMarkdown, compileMarkdown } from "@self-learning/markdown";
import {
	findContentType,
	getContentTypeDisplayName,
	includesMediaType,
	LessonContent,
	LessonMeta
} from "@self-learning/types";
import { AuthorsList, LicenseChip, LoadingBox, Tab, Tabs } from "@self-learning/ui/common";
import { LabeledField } from "@self-learning/ui/forms";
import { MarkdownContainer } from "@self-learning/ui/layouts";
import { PdfViewer, VideoPlayer } from "@self-learning/ui/lesson";
import { GetServerSideProps } from "next";
import { MDXRemote } from "next-mdx-remote";
import Link from "next/link";
import { useRouter } from "next/router";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

export type LessonProps = LessonLayoutProps & {
	markdown: {
		description: CompiledMarkdown | null;
		article: CompiledMarkdown | null;
		preQuestion: CompiledMarkdown | null;
		subtitle: CompiledMarkdown | null;
	};
};

export const getServerSideProps: GetServerSideProps<LessonProps> = async ({ params }) => {
	const props = await getStaticPropsForLayout(params);

	if ("notFound" in props) return { notFound: true };

	const { lesson } = props;

	lesson.quiz = null; // Not needed on this page, but on /quiz
	let mdDescription = null;
	let mdArticle = null;
	let mdQuestion = null;
	let mdSubtitle = null;

	if (lesson.description) {
		mdDescription = await compileMarkdown(lesson.description);
	}

	if (lesson.subtitle && lesson.subtitle.length > 0) {
		mdSubtitle = await compileMarkdown(lesson.subtitle);
	}

	const { content: article } = findContentType("article", lesson.content as LessonContent);

	if (article) {
		mdArticle = await compileMarkdown(article.value.content ?? "Kein Inhalt.");

		// Remove article content to avoid duplication
		article.value.content = "(replaced)";
	}

	// TODO change to check if the lesson is self requlated
	if (lesson.lessonType === LessonType.SELF_REGULATED) {
		mdQuestion = await compileMarkdown(lesson.selfRegulatedQuestion ?? "Kein Inhalt.");
	}

	return {
		props: {
			...props,
			markdown: {
				article: mdArticle,
				description: mdDescription,
				preQuestion: mdQuestion,
				subtitle: mdSubtitle
			}
		}
	};
};

function usePreferredMediaType(lesson: LessonProps["lesson"]) {
	// Handle situations that content creator may created an empty lesson (to add content later)
	const content = lesson.content as LessonContent;
	const router = useRouter();
	const [preferredMediaType, setPreferredMediaType] = useState(
		content.length > 0 ? content[0].type : null
	);

	useEffect(() => {
		if (content.length > 0) {
			const availableMediaTypes = content.map(c => c.type);

			const { type: typeFromRoute } = router.query;
			let typeFromStorage: string | null = null;

			if (typeof window !== "undefined") {
				typeFromStorage = window.localStorage.getItem("preferredMediaType");
			}

			const { isIncluded, type } = includesMediaType(
				availableMediaTypes,
				(typeFromRoute as string) ?? typeFromStorage
			);

			if (isIncluded) {
				setPreferredMediaType(type);
			}
		}
	}, [router, content]);
	return preferredMediaType;
}

export default function Lesson({ lesson, course, markdown }: LessonProps) {
	// Learning Analytics: navigate from page
	const router = useRouter();
	useEffect(() => {
		const navigateFromPage = () => {
			const lALessonInfo = JSON.parse(localStorage.getItem("la_lessonInfo") + "");
			if (lALessonInfo && lALessonInfo != "") {
				lALessonInfo.end = "" + new Date();
				window.localStorage.setItem("la_lessonInfo", JSON.stringify(lALessonInfo));
			}
		};
		router.events.on("routeChangeStart", navigateFromPage);
		return () => {
			router.events.off("routeChangeStart", navigateFromPage);
		};
	}, [router.events]);

	const [showDialog, setShowDialog] = useState(lesson.lessonType === LessonType.SELF_REGULATED);

	const { content: video } = findContentType("video", lesson.content as LessonContent);
	const { content: pdf } = findContentType("pdf", lesson.content as LessonContent);

	const preferredMediaType = usePreferredMediaType(lesson);

	// Learning Analytics: init or save lesson info
	useEffect(() => {
		if (window !== undefined) {
			const lALessonInfo = JSON.parse(localStorage.getItem("la_lessonInfo") + "");
			if (lALessonInfo && lALessonInfo != "") {
				if (lALessonInfo.lessonId != lesson.lessonId) {
					//ToDo Save
					window.localStorage.setItem(
						"la_lessonInfo",
						JSON.stringify({
							lessonId: lesson.lessonId,
							start: "" + new Date(),
							end: ""
						})
					);
				}
			} else {
				window.localStorage.setItem(
					"la_lessonInfo",
					JSON.stringify({
						lessonId: lesson.lessonId,
						start: "" + new Date(),
						end: ""
					})
				);
			}
		}
	}, [lesson.lessonId]);

	if (showDialog && markdown.preQuestion) {
		return (
			<article className="flex flex-col gap-4">
				<SelfRegulatedPreQuestion
					setShowDialog={setShowDialog}
					question={markdown.preQuestion}
				/>
			</article>
		);
	}

	return (
		<article className="flex flex-col gap-4">
			{preferredMediaType === "video" && (
				<div className="aspect-video w-full xl:max-h-[75vh]">
					{video?.value.url ? (
						<VideoPlayer url={video.value.url} />
					) : (
						<div className="py-16 text-center text-red-500">Error: Missing URL</div>
					)}
				</div>
			)}

			<LessonHeader
				lesson={lesson}
				course={course}
				mdDescription={markdown.description}
				mdSubtitle={markdown.subtitle}
			/>

			{preferredMediaType === "article" && markdown.article && (
				<MarkdownContainer className="mx-auto w-full pt-4">
					<MDXRemote {...markdown.article} />
				</MarkdownContainer>
			)}

			{preferredMediaType === "pdf" && pdf?.value.url && (
				<div className="h-[90vh] xl:h-[80vh]">
					<PdfViewer url={pdf.value.url} />
				</div>
			)}
		</article>
	);
}

Lesson.getLayout = LessonLayout;

function LessonHeader({
	course,
	lesson,
	mdDescription,
	mdSubtitle
}: {
	course: LessonProps["course"];
	lesson: LessonProps["lesson"];
	mdDescription?: CompiledMarkdown | null;
	mdSubtitle?: CompiledMarkdown | null;
}) {
	const { chapterName } = useLessonContext(lesson.lessonId, course.slug);

	let license = lesson.license;
	if (license === null) {
		license = trpc.licenseRouter.getDefault.useQuery().data ?? null;
	}

	return (
		<div className="flex flex-col gap-8">
			<div className="flex flex-wrap justify-between gap-4">
				<div className="flex w-full flex-col">
					<span className="flex flex-wrap-reverse justify-between gap-4">
						<span className="flex flex-col gap-2">
							<span className="font-semibold text-secondary">{chapterName}</span>
							<h1 className="text-4xl">{lesson.title}</h1>
						</span>
						<LessonControls course={course} lesson={lesson} />
					</span>
					{mdSubtitle && (
						<MarkdownContainer className="mt-2 text-light">
							<MDXRemote {...mdSubtitle} />
						</MarkdownContainer>
					)}

					<span className="flex flex-wrap-reverse justify-between gap-4">
						<span className="flex flex-col gap-3">
							<Authors authors={lesson.authors} />
						</span>
						<LicenseLabel license={license} />
					</span>

					<div className="pt-4">
						<MediaTypeSelector lesson={lesson} course={course} />
					</div>
				</div>
			</div>

			{mdDescription && (
				<MarkdownContainer className="mx-auto pb-4">
					<MDXRemote {...mdDescription} />
				</MarkdownContainer>
			)}
		</div>
	);
}

function LessonControls({
	course,
	lesson
}: {
	course: LessonProps["course"];
	lesson: LessonProps["lesson"];
}) {
	const markAsCompleted = useMarkAsCompleted(lesson.lessonId, course.slug);
	const completion = useCourseCompletion(course.slug);
	const isCompletedLesson = !!completion?.completedLessons[lesson.lessonId];
	const hasQuiz = (lesson.meta as LessonMeta).hasQuiz;

	return (
		<div className="flex w-full flex-wrap gap-2 xl:w-fit xl:flex-row">
			{hasQuiz && (
				<Link
					href={`/courses/${course.slug}/${lesson.slug}/quiz`}
					className="btn-primary flex h-fit w-full flex-wrap-reverse text-sm xl:w-fit"
					data-testid="quizLink"
				>
					<span>Zur Lernkontrolle</span>
					<PlayIcon className="h-6 shrink-0" />
				</Link>
			)}

			{!hasQuiz && !isCompletedLesson && (
				<button
					className="btn-primary flex h-fit w-full flex-wrap-reverse text-sm xl:w-fit"
					onClick={markAsCompleted}
				>
					<span>Als abgeschlossen markieren</span>
					<CheckCircleIcon className="h-6 shrink-0" />
				</button>
			)}
		</div>
	);
}

function Authors({ authors }: { authors: LessonProps["lesson"]["authors"] }) {
	return (
		<>
			{authors.length > 0 && (
				<div className="mt-4">
					<AuthorsList authors={authors} />
				</div>
			)}
		</>
	);
}

export function LicenseLabel({ license }: { license: LessonProps["lesson"]["license"] }) {
	if (license === null) {
		return <LoadingBox />;
	}
	if (license.url) {
		return (
			<div className="-mt-3">
				<LabeledField label="Lizenz">
					<LicenseChip name={license.name} imgUrl={license.logoUrl} url={license.url} />
				</LabeledField>
			</div>
		);
	} else {
		return (
			<div className="-mt-3">
				<LabeledField label="Lizenz">
					<LicenseChip
						name={license.name}
						imgUrl={license.logoUrl}
						description={license.licenseText !== null ? license.licenseText : undefined}
					/>
				</LabeledField>
			</div>
		);
	}
}

function MediaTypeSelector({
	lesson,
	course
}: {
	course: LessonProps["course"];
	lesson: LessonProps["lesson"];
}) {
	const lessonContent = lesson.content as LessonContent;
	// If no content is specified at this time, use video as default (and don't s´display anything)
	const preferredMediaType = usePreferredMediaType(lesson) ?? "video";
	const { index } = findContentType(preferredMediaType, lessonContent);
	const [selectedIndex, setSelectedIndex] = useState(index);
	const router = useRouter();

	// Learning Analytics: number of changes of the media type and preferred media type
	const [numberOfChangesMediaType, setNumberOfChangesMediaType] = useState({
		video: preferredMediaType == "video" ? 1 : 0,
		article: preferredMediaType == "article" ? 1 : 0,
		pdf: preferredMediaType == "pdf" ? 1 : 0,
		iframe: preferredMediaType == "iframe" ? 1 : 0
	});

	useEffect(() => {
		const numberOfChanges = JSON.parse(
			window.localStorage.getItem("la_numberOfChangesMediaType") + ""
		);
		if (numberOfChanges && numberOfChanges != "") {
			setNumberOfChangesMediaType(numberOfChanges);
		}
	}, []);

	function addNumberOfChangesMediaType(type: string) {
		if (typeof window !== "undefined") {
			switch (type) {
				case "pdf":
					setNumberOfChangesMediaType(numberOfChangesMediaType => ({
						...numberOfChangesMediaType,
						pdf: numberOfChangesMediaType.pdf + 1
					}));
					break;
				case "iframe":
					setNumberOfChangesMediaType(numberOfChangesMediaType => ({
						...numberOfChangesMediaType,
						iframe: numberOfChangesMediaType.iframe + 1
					}));
					break;
				case "video":
					setNumberOfChangesMediaType(numberOfChangesMediaType => ({
						...numberOfChangesMediaType,
						video: numberOfChangesMediaType.video + 1
					}));
					break;
				case "article":
					setNumberOfChangesMediaType(numberOfChangesMediaType => ({
						...numberOfChangesMediaType,
						article: numberOfChangesMediaType.article + 1
					}));
					break;
			}

			window.localStorage.setItem(
				"la_numberOfChangesMediaType",
				JSON.stringify(numberOfChangesMediaType)
			);
		}
	}
	// Learning Analytics: end

	function changeMediaType(index: number) {
		const type = lessonContent[index].type;

		window.localStorage.setItem("preferredMediaType", type);

		router.push(`/courses/${course.slug}/${lesson.slug}?type=${type}`, undefined, {
			shallow: true
		});
		addNumberOfChangesMediaType(type);
		setSelectedIndex(index);
	}

	useEffect(() => {
		if (selectedIndex !== index) {
			setSelectedIndex(index);
		}
	}, [index, selectedIndex, setSelectedIndex]);

	return (
		<>
			{lessonContent.length > 1 && (
				<Tabs selectedIndex={selectedIndex} onChange={changeMediaType}>
					{lessonContent.map((content, idx) => (
						<Tab key={idx}>
							<span data-testid="mediaTypeTab">
								{getContentTypeDisplayName(content.type)}
							</span>
						</Tab>
					))}
				</Tabs>
			)}
		</>
	);
}

function SelfRegulatedPreQuestion({
	question,
	setShowDialog
}: {
	question: CompiledMarkdown;
	setShowDialog: Dispatch<SetStateAction<boolean>>;
}) {
	const [userAnswer, setUserAnswer] = useState("");

	return (
		<>
			<div>
				<h1>Aktivierungsfrage</h1>
				<MarkdownContainer className="w-full py-4">
					<MDXRemote {...question} />
				</MarkdownContainer>
				<div className="mt-8">
					<h2>Deine Antwort:</h2>
					<textarea
						className="w-full"
						placeholder="..."
						onChange={e => setUserAnswer(e.target.value)}
					/>
				</div>
				<div className="mt-2 flex justify-end gap-2">
					<button
						type="button"
						className="btn-primary"
						onClick={() => {
							setShowDialog(false);
						}}
						disabled={userAnswer.length == 0}
					>
						Antwort Speichern
					</button>
				</div>
			</div>
		</>
	);
}
