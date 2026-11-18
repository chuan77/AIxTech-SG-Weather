import { join } from 'node:path';
import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import { createLocalAdapter, createTursoAdapter, type DatabaseAdapter } from './dbAdapter.js';
import { resolveDatabaseConfig, type DatabaseConfig } from './dbConfig.js';
import { logger } from './logger.js';
import { locations, visitors, type VisitorRow, type WeatherSnapshot } from './schema.js';

export interface LocationRecord {
  id: number;
  latitude: number;
  longitude: number;
  created_at: string;
  weather: WeatherSnapshot;
}

type LocationRow = typeof locations.$inferSelect;

const defaultWeather: WeatherSnapshot = {
  condition: 'Not refreshed',
  observed_at: null,
  source: 'not-refreshed',
  area: null,
  valid_period_text: null,
  temperature_c: null,
  humidity_percent: null,
  rainfall_mm: null,
  wind_speed_knots: null,
  wind_direction_degrees: null,
  forecast_low_c: null,
  forecast_high_c: null,
  uv_index: null,
  uv_hourly: null,
  psi_twenty_four_hourly: null,
  pm25_one_hourly: null,
  air_quality_region: null,
  pm10_twenty_four_hourly: null,
  o3_eight_hour_max: null,
  no2_one_hour_max: null,
  so2_twenty_four_hourly: null,
  co_eight_hour_max: null,
  air_quality_observed_at: null,
  wbgt_c: null,
  heat_stress_level: null,
  wbgt_station_name: null,
  wbgt_station_distance_km: null,
  wbgt_observed_at: null,
  forecast_periods: [],
  daily_forecast: [],
};

// Local file by default; the hosted Turso database when TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
// are set (see dbConfig.ts). If the database cannot be opened or migrated, log why and fail fast.
// Nothing is ever deleted or recreated, so existing saved locations are left untouched.
let adapter: DatabaseAdapter;

/** Where the database is, for logs: the local path, never a Turso URL or token. */
function describe(config: DatabaseConfig) {
  return config.kind === 'local'
    ? { kind: config.kind, databasePath: config.path }
    : { kind: config.kind };
}

async function countMigrations(): Promise<number> {
  const table = await adapter.query(
    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
    [],
    'get',
  );
  if (Number(table.rows?.[0] ?? 0) === 0) return 0;
  const applied = await adapter.query('SELECT count(*) FROM __drizzle_migrations', [], 'get');
  return Number(applied.rows?.[0] ?? 0);
}

async function openDatabase() {
  let config: DatabaseConfig | undefined;
  try {
    config = resolveDatabaseConfig(process.env, process.cwd());
    adapter =
      config.kind === 'local'
        ? createLocalAdapter(config.path)
        : createTursoAdapter(config.url, config.authToken);
    const database = drizzle(adapter.query, { schema: { locations, visitors } });
    const before = await countMigrations();
    await migrate(
      database,
      async (migrationQueries) => {
        await adapter.batch(migrationQueries.map((query) => query.trim()).filter(Boolean));
      },
      { migrationsFolder: join(process.cwd(), 'backend', 'drizzle') },
    );
    const migrationsApplied = (await countMigrations()) - before;
    logger.info({ ...describe(config), migrationsApplied }, 'database ready');
    return database;
  } catch (error) {
    logger.error(
      { err: error, ...(config ? describe(config) : {}) },
      'could not open or migrate the database',
    );
    throw error;
  }
}

const db = await openDatabase();

/** One visitor's saved places, newest first. Every location query is scoped to its owner (spec 013). */
export async function listLocations(visitorId: number): Promise<LocationRecord[]> {
  return (
    await db
      .select()
      .from(locations)
      .where(eq(locations.visitorId, visitorId))
      .orderBy(desc(locations.createdAt), desc(locations.id))
      .all()
  ).map(rowToRecord);
}

export async function createLocation(
  visitorId: number,
  latitude: number,
  longitude: number,
): Promise<LocationRecord> {
  const duplicate = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.visitorId, visitorId),
        eq(locations.latitude, latitude),
        eq(locations.longitude, longitude),
      ),
    )
    .get();

  if (duplicate) {
    throw duplicateLocationError();
  }

  const createdAt = timestamp(new Date());
  const weather = weatherToColumns(defaultWeather);
  try {
    const row = await db
      .insert(locations)
      .values({
        visitorId,
        latitude,
        longitude,
        createdAt,
        ...weather,
      })
      .returning()
      .get();

    return rowToRecord(row);
  } catch (error) {
    // A concurrent add can pass the pre-check; the unique index is the real guard.
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw duplicateLocationError();
    }
    throw error;
  }
}

