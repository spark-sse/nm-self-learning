import {
	toPlainText,
	markdownify,
	ExportFormat,
	liaScriptExport,
	IndentationLevels,
	LiaScriptSection,
	selectNarrator
} from "./low-level-api";
import { FullCourseExport as CourseWithLessons, FullCourseData } from "@self-learning/teaching";
import { LessonContent as LessonExport } from "@self-learning/lesson";
import { Quiz } from "@self-learning/quiz";

import { CourseChapter, LessonContent, findContentType } from "@self-learning/types";
import { ExportOptions } from "./types";

export function exportCourse(
	{ course, lessons }: CourseWithLessons,
	options: ExportOptions = {
		addTitlePage: true,
		language: "de",
		narrator: "female",
		considerTopics: true,
		exportMailAddresses: true
	}
) {
	console.log(">Exporting course", course, lessons);
	const json: ExportFormat = {
		// The list of supported items are documented here:
		// https://liascript.github.io/course/?https://raw.githubusercontent.com/liaScript/docs/master/README.md#176
		meta: {
			title: course.title,
			author: course.authors.map(author => author.displayName).join(", "),
			...(options.exportMailAddresses && {
				email: course.authors.map(author => author.user.email).join(", ")
			}),
			date: new Date().toLocaleDateString(),
			version: "1.0",
			narrator: selectNarrator(options),
			...(course.description && { comment: toPlainText(course.description) }),
			...(course.imgUrl && { logo: course.imgUrl })
		},
		sections: []
	};

	if (options.addTitlePage) {
		addTitlePage(course, json.sections, options);
	}

	const lessonsMap = new Map<string, LessonExport>();
	for (const lesson of lessons) {
		console.log(">>Adding a lesson to map?", lesson.title);
		lessonsMap.set(lesson.lessonId, lesson);
	}
	for (const chapter of course.content as CourseChapter[]) {
		console.log(">>Adding a chapter", chapter.title); //Chapters are collections of lessons.
		const baseIndent = options.addTitlePage ? 2 : 1;

		addSection(chapter, lessonsMap, baseIndent, json.sections);
	}

	return liaScriptExport(json);
}

/**
 * Generates a title page for the course (indented by 1). This includes:
 * - Title
 * - Subtitle (optional)
 * - Picture (optional)
 * - Description (optional)
 * - Subject (optional)
 * - Specializations (optional)
 * @param course The course to export
 * @param sections The data used to generate the LiaScript export (will be altered as a side effect)
 * @param options The options to consider
 */
function addTitlePage(
	course: FullCourseData,
	sections: LiaScriptSection[],
	options: ExportOptions
) {
	console.log(">>Adding a title page");
	const section = {
		title: course.title,
		indent: 1 as IndentationLevels,
		body: [] as string[]
	};

	// Support that subtile may become optional in future
	course.subtitle && section.body.push(markdownify(course.subtitle));
	// Add (optional) picture after subtitle before (optional) description
	course.imgUrl && section.body.push(`![Course Logo](${course.imgUrl})`);
	course.description && section.body.push(markdownify(course.description));

	// Add subject and specializations
	if (options.considerTopics) {
		course.subject && section.body.push(`**Fach:** ${course.subject.title}`);

		if (course.specializations.length > 0) {
			const topic =
				course.specializations.length > 1 ? "Spezialisierungen" : "Spezialisierung";
			section.body.push(
				`**${topic}:** ${course.specializations.map(s => s.title).join(", ")}`
			);
		}
	}
	sections.push(section);
}

function addSection(
	chapter: CourseChapter,
	lessons: Map<string, LessonExport>,
	indent: IndentationLevels,
	sections: LiaScriptSection[]
) {
	console.log(">>>Adding a section", chapter.title);
	const section = {
		title: chapter.title,
		indent: indent,
		body: [] as (string | object)[]
	};

	if (chapter.description) {
		const description = markdownify(chapter.description);
		section.body.push(description);
	}

	sections.push(section);

	chapter.content.forEach(entry => {
		const lesson = lessons.get(entry.lessonId);
		if (lesson) {
			const lessonIndent = indent < 6 ? ((indent + 1) as IndentationLevels) : 6;
			addLesson(lesson, lessonIndent, sections);
		}
	});
}

