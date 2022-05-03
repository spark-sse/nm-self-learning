import Image from "next/image";
import { ReactElement } from "react";

export function ImageCard({
	title,
	imgUrl,
	subtitle,
	footer
}: {
	title: string;
	subtitle: string | null;
	slug: string;
	imgUrl: string | null;
	footer?: ReactElement;
}) {
	return (
		<div className="flex flex-col">
			{!imgUrl || imgUrl.length === 0 ? (
				<div className="relative h-[256px] w-full shrink-0 rounded-t-lg bg-gradient-to-br from-purple-500 to-blue-400"></div>
			) : (
				<div className="relative h-[256px] w-full shrink-0 rounded-t-lg bg-white">
					<Image
						className="rounded-t-lg"
						src={`http://localhost:1337${imgUrl}`}
						alt=""
						layout="fill"
						objectFit="cover"
					></Image>
				</div>
			)}

			<div className="glass flex h-full flex-col justify-between gap-4 rounded-b-lg p-4">
				<div className="flex flex-col gap-4">
					<h2 className="text-2xl">{title}</h2>
					<span className="text-sm text-slate-500">{subtitle}</span>
				</div>
				{footer && <div className="flex flex-col">{footer}</div>}
			</div>
		</div>
	);
}