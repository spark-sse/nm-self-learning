import { Unauthorized, useRequiredSession } from "@self-learning/ui/layouts";
import { LessonFormModel } from "@self-learning/teaching";
import { useRouter } from "next/router";
import { trpc } from "@self-learning/api-client";
import { LessonEditor, onLessonCreatorClosed } from "./edit/[lessonId]";

export default function CreateLessonPage() {
	const session = useRequiredSession();
	const authorUsername = session.data?.user.name;
	const router = useRouter();
	const { mutateAsync: createLessonAsync } = trpc.lesson.create.useMutation();
	if (!authorUsername) {
		return (
			<Unauthorized>Um eine Lerneinheit zu erstellen, musst du ein Autor sein.</Unauthorized>
		);
	}

	async function handleCreateClose(lesson?: LessonFormModel) {
		await onLessonCreatorClosed(
			() => {
				router.push("/overview");
			},
			createLessonAsync,
			lesson
		);
	}

	return <LessonEditor onClose={handleCreateClose} />;
}