function addLesson(lesson: LessonExport, indent: IndentationLevels, sections: LiaScriptSection[]) {
	const nm = {
		title: lesson.title,
		indent: indent,
		body: [] as string[]
	};

	// Lesson's overview page, may contain:
	// - Sub title
	// - Description
	// - Self-regulated question
	lesson.subtitle && nm.body.push(markdownify(lesson.subtitle));
	lesson.description && nm.body.push(markdownify(lesson.description));
	lesson.selfRegulatedQuestion &&
		nm.body.push(markdownify(`Aktivierungsfrage: ${lesson.selfRegulatedQuestion}`));
	sections.push(nm);

	const lessonContent = lesson.content as LessonContent;

	const video = findContentType("video", lessonContent);
	if (video.content) {
		const videoIndent = indent < 6 ? ((indent + 1) as IndentationLevels) : 6;
		const videoPart = {
			title: "Video",
			indent: videoIndent,
			body: [`!?[Video](${video.content.value.url})`]
		};

		sections.push(videoPart);
	}

	const article = findContentType("article", lessonContent);
	if (article.content) {
		const articleIndent = indent < 6 ? ((indent + 1) as IndentationLevels) : 6;
		const articlePart = {
			title: "Artikel",
			indent: articleIndent,
			body: [markdownify(article.content.value.content, { htmlTag: "section" })]
		};

		sections.push(articlePart);
	}

	const pdf = findContentType("pdf", lessonContent);
	if (pdf.content) {
		const pdfIndent = indent < 6 ? ((indent + 1) as IndentationLevels) : 6;
		const pdfPart = {
			title: "PDF",
			indent: pdfIndent,
			body: [pdf.content.value.url]
		};

		sections.push(pdfPart);
	}

	if (lesson.quiz) {
		console.log(">>>Creating a Quiz !!");
		const quizIndent = indent < 6 ? ((indent + 1) as IndentationLevels) : 6;
		const quizPart = {
			title: "Lernzielkontrolle",
			indent: quizIndent,
			body: [] as string[]
		};

		const quiz = lesson.quiz as Quiz;
		for (const question of quiz.questions) {
			console.log(question);
			switch (question.type) {
				case "multiple-choice": {
					let answers = "";
					for (const answer of question.answers) {
						if (answer.isCorrect) {
							answers += `- [[x]] ${markdownify(answer.content)}\n`;
						} else {
							answers += `- [[ ]] ${markdownify(answer.content)}\n`;
						}
					}
					const hints = addHints(question.hints);
					quizPart.body.push(markdownify(question.statement + "\n\n" + answers + hints));
					break;
				}
				case "exact": {
					const answers = `- [[${markdownify(question.acceptedAnswers[0].value)}]]\n`;
					const hints = addHints(question.hints);
					const answerScript = addTextQuizOptionScript(question.acceptedAnswers);
					quizPart.body.push(
						markdownify(question.statement + "\n\n" + answers + hints + answerScript)
					);
					break;
				}
				case "text": {
					// As we have no "correct" answer for this, we just use a text input which cannot be wrong.
					const answers = `- [[Freitext]]\n`;
					const hints = addHints(question.hints);
					const answerScript = `<script>\nlet input = "@input".trim()\ninput != ""</script>\n`;
					quizPart.body.push(
						markdownify(question.statement + "\n\n" + answers + hints + answerScript)
					);
					break;
				}
				case "cloze":
					{
						console.log("Cloze Question: ", question);
						let answer = question.clozeText;
						answer = addClozeQuiz(answer);
						quizPart.body.push(markdownify(question.statement + "\n\n" + answer));
					}
					break;
				case "programming":
					{
						console.log("PRogramming Question: ", question);
					}
					break;
				default:
					console.log(`Unknown question type: ${question.type}`);
					break;
			}
		}

		sections.push(quizPart);
	}
}
function addHints(hints: { hintId: string; content: string }[]) {
	let hintsList = "";
	for (const hint of hints) {
		console.log("Writing a Hint to Console: ", hint);
		hintsList += `[[?]] ${toPlainText(hint.content)}\n`;
	}
	console.log("Hints: ", hintsList);
	return hintsList;
}

