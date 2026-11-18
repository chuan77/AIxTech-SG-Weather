# Idea Intake: New features from data.gov.sg transport data

- **Slug**: sg-transport-data
- **Created**: 2026-11-18
- **Source**: https://data.gov.sg/datasets?topics=transport&resultId=d_e25662f1a062dd046453926aa284ba64 (host: data.gov.sg, policy: confirmed-by-user; fetched once, pinned to validated public address 172.66.149.179, HTTP 200, no redirects followed)
- **Type**: exploration

## Idea (as captured)

> "let research for new features to from https://data.gov.sg/datasets?topics=transport&resultId=d_e25662f1a062dd046453926aa284ba64 data"

The link opens data.gov.sg's **transport** topic with one dataset selected. What the fetched page showed, recorded as data:

- **Dataset**: "Taxi Availability", id `d_e25662f1a062dd046453926aa284ba64`, agency: Land Transport Authority. The page's citation reads "Land Transport Authority. (2016). Taxi Availability (2025) [Dataset]. data.gov.sg."
- **Format**: an API. Its embedded OpenAPI description lists `GET https://api.data.gov.sg/v1/transport/taxi-availability`, summarised as "Get locations of available taxis in Singapore".
- **What the endpoint says about itself**:
  - "Retrieved every 30 seconds from LTA's Datamall."
  - "The response is a valid **GeoJSON** which you could insert into a mapping tool like Leaflet."
  - "We recommend that this endpoint be called every minute."
  - Optional `date_time` parameter, `YYYY-MM-DD[T]HH:mm:ss (SGT)`.
  - Optional `x-api-key` header "for higher rate limits".
- **Response shape**: a GeoJSON `MultiPoint` of `[longitude, latitude]` positions, with `properties.timestamp` ("Time of acquisition of data from LTA's Datamall") and `properties.taxi_count` ("Total number of available taxis").
- The rest of the transport topic's dataset list loads in the browser and wasn't in the fetched HTML, so this intake doesn't know which other transport datasets exist.

## Restated

The owner wants to explore new features for the Lepak weather app built on Singapore's public transport datasets on data.gov.sg, starting from the LTA "Taxi Availability" feed: live positions and counts of available taxis island-wide.

## Origin & Context

- **Raised by**: repo owner (this session, 2026-11-18)
- **Trigger**: [NEEDS CLARIFICATION: what prompted it? For example, a user need such as "find a taxi when it rains", the app's move to public mobile users, or general curiosity about the data catalogue]
- **Related, for context only**: the app already pulls data.gov.sg weather data into a snapshot per saved place, with one constitution exception for an island-wide live layer (lightning, cached, refreshed only on a user's action). A separate, untracked assessment `flood-alerts/` also exists.

## First-Glance Unknowns

- [NEEDS CLARIFICATION: Is the scope taxi availability only, or the whole transport topic (for example carpark availability, traffic images, bus arrivals or road incidents, if data.gov.sg carries them)?]
- [NEEDS CLARIFICATION: What would the feature do for a weather app's users? Showing taxis near a saved place, linking taxi supply to rain, or something else?]
- [NEEDS CLARIFICATION: Is a transport feature in scope for a weather app ("Lepak")? Would it need a constitution amendment, given that a new island-wide data source requires one?]
- [NEEDS CLARIFICATION: Do the snapshot-only rule and the 2-minute cache fit a feed that updates every 30 seconds and recommends polling every minute?]
- [NEEDS CLARIFICATION: Rate limits, licence and terms of use for this dataset, and whether the existing `WEATHER_API_KEY` covers it]
- [NEEDS CLARIFICATION: Is the endpoint (`api.data.gov.sg/v1`) current, or is there a v2 equivalent like the weather APIs use?]
- [NEEDS CLARIFICATION: How many taxi points come back per call, and does that matter for the map's performance on phones?]
