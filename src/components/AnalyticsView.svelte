<script lang="ts">
	import { onDestroy } from 'svelte';
	import Hint from './Hint.svelte';
	import { dataStorage } from '../store/data_storage';
	import { status, restartEpoch } from '../store/status';
	import {
		stats,
		statsState,
		statsWindowMs,
		acquireStats,
		refreshStats,
		forgetStats
	} from '../store/stats';
	import type { ZoneStats } from '$lib/api/types';

	export let active = false;

	/** The classes a road usually has in this order; anything else follows alphabetically */
	const CLASS_ORDER = ['car', 'motorbike', 'bus', 'truck', 'train'];
	/** Below this share of vehicles with a measured speed the average deserves a warning */
	const WEAK_SPEED_SHARE = 0.5;
	/** The device starts its clock at zero, so a period near the epoch means no window has ended */
	const EPOCH_GUARD = Date.UTC(1971, 0, 1);
	const HEAT_STEPS = 5;

	let tableView = false;
	let hoveredZone: string | null = null;
	let hoveredClass: string | null = null;

	let release: (() => void) | undefined;
	$: if (active && !release) {
		release = acquireStats();
	} else if (!active && release) {
		release();
		release = undefined;
	}

	// A restart wipes every counter, so the window on screen belongs to a run that is gone
	let seenEpoch = 0;
	const unsubscribeEpoch = restartEpoch.subscribe((epoch) => {
		if (epoch === seenEpoch) return;
		seenEpoch = epoch;
		forgetStats();
	});

	onDestroy(() => {
		unsubscribeEpoch();
		release?.();
	});

	$: zones = ($stats?.data ?? []).slice().sort(compareZones);
	$: classes = classesOf(zones);
	$: axisTop = topOf(zones, classes);
	$: period = periodOf(zones);
	$: matrix = matrixOf(zones);
	$: onFile = $status?.input?.kind === 'file';

	function compareZones(left: ZoneStats, right: ZoneStats): number {
		return left.lane_direction - right.lane_direction || left.lane_number - right.lane_number;
	}

	function classesOf(list: ZoneStats[]): string[] {
		const seen = new Set<string>();
		for (const zone of list) {
			for (const name of Object.keys(zone.statistics)) seen.add(name);
		}
		const known = CLASS_ORDER.filter((name) => seen.has(name));
		const rest = [...seen].filter((name) => !CLASS_ORDER.includes(name)).sort();
		return [...known, ...rest];
	}

	const countOf = (zone: ZoneStats, name: string) =>
		zone.statistics[name]?.estimated_sum_intensity ?? 0;
	const measuredOf = (zone: ZoneStats, name: string) =>
		zone.statistics[name]?.estimated_defined_sum_intensity ?? 0;
	const speedOf = (zone: ZoneStats, name: string) =>
		zone.statistics[name]?.estimated_avg_speed ?? -1;

	/**
	 * One scale for every zone: the cards are the same chart repeated, so a bar in one
	 * of them has to mean the same height as a bar in the next
	 */
	function topOf(list: ZoneStats[], names: string[]): number {
		let highest = 0;
		for (const zone of list) {
			for (const name of names) highest = Math.max(highest, countOf(zone, name));
		}
		if (highest <= 4) return Math.max(2, Math.ceil(highest / 2) * 2);
		const power = Math.pow(10, Math.floor(Math.log10(highest)));
		for (const step of [1, 2, 5]) {
			if (highest <= step * power) return step * power;
		}
		return 10 * power;
	}

	/**
	 * A window can start before midnight and end after it, so the date is always shown,
	 * and both dates when the two differ
	 */
	function periodText(from: string, to: string): string {
		const start = new Date(from);
		const end = new Date(to);
		const date = (at: Date) => at.toLocaleDateString('en-GB');
		const clock = (at: Date) => at.toLocaleTimeString('en-GB', { hour12: false });
		if (date(start) === date(end)) return `${date(start)} ${clock(start)} to ${clock(end)}`;
		return `${date(start)} ${clock(start)} to ${date(end)} ${clock(end)}`;
	}

	function periodOf(list: ZoneStats[]) {
		const first = list[0];
		if (!first) return null;
		const start = new Date(first.period_start);
		const end = new Date(first.period_end);
		if (Number.isNaN(end.getTime()) || end.getTime() < EPOCH_GUARD) return null;
		return {
			start: first.period_start,
			end: first.period_end,
			seconds: (end.getTime() - start.getTime()) / 1000
		};
	}

	const keyOf = (zone: ZoneStats) => `ld-${zone.lane_direction}_ln-${zone.lane_number}`;

	function matrixOf(list: ZoneStats[]) {
		const table = $stats?.od_matrix ?? {};
		let highest = 0;
		for (const from of list) {
			for (const to of list) {
				highest = Math.max(highest, table[keyOf(from)]?.[keyOf(to)] ?? 0);
			}
		}
		return { table, highest };
	}

	const movesOf = (from: ZoneStats, to: ZoneStats) => matrix.table[keyOf(from)]?.[keyOf(to)] ?? 0;

	/** Which step of the heat ramp a cell gets. Zero keeps the surface, so empty reads as empty */
	function heatStep(value: number): number {
		if (value <= 0 || matrix.highest <= 0) return 0;
		return Math.min(HEAT_STEPS, Math.ceil((value / matrix.highest) * HEAT_STEPS));
	}

	const zoneName = (zone: ZoneStats) =>
		`Direction ${zone.lane_direction}, lane ${zone.lane_number}`;

	/** The colour the zone already wears on the map and on the frame */
	const zoneColour = (zone: ZoneStats) =>
		$dataStorage.get(zone.id)?.properties.color_rgb_str ?? 'var(--accent-primary)';

	const formatSpeed = (value: number) => (value < 0 ? 'not measured' : `${value.toFixed(1)} km/h`);

	function shareText(zone: ZoneStats): string {
		const flow = zone.traffic_flow_parameters;
		if (flow.sum_intensity === 0) return 'no vehicles to measure';
		return `speed measured for ${flow.defined_sum_intensity} of ${flow.sum_intensity}`;
	}

	function isWeak(zone: ZoneStats): boolean {
		const flow = zone.traffic_flow_parameters;
		return (
			flow.sum_intensity > 0 && flow.defined_sum_intensity / flow.sum_intensity < WEAK_SPEED_SHARE
		);
	}

	function columnText(zone: ZoneStats, name: string): string {
		const count = countOf(zone, name);
		if (count === 0) return `${name}: nothing in this window`;
		const speed = speedOf(zone, name);
		const measured = measuredOf(zone, name);
		const speedPart = speed < 0 ? 'no speed measured' : `average ${speed.toFixed(1)} km/h`;
		return `${name}: ${count} ${count === 1 ? 'vehicle' : 'vehicles'}, speed measured for ${measured}, ${speedPart}`;
	}

	function show(zoneId: string, name: string) {
		hoveredZone = zoneId;
		hoveredClass = name;
	}

	function hide() {
		hoveredZone = null;
		hoveredClass = null;
	}