function addTextQuizOptionScript(acceptedAnswers: { value: string; acceptedAnswerId: string }[]) {
	let script = `<script>\n`;
	script += `let input = "@input".trim()\n`;
	for (const [i, answer] of acceptedAnswers.entries()) {
		if (i == acceptedAnswers.length - 1) {
			script += `input == "${answer.value}"\n`;
		} else {
			script += `input == "${answer.value}" ||`;
		}
	}
	script += `</script>\n`;
	return script;
}

function addClozeQuiz(text: string) {
	//const text = "Das ist eine {T: [Textantwort]}. Das ist ein Textfeld {T: [Antwort, Lücke]} mit zwei richtigen Möglichkeiten.Das ist ein Single-Choice Feld mit {C: [#eins, zwei]} Antwortmöglichkeiten, aus denen ausgewählt werden muss. Falsche Antworten werden mit einem # gekennzeichnet.LaTeX kann verwendet werden, um mathematische Formeln und Symbole darzustellen. Zum Beispiel: $$V_{sphere} = \frac{4}{3}\pi r^3$$. Es kann auch in Single-Choice Feldern benutzt werden: {C: [#eins, $$V_{sphere} = \frac{4}{3}\pi r^3$$]}"
	let chars = [...text];
	let start = 0;
	let index = 0;
	let indexEnd = 0;
	let found = 0;
	let conf = 0;
	let reducedToN = false;
	for (let i = 0; i < chars.length; i++) {
		if (chars[i] == `}`) {
			start--;
			if (start <= 0) {
				start = 0;
				if (conf == 1) {
					reducedToN = true;
				}
			}
		}
		if (start == 1 && found == 0 && chars[i] != `T` && chars[i] != `C` && chars[i] != " ") {
			start = 0;
			index = 0;
		} else if (start == 1 && found == 0) {
			found++;
		}
		if (start == 1 && found == 1 && conf == 0 && chars[i] != `:`) {
			if (chars[i] != `C` && chars[i] != `T` && chars[i] != " ") {
				start = 0;
				found = 0;
				index = 0;
			}
		} else if (start == 1 && found == 1 && conf == 0) {
			conf++;
		}

		if (chars[i] == `{`) {
			start++;
			if (start == 1) {
				index = i;
			}
		}
		if (reducedToN) {
			indexEnd = i + 1;
			let newString = text.substring(index, indexEnd).replace(/(?<!\\)([\]|[])/g, ``); //remove the unneeded [ ]
			newString = newString.replace(`{`, `[[`); //Matches and substitutes the first { for the needed [[
			newString = newString.replace(/}(?=[^}]*$)/, `]]`); //Matches and replaced only the last } with ]]
			const cmatch = newString.match(/C:/); // prepare for selection type word
			newString = newString.replace(/[T|C]:/g, ``); // removes the unneeded T and C starters
			if (cmatch != null) {
				const word = newString.match(/(?<=\[\[)(.*?)(?=,)/g);
				if (word != null) {
					const strWord = word.join(" ");
					const start = newString.indexOf(strWord);
					const end = start + strWord.length;
					newString =
						newString.slice(0, start) +
						`(` +
						newString.slice(start, end) +
						`)` +
						newString.slice(end);
				}
			}
			newString = newString.replace(/,/g, `|`); // replace all , with |
			reducedToN = false;
			text = text.slice(0, index) + newString + text.slice(indexEnd);
			indexEnd = 0;
			found = 0;
			conf = 0;
			chars = [...text];
		}
	}
	return text;
}