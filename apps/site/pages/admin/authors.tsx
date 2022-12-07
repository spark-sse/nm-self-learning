import { zodResolver } from "@hookform/resolvers/zod";
import { trpc } from "@self-learning/api-client";
import { Author, authorSchema } from "@self-learning/types";
import {
	Dialog,
	DialogActions,
	ImageOrPlaceholder,
	LoadingBox,
	OnDialogCloseFn,
	showToast,
	Table,
	TableDataColumn,
	TableHeaderColumn
} from "@self-learning/ui/common";
import { LabeledField, SearchField, Upload } from "@self-learning/ui/forms";
import { CenteredSection } from "@self-learning/ui/layouts";
import { OpenAsJsonButton } from "libs/feature/teaching/src/lib/json-editor-dialog";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";

export default function AuthorsPage() {
	useSession({ required: true });

	const [displayName, setDisplayName] = useState("");
	const { data: users, isLoading } = trpc.author.getAllWithSubject.useQuery();
	const [editTarget, setEditTarget] = useState<string | null>(null);

	const filteredAuthors = useMemo(() => {
		if (!users) return [];
		if (!displayName || displayName.length === 0) return users;

		const lowerCaseDisplayName = displayName.toLowerCase().trim();
		return users.filter(user =>
			user.author?.displayName.toLowerCase().includes(lowerCaseDisplayName)
		);
	}, [displayName, users]);

	function onEdit(username: string) {
		setEditTarget(username);
	}

	function onEditDialogClose() {
		setEditTarget(null);
	}

	return (
		<CenteredSection>
			<h1 className="mb-16 text-5xl">Autoren</h1>

			<SearchField
				placeholder="Suche nach Autor"
				onChange={e => setDisplayName(e.target.value)}
			/>

			{editTarget && <EditAuthorDialog onClose={onEditDialogClose} username={editTarget} />}

			{isLoading ? (
				<LoadingBox />
			) : (
				<Table
					head={
						<>
							<TableHeaderColumn></TableHeaderColumn>
							<TableHeaderColumn>Name</TableHeaderColumn>
							<TableHeaderColumn></TableHeaderColumn>
						</>
					}
				>
					{filteredAuthors.map(({ author, name }) => (
						<Fragment key={name}>
							{author && (
								<tr key={name}>
									<TableDataColumn>
										<ImageOrPlaceholder
											src={author?.imgUrl ?? undefined}
											className="m-0 h-10 w-10 rounded-lg object-cover"
										/>
									</TableDataColumn>
									<TableDataColumn>
										<div className="flex flex-wrap gap-4">
											<Link
												className="text-sm font-medium hover:text-secondary"
												href={`/authors/${author.slug}`}
											>
												{author.displayName}
											</Link>
											<span className="flex gap-2 text-xs">
												{author.subjectAdmin.map(({ subject }) => (
													<span
														key={subject.title}
														className="rounded-full bg-secondary px-3 py-[2px] text-white"
													>
														Admin: {subject.title}
													</span>
												))}
											</span>
										</div>
									</TableDataColumn>
									<TableDataColumn>
										<div className="flex flex-wrap justify-end gap-4">
											<button
												className="btn-stroked"
												onClick={() => onEdit(name)}
											>
												Editieren
											</button>
										</div>
									</TableDataColumn>
								</tr>
							)}
						</Fragment>
					))}
				</Table>
			)}
		</CenteredSection>
	);
}

function EditAuthorDialog({
	username,
	onClose
}: {
	username: string;
	onClose: OnDialogCloseFn<Author>;
}) {
	const { data: user, isLoading } = trpc.author.getAuthorForForm.useQuery({ username });

	return (
		<Dialog onClose={() => onClose(undefined)} title={user?.author?.displayName ?? username}>
			{isLoading ? (
				<LoadingBox />
			) : (
				<>
					{user && user.author && (
						<AuthorForm
							username={username}
							onClose={onClose}
							initialAuthor={{
								displayName: user.author.displayName,
								imgUrl: user.author.imgUrl,
								slug: user.author.slug,
								subjectAdmin: user.author.subjectAdmin.map(s => ({
									subjectId: s.subject.subjectId
								})),
								specializationAdmin: user.author.specializationAdmin.map(s => ({
									specializationId: s.specialization.specializationId
								}))
							}}
						/>
					)}
				</>
			)}
		</Dialog>
	);
}