</script>

<section class="analytics" class:hidden={!active}>
	<header class="analytics-bar">
		<div class="window">
			<span class="window-label">
				Last completed window
				<Hint
					text="The device counts over a fixed window and keeps only the one that has just ended. Nothing older is stored anywhere, here or on the device."
				/>
			</span>
			{#if period}
				<span class="window-value">
					{periodText(period.start, period.end)}
					<span class="window-length">{Math.round(period.seconds)} s</span>
				</span>
			{:else}
				<span class="window-value weak">
					the first window has not finished yet
					<span class="window-length">{Math.round($statsWindowMs / 1000)} s each</span>
				</span>
			{/if}
		</div>

		<span class="spacer"></span>

		{#if !$statsState.reachable}
			<span class="stale">device not answering, these numbers are the last ones it gave</span>
		{/if}

		<button
			type="button"
			class="action-btn secondary"
			class:pressed={tableView}
			on:click={() => (tableView = !tableView)}
		>
			<i class="material-icons">table_rows</i>
			{tableView ? 'Charts' : 'Table'}
		</button>
		<button type="button" class="action-btn secondary" on:click={refreshStats}>
			<i class="material-icons">refresh</i>
			Refresh
		</button>
	</header>

	<div class="content">
		{#if $statsState.initializing && !$stats}
			<p class="state">Reading the statistics</p>
		{:else if !$stats}
			<p class="state">
				The device is not answering.{$statsState.error ? ` ${$statsState.error}` : ''}
			</p>
		{:else if zones.length === 0}
			<p class="state">
				The device reports no zones. Draw them on the Setup tab and save, then the counts appear
				here.
			</p>
		{:else}
			<p class="lead">
				Vehicles counted in the window above, by class, one card per zone. Every card shares the
				same scale, so the bars compare directly.
				{#if onFile}
					The source is a video file, so the times follow the recording, not the clock.
				{/if}
			</p>

			{#if tableView}
				<div class="table-wrap">
					<table class="numbers">
						<thead>
							<tr>
								<th>Zone</th>
								<th>Class</th>
								<th class="right">Vehicles</th>
								<th class="right">Speed measured</th>
								<th class="right">Average speed</th>
							</tr>
						</thead>
						<tbody>
							{#each zones as zone (zone.id)}
								{#each classes as name (name)}
									<tr>
										<td>
											<span class="dot" style="background: {zoneColour(zone)}"></span>
											{zoneName(zone)}
										</td>
										<td>{name}</td>
										<td class="right">{countOf(zone, name)}</td>
										<td class="right">{measuredOf(zone, name)}</td>
										<td class="right">{formatSpeed(speedOf(zone, name))}</td>
									</tr>
								{/each}
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<div class="cards">
					{#each zones as zone (zone.id)}
						{@const flow = zone.traffic_flow_parameters}
						<article class="card" style="--zone: {zoneColour(zone)}">
							<header class="card-head">
								<span class="dot"></span>
								<h3>{zoneName(zone)}</h3>
								<span class="card-total">{flow.sum_intensity}</span>
							</header>

							<div class="legend">
								<span class="key"><span class="swatch measured"></span>speed measured</span>
								<span class="key"><span class="swatch rest"></span>no speed</span>
								<Hint
									text="A vehicle without a measured speed was still counted. It usually means the vehicle was seen for too short a stretch of the zone, or the zone is calibrated loosely."
								/>
							</div>

							<div class="chart">
								<span class="axis-name">vehicles</span>
								<div class="axis">
									<span>{axisTop}</span>
									<span>{axisTop / 2}</span>
									<span>0</span>
								</div>
								<div class="plot">
									<div class="grid">
										<span class="line"></span>
										<span class="line"></span>
										<span class="line base"></span>
									</div>
									<div class="columns">
										{#each classes as name, index (name)}
											{@const count = countOf(zone, name)}
											{@const measured = Math.min(measuredOf(zone, name), count)}
											{@const rest = count - measured}
											<button
												type="button"
												class="column"
												class:first={index === 0}
												class:last={index === classes.length - 1}
												aria-label={columnText(zone, name)}
												on:mouseenter={() => show(zone.id, name)}
												on:mouseleave={hide}
												on:focus={() => show(zone.id, name)}
												on:blur={hide}
											>
												{#if hoveredZone === zone.id && hoveredClass === name}
													<span class="tip" role="tooltip">{columnText(zone, name)}</span>
												{/if}
												{#if count > 0}
													<span class="cap">{count}</span>
												{/if}
												<span class="stack" style="height: {(count / axisTop) * 100}%">
													{#if rest > 0}
														<span class="seg rest" style="flex-grow: {rest}"></span>
													{/if}
													{#if measured > 0}
														<span class="seg measured" style="flex-grow: {measured}"></span>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								</div>
								<div class="ticks">
									{#each classes as name (name)}
										<span class="tick">{name}</span>
									{/each}
								</div>
							</div>

							{#if flow.sum_intensity === 0}
								<p class="empty">No vehicle passed this zone in the window.</p>
							{/if}

							<dl class="facts">
								<div>
									<dt>Average speed</dt>
									<dd>{formatSpeed(flow.avg_speed)}</dd>
								</div>
								<div>
									<dt>Headway</dt>
									<dd>
										{flow.sum_intensity > 0 && flow.avg_headway > 0
											? `${flow.avg_headway.toFixed(1)} s`
											: 'n/a'}
									</dd>
								</div>
							</dl>
							<p class="share" class:weak={isWeak(zone)}>{shareText(zone)}</p>
						</article>
					{/each}
				</div>

				<section class="od">
					<header class="od-head">
						<h3>Where the vehicles went</h3>
						<Hint
							text="A cell counts vehicles that entered by the row zone and left by the column zone in this window. The diagonal is a vehicle that came back the way it arrived, a U-turn."
						/>
					</header>
					<p class="lead">
						Rows are where a vehicle came from, columns are where it went. The darker the cell, the
						more vehicles took that way.
					</p>
					{#if matrix.highest === 0}
						<p class="empty">
							No vehicle went from one zone to another in this window. A vehicle counted in a single
							zone does not appear here.
						</p>
					{/if}
					<div class="table-wrap">
						<table class="heat">
							<thead>
								<tr>
									<th class="corner"></th>
									{#each zones as zone (zone.id)}
										<th scope="col">
											<span class="dot" style="background: {zoneColour(zone)}"></span>
											<span class="head-text">{zoneName(zone)}</span>
										</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each zones as from (from.id)}
									<tr>
										<th scope="row">
											<span class="dot" style="background: {zoneColour(from)}"></span>
											<span class="head-text">{zoneName(from)}</span>
										</th>
										{#each zones as to (to.id)}
											{@const moves = movesOf(from, to)}
											<td
												class="cell step-{heatStep(moves)}"
												title="{zoneName(from)} to {zoneName(to)}: {moves} {moves === 1
													? 'vehicle'
													: 'vehicles'}{from.id === to.id ? ', a U-turn' : ''}"
											>
												{moves}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</section>
			{/if}
		{/if}
	</div>
</section>

<style>
	.analytics {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		background: var(--bg-primary);
	}

	.analytics.hidden {
		display: none;
	}

	.analytics-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm) var(--space-md);
		border-bottom: 1px solid var(--border-primary);
		background: var(--bg-secondary);
	}

	.spacer {
		flex: 1;
	}

	.window {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.window-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--text-secondary);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.window-value {
		color: var(--text-primary);
		font-size: var(--text-base);
		font-variant-numeric: tabular-nums;
	}

	.window-value.weak {
		color: var(--text-secondary);
	}

	.window-length {
		margin-left: var(--space-xs);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-sm);
		background: var(--bg-tertiary);
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}

	.stale {
		color: var(--warning-text);
		font-size: var(--text-sm);
	}

	.pressed {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
	}

	.content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: var(--space-md);
	}

	.state {
		margin: var(--space-2xl) auto;
		max-width: 46ch;
		color: var(--text-secondary);
		font-size: var(--text-md);
		text-align: center;
		line-height: 1.5;
	}

	.lead {
		margin: 0 0 var(--space-md) 0;
		max-width: 80ch;
		color: var(--text-secondary);
		font-size: var(--text-sm);
		line-height: 1.5;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
		gap: var(--space-md);
	}

	.card {
		display: flex;
		flex-direction: column;
		padding: var(--space-md);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
	}

	.card-head h3 {
		margin: 0;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-primary);
	}

	.card-total {
		margin-left: auto;
		font-size: var(--text-lg);
		font-weight: 600;
		color: var(--text-primary);
		font-variant-numeric: tabular-nums;
	}

	.dot {
		width: 10px;
		height: 10px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: var(--zone);
	}

	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-top: var(--space-xs);
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}

	.key {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
	}

	.swatch.measured {
		background: var(--zone);
	}

	.swatch.rest {
		background: color-mix(in srgb, var(--zone) 28%, var(--bg-primary));
	}

	.chart {
		display: grid;
		grid-template-columns: auto 1fr;
		/* The axis name, then the plot, then the class labels */
		grid-template-rows: auto auto auto;
		gap: var(--space-xs);
		margin-top: var(--space-sm);
		/* A card that runs the whole width would otherwise stretch six bars across a metre */
		max-width: 720px;
	}

	.axis {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		height: 150px;
		padding-top: 16px;
		box-sizing: border-box;
		color: var(--text-secondary);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	/* The labels sit on the gridlines, which start below the room left for the cap values */
	.axis span {
		transform: translateY(-50%);
	}

	.plot {
		position: relative;
		height: 150px;
		padding-top: 16px;
		box-sizing: border-box;
	}

	.grid {
		position: absolute;
		left: 0;
		right: 0;
		top: 16px;
		bottom: 0;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		pointer-events: none;
	}

	.line {
		height: 1px;
		background: var(--border-primary);
	}

	.line.base {
		background: var(--text-secondary);
		opacity: 0.4;
	}

	.columns {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 100%;
	}

	.column {
		position: relative;
		display: flex;
		flex: 1 1 0;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		height: 100%;
		padding: 0;
		border: none;
		background: none;
		cursor: default;
	}

	.cap {
		color: var(--text-secondary);
		font-size: var(--text-xs);
		line-height: 16px;
		font-variant-numeric: tabular-nums;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		max-width: 24px;
		/* The cap value shares the column, and without this a full-height bar gives way to it */
		flex-shrink: 0;
	}

	.seg {
		flex-basis: 0;
		min-height: 2px;
	}

	.seg.measured {
		background: var(--zone);
	}

	.seg.rest {
		background: color-mix(in srgb, var(--zone) 28%, var(--bg-primary));
	}

	/* The top of the bar is its data end, the baseline end stays square */
	.stack > .seg:first-child {
		border-radius: 4px 4px 0 0;
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		width: max-content;
		max-width: 220px;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-sm);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-size: var(--text-xs);
		line-height: 1.4;
		text-align: left;
		box-shadow: 0 2px 8px var(--shadow);
	}

	/* An edge column would push its bubble past the card, so the bubble hugs that edge */
	.column.first .tip {
		left: 0;
		transform: none;
	}

	.column.last .tip {
		left: auto;
		right: 0;
		transform: none;
	}

	.axis-name {
		grid-column: 1 / -1;
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}

	.ticks {
		grid-column: 2;
	}

	.ticks {
		display: flex;
		gap: 2px;
	}

	.tick {
		flex: 1 1 0;
		overflow: hidden;
		color: var(--text-secondary);
		font-size: var(--text-xs);
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.empty {
		margin: var(--space-sm) 0 0 0;
		color: var(--text-secondary);
		font-size: var(--text-sm);
	}

	.facts {
		display: flex;
		gap: var(--space-lg);
		margin: var(--space-md) 0 0 0;
	}

	.facts dt {
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}

	.facts dd {
		margin: 2px 0 0 0;
		color: var(--text-primary);
		font-size: var(--text-md);
		font-variant-numeric: tabular-nums;
	}

	.share {
		margin: var(--space-sm) 0 0 0;
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}

	.share.weak {
		color: var(--warning-text);
	}

	.od {
		margin-top: var(--space-xl);
	}

	.od-head {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.od-head h3 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--text-md);
		font-weight: 600;
		color: var(--text-primary);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border-primary);
		border-radius: var(--radius-md);
		background: var(--bg-primary);
	}

	table {
		border-collapse: collapse;
		width: 100%;
		font-size: var(--text-sm);
	}

	th,
	td {
		padding: var(--space-sm);
		text-align: left;
		white-space: nowrap;
	}

	thead th {
		color: var(--text-secondary);
		font-weight: 500;
		font-size: var(--text-xs);
		border-bottom: 1px solid var(--border-primary);
	}

	/* The heading has to stand over its own column of numbers, which are centred */
	.heat thead th {
		text-align: center;
	}

	.heat thead th.corner {
		text-align: left;
	}

	.heat th .dot,
	.numbers .dot {
		display: inline-block;
		margin-right: var(--space-xs);
		vertical-align: middle;
	}

	.heat tbody th {
		color: var(--text-primary);
		font-weight: 500;
	}

	.cell {
		text-align: center;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
	}

	.cell.step-1,
	.cell.step-2 {
		color: #101418;
	}

	.cell.step-3,
	.cell.step-4,
	.cell.step-5 {
		color: #ffffff;
	}

	.cell.step-1 {
		background: #82b2e8;
	}

	.cell.step-2 {
		background: #5b99de;
	}

	.cell.step-3 {
		background: #3878c6;
	}

	.cell.step-4 {
		background: #1d589d;
	}

	.cell.step-5 {
		background: #0c3a69;
	}

	/* The dark steps are chosen against the dark surface, not flipped from the light ones */
	:global(html.dark) .cell.step-1 {
		background: #345f8d;
		color: #ffffff;
	}

	:global(html.dark) .cell.step-2 {
		background: #3c71a6;
		color: #ffffff;
	}

	:global(html.dark) .cell.step-3 {
		background: #4585c1;
		color: #101418;
	}

	:global(html.dark) .cell.step-4 {
		background: #5499da;
		color: #101418;
	}

	:global(html.dark) .cell.step-5 {
		background: #6fb2f0;
		color: #101418;
	}

	.numbers .right,
	.right {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.numbers tbody tr:nth-child(odd) {
		background: var(--bg-secondary);
	}

	@media (max-width: 640px) {
		.content {
			padding: var(--space-sm);
		}

		.cards {
			grid-template-columns: 1fr;
		}
	}
</style>
