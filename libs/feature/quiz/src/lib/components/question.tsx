import type { CompiledMarkdown, MdLookup, MdLookupArray } from "@self-learning/markdown";
import {
	AnswerContextProvider,
	EVALUATION_FUNCTIONS,
	MultipleChoiceAnswer,
	ProgrammingAnswer,
	QuestionType,
	ShortTextAnswer,
	TextAnswer,
	useQuestion,
	VorwissenAnswer
} from "@self-learning/question-types";
import { CenteredContainer, MarkdownContainer } from "@self-learning/ui/layouts";
import { MDXRemote } from "next-mdx-remote";
import { Dispatch, SetStateAction, useState } from "react";
import { Certainty } from "./certainty";
import { Hints } from "./hints";

export function Question({
	question,
	markdown
}: {
	question: QuestionType;
	markdown: {
		questionsMd: MdLookup;
		answersMd: MdLookup;
		hintsMd: MdLookupArray;
	};
}) {
	const [evaluation, setEvaluation] = useState<unknown | null>(null);
	const [usedHints, setUsedHints] = useState<CompiledMarkdown[]>([]);
	const hintsAvailable = question.hints && question.hints.length > 0;
	const allHints = markdown.hintsMd[question.questionId] ?? [];

	function useHint() {
		const nextHintIndex = usedHints.length;

		if (nextHintIndex < allHints.length) {
			const nextHint = markdown.hintsMd[question.questionId][nextHintIndex];
			setUsedHints(prev => [...prev, nextHint]);
		}
	}

	return (
		<AnswerContextProvider
			question={question}
			markdown={markdown}
			evaluation={evaluation}
			setEvaluation={setEvaluation}
		>
			<article className="flex flex-col gap-8">
				<div>
					<div className="flex items-center justify-between">
						<span className="font-semibold text-secondary">{question.type}</span>
						<div className="flex gap-4">
							<button
								className="btn-stroked h-fit"
								onClick={() => setEvaluation(null)}
							>
								Reset
							</button>
							<CheckResult setEvaluation={setEvaluation} />
						</div>
					</div>
					{markdown.questionsMd[question.questionId] ? (
						<MarkdownContainer>
							<MDXRemote {...markdown.questionsMd[question.questionId]} />
						</MarkdownContainer>
					) : (
						<span className="text-red-500">Error: No markdown content found.</span>
					)}
				</div>

				<div className="flex max-w-full flex-col gap-8">
					<Answer question={question} />
				</div>

				{question.withCertainty && <Certainty />}

				{hintsAvailable && (
					<Hints
						totalHintsCount={allHints.length}
						usedHints={usedHints}
						useHint={useHint}
					/>
				)}
			</article>
		</AnswerContextProvider>
	);
}

function CheckResult({
	setEvaluation
}: {
	setEvaluation: Dispatch<SetStateAction<unknown | null>>;
}) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { question, answer } = useQuestion(null as any);

	function checkResult() {
		console.log("checking...");
		const evaluation = EVALUATION_FUNCTIONS[question.type](
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			question as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			answer as any
		);
		console.log("question", question);
		console.log("answer", answer);
		console.log("evaluation", evaluation);
		setEvaluation(evaluation);
	}

	return (
		<button className="btn-primary" onClick={checkResult}>
			Überprüfen
		</button>
	);
}

function Answer({ question }: { question: QuestionType }) {
	// Works, but prevents HMR :(
	// const component = QUESTION_ANSWER_COMPONENTS[question.type];

	// if (component) {
	// 	return component();
	// }

	if (question.type === "programming") {
		return <ProgrammingAnswer />;
	}

	if (question.type === "multiple-choice") {
		return <MultipleChoiceAnswer />;
	}

	if (question.type === "short-text") {
		return <ShortTextAnswer />;
	}

	if (question.type === "text") {
		return <TextAnswer />;
	}

	if (question.type === "vorwissen") {
		return <VorwissenAnswer />;
	}

	return (
		<CenteredContainer className="text-red-500">
			Error: No implementation found for "{(question as { type: string }).type}".
		</CenteredContainer>
	);
}
