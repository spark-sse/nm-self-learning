import { SidebarEditorLayout } from "@self-learning/ui/layouts";
import { RepositoryInfoMemorized, SkillInfoForm } from "./folder-content-form";
import { createContext, useState } from "react";
import { trpc } from "@self-learning/api-client";
import { Divider, LoadingBox } from "@self-learning/ui/common";
import FolderListView from "./folder-list-view";
import { SkillFormModel } from "@self-learning/types";

export type SkillSelectHandler = (selectedSkill: SkillFormModel) => void;
export interface FolderContextProps {
	onSelect: SkillSelectHandler;
}
export const FolderContext = createContext<FolderContextProps>({ onSelect: () => {} });

export function FolderSkillEditor({ repositoryID }: { repositoryID: string }) {
	const { data: repository, isLoading } = trpc.skill.getRepository.useQuery({ id: repositoryID });
	const [selectedItem, setSelectedItem] = useState<SkillFormModel | null>(null);

	const changeSelectedItem = (item: SkillFormModel) => {
		setSelectedItem(item);
	};

	return (
		<div className="bg-gray-50">
			<SidebarEditorLayout
				sidebar={
					<>
						<div>
							<span className="text-2xl font-semibold text-secondary">
								Skillkarten editieren
							</span>
						</div>

						{isLoading ? (
							<LoadingBox />
						) : (
							<>
								{repository && (
									<>
										<RepositoryInfoMemorized repository={repository} />
										<Divider />
									</>
								)}
							</>
						)}
						<SkillInfoForm skill={selectedItem} />
					</>
				}
			>
				{isLoading ? (
					<LoadingBox />
				) : (
					<div>
						{repository && (
							<FolderContext.Provider value={{ onSelect: changeSelectedItem }}>
								<FolderListView repository={repository} />
							</FolderContext.Provider>
						)}
					</div>
				)}
			</SidebarEditorLayout>
		</div>
	);
}
