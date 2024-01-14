import { useEffect, useState } from "react";
import { Form, LabeledField } from "@self-learning/ui/forms";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, useFormContext } from "react-hook-form";
import { SkillFormModel, skillFormSchema } from "@self-learning/types";
import { trpc } from "@self-learning/api-client";
import { SkillResolved } from "@self-learning/api";
import { SkillDeleteOption } from "./skill-taskbar";
import { Divider, showToast } from "@self-learning/ui/common";
import { SelectSkillsView } from "../skill-dialog/select-skill-view";
import { dispatchChange } from "./cycle-detection/detect-change-hook";
import { FolderItem } from "./cycle-detection/cycle-detection";
import { XIcon } from "@heroicons/react/solid";
import { SkillSelectHandler } from "@self-learning/teaching";

export function SelectedSkillsInfoForm({
	skills,
	previousSkill,
	skillMap,
	handleSelection,
	handleChangeOfItems
}: {
	skills: SkillFormModel[];
	previousSkill: SkillFormModel | null;
	skillMap: Map<string, FolderItem>;
	handleSelection: SkillSelectHandler;
	handleChangeOfItems: (skillMap: Map<string, FolderItem>) => void;
}) {
	if (skills.length > 0) {
		return (
			<div>
				{skills.length > 1 ? (
					<MassSelectedInfo
						skills={skills}
						handleSelection={handleSelection}
						handleChangeOfItems={handleChangeOfItems}
						skillMap={skillMap}
					/>
				) : (
					<SkillInfoForm
						skill={skills[0]}
						previousSkill={previousSkill}
						handleSelection={handleSelection}
						handleChangeOfItems={handleChangeOfItems}
						skillMap={skillMap}
					/>
				)}
			</div>
		);
	} else {
		return <div />;
	}
}

export function MassSelectedInfo({
	skills,
	skillMap,
	handleSelection,
	handleChangeOfItems
}: {
	skills: SkillFormModel[];
	skillMap: Map<string, FolderItem>;
	handleSelection: SkillSelectHandler;
	handleChangeOfItems: (skillMap: Map<string, FolderItem>) => void;
}) {
	return (
		<>
			<h2 className="text-xl">Ausgewählte Skills:</h2>
			<span className="pb-4 text-sm text-light">Die rechts ausgewählten Skills</span>

			<section className="flex h-64 flex-col overflow-auto rounded-lg border border-light-border">
				<div className="flex flex-col">
					{skills.map((skill, index) => (
						<span
							key={"span: " + skill.id + index}
							className="flex items-center gap-2 pl-1"
						>
							{skill.name}
						</span>
					))}
				</div>
			</section>
			<div className="pt-4" />
			<Divider />
			<SkillDeleteOption
				skills={skills}
				classname={"py-2 px-8"}
				handleSelection={handleSelection}
				skillMap={skillMap}
				handleChangeOfItems={handleChangeOfItems}
			/>
		</>
	);
}

