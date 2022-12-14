import { Prisma } from "@prisma/client";
import { database } from "@self-learning/database";
import { createLessonMeta, lessonSchema } from "@self-learning/types";
import { getRandomId, paginate, Paginated, paginationSchema } from "@self-learning/util/common";
import { z } from "zod";
import { authProcedure, t } from "../trpc";

export const lessonRouter = t.router({
	findOneAllProps: authProcedure.input(z.object({ lessonId: z.string() })).query(({ input }) => {
		return database.lesson.findUniqueOrThrow({
			where: { lessonId: input.lessonId },
			include: {
				authors: {
					select: {
						slug: true
					}
				}
			}
		});
	}),
	findOne: authProcedure.input(z.object({ lessonId: z.string() })).query(({ input }) => {
		return database.lesson.findUniqueOrThrow({
			where: { lessonId: input.lessonId },
			select: { lessonId: true, title: true, slug: true, meta: true }
		});
	}),
	findMany: authProcedure
		.input(paginationSchema.extend({ title: z.string().optional() }))
		.query(async ({ input: { title, page } }) => {
			const pageSize = 15;
			const { lessons, count } = await findLessons({
				title,
				...paginate(pageSize, page)
			});
			return {
				result: lessons,
				totalCount: count,
				page,
				pageSize
			} satisfies Paginated<unknown>;
		}),
	create: authProcedure.input(lessonSchema).mutation(async ({ input }) => {
		const createdLesson = await database.lesson.create({
			data: {
				...input,
				quiz: input.quiz ? (input.quiz as Prisma.JsonObject) : Prisma.JsonNull,
				authors: {
					connect: input.authors.map(a => ({ slug: a.slug }))
				},
				content: input.content as Prisma.InputJsonArray,
				lessonId: getRandomId(),
				meta: createLessonMeta(input) as unknown as Prisma.JsonObject
			},
			select: {
				lessonId: true,
				slug: true,
				title: true
			}
		});

		console.log("[lessonRouter]: Created lesson", createdLesson);
		return createdLesson;
	}),
	edit: authProcedure
		.input(
			z.object({
				lessonId: z.string(),
				lesson: lessonSchema
			})
		)
		.mutation(async ({ input }) => {
			const updatedLesson = await database.lesson.update({
				where: { lessonId: input.lessonId },
				data: {
					...input.lesson,
					quiz: input.lesson.quiz
						? (input.lesson.quiz as Prisma.JsonObject)
						: Prisma.JsonNull,
					lessonId: input.lessonId,
					authors: {
						set: input.lesson.authors.map(a => ({ slug: a.slug }))
					},
					meta: createLessonMeta(input.lesson) as unknown as Prisma.JsonObject
				},
				select: {
					lessonId: true,
					slug: true,
					title: true
				}
			});

			console.log("[lessonRouter]: Updated lesson", updatedLesson);
			return updatedLesson;
		})
});

export async function findLessons({
	title,
	skip,
	take
}: {
	title?: string;
	skip?: number;
	take?: number;
}) {
	const where: Prisma.LessonWhereInput = {
		title:
			typeof title === "string" && title.length > 0
				? { contains: title, mode: "insensitive" }
				: undefined
	};

	const [lessons, count] = await database.$transaction([
		database.lesson.findMany({
			select: {
				lessonId: true,
				title: true,
				slug: true,
				updatedAt: true,
				authors: {
					select: {
						displayName: true,
						slug: true,
						imgUrl: true
					}
				}
			},
			orderBy: { updatedAt: "desc" },
			where,
			take,
			skip
		}),
		database.lesson.count({ where })
	]);

	return { lessons, count };
}
