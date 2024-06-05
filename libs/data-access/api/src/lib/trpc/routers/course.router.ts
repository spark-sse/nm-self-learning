import { Prisma } from "@prisma/client";
import { database } from "@self-learning/database";
import {
	courseFormSchema,
	getFullCourseExport,
	mapCourseFormToInsert,
	mapCourseFormToUpdate
} from "@self-learning/teaching";
import {
	CompletedLessonsMap,
	CourseCompletion,
	CourseContent,
	extractLessonIds,
	LessonMeta
} from "@self-learning/types";
import { getRandomId, paginate, Paginated, paginationSchema } from "@self-learning/util/common";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authProcedure, t, UserFromSession } from "../trpc";

export const courseRouter = t.router({
	findMany: t.procedure
		.input(
			paginationSchema.extend({
				title: z.string().optional(),
				specializationId: z.string().optional()
			})
		)
		.query(async ({ input }) => {
			const pageSize = 15;

			const where: Prisma.CourseWhereInput = {
				title:
					input.title && input.title.length > 0
						? { contains: input.title, mode: "insensitive" }
						: undefined,
				specializations: input.specializationId
					? {
							some: {
								specializationId: input.specializationId
							}
					  }
					: undefined
			};

			const [result, count] = await database.$transaction([
				database.course.findMany({
					select: {
						courseId: true,
						slug: true,
						imgUrl: true,
						title: true,
						authors: {
							select: {
								displayName: true
							}
						},
						subject: {
							select: {
								subjectId: true,
								title: true
							}
						}
					},
					...paginate(pageSize, input.page),
					orderBy: { title: "asc" },
					where
				}),
				database.course.count({ where })
			]);

			return {
				result,
				pageSize: pageSize,
				page: input.page,
				totalCount: count
			} satisfies Paginated<unknown>;
		}),
	getContent: t.procedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
		const course = await database.course.findUniqueOrThrow({
			where: { slug: input.slug },
			select: {
				content: true
			}
		});

		const content = (course.content ?? []) as CourseContent;
		const lessonIds = extractLessonIds(content);

		const lessons = await database.lesson.findMany({
			where: { lessonId: { in: lessonIds } },
			select: {
				lessonId: true,
				slug: true,
				title: true,
				meta: true
			}
		});

		const lessonMap: {
			[lessonId: string]: { title: string; lessonId: string; slug: string; meta: LessonMeta };
		} = {};

		for (const lesson of lessons) {
			lessonMap[lesson.lessonId] = lesson as (typeof lessons)[0] & { meta: LessonMeta };
		}

		return { content, lessonMap };
	}),
	fullExport: t.procedure.input(z.object({ slug: z.string() })).query(async ({ input, ctx }) => {
		const fullExport = await getFullCourseExport(input.slug);

		// Check if content is generally allowed to be exported
		const isOERCompatible = fullExport.lessons.every(
			lesson => lesson.license?.oerCompatible !== false
		);

		// OER-compatible or ADMIN / AUTHOR of the course
		if (!isOERCompatible && !(await authorizedUserForExport(ctx.user, input.slug))) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Content is neither OER-compatible nor is the user an author of the course. Export not allowed."
			});
		}

		return fullExport;
	}),
	create: authProcedure.input(courseFormSchema).mutation(async ({ input, ctx }) => {
		if (!canCreate(ctx.user)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message:
					"Creating a course requires either: admin role | admin of all related subjects | admin of all related specializations"
			});
		}

		const courseForDb = mapCourseFormToInsert(input, getRandomId());

		const created = await database.course.create({
			data: courseForDb,
			select: {
				title: true,
				slug: true,
				courseId: true
			}
		});

		console.log("[courseRouter.create]: Course created by", ctx.user.name, created);
		return created;
	}),
	edit: authProcedure
		.input(
			z.object({
				courseId: z.string(),
				course: courseFormSchema
			})
		)
		.mutation(async ({ input, ctx }) => {
			if (!canEditCourse(ctx.user, input.courseId)) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "Editing a course requires either: admin role | author of course"
				});
			}

			const courseForDb = mapCourseFormToUpdate(input.course, input.courseId);

			const updated = await database.course.update({
				where: { courseId: input.courseId },
				data: courseForDb,
				select: {
					title: true,
					slug: true,
					courseId: true
				}
			});

			console.log("[courseRouter.edit]: Course updated by", ctx.user.name, updated);
			return updated;
		}),

	getCoursesWithCompletions: authProcedure
		.input(z.object({ username: z.string() }))
		.query(async ({ input }) => {
			const { username } = input;

			const enrollments = await database.enrollment.findMany({
				where: {
					username: username
				},
				include: {
					course: {
						include: {
							completions: {
								where: { username: username }
							}
						}
					}
				}
			});

			const coursesWithCompletions: CourseCompletion[] = [];

			for (const enrollment of enrollments) {
				const course = enrollment.course;
				const totalLessons = await database.lesson.count({
					where: {
						completions: {
							some: {
								courseId: course.courseId
							}
						}
					}
				});
				const completedLessons = await database.lesson.count({
					where: {
						completions: {
							some: {
								courseId: course.courseId,
								username: username
							}
						}
					}
				});
				const completionPercentage = (completedLessons / totalLessons) * 100;

				const completedLessonsMap: CompletedLessonsMap = {};
				const lessons = await database.lesson.findMany({
					where: {
						completions: {
							some: {
								courseId: course.courseId,
								username: username
							}
						}
					},
					select: {
						lessonId: true,
						slug: true,
						title: true,
						completions: {
							where: { username: username },
							select: { createdAt: true }
						}
					}
				});

				for (const lesson of lessons) {
					const lessonId = lesson.lessonId;
					completedLessonsMap[lessonId] = {
						slug: lesson.slug,
						title: lesson.title,
						dateIso:
							lesson.completions.length > 0
								? lesson.completions[0].createdAt.toISOString()
								: ""
					};
				}

				coursesWithCompletions.push({
					courseCompletion: {
						lessonCount: totalLessons,
						completedLessonCount: completedLessons,
						completionPercentage
					},
					chapterCompletion: [], // Assuming chapter completion can be computed similarly
					completedLessons: completedLessonsMap
				});
			}

			return coursesWithCompletions;
		})
});