export function SkillInfoForm({
	skill,
	previousSkill,
	skillMap,
	handleSelection,
	handleChangeOfItems
}: {
	skill: SkillFormModel;
	previousSkill: SkillFormModel | null;
	skillMap: Map<string, FolderItem>;
	handleSelection: SkillSelectHandler;
	handleChangeOfItems: (skillMap: Map<string, FolderItem>) => void;
}) {
	const { mutateAsync: updateSkill } = trpc.skill.updateSkill.useMutation();
	const { data: dbSkill } = trpc.skill.getSkillById.useQuery({
		skillId: skill.id
	});

	const onSubmit = async (data: SkillFormModel) => {
		const updatedSkill = await updateSkill({
			skill: {
				...data,
				repositoryId: skill.repositoryId,
				id: skill.id,
				// don't use the form values. parents|children are changed from inside the dependency info component
				children: skill.children,
				parents: skill.parents
			}
		});
		const updatedSkillFormModel = {
			id: updatedSkill.id,
			name: updatedSkill.name,
			description: updatedSkill.description,
			children: updatedSkill.children.map(skill => skill.id),
			parents: updatedSkill.parents.map(skill => skill.id),
			repositoryId: updatedSkill.repository.id
		};

		const folderItem = {
			skill: updatedSkillFormModel,
			selectedSkill: true
		};

		showToast({
			type: "success",
			title: "Skill gespeichert!",
			subtitle: ""
		});

		skillMap.set(updatedSkill.id, folderItem);

		handleChangeOfItems(skillMap);
	};

	const form = useForm({
		defaultValues: skill,
		resolver: zodResolver(skillFormSchema)
	});

	const errors = form.formState.errors;

	useEffect(() => {
		form.setValue("name", skill.name);
		form.setValue("description", skill?.description);
		let folderItemHistory = skillMap.get(skill.id);
		if (!folderItemHistory) return;
		const items: FolderItem[] = [
			{
				skill: skill,
				selectedSkill: true,
				cycle: folderItemHistory.cycle,
				parent: folderItemHistory.parent ?? undefined
			}
		];
		if (previousSkill !== null) {
			folderItemHistory = skillMap.get(previousSkill.id);
			if (!folderItemHistory) return;
			items.push({
				skill: previousSkill,
				selectedSkill: false,
				cycle: folderItemHistory.cycle,
				parent: folderItemHistory.parent ?? undefined
			});
		}
		//informs the specific row about the change
		dispatchChange(items);
	}, [skill, form, previousSkill, skillMap]);

	return (
		<FormProvider {...form}>
			<form className="flex flex-col justify-between" onSubmit={form.handleSubmit(onSubmit)}>
				<Form.SidebarSection>
					<div className="flex justify-between">
						<Form.SidebarSectionTitle
							title="Bearbeiten"
							subtitle="Informationen über den rechts ausgewählten Skill"
						/>
						<button
							type="button"
							className="h-fit rounded-lg border border-light-border bg-white px-2 py-2"
							title="Ansicht ohne Veränderungen schließen"
							onClick={() => handleSelection(null, skillMap)}
						>
							<XIcon className="h-5" />
						</button>
					</div>
					<div className="flex flex-col gap-4 border-b-2 border-light-border">
						<LabeledField label="Name" error={errors.name?.message}>
							<input type="text" className="textfield" {...form.register("name")} />
						</LabeledField>
						<LabeledField label="Beschreibung" error={errors.description?.message}>
							<textarea {...form.register("description")} />
						</LabeledField>
						<SkillToSkillDepsInfo
							parents={dbSkill?.parents ?? []}
							children={dbSkill?.children ?? []}
							repoId={skill.repositoryId}
							skillToChange={skill}
						/>
					</div>
					<div className="flex justify-between">
						<button type="submit" className="btn-primary w-full">
							Speichern
						</button>
						<SkillDeleteOption
							skills={[skill]}
							classname={"py-2 px-2"}
							handleSelection={handleSelection}
							skillMap={skillMap}
							handleChangeOfItems={handleChangeOfItems}
						/>
					</div>
				</Form.SidebarSection>
			</form>
		</FormProvider>
	);
}

function SkillToSkillDepsInfo({
	parents,
	children,
	repoId,
	skillToChange
}: {
	parents: SkillResolved["parents"];
	children: SkillResolved["children"];
	repoId: string;
	skillToChange: SkillFormModel;
}) {
	const [parentItems, setParentItems] = useState<SkillResolved["parents"]>(parents);
	const [childItems, setChildItems] = useState<SkillResolved["children"]>(children);
	const { setValue } = useFormContext<SkillFormModel>();

	useEffect(() => {
		setParentItems(parents);
	}, [parents]);

	useEffect(() => {
		setChildItems(children);
	}, [children]);

	const removeParent = (id: string) => {
		setParentItems(parentItems.filter(item => item.id !== id));
		skillToChange.parents = skillToChange.parents.filter(item => item !== id);
	};
	const removeChild = (id: string) => {
		setChildItems(childItems.filter(item => item.id !== id));
		skillToChange.children = skillToChange.children.filter(item => item !== id);
	};

	const addChildren = (skills: SkillFormModel[]) => {
		setChildItems([...childItems, ...skills]);
		skillToChange.children = [...skillToChange.children, ...skills.map(item => item.id)];
		setValue("children", skillToChange.children);
	};

	const addParent = (skills: SkillFormModel[]) => {
		setParentItems([...parentItems, ...skills]);
		skillToChange.parents = [...skillToChange.parents, ...skills.map(item => item.id)];
		setValue("parents", skillToChange.parents);
	};

	return (
		<>
			<label>
				<span className="text-sm font-semibold">
					{"Beinhaltet folgende Skills (Kinder):"}
				</span>
			</label>
			<div>
				<SelectSkillsView
					skills={childItems.map(skill => {
						return {
							...skill,
							children: [],
							parents: [],
							repositoryId: repoId
						};
					})}
					onDeleteSkill={skill => {
						removeChild(skill.id);
					}}
					onAddSkill={skills => {
						if (!skills) return;
						addChildren(skills);
					}}
					repoId={repoId}
				/>
			</div>
			<label>
				<span className="text-sm font-semibold">
					{"Ist Teil von folgenden Skills (Eltern):"}
				</span>
			</label>
			<div>
				<SelectSkillsView
					skills={parentItems.map(skill => {
						return {
							...skill,
							children: [],
							parents: [],
							repositoryId: repoId
						};
					})}
					onDeleteSkill={skill => {
						removeParent(skill.id);
					}}
					onAddSkill={skills => {
						if (!skills) return;
						addParent(skills);
					}}
					repoId={repoId}
				/>
			</div>
		</>
	);
}
