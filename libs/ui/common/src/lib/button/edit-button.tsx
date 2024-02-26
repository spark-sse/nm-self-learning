import React from "react";
import { PencilIcon } from "@heroicons/react/solid";
import { UniversalButton } from "./universal-button";

export function EditButton({
	onEdit,
	title,
	children
}: {
	onEdit: () => void;
	title?: string;
	children?: React.ReactNode;
}) {
	return (
		<UniversalButton onClick={onEdit} title={title ? title : "Bearbeiten"}>
			{children ? (
				<div className="flex items-center space-x-2">
					<PencilIcon className="h-5 w-5 text-gray-500" />
					<div>{children}</div>
				</div>
			) : (
				<PencilIcon className="h-5 w-5 text-gray-500" />
			)}
		</UniversalButton>
	);
}