function duplicateLocationError(): Error {
  const error = new Error('Location already exists');
  error.name = 'DuplicateLocationError';
  return error;
}

/** The row only if it belongs to this visitor; anyone else's row reads as missing (FR-004). */
function owned(visitorId: number, id: number) {
  return and(eq(locations.id, id), eq(locations.visitorId, visitorId));
}

export async function getLocation(visitorId: number, id: number): Promise<LocationRecord | null> {
  const row = await db.select().from(locations).where(owned(visitorId, id)).get();
  return row ? rowToRecord(row) : null;
}

export async function updateWeather(
  visitorId: number,
  id: number,
  weather: WeatherSnapshot,
): Promise<LocationRecord | null> {
  const columns = weatherToColumns(weather);
  const row = await db.update(locations).set(columns).where(owned(visitorId, id)).returning().get();

  return row ? rowToRecord(row) : null;
}

export async function deleteLocation(visitorId: number, id: number): Promise<boolean> {
  const row = await db
    .delete(locations)
    .where(owned(visitorId, id))
    .returning({ id: locations.id })
    .get();

  return row !== undefined;
}

/** `YYYY-MM-DDTHH:MM:SS` in UTC, the format of every stored date; sorts as text. */
export function timestamp(date: Date): string {
  return date.toISOString().slice(0, 19);
}

export async function findVisitorByHash(keyHash: string): Promise<number | null> {
  const row = await db
    .select({ id: visitors.id })
    .from(visitors)
    .where(eq(visitors.keyHash, keyHash))
    .get();
  return row?.id ?? null;
}

/** The visitor with this key hash, created if new. Safe when two first saves race. */
export async function ensureVisitorByHash(keyHash: string, now: Date): Promise<number> {
  const at = timestamp(now);
  await db
    .insert(visitors)
    .values({ keyHash, createdAt: at, lastUsedAt: at })
    .onConflictDoNothing({ target: visitors.keyHash })
    .run();
  const id = await findVisitorByHash(keyHash);
  if (id === null) throw new Error('visitor could not be created');
  return id;
}

/** Records a use, writing only when the stored time is older than `staleBefore` (one write an hour). */
export async function touchVisitorRow(id: number, now: Date, staleBefore: Date): Promise<void> {
  await db
    .update(visitors)
    .set({ lastUsedAt: timestamp(now) })
    .where(and(eq(visitors.id, id), lt(visitors.lastUsedAt, timestamp(staleBefore))))
    .run();
}

/**
 * Deletes visitors last used before `cutoff`, and their places first. Rows with no owner
 * (pre-spec-013, awaiting the owner's claim) are never touched. Makes no weather call.
 */
export async function purgeVisitorsUnusedSince(
  cutoff: Date,
): Promise<{ visitors: number; locations: number }> {
  const stale = (
    await db
      .select({ id: visitors.id })
      .from(visitors)
      .where(lt(visitors.lastUsedAt, timestamp(cutoff)))
      .all()
  ).map((row) => row.id);
  if (stale.length === 0) return { visitors: 0, locations: 0 };

  const removedLocations = await db
    .delete(locations)
    .where(inArray(locations.visitorId, stale))
    .returning({ id: locations.id })
    .all();
  const removedVisitors = await db
    .delete(visitors)
    .where(inArray(visitors.id, stale))
    .returning({ id: visitors.id })
    .all();
  return { visitors: removedVisitors.length, locations: removedLocations.length };
}

/**
 * Gives every unowned (pre-spec-013) place to one visitor, leaving any whose coordinates that
 * visitor already has. Running it again claims nothing new.
 */
export async function claimUnownedLocations(
  visitorId: number,
): Promise<{ claimed: number; skipped: number }> {
  const claimed = await db
    .update(locations)
    .set({ visitorId })
    .where(
      and(
        isNull(locations.visitorId),
        sql`NOT EXISTS (SELECT 1 FROM ${locations} AS mine WHERE mine.visitor_id = ${visitorId}
          AND mine.latitude = ${locations.latitude} AND mine.longitude = ${locations.longitude})`,
        // Unowned duplicates of one spot (possible once the global unique index is gone): claim
        // only the oldest, so the per-visitor unique index can't fail the whole update.
        sql`${locations.id} = (SELECT min(dup.id) FROM ${locations} AS dup
          WHERE dup.visitor_id IS NULL AND dup.latitude = ${locations.latitude}
          AND dup.longitude = ${locations.longitude})`,
      ),
    )
    .returning({ id: locations.id })
    .all();
  const skipped = await db
    .select({ n: count() })
    .from(locations)
    .where(isNull(locations.visitorId))
    .get();
  return { claimed: claimed.length, skipped: skipped?.n ?? 0 };
}

