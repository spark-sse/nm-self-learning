import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/solid";
import { database } from "@self-learning/database";
import { compileMarkdown, MdLookup, MdLookupArray } from "@self-learning/markdown";
import { Question, QuestionType, useQuizAttempt } from "@self-learning/quiz";
import { GetStaticPaths, GetStaticProps } from "next";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const text = `Lorem ipsum dolor sit amet consectetur adipisicing elit. Pariatur nostrum dolorem ### at placeat. Ad corrupti fugit, magnam ipsam iste similique voluptates. Doloribus repellat velit expedita molestias eaque consectetur nesciunt.
Temporibus, repellendus aspernatur provident unde ipsa voluptates delectus a adipisci itaque quam impedit suscipit harum illo voluptas saepe facere est distinctio non cum nesciunt. Dicta rerum dignissimos commodi cum molestias?
Quia nisi delectus quos, possimus eos id. Tempore iure sint harum nihil ### facilis expedita eveniet reprehenderit ipsa! Inventore ab similique, voluptatibus consectetur deleniti perspiciatis enim hic nesciunt, omnis sint blanditiis.
Expedita quo voluptatum, obcaecati accusamus in saepe esse maxime, neque soluta ### itaque! Aliquam est at dignissimos nobis illo delectus recusandae amet! ### beatae ea consequatur nobis natus repellendus vel!
// eslint-disable-next-line indent
Harum, adipisci vel corrupti, corporis error pariatur ad quasi quisquam, ### rem reiciendis! Repellendus velit minima veritatis vitae porro iure earum quas libero, error, qui exercitationem nihil et, cum veniam?`;

const textArray = text.split("###");

function getQuiz(slug: string): QuestionType[] {
	return [
		{
			type: "multiple-choice",
			questionId: "923d78a5-af38-4599-980a-2b4cb62e4014",
			statement: `
			# How way your day?

			Lorem ipsum dolor sit amet consectetur, adipisicing elit. Quasi molestias doloribus assumenda aspernatur in maxime numquam. Sint quas nobis voluptatum nemo consequatur aperiam ea sit eveniet, perferendis iure! Fugiat, optio!
			`.trim(),
			answers: [
				{
					answerId: "35d310ee-1acf-48e0-8f8c-090acd0e873a",
					content: "Good",
					isCorrect: true
				},
				{
					answerId: "cd33a2ef-95e8-4353-ad1d-de778d62ad57",
					content: "Bad",
					isCorrect: true
				}
			],
			hints: {
				content: [
					"Lorem ipsum dolor sit amet consectetur adipisicing elit. Libero laudantium sequi illo, veritatis labore culpa, eligendi, quod consequatur autem ad dolorem explicabo quos alias harum fuga sapiente reiciendis. Incidunt, voluptates.",
					"# Lorem ipsum dolor \n- Eins\n- Zwei"
				]
			},
			withCertainty: true
		},
		{
			type: "short-text",
			questionId: "edbcf6a7-f9e9-4efe-b7ed-2bd0096c4e1d",
			statement: "# Was ist 1 + 1 ?",
			answers: null,
			withCertainty: true
		},
		{
			type: "text",
			questionId: "34fca2c2-c547-4f66-9a4e-927770a55090",
			statement: "# Was ist 1 + 1 ?",
			answers: null,
			withCertainty: true
		},
		{
			type: "cloze",
			questionId: "49497f71-8ed2-44a6-b36c-a44a4b0617d1",
			statement: "# Lückentext",
			answers: null,
			withCertainty: false,
			textArray: textArray
		}
	];
}

type QuestionProps = {
	lesson: ResolvedValue<typeof getLesson>;
	questions: QuestionType[];
	markdown: {
		questionsMd: MdLookup;
		answersMd: MdLookup;
		hintsMd: MdLookupArray;
	};
};