function AuthorForm({
	initialAuthor,
	username,
	// user,
	onClose
}: {
	/** Initial data to populate the form.  */
	initialAuthor: Author;
	username: string;
	onClose: OnDialogCloseFn<Author>;
}) {
	const trpcContext = trpc.useContext();
	const { mutateAsync: updateAuthor } = trpc.author.updateAsAdmin.useMutation();
	const methods = useForm({
		resolver: zodResolver(authorSchema),
		defaultValues: initialAuthor
	});

	function onSubmit(author: Author) {
		console.log("Saving author...", author);

		updateAuthor({ author, username })
			.then(res => {
				showToast({
					type: "success",
					title: "Autor gespeichert!",
					subtitle: res.displayName
				});
				onClose(undefined);
			})
			.catch(err => {
				console.error(err);
				showToast({
					type: "error",
					title: "Fehler",
					subtitle: "Autor konnte nicht gespeichert werden."
				});
			})
			.finally(() => {
				trpcContext.author.invalidate();
			});
	}

	return (
		<FormProvider {...methods}>
			<form
				className="flex flex-col justify-between"
				onSubmit={methods.handleSubmit(onSubmit)}
			>
				<div className="absolute top-8 right-8">
					<OpenAsJsonButton validationSchema={authorSchema} />
				</div>

				<div className="grid gap-8 xl:grid-cols-[400px_600px]">
					<AuthorData />
					<Permissions />
				</div>

				<DialogActions onClose={onClose}>
					<button className="btn-primary" type="submit">
						Speichern
					</button>
				</DialogActions>
			</form>
		</FormProvider>
	);
}

function AuthorData() {
	const { register, control, setValue, formState } = useFormContext<Author>();
	const imgUrl = useWatch({ control: control, name: "imgUrl" });
	const errors = formState.errors;

	return (
		<section className="flex flex-col rounded-lg border border-light-border p-4">
			<h2 className="mb-4 text-2xl">Daten</h2>
			<div className="flex flex-col gap-4">
				<LabeledField label="Name" error={errors.displayName?.message}>
					<input className="textfield" type={"text"} {...register("displayName")} />
				</LabeledField>
				<LabeledField label="Slug" error={errors.slug?.message}>
					<input className="textfield" type={"text"} {...register("slug")} />
				</LabeledField>
				<LabeledField label="Bild" error={errors.imgUrl?.message}>
					<div className="flex w-full gap-4">
						<div className="flex w-full flex-col gap-2">
							<input
								className="textfield w-full"
								type={"text"}
								placeholder={"https://example.com/image.png"}
								{...register("imgUrl")}
							/>
							<Upload
								mediaType="image"
								onUploadCompleted={url => setValue("imgUrl", url)}
								preview={
									<>
										{imgUrl && imgUrl.length > 0 ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={imgUrl}
												alt="Avatar"
												className="mx-auto h-32 w-32 shrink-0 rounded-lg object-cover"
											></img>
										) : (
											<div className="mx-auto h-32 w-32  shrink-0 rounded-lg bg-gray-200"></div>
										)}
									</>
								}
							/>
						</div>
					</div>
				</LabeledField>
			</div>
		</section>
	);
}

function Permissions() {
	const { data: subjects } = trpc.subject.getAllWithSpecializations.useQuery();
	const { control, setValue } = useFormContext<Author>();
	const subjectAdmin = useWatch({ control: control, name: "subjectAdmin" });
	const specializationAdmin = useWatch({ control: control, name: "specializationAdmin" });

	return (
		<section className="flex flex-col gap-8">
			<section className="flex h-full flex-col gap-4 rounded-lg border border-light-border p-4">
				<h2 className="text-2xl">Rechte</h2>
				<p className="text-sm text-light">TODO: Beschreibung der Rechte</p>
				<div className="flex gap-4">
					{!subjects ? (
						<LoadingBox />
					) : (
						<ul className="flex flex-col gap-2">
							{subjects.map(subject => (
								<li key={subject.subjectId}>
									<div className="flex flex-col">
										<span className="flex items-center gap-2">
											<input
												id={subject.subjectId}
												type={"checkbox"}
												className="checkbox"
												checked={
													!!subjectAdmin.find(
														s => s.subjectId === subject.subjectId
													)
												}
												onChange={e => {
													if (e.target.checked) {
														setValue(
															"subjectAdmin",
															[...subjectAdmin, subject].sort(
																(a, b) =>
																	a.subjectId.localeCompare(
																		b.subjectId
																	)
															)
														);
													} else {
														setValue(
															"subjectAdmin",
															subjectAdmin.filter(
																s =>
																	s.subjectId !==
																	subject.subjectId
															)
														);
													}
												}}
											/>
											<label
												htmlFor={subject.subjectId}
												className="text-sm font-semibold"
											>
												{subject.title}
											</label>
										</span>
										<ul className="py-2 pl-8 text-sm">
											{subject.specializations.map(specialization => (
												<li
													key={specialization.specializationId}
													className="flex items-center gap-2"
												>
													<input
														type="checkbox"
														id={specialization.specializationId}
														className="checkbox"
														checked={
															!!specializationAdmin.find(
																s =>
																	s.specializationId ===
																	specialization.specializationId
															)
														}
														onChange={e => {
															if (e.target.checked) {
																setValue(
																	"specializationAdmin",
																	[
																		...specializationAdmin,
																		specialization
																	].sort((a, b) =>
																		a.specializationId.localeCompare(
																			b.specializationId
																		)
																	)
																);
															} else {
																setValue(
																	"specializationAdmin",
																	specializationAdmin.filter(
																		s =>
																			s.specializationId !==
																			specialization.specializationId
																	)
																);
															}
														}}
													/>
													<label
														htmlFor={specialization.specializationId}
													>
														{specialization.title}
													</label>
												</li>
											))}
										</ul>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</section>
		</section>
	);
}