// Test helpers: read-only views and an unowned insert, so tests can check what no route exposes.
export async function getVisitorForTest(id: number): Promise<VisitorRow | undefined> {
  return db.select().from(visitors).where(eq(visitors.id, id)).get();
}

export async function countVisitorsForTest(): Promise<number> {
  return (await db.select({ n: count() }).from(visitors).get())?.n ?? 0;
}

export async function countUnownedLocationsForTest(): Promise<number> {
  return (
    (await db.select({ n: count() }).from(locations).where(isNull(locations.visitorId)).get())?.n ??
    0
  );
}

export function getDefaultWeatherForTest(): WeatherSnapshot {
  return { ...defaultWeather };
}

export async function insertUnownedLocationForTest(
  latitude: number,
  longitude: number,
  weather: WeatherSnapshot = defaultWeather,
): Promise<number> {
  const row = await db
    .insert(locations)
    .values({
      visitorId: null,
      latitude,
      longitude,
      createdAt: timestamp(new Date()),
      ...weatherToColumns(weather),
    })
    .returning({ id: locations.id })
    .get();
  return row.id;
}

export function closeDatabase(): void {
  adapter.close();
}

export async function resetStore(): Promise<void> {
  await db.delete(locations).run();
  await db.delete(visitors).run();
  await adapter.execute("DELETE FROM sqlite_sequence WHERE name IN ('locations', 'visitors')");
}

function weatherToColumns(weather: WeatherSnapshot) {
  return {
    condition: weather.condition,
    observedAt: weather.observed_at,
    source: weather.source,
    area: weather.area,
    validPeriodText: weather.valid_period_text,
    temperatureC: weather.temperature_c,
    humidityPercent: weather.humidity_percent,
    rainfallMm: weather.rainfall_mm,
    windSpeedKnots: weather.wind_speed_knots,
    windDirectionDegrees: weather.wind_direction_degrees,
    forecastLowC: weather.forecast_low_c,
    forecastHighC: weather.forecast_high_c,
    uvIndex: weather.uv_index,
    uvHourly: weather.uv_hourly,
    psiTwentyFourHourly: weather.psi_twenty_four_hourly,
    pm25OneHourly: weather.pm25_one_hourly,
    airQualityRegion: weather.air_quality_region,
    pm10TwentyFourHourly: weather.pm10_twenty_four_hourly,
    o3EightHourMax: weather.o3_eight_hour_max,
    no2OneHourMax: weather.no2_one_hour_max,
    so2TwentyFourHourly: weather.so2_twenty_four_hourly,
    coEightHourMax: weather.co_eight_hour_max,
    airQualityObservedAt: weather.air_quality_observed_at,
    wbgtC: weather.wbgt_c,
    heatStressLevel: weather.heat_stress_level,
    wbgtStationName: weather.wbgt_station_name,
    wbgtStationDistanceKm: weather.wbgt_station_distance_km,
    wbgtObservedAt: weather.wbgt_observed_at,
    forecastPeriods: weather.forecast_periods,
    dailyForecast: weather.daily_forecast,
  };
}

function rowToRecord(row: LocationRow): LocationRecord {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    created_at: row.createdAt,
    weather: {
      condition: row.condition,
      observed_at: row.observedAt,
      source: row.source,
      area: row.area,
      valid_period_text: row.validPeriodText,
      temperature_c: row.temperatureC,
      humidity_percent: row.humidityPercent,
      rainfall_mm: row.rainfallMm,
      wind_speed_knots: row.windSpeedKnots,
      wind_direction_degrees: row.windDirectionDegrees,
      forecast_low_c: row.forecastLowC,
      forecast_high_c: row.forecastHighC,
      uv_index: row.uvIndex,
      uv_hourly: row.uvHourly ?? null,
      psi_twenty_four_hourly: row.psiTwentyFourHourly,
      pm25_one_hourly: row.pm25OneHourly,
      air_quality_region: row.airQualityRegion,
      pm10_twenty_four_hourly: row.pm10TwentyFourHourly,
      o3_eight_hour_max: row.o3EightHourMax,
      no2_one_hour_max: row.no2OneHourMax,
      so2_twenty_four_hourly: row.so2TwentyFourHourly,
      co_eight_hour_max: row.coEightHourMax,
      air_quality_observed_at: row.airQualityObservedAt,
      wbgt_c: row.wbgtC,
      heat_stress_level: row.heatStressLevel,
      wbgt_station_name: row.wbgtStationName,
      wbgt_station_distance_km: row.wbgtStationDistanceKm,
      wbgt_observed_at: row.wbgtObservedAt,
      forecast_periods: row.forecastPeriods,
      daily_forecast: row.dailyForecast,
    },
  };
}
