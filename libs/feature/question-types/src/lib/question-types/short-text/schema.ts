import { z } from "zod";
import { baseAnswerSchema, baseQuestionSchema } from "../../base-question";

export const shortTextQuestionSchema = baseQuestionSchema.extend({
	type: z.literal("short-text"),
	acceptedAnswers: z.array(
		z.object({
			acceptedAnswerId: z.string(),
			value: z.string()
		})
	)
});

export type ShortTextQuestion = z.infer<typeof shortTextQuestionSchema>;

export const shortTextAnswerSchema = baseAnswerSchema.extend({
	type: z.literal("short-text"),
	value: z.string()
});

export type ShortTextAnswer = z.infer<typeof shortTextAnswerSchema>;

export type ShortText = {
	type: "short-text";
	question: ShortTextQuestion;
	answer: ShortTextAnswer;
	evaluation: unknown;
};
