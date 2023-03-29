// config.js
// get ram limit from env var
export const RSS_LOW_MEMORY_THRESHOLD = process.env.SENIMAN_RSS_LOW_MEMORY_THRESHOLD ? parseInt(process.env.SENIMAN_RSS_LOW_MEMORY_THRESHOLD) : 0;
export const RSS_LOW_MEMORY_THRESHOLD_ENABLED = RSS_LOW_MEMORY_THRESHOLD > 0;

if (RSS_LOW_MEMORY_THRESHOLD_ENABLED) {
  console.log('RSS_LOW_MEMORY_THRESHOLD enabled: ', RSS_LOW_MEMORY_THRESHOLD + 'MB');
}

// create RATELIMIT_WINDOW_INPUT_THRESHOLD from env var
export const RATELIMIT_WINDOW_INPUT_THRESHOLD = process.env.SENIMAN_RATELIMIT_WINDOW_INPUT_THRESHOLD ?
  parseInt(process.env.RATELIMIT_WINDOW_INPUT_THRESHOLD) : 16;
export const RATELIMIT_WINDOW_INPUT_TTL_SECONDS = process.env.SENIMAN_RATELIMIT_WINDOW_INPUT_TTL_SECONDS ?
  parseInt(process.env.RATELIMIT_WINDOW_INPUT_TTL_SECONDS) : 2;

// set default max input event buffer size to 4KB
export const MAX_INPUT_EVENT_BUFFER_SIZE = process.env.SENIMAN_MAX_INPUT_EVENT_BUFFER_SIZE ?
  parseInt(process.env.SENIMAN_MAX_INPUT_EVENT_BUFFER_SIZE) : 4096;

// create RATELIMIT_WINDOW_CREATION_THRESHOLD from env var
export const RATELIMIT_WINDOW_CREATION_THRESHOLD = process.env.SENIMAN_RATELIMIT_WINDOW_CREATION_TTL_SECONDS ?
  parseInt(process.env.SENIMAN_RATELIMIT_WINDOW_CREATION_TTL_SECONDS) : 3;
export const RATELIMIT_WINDOW_CREATION_TTL_SECONDS = process.env.SENIMAN_RATELIMIT_WINDOW_CREATION_TTL_SECONDS ?
  parseInt(process.env.SENIMAN_RATELIMIT_WINDOW_CREATION_TTL_SECONDS) : 1;