export const getStaticProps: GetStaticProps<QuestionProps> = async ({ params }) => {
	const slug = params?.lessonSlug as string | undefined;

	if (!slug) {
		throw new Error("No [lessonSlug] provided.");
	}

	const lesson = await getLesson(slug);

	const questions = getQuiz(slug ?? "");

	const questionsMd: MdLookup = {};
	const answersMd: MdLookup = {};
	const hintsMd: MdLookupArray = {};

	for (const question of questions) {
		questionsMd[question.questionId] = await compileMarkdown(question.statement);

		if (question.hints && !question.hints.disabled) {
			hintsMd[question.questionId] = [];

			for (const hint of question.hints.content) {
				hintsMd[question.questionId].push(await compileMarkdown(hint));
			}
		}

		if (question.answers) {
			for (const answer of question.answers) {
				answersMd[answer.answerId] = await compileMarkdown(answer.content);
			}
		}
	}

	if (!slug) {
		throw new Error("No slug provided.");
	}

	return {
		notFound: !lesson,
		props: {
			lesson: lesson as Defined<typeof lesson>,
			questions: questions,
			markdown: {
				questionsMd,
				answersMd,
				hintsMd
			}
		}
	};
};

export const getStaticPaths: GetStaticPaths = () => {
	return { paths: [], fallback: "blocking" };
};

async function getLesson(slug: string | undefined) {
	return await database.lesson.findUnique({
		where: { slug },
		select: {
			lessonId: true,
			slug: true,
			title: true,
			quiz: true
		}
	});
}

export default function QuestionsPage({ lesson, questions, markdown }: QuestionProps) {
	const { slug, lessonId } = lesson;
	const [currentQuestion, setCurrentQuestion] = useState(questions[0]);
	const router = useRouter();
	const { index } = router.query;
	const [nextIndex, setNextIndex] = useState(1);

	// const { quizAttemptsInfo } = useQuizAttemptsInfo(
	// 	lesson.lessonId,
	// 	session?.user?.name as string
	// );

	function goToNextQuestion() {
		router.push(`/lessons/${slug}/quiz?index=${nextIndex}`, undefined, {
			shallow: true
		});
	}

	function goToPreviousQuestion() {
		router.push(`/lessons/${slug}/quiz?index=${nextIndex - 2}`, undefined, {
			shallow: true
		});
	}

	useEffect(() => {
		const indexNumber = Number(index);

		if (Number.isFinite(indexNumber) && indexNumber < questions.length) {
			setCurrentQuestion(questions[indexNumber]);
			setNextIndex(Number(index) + 1);
		} else {
			setCurrentQuestion(questions[0]);
			setNextIndex(1);
		}
	}, [index, questions]);

	return (
		<div className="bg-gray-50">
			<div className="grid items-start gap-16 bg-gray-50 px-4 pb-16 lg:px-0">
				<div className="mx-auto grid w-full max-w-3xl items-start gap-8">
					<QuestionNavigation
						lesson={lesson}
						amount={questions.length}
						current={nextIndex}
						hasPrevious={nextIndex > 1}
						hasNext={nextIndex < questions.length}
						goToNext={goToNextQuestion}
						goToPrevious={goToPreviousQuestion}
					/>
					<Question question={currentQuestion} markdown={markdown} />
				</div>
			</div>
		</div>
	);
}

function QuestionNavigation({
	lesson,
	current,
	amount,
	hasPrevious,
	hasNext,
	goToNext,
	goToPrevious
}: {
	lesson: QuestionProps["lesson"];
	current: number;
	amount: number;
	hasPrevious: boolean;
	hasNext: boolean;
	goToNext: () => void;
	goToPrevious: () => void;
}) {
	const { submitAnswers } = useQuizAttempt();
	const { data: session } = useSession({ required: true });

	return (
		<div className="flex flex-col gap-4 rounded-b-lg border-x border-b border-light-border bg-white p-4">
			<div className="flex flex-col gap-2">
				<h2 className="text-lg text-secondary">{lesson.title}</h2>
				<h1 className="text-4xl">Lernkontrolle</h1>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-6">
				<span>
					Frage {current} von {amount}
				</span>
				<div className="flex flex-wrap place-content-end gap-4">
					<button
						disabled={!hasPrevious}
						className="btn-stroked w-full sm:w-fit"
						onClick={goToPrevious}
					>
						<ChevronLeftIcon className="h-5" />
						<span>Vorherige Frage</span>
					</button>
					<button
						disabled={!hasNext}
						className="btn-primary w-full sm:w-fit"
						onClick={goToNext}
					>
						<span>Nächste Frage</span>
						<ChevronRightIcon className="h-5" />
					</button>
				</div>
				{/* <button
				className="btn-primary mt-8"
				onClick={() =>
					submitAnswers({
						username: session?.user?.name as string,
						lessonId: lesson.lessonId,
						answers: [],
						state: "COMPLETED"
					})
				}
			>
				Submit Answers
			</button> */}
			</div>
		</div>
	);
}