function canCreate(user: UserFromSession): boolean {
	return user.role === "ADMIN" || user.isAuthor;
}

async function canEditCourse(user: UserFromSession, courseId: string): Promise<boolean> {
	if (user.role === "ADMIN") {
		return true;
	}

	const beforeUpdate = await database.course.findUniqueOrThrow({
		where: { courseId },
		select: {
			authors: {
				select: {
					username: true
				}
			}
		}
	});

	if (beforeUpdate.authors.some(author => author.username === user.name)) {
		return true;
	}

	return false;
}

/**
 * Guard (pre-check) that checks if a user is allowed to export a course based on its role.
 * These are:
 * - ADMIN: always allowed
 * - AUTHOR: allowed if the user is an author of the course
 *
 * Further, users of other roles may also export a course, if all content is public (OER-compatible).
 * However, this is not checked here, as this requires the full course data and, thus, is done during the export.
 * @param user The user which requests the export
 * @param slug The course to export (by slug)
 * @returns true if the user is allowed to export the course, false requires to check all licenses
 */
async function authorizedUserForExport(
	user: UserFromSession | undefined,
	slug: string
): Promise<boolean> {
	if (!user) {
		return false;
	}

	if (user.role === "ADMIN") {
		return true;
	}

	const beforeExport = await database.course.findUniqueOrThrow({
		where: { slug },
		select: {
			authors: {
				select: {
					username: true
				}
			}
		}
	});

	if (beforeExport.authors.some(author => author.username === user.name)) {
		return true;
	}

	return false;
}
