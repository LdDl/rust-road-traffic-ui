import type { AnprSettings, ConfigView } from './types';

export type ConfigDraft = Omit<ConfigView, 'anpr'> & { anpr: AnprSettings };
export type SectionKey = keyof ConfigView;

const connectionFields = ['host', 'port', 'username', 'password', 'db_index'];
const fields: Record<SectionKey, string[]> = {
	input: ['video_src', 'process_every_nth_frame'],
	equipment_info: ['id'],
	worker: ['reset_data_milliseconds'],
	tracking: [
		'type',
		'kalman_filter',
		'max_lost_seconds',
		'max_no_match',
		'max_points_in_track',
		'iou_threshold'
	],
	verbose: ['level', 'logs_folder', 'max_file_size_mb', 'max_files'],
	redis_publisher: [
		'enable',
		...connectionFields,
		'channel_name',
		'vehicle_events.enable',
		'vehicle_events.channel_name',
		...connectionFields.map((f) => `vehicle_events.connection.${f}`)
	],
	anpr: ['enable', 'image']
};

export const configSections = Object.keys(fields) as SectionKey[];
const connectionPath = 'redis_publisher.vehicle_events.connection';
const nullable = new Set([
	'tracking.max_lost_seconds',
	'tracking.max_no_match',
	'tracking.iou_threshold',
	'redis_publisher.username',
	`${connectionPath}.username`,
	'verbose.level',
	'verbose.logs_folder',
	'verbose.max_file_size_mb',
	'verbose.max_files'
]);
const emptyAllowed = new Set([
	'redis_publisher.password',
	`${connectionPath}.password`,
	'anpr.image'
]);

export function configDraft(config: ConfigView): ConfigDraft {
	const copy = structuredClone(config);
	return {
		...copy,
		anpr: copy.anpr ?? { enable: false, image: '' }
	};
}

export function valueAt(value: unknown, path: string): unknown {
	return path
		.split('.')
		.reduce<unknown>(
			(current, key) =>
				current !== null && typeof current === 'object'
					? (current as Record<string, unknown>)[key]
					: undefined,
			value
		);
}

function normalise(path: string, value: unknown): unknown {
	return nullable.has(path) && (value === '' || value === undefined) ? null : value;
}

export function sameValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

function setAt(target: Record<string, unknown>, path: string, value: unknown) {
	const keys = path.split('.');
	const field = keys.pop()!;
	let parent = target;
	for (const key of keys) {
		parent[key] ??= {};
		parent = parent[key] as Record<string, unknown>;
	}
	parent[field] = value;
}

export function sectionPatch(
	before: ConfigDraft,
	after: ConfigDraft,
	section: SectionKey
): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const field of fields[section]) {
		const path = `${section}.${field}`;
		if (path.startsWith(`${connectionPath}.`) && !valueAt(after, connectionPath)) continue;
		const next = normalise(path, valueAt(after, path));
		if (!sameValue(normalise(path, valueAt(before, path)), next)) setAt(patch, field, next);
	}
	if (
		section === 'redis_publisher' &&
		valueAt(before, connectionPath) &&
		!valueAt(after, connectionPath)
	) {
		setAt(patch, 'vehicle_events.connection', null);
	}
	return patch;
}

export function changedFields(patch: Record<string, unknown>): number {
	return Object.values(patch).reduce<number>(
		(count, value) =>
			count +
			(value !== null && typeof value === 'object' && !Array.isArray(value)
				? changedFields(value as Record<string, unknown>)
				: 1),
		0
	);
}

export function missingFields(draft: ConfigDraft, section: SectionKey): string[] {
	return fields[section].filter((field) => {
		const path = `${section}.${field}`;
		if (nullable.has(path)) return false;
		if (path.startsWith(`${connectionPath}.`) && !valueAt(draft, connectionPath)) return false;
		const value = valueAt(draft, path);
		if (value === '' && emptyAllowed.has(path)) return false;
		return (
			value === null ||
			value === undefined ||
			(typeof value === 'string' && !value.trim()) ||
			(Array.isArray(value) &&
				(!value.length || value.some((item) => typeof item !== 'string' || !item.trim())))
		);
	});
